import { useState, useCallback, useMemo, useEffect } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Square } from "chess.js";
import type {
  ChessGameState,
  PieceType,
  PieceColor,
} from "../lib/chess-engine";
import { PieceSVG } from "../lib/piece-svgs";

// --- Theme Config ---
export interface BoardTheme {
  lightSquare: string;
  darkSquare: string;
  selectedSquare: string;
  legalMoveIndicator: string;
  lastMoveHighlight: string;
  checkHighlight: string;
  boardBorder: string;
  boardBorderWidth: number;
  boardShadow: string;
  pieceSize: number;
  squareSize: number;
  coordinateColor: string;
  coordinateFontFamily: string;
}

export const DEFAULT_THEME: BoardTheme = {
  lightSquare: "#EED5AA",
  darkSquare: "#AE7B52",
  selectedSquare: "rgba(245, 185, 66, 0.55)",
  legalMoveIndicator: "rgba(0, 0, 0, 0.22)",
  lastMoveHighlight: "rgba(245, 158, 11, 0.32)",
  checkHighlight: "rgba(239, 68, 68, 0.55)",
  boardBorder: "#4A2C10",
  boardBorderWidth: 4,
  boardShadow: "0 12px 40px rgba(0,0,0,0.45), 0 0 60px rgba(245,158,11,0.03)",
  pieceSize: 60,
  squareSize: 72,
  coordinateColor: "#5D3A1A",
  coordinateFontFamily: "'Space Grotesk', serif",
};

// --- Detect touch device ---
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(
      "ontouchstart" in window || navigator.maxTouchPoints > 0
    );
  }, []);
  return isTouch;
}

// --- Draggable Piece ---
function DraggablePiece({
  square,
  type,
  color,
  size,
  isDragging,
  onTap,
  isTouchDevice,
}: {
  square: string;
  type: PieceType;
  color: PieceColor;
  size: number;
  isDragging: boolean;
  onTap: (sq: string) => void;
  isTouchDevice: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: square,
    data: { type, color, square },
  });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    cursor: isTouchDevice ? "pointer" : "grab",
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 0 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    position: "relative",
    touchAction: "none", // Prevents browser scroll on drag
  };

  // On touch devices, clicks are the primary interaction
  const handleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      onTap(square);
    },
    [onTap, square],
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isTouchDevice ? {} : listeners)}
      {...attributes}
      onClick={handleClick}
    >
      <PieceSVG type={type} color={color} size={size} />
    </div>
  );
}

