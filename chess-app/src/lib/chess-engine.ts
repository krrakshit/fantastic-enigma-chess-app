import { useState, useCallback } from "react";
import { Chess, type Square, type Move, type PieceSymbol, type Color } from "chess.js";

export type PieceType = PieceSymbol;
export type PieceColor = Color;

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
}

export interface SquareInfo {
  square: Square;
  piece: ChessPiece | null;
  isLight: boolean;
}

export type BoardState = SquareInfo[][];

export type GameStatus =
  | "playing"
  | "check"
  | "checkmate"
  | "stalemate"
  | "draw"
  | "threefold"
  | "insufficient";

export interface MoveResult {
  success: boolean;
  move?: Move;
  error?: string;
}

export interface ChessGameState {
  board: BoardState;
  turn: PieceColor;
  gameStatus: GameStatus;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  moveHistory: Move[];
  lastMove: Move | null;
  capturedPieces: { w: ChessPiece[]; b: ChessPiece[] };
  makeMove: (from: Square, to: Square, promotion?: PieceType) => MoveResult;
  legalMoves: (square: Square) => Square[];
  undo: () => void;
  reset: () => void;
  isPromoting: (from: Square, to: Square) => boolean;
}

function getSquareColor(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}

function boardToState(game: Chess): BoardState {
  const board: BoardState = [];
  for (let row = 0; row < 8; row++) {
    const rank: SquareInfo[] = [];
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
      // The captured piece belongs to the opposite color of the mover
      const capturedColor = move.color === "w" ? "b" : "w";
      captured[capturedColor].push({
        type: move.captured as PieceType,
        color: capturedColor,
      });
    }
  }
  return captured;
}

export function useChessGame(): ChessGameState {
  const [game] = useState(() => new Chess());
  const [, forceUpdate] = useState(0);

  const refresh = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  const board = boardToState(game);
  const history = game.history({ verbose: true });
  const gameStatus = getGameStatus(game);

  const makeMove = useCallback(
    (from: Square, to: Square, promotion?: PieceType): MoveResult => {
      try {
        const move = game.move({ from, to, promotion: promotion || "q" });
        if (move) {
          refresh();
          return { success: true, move };
        }
        return { success: false, error: "Invalid move" };
      } catch (e: any) {
        return { success: false, error: e.message || "Invalid move" };
      }
    },
    [game, refresh]
  );

  const legalMoves = useCallback(
    (square: Square): Square[] => {
      const moves = game.moves({ square, verbose: true });
      return moves.map((m) => m.to);
    },
    [game]
  );

  const undo = useCallback(() => {
    game.undo();
    refresh();
  }, [game, refresh]);

  const reset = useCallback(() => {
    game.reset();
    refresh();
  }, [game, refresh]);

  const isPromoting = useCallback(
    (from: Square, to: Square): boolean => {
      const piece = game.get(from);
      if (!piece || piece.type !== "p") return false;
      const toRank = parseInt(to[1]);
      return (piece.color === "w" && toRank === 8) || (piece.color === "b" && toRank === 1);
    },
    [game]
  );

  return {
    board,
    turn: game.turn(),
    gameStatus,
    isCheck: game.inCheck(),
    isCheckmate: game.isCheckmate(),
    isStalemate: game.isStalemate(),
    isDraw: game.isDraw(),
    moveHistory: history,
    lastMove: history.length > 0 ? history[history.length - 1] : null,
    capturedPieces: getCapturedPieces(history),
    makeMove,
    legalMoves,
    undo,
    reset,
    isPromoting,
  };
}
