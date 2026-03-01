import type { ChessGameState, PieceColor } from "../lib/chess-engine";
import { PieceSVG } from "../lib/piece-svgs";
import { Link } from "@tanstack/react-router";
import type { Move } from "chess.js";

interface GameInfoProps {
  game: ChessGameState;
  styles: {
    container: React.CSSProperties;
    heading: React.CSSProperties;
    text: React.CSSProperties;
    accent: string;
    bg: string;
    turnIndicator: React.CSSProperties;
    moveItem: React.CSSProperties;
    button: React.CSSProperties;
    statusBanner: React.CSSProperties;
    backLink: React.CSSProperties;
  };
  themeName: string;
}

export function GameInfo({ game, styles, themeName }: GameInfoProps) {
  const statusText = (() => {
    switch (game.gameStatus) {
      case "checkmate":
        return `Checkmate! ${game.turn === "w" ? "Black" : "White"} wins!`;
      case "check":
        return `${game.turn === "w" ? "White" : "Black"} is in check!`;
      case "stalemate":
        return "Stalemate — Draw!";
      case "draw":
      case "threefold":
      case "insufficient":
        return "Draw!";
      default:
        return `${game.turn === "w" ? "White" : "Black"} to move`;
    }
  })();

  const formatMove = (move: Move, idx: number): string => {
    if (idx % 2 === 0) {
      return `${Math.floor(idx / 2) + 1}. ${move.san}`;
    }
    return move.san;
  };

  return (
    <div style={styles.container}>
      <Link to="/" style={styles.backLink}>
        ← Back
      </Link>
      <h1 style={styles.heading}>{themeName}</h1>

      {/* Status */}
      <div style={styles.statusBanner}>{statusText}</div>

      {/* Turn indicator */}
      <div style={styles.turnIndicator}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: game.turn === "w" ? "#fff" : "#222",
            border: "2px solid #666",
          }}
        />
        <span>{game.turn === "w" ? "White" : "Black"}'s turn</span>
      </div>

      {/* Captured pieces */}
      {(game.capturedPieces.b.length > 0 ||
        game.capturedPieces.w.length > 0) && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              ...styles.text,
              fontSize: "0.75rem",
              marginBottom: 6,
              opacity: 0.6,
            }}
          >
            Captured
          </div>
          {game.capturedPieces.b.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                marginBottom: 4,
              }}
            >
              {game.capturedPieces.b.map((p, i) => (
                <PieceSVG
                  key={`cb-${i}`}
                  type={p.type}
                  color={p.color}
                  size={24}
                />
              ))}
            </div>
          )}
          {game.capturedPieces.w.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {game.capturedPieces.w.map((p, i) => (
                <PieceSVG
                  key={`cw-${i}`}
                  type={p.type}
                  color={p.color}
                  size={24}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Move history */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            ...styles.text,
            fontSize: "0.75rem",
            marginBottom: 8,
            opacity: 0.6,
          }}
        >
          Move History
        </div>
        <div
          style={{
            maxHeight: 240,
            overflowY: "auto",
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 8px",
          }}
        >
          {game.moveHistory.map((m, i) => (
            <span key={i} style={styles.moveItem}>
              {formatMove(m, i)}
            </span>
          ))}
          {game.moveHistory.length === 0 && (
            <span style={{ ...styles.text, opacity: 0.4, fontSize: "0.85rem" }}>
              No moves yet
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
        <button onClick={game.undo} style={styles.button}>
          Undo
        </button>
        <button onClick={game.reset} style={styles.button}>
          New Game
        </button>
      </div>
    </div>
  );
}
