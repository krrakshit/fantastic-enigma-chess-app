import { useState, useCallback, useEffect } from "react";
import { Chess, type Square, type Move } from "chess.js";
import type {
  ChessGameState,
  BoardState,
  GameStatus,
  ChessPiece,
  MoveResult,
  PieceType,
  PieceColor,
} from "./chess-engine";
import { useWebSocket, type WsStatus } from "./websocket-context";

// ─── Internal helpers ──────────────────────────────────────────────────────────

function getSquareColor(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}

function boardToState(game: Chess): BoardState {
  const board: BoardState = [];
  for (let row = 0; row < 8; row++) {
    const rank = [];
    for (let col = 0; col < 8; col++) {
      const file = String.fromCharCode(97 + col);
      const rankNum = 8 - row;
      const square = `${file}${rankNum}` as Square;
      const piece = game.get(square);
      rank.push({
        square,
        piece: piece ? { type: piece.type, color: piece.color } : null,
        isLight: getSquareColor(row, col),
      });
    }
    board.push(rank);
  }
  return board;
}

function getGameStatus(game: Chess): GameStatus {
  if (game.isCheckmate()) return "checkmate";
  if (game.isStalemate()) return "stalemate";
  if (game.isThreefoldRepetition()) return "threefold";
  if (game.isInsufficientMaterial()) return "insufficient";
  if (game.isDraw()) return "draw";
  if (game.inCheck()) return "check";
  return "playing";
}

function getCapturedPieces(history: Move[]): { w: ChessPiece[]; b: ChessPiece[] } {
  const captured: { w: ChessPiece[]; b: ChessPiece[] } = { w: [], b: [] };
  for (const move of history) {
    if (move.captured) {
      const capturedColor = move.color === "w" ? "b" : "w";
      captured[capturedColor].push({
        type: move.captured as PieceType,
        color: capturedColor,
      });
    }
  }
  return captured;
}

// ─── Public types ──────────────────────────────────────────────────────────────

export interface MultiplayerGameState extends ChessGameState {
  /** The color assigned to the local player */
  myColor: PieceColor | null;
  /** Whether it is currently the local player's turn */
  isMyTurn: boolean;
  /** WebSocket connection status (from the global context) */
  connectionStatus: WsStatus;
  /** Opponent's player ID */
  opponentId: string | null;
  /** Latest server error message, if any */
  errorMessage: string | null;
}

export interface GameRoomData {
  roomId: string;
  player1Id: string;
  player2Id: string;
  currentPlayerId: string;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages the chess game state for a live multiplayer room.
 *
 * Critically, it does NOT create a new WebSocket. Instead it reads the
 * GLOBAL, persistent socket from `WebSocketContext` (the same socket that
 * was used in the lobby to match the players). This ensures the server
 * keeps the correct socket reference for the room.
 */
export function useChessWebSocket(
  roomData: GameRoomData | null
): MultiplayerGameState {
  // ── Global WS (shared with lobby) ──────────────────────────────────────
  const { send, addListener, status } = useWebSocket();

  // ── Local chess state ───────────────────────────────────────────────────
  const [chess] = useState(() => new Chess());
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Derive player color from room data
  const myColor: PieceColor | null = roomData
    ? roomData.currentPlayerId === roomData.player1Id
      ? "w"
      : "b"
    : null;

  const opponentId: string | null = roomData
    ? myColor === "w"
      ? roomData.player2Id
      : roomData.player1Id
    : null;

  // ── Subscribe to incoming opponent moves ───────────────────────────────
  useEffect(() => {
    if (!roomData) return;

    const unsub = addListener((msg) => {
      if (msg.type === "move" && msg.move) {
        // Apply the opponent's move to our local chess instance
        try {
          chess.move({
            from: msg.move.from as Square,
            to: msg.move.to as Square,
          });
          refresh();
        } catch {
          // Server sent an illegal move — should never happen, just ignore
        }
      } else if (msg.type === "error") {
        setErrorMessage(msg.message ?? "Server error");
        // Auto-clear after 3 s
        setTimeout(() => setErrorMessage(null), 3000);
      }
    });

    return unsub; // removes this handler when the component unmounts
  }, [roomData?.roomId, addListener, chess, refresh]);

  // ── makeMove ────────────────────────────────────────────────────────────
  const makeMove = useCallback(
    (from: Square, to: Square, promotion?: PieceType): MoveResult => {
      // Guard: only let the local player move on their turn
      if (!myColor || chess.turn() !== myColor) {
        return { success: false, error: "Not your turn" };
      }
      try {
        const move = chess.move({ from, to, promotion: promotion ?? "q" });
        if (move) {
          // Push move to the server so it can relay it to the opponent
          if (roomData) {
            send({
              content: "move",
              uid: roomData.currentPlayerId,
              move: {
                roomID: roomData.roomId,
                playerID: roomData.currentPlayerId,
                piece: move.piece,
                from,
                to,
              },
            });
          }
          refresh();
          return { success: true, move };
        }
        return { success: false, error: "Invalid move" };
      } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : "Invalid move" };
      }
    },
    [chess, myColor, roomData, send, refresh]
  );

  // ── legalMoves ──────────────────────────────────────────────────────────
  const legalMoves = useCallback(
    (square: Square): Square[] =>
      chess.moves({ square, verbose: true }).map((m) => m.to),
    [chess]
  );

  // ── undo / reset (disabled in multiplayer) ─────────────────────────────
  const undo = useCallback(() => {}, []);
  const reset = useCallback(() => {}, []);

  // ── isPromoting ─────────────────────────────────────────────────────────
  const isPromoting = useCallback(
    (from: Square, to: Square): boolean => {
      const piece = chess.get(from);
      if (!piece || piece.type !== "p") return false;
      const toRank = parseInt(to[1]);
      return (
        (piece.color === "w" && toRank === 8) ||
        (piece.color === "b" && toRank === 1)
      );
    },
    [chess]
  );

  // ── Assemble state ──────────────────────────────────────────────────────
  const history = chess.history({ verbose: true });

  return {
    board: boardToState(chess),
    turn: chess.turn(),
    gameStatus: getGameStatus(chess),
    isCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    moveHistory: history,
    lastMove: history.length > 0 ? history[history.length - 1] : null,
    capturedPieces: getCapturedPieces(history),
    makeMove,
    legalMoves,
    undo,
    reset,
    isPromoting,
    // Multiplayer-specific
    myColor,
    isMyTurn: myColor !== null && chess.turn() === myColor,
    connectionStatus: status,
    opponentId,
    errorMessage,
  };
}
