import type { PieceType, PieceColor } from "./chess-engine";

/**
 * High-quality chess piece images using the "cburnett" set
 * from Wikimedia Commons (CC BY-SA 3.0, Colin M.L. Burnett).
 * Same style used by Lichess and similar to chess.com's neo set.
 */
const PIECE_URLS: Record<PieceColor, Record<PieceType, string>> = {
  w: {
    k: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
    q: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
    r: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
    b: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
    n: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
    p: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg",
  },
  b: {
    k: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
    q: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
    r: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
    b: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
    n: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
    p: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg",
  },
};

interface PieceSVGProps {
  type: PieceType;
  color: PieceColor;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function PieceSVG({
  type,
  color,
  size = 60,
  style,
  className,
}: PieceSVGProps) {
  const url = PIECE_URLS[color][type];

  return (
    <img
      src={url}
      alt={`${color === "w" ? "White" : "Black"} ${type}`}
      width={size}
      height={size}
      className={className}
      draggable={false}
      style={{
        userSelect: "none",
        pointerEvents: "none",
        filter: "drop-shadow(1px 2px 2px rgba(0,0,0,0.3))",
        ...style,
      }}
    />
  );
}

// Unicode fallback (for text contexts like move history)
const PIECE_CHARS: Record<PieceColor, Record<PieceType, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

export function getPieceChar(type: PieceType, color: PieceColor): string {
  return PIECE_CHARS[color][type];
}
