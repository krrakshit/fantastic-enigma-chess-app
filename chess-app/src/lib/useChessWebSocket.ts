import { useState, useCallback, useEffect, useRef } from "react";
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

// ─── Module-level constants ────────────────────────────────────────────────────
const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

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

function getCapturedPieces(history: Move[]): {
  w: ChessPiece[];
  b: ChessPiece[];
} {
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

export interface GameResult {
  winner: string | null;
  runnerup: string | null;
  winnerPoints: number;
  runnerupPoints: number;
  myPoints: number;
  opponentPoints: number;
  totalMoves: number;
  status: string;
  roomId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

/** Initial time per player in milliseconds (10 minutes) */
export const INITIAL_TIME_MS = 10 * 60 * 1000;

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
  /** Running point totals */
  myPoints: number;
  opponentPoints: number;
  /** Populated when server sends game_over */
  gameResult: GameResult | null;
  /** ISO timestamp of the first move (null before game starts) */
  gameStartedAt: string | null;
  /** Remaining time for white in ms */
  whiteTime: number;
  /** Remaining time for black in ms */
  blackTime: number;
  /** Time taken per move in ms (index matches moveHistory) */
  moveTimes: number[];
  /** Chat messages exchanged during the game */
  chatMessages: ChatMessage[];
  /** Send a chat message to the opponent */
  sendChat: (message: string) => void;
}

export interface ChatMessage {
  senderID: string;
  message: string;
  timestamp: number;
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
  roomData: GameRoomData | null,
): MultiplayerGameState {
  // ── Global WS (shared with lobby) ──────────────────────────────────────
  const { send, addListener, status } = useWebSocket();

  // ── Local chess state ───────────────────────────────────────────────────
  const [chess] = useState(() => {
    // Restore board from localStorage if a matching saved state exists
    if (roomData) {
      try {
        const raw = localStorage.getItem("chessGameState");
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.roomId === roomData.roomId && saved.fen) {
            const restored = new Chess(saved.fen);
            return restored;
          }
        }
      } catch { /* fallback to new game */ }
    }
    return new Chess();
  });
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);
  // moveStartTime is null until the first move — prevents huge initial elapsed values
  const moveStartTime = useRef<number | null>(null);
  const gameStartTime = useRef<number | null>(null); // set on first move

  // Restore point totals from localStorage if available
  const _getSavedPoints = () => {
    if (roomData) {
      try {
        const raw = localStorage.getItem("chessGameState");
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.roomId === roomData.roomId) {
            return { my: saved.myPoints ?? 0, opp: saved.opponentPoints ?? 0 };
          }
        }
      } catch { /* ignore */ }
    }
    return { my: 0, opp: 0 };
  };
  const _initPoints = _getSavedPoints();
  const myPointsRef = useRef<number>(_initPoints.my);
  const opponentPointsRef = useRef<number>(_initPoints.opp);
  const [myPoints, setMyPoints] = useState<number>(_initPoints.my);
  const [opponentPoints, setOpponentPoints] = useState<number>(_initPoints.opp);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Move times (ms per move, index matches moveHistory) ───────────────
  const _getSavedMoveTimes = () => {
    if (roomData) {
      try {
        const raw = localStorage.getItem("chessGameState");
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.roomId === roomData.roomId && Array.isArray(saved.moveTimes)) {
            return saved.moveTimes as number[];
          }
        }
      } catch { /* ignore */ }
    }
    return [] as number[];
  };
  const moveTimesRef = useRef<number[]>(_getSavedMoveTimes());
  const [moveTimes, setMoveTimes] = useState<number[]>(moveTimesRef.current);

  // ── Chat messages ─────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // ── Chess clock state ─────────────────────────────────────────────────
  const _getSavedTimes = () => {
    if (roomData) {
      try {
        const raw = localStorage.getItem("chessGameState");
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.roomId === roomData.roomId) {
            return {
              w: saved.whiteTime ?? INITIAL_TIME_MS,
              b: saved.blackTime ?? INITIAL_TIME_MS,
            };
          }
        }
      } catch { /* ignore */ }
    }
    return { w: INITIAL_TIME_MS, b: INITIAL_TIME_MS };
  };
  const _initTimes = _getSavedTimes();
  const whiteTimeRef = useRef<number>(_initTimes.w);
  const blackTimeRef = useRef<number>(_initTimes.b);
  const [whiteTime, setWhiteTime] = useState<number>(_initTimes.w);
  const [blackTime, setBlackTime] = useState<number>(_initTimes.b);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // Start / stop the countdown interval based on whose turn it is
  // Timer only runs after the FIRST move (white plays) so it begins on black's first turn
  const moveCount = chess.history().length;
  const gameHasStarted = moveCount > 0;
  useEffect(() => {
    // Don't tick before any move is made or after the game ends
    const isOver = chess.isCheckmate() || chess.isStalemate() || chess.isDraw();
    if (!gameHasStarted || isOver) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      if (chess.turn() === "w") {
        whiteTimeRef.current = Math.max(0, whiteTimeRef.current - delta);
        setWhiteTime(whiteTimeRef.current);
      } else {
        blackTimeRef.current = Math.max(0, blackTimeRef.current - delta);
        setBlackTime(blackTimeRef.current);
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // Re-run whenever the move count changes (turn switches) or game ends
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount, chess.isCheckmate(), chess.isStalemate(), chess.isDraw()]);

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

  // ── Persist game state to localStorage ────────────────────────────────
  /**
   * Saves the full game state (FEN + move history + room info) to localStorage
   * after every move. This allows the game to be restored if the WebSocket
   * connection is lost and the page is refreshed.
   */
  const persistGameState = useCallback(
    (currentChess: Chess) => {
      if (!roomData) return;
      try {
        const history = currentChess.history({ verbose: true });
        const gameState = {
          // Room meta
          roomId: roomData.roomId,
          player1Id: roomData.player1Id,
          player2Id: roomData.player2Id,
          currentPlayerId: roomData.currentPlayerId,
          // FEN for direct board restore
          fen: currentChess.fen(),
          // Full move list so UI can replay or display history
          moves: history.map((m) => ({
            from: m.from,
            to: m.to,
            piece: m.piece,
            promotion: m.promotion,
            captured: m.captured,
            san: m.san,
            color: m.color,
          })),
          // Point snapshots
          myPoints: myPointsRef.current,
          opponentPoints: opponentPointsRef.current,
          // Clock snapshots
          whiteTime: whiteTimeRef.current,
          blackTime: blackTimeRef.current,
          // Move times
          moveTimes: moveTimesRef.current,
          // Timestamps
          savedAt: new Date().toISOString(),
          gameStartedAt: gameStartTime.current
            ? new Date(gameStartTime.current).toISOString()
            : null,
        };
        localStorage.setItem("chessGameState", JSON.stringify(gameState));
        // Keep legacy "gameData" key in sync for other parts of the app
        localStorage.setItem(
          "gameData",
          JSON.stringify({
            roomId: roomData.roomId,
            player1Id: roomData.player1Id,
            player2Id: roomData.player2Id,
            currentPlayerId: roomData.currentPlayerId,
          }),
        );
      } catch {
        /* storage might be full — ignore */
      }
    },
    [roomData],
  );

  // ── Subscribe to incoming opponent moves ───────────────────────────────
  useEffect(() => {
    if (!roomData) return;

    const unsub = addListener((msg) => {
      if (msg.type === "move" && msg.move) {
        // Apply the opponent's move, including promotion if present
        try {
          const movePayload: { from: Square; to: Square; promotion?: string } = {
            from: msg.move.from as Square,
            to: msg.move.to as Square,
          };
          // Only pass promotion when it's a valid promotion piece
          if (msg.move.promotion && ["q", "r", "b", "n"].includes(msg.move.promotion)) {
            movePayload.promotion = msg.move.promotion;
          }
          chess.move(movePayload);
          if (msg.move.points) {
            opponentPointsRef.current += msg.move.points;
            setOpponentPoints(opponentPointsRef.current);
          }
          // Record opponent's move time
          moveTimesRef.current = [...moveTimesRef.current, msg.move.time ?? 0];
          setMoveTimes(moveTimesRef.current);
          // Reset move start time so our next move's elapsed is relative
          moveStartTime.current = Date.now();
          // Persist state after opponent move
          persistGameState(chess);
          refresh();
        } catch {
          // Server sent an illegal move — should never happen, just ignore
        }
      } else if (msg.type === "game_over") {
        const myPts = myPointsRef.current;
        const oppPts = opponentPointsRef.current;
        const endedAt = new Date();
        const startedAt = gameStartTime.current
          ? new Date(gameStartTime.current)
          : endedAt;
        const durationSeconds = Math.round(
          (endedAt.getTime() - startedAt.getTime()) / 1000,
        );
        const result: GameResult = {
          winner: msg.winner ?? null,
          runnerup: msg.runnerup ?? null,
          winnerPoints: msg.winnerPoints ?? 0,
          runnerupPoints: msg.runnerupPoints ?? 0,
          myPoints: myPts,
          opponentPoints: oppPts,
          totalMoves: chess.history().length,
          status: "checkmate",
          roomId: msg.roomId ?? roomData?.roomId ?? "",
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds,
        };
        setGameResult(result);
        // Persist full game result — clear game state on finish
        try {
          const raw = localStorage.getItem("gameData");
          const session = raw ? JSON.parse(raw) : {};
          localStorage.setItem(
            "gameResult",
            JSON.stringify({ ...session, ...result }),
          );
          // Clear in-progress state now that the game is over
          localStorage.removeItem("chessGameState");
        } catch {
          /* ignore */
        }
      } else if (msg.type === "chat") {
        setChatMessages((prev) => [
          ...prev,
          { senderID: msg.senderID, message: msg.message, timestamp: Date.now() },
        ]);
      } else if (msg.type === "error") {
        setErrorMessage(msg.message ?? "Server error");
        // Auto-clear after 3 s
        setTimeout(() => setErrorMessage(null), 3000);
      }
    });

    return unsub; // removes this handler when the component unmounts
  }, [roomData?.roomId, addListener, chess, refresh, persistGameState]);

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
            const now = Date.now();
            if (gameStartTime.current === null) gameStartTime.current = now;
            // First move: elapsed is 0 (no prior reference point)
            const elapsed = moveStartTime.current !== null
              ? now - moveStartTime.current
              : 0;
            moveStartTime.current = now;
            const points = move.captured
              ? (PIECE_VALUES[move.captured] ?? 0)
              : 0;
            if (points > 0) {
              myPointsRef.current += points;
              setMyPoints(myPointsRef.current);
            }
            // Record my move time
            moveTimesRef.current = [...moveTimesRef.current, elapsed];
            setMoveTimes(moveTimesRef.current);
            // Persist game state after our own move
            persistGameState(chess);
            send({
              content: "move",
              uid: roomData.currentPlayerId,
              move: {
                roomID: roomData.roomId,
                playerID: roomData.currentPlayerId,
                piece: move.piece,
                from,
                to,
                time: elapsed,
                points,
                // Only include promotion when it's actually a promotion move
                promotion: promotion ?? undefined,
              },
            });
          }
          refresh();
          return { success: true, move };
        }
        return { success: false, error: "Invalid move" };
      } catch (e: unknown) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Invalid move",
        };
      }
    },
    [chess, myColor, roomData, send, refresh],
  );

  // ── legalMoves ──────────────────────────────────────────────────────────
  const legalMoves = useCallback(
    (square: Square): Square[] =>
      chess.moves({ square, verbose: true }).map((m) => m.to),
    [chess],
  );

  // ── sendChat ─────────────────────────────────────────────────────────
  const sendChat = useCallback(
    (message: string) => {
      if (!roomData || !message.trim()) return;
      const trimmed = message.trim();
      send({
        content: {
          roomID: roomData.roomId,
          senderID: roomData.currentPlayerId,
          message: trimmed,
        },
        uid: roomData.currentPlayerId,
      });
      setChatMessages((prev) => [
        ...prev,
        { senderID: roomData.currentPlayerId, message: trimmed, timestamp: Date.now() },
      ]);
    },
    [roomData, send],
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
    [chess],
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
    myPoints,
    opponentPoints,
    gameResult,
    gameStartedAt: gameStartTime.current
      ? new Date(gameStartTime.current).toISOString()
      : null,
    whiteTime,
    blackTime,
    moveTimes,
    chatMessages,
    sendChat,
  };
}