// --- Droppable Square ---
function DroppableSquare({
  square,
  isLight,
  theme,
  children,
  isSelected,
  isLegalMove,
  isLastMove,
  isCheck,
  showCoords,
  row,
  col,
  onSquareClick,
}: {
  square: string;
  isLight: boolean;
  theme: BoardTheme;
  children: React.ReactNode;
  isSelected: boolean;
  isLegalMove: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  showCoords: boolean;
  row: number;
  col: number;
  onSquareClick: (sq: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: square });

  let bg = isLight ? theme.lightSquare : theme.darkSquare;
  if (isLastMove) bg = theme.lastMoveHighlight;
  if (isSelected) bg = theme.selectedSquare;
  if (isCheck) bg = theme.checkHighlight;

  const squareStyle: React.CSSProperties = {
    width: theme.squareSize,
    height: theme.squareSize,
    backgroundColor: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    transition: "background-color 0.15s ease",
    boxShadow: isOver ? `inset 0 0 0 3px ${theme.selectedSquare}` : undefined,
    cursor: isLegalMove ? "pointer" : undefined,
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={squareStyle}
      onClick={(e) => {
        e.stopPropagation();
        onSquareClick(square);
      }}
    >
      {children}
      {isLegalMove && (
        <div
          style={{
            position: "absolute",
            width: children ? "90%" : "30%",
            height: children ? "90%" : "30%",
            borderRadius: children ? "4px" : "50%",
            backgroundColor: children
              ? "transparent"
              : theme.legalMoveIndicator,
            border: children ? `3px solid ${theme.legalMoveIndicator}` : "none",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}
      {showCoords && col === 0 && (
        <span
          style={{
            position: "absolute",
            top: 2,
            left: 4,
            fontSize: Math.max(9, theme.squareSize * 0.15),
            fontWeight: 600,
            color: theme.coordinateColor,
            fontFamily: theme.coordinateFontFamily,
            pointerEvents: "none",
            opacity: 0.7,
          }}
        >
          {8 - row}
        </span>
      )}
      {showCoords && row === 7 && (
        <span
          style={{
            position: "absolute",
            bottom: 2,
            right: 4,
            fontSize: Math.max(9, theme.squareSize * 0.15),
            fontWeight: 600,
            color: theme.coordinateColor,
            fontFamily: theme.coordinateFontFamily,
            pointerEvents: "none",
            opacity: 0.7,
          }}
        >
          {String.fromCharCode(97 + col)}
        </span>
      )}
    </div>
  );
}

// --- Promotion Dialog ---
function PromotionDialog({
  color,
  onSelect,
  theme,
}: {
  color: PieceColor;
  onSelect: (piece: PieceType) => void;
  theme: BoardTheme;
}) {
  const pieces: PieceType[] = ["q", "r", "b", "n"];
  const btnSize = Math.min(72, theme.squareSize);
  const iconSize = btnSize * 0.78;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #181820, #22222e)",
          borderRadius: 16,
          padding: 20,
          display: "flex",
          gap: 12,
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {pieces.map((p) => (
          <button
            key={p}
            onClick={() => onSelect(p)}
            style={{
              width: btnSize,
              height: btnSize,
              border: "2px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.borderColor = "rgba(245,158,11,0.5)";
              (e.target as HTMLElement).style.transform = "scale(1.1)";
              (e.target as HTMLElement).style.background = "rgba(245,158,11,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
              (e.target as HTMLElement).style.transform = "scale(1)";
              (e.target as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            }}
          >
            <PieceSVG type={p} color={color} size={iconSize} />
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Main ChessBoard Component ---
export interface ChessBoardProps {
  game?: ChessGameState;
  theme?: Partial<BoardTheme>;
  showCoordinates?: boolean;
  flipped?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** If true, no moves can be made (used in multiplayer when it's opponent's turn) */
  disabled?: boolean;
}

export function ChessBoard({
  game,
  theme: themeOverride,
  showCoordinates = true,
  flipped = false,
  className,
  style,
  disabled = false,
}: ChessBoardProps) {
  const theme = useMemo(
    () => ({ ...DEFAULT_THEME, ...themeOverride }),
    [themeOverride],
  );

  const isTouchDevice = useIsTouchDevice();

  if(!game) {
    return 
  }
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  // Use both PointerSensor and TouchSensor for better cross-device support
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150,
      tolerance: 8,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);

  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  // Click-to-move handler (primary for mobile, also works on desktop)
  const handleSquareClick = useCallback(
    (sq: string) => {
      if (disabled) return;
      const square = sq as Square;

      // If a piece is selected and this square is a legal target => make the move
      if (selectedSquare && legalTargets.includes(square)) {
        if (game.isPromoting(selectedSquare, square)) {
          setPromotion({ from: selectedSquare, to: square });
        } else {
          game.makeMove(selectedSquare, square);
        }
        setSelectedSquare(null);
        setLegalTargets([]);
        return;
      }

      // Check if there's a piece on this square belonging to the current turn
      let hasPiece = false;
      for (const row of game.board) {
        for (const s of row) {
          if (s.square === square && s.piece && s.piece.color === game.turn) {
            hasPiece = true;
            break;
          }
        }
        if (hasPiece) break;
      }

      if (hasPiece) {
        // Select this piece
        setSelectedSquare(square);
        setLegalTargets(game.legalMoves(square));
      } else {
        // Clicked empty square or opponent piece => deselect
        setSelectedSquare(null);
        setLegalTargets([]);
      }
    },
    [game, disabled, selectedSquare, legalTargets],
  );

  // Piece tap handler (same as square click but for the piece overlay)
  const handlePieceTap = useCallback(
    (sq: string) => {
      handleSquareClick(sq);
    },
    [handleSquareClick],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (disabled) return;
      const sq = event.active.id as Square;
      setActiveId(sq);
      setSelectedSquare(sq);
      setLegalTargets(game.legalMoves(sq));
    },
    [game, disabled],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      if (!event.over) {
        setSelectedSquare(null);
        setLegalTargets([]);
        return;
      }

      const from = event.active.id as Square;
      const to = event.over.id as Square;

      if (game.isPromoting(from, to)) {
        setPromotion({ from, to });
      } else {
        game.makeMove(from, to);
      }

      setSelectedSquare(null);
      setLegalTargets([]);
    },
    [game],
  );

  const handlePromotion = useCallback(
    (piece: PieceType) => {
      if (promotion) {
        game.makeMove(promotion.from, promotion.to, piece);
        setPromotion(null);
      }
    },
    [game, promotion],
  );

  // Determine which piece is the king in check
  const kingInCheckSquare = useMemo(() => {
    if (!game.isCheck) return null;
    for (const row of game.board) {
      for (const sq of row) {
        if (sq.piece?.type === "k" && sq.piece.color === game.turn) {
          return sq.square;
        }
      }
    }
    return null;
  }, [game.board, game.isCheck, game.turn]);

  const boardRows = flipped
    ? [...game.board].reverse().map((r) => [...r].reverse())
    : game.board;

  const draggedPiece = useMemo(() => {
    if (!activeId) return null;
    for (const row of game.board) {
      for (const sq of row) {
        if (sq.square === activeId && sq.piece) return sq.piece;
      }
    }
    return null;
  }, [activeId, game.board]);

  const boardSize = theme.squareSize * 8 + theme.boardBorderWidth * 2;

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className={className}
          style={{
            display: "inline-block",
            border: `${theme.boardBorderWidth}px solid ${theme.boardBorder}`,
            borderRadius: 4,
            boxShadow: theme.boardShadow,
            lineHeight: 0,
            width: boardSize,
            touchAction: "none", // Prevent browser gestures on the board
            ...style,
          }}
        >
          {boardRows.map((row, rowIdx) => (
            <div key={rowIdx} style={{ display: "flex" }}>
              {row.map((sq, colIdx) => {
                const isSelected = selectedSquare === sq.square;
                const isLegalTarget = legalTargets.includes(sq.square);
                const isLastMoveFrom = game.lastMove?.from === sq.square;
                const isLastMoveTo = game.lastMove?.to === sq.square;
                const isKingCheck = kingInCheckSquare === sq.square;

                return (
                  <DroppableSquare
                    key={sq.square}
                    square={sq.square}
                    isLight={sq.isLight}
                    theme={theme}
                    isSelected={isSelected}
                    isLegalMove={isLegalTarget}
                    isLastMove={isLastMoveFrom || isLastMoveTo}
                    isCheck={isKingCheck}
                    showCoords={showCoordinates}
                    row={flipped ? 7 - rowIdx : rowIdx}
                    col={flipped ? 7 - colIdx : colIdx}
                    onSquareClick={handleSquareClick}
                  >
                    {sq.piece && (
                      <DraggablePiece
                        square={sq.square}
                        type={sq.piece.type}
                        color={sq.piece.color}
                        size={theme.pieceSize}
                        isDragging={activeId === sq.square}
                        onTap={handlePieceTap}
                        isTouchDevice={isTouchDevice}
                      />
                    )}
                  </DroppableSquare>
                );
              })}
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggedPiece && (
            <PieceSVG
              type={draggedPiece.type}
              color={draggedPiece.color}
              size={theme.pieceSize * 1.2}
              style={{ cursor: "grabbing" }}
            />
          )}
        </DragOverlay>
      </DndContext>

      {promotion && (
        <PromotionDialog
          color={game.turn}
          onSelect={handlePromotion}
          theme={theme}
        />
      )}
    </>
  );
}
