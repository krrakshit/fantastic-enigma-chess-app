import { createFileRoute } from "@tanstack/react-router";
import { useChessGame } from "../lib/chess-engine";
import { ChessBoard } from "../components/ChessBoard";
import { GameInfo } from "../components/GameInfo";

export const Route = createFileRoute("/parchment")({
  component: ParchmentTheme,
});

function ParchmentTheme() {
  const game = useChessGame();

  const boardTheme = {
    lightSquare: "#FFF8E7",
    darkSquare: "#A8B8A0",
    selectedSquare: "rgba(139, 0, 0, 0.2)",
    legalMoveIndicator: "rgba(44, 44, 44, 0.2)",
    lastMoveHighlight: "rgba(139, 0, 0, 0.1)",
    checkHighlight: "rgba(139, 0, 0, 0.3)",
    boardBorder: "#2C2C2C",
    boardBorderWidth: 2,
    boardShadow: "0 4px 20px rgba(0,0,0,0.1)",
    pieceSize: 56,
    squareSize: 68,
    coordinateColor: "#2C2C2C",
    coordinateFontFamily: "'Source Serif 4', serif",
  };

  const infoStyles = {
    container: {
      width: 300,
      padding: "28px 24px",
      background: "#FFF8E7",
      borderRadius: 0,
      border: "1px solid #D4C5A0",
      fontFamily: "'Source Serif 4', serif",
      color: "#2C2C2C",
      borderTop: "3px solid #8B0000",
    } as React.CSSProperties,
    heading: {
      fontFamily: "'Libre Baskerville', serif",
      fontSize: "1.6rem",
      fontWeight: 700,
      color: "#2C2C2C",
      margin: "12px 0 20px",
      borderBottom: "1px solid #D4C5A0",
      paddingBottom: 12,
    } as React.CSSProperties,
    text: { color: "#4A4A4A" } as React.CSSProperties,
    accent: "#8B0000",
    bg: "#FFF8E7",
    turnIndicator: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 12px",
      background: "rgba(139, 0, 0, 0.04)",
      borderRadius: 0,
      border: "1px solid #E8DCC8",
      fontSize: "0.9rem",
      color: "#2C2C2C",
      fontStyle: "italic" as const,
    } as React.CSSProperties,
    moveItem: {
      fontSize: "0.9rem",
      color: "#4A4A4A",
      fontFamily: "'Source Serif 4', serif",
    } as React.CSSProperties,
    button: {
      flex: 1,
      padding: "8px 14px",
      border: "1px solid #D4C5A0",
      borderRadius: 0,
      background: "transparent",
      color: "#2C2C2C",
      cursor: "pointer",
      fontFamily: "'Libre Baskerville', serif",
      fontSize: "0.8rem",
      transition: "all 0.2s",
    } as React.CSSProperties,
    statusBanner: {
      padding: "8px 14px",
      background: "rgba(139, 0, 0, 0.04)",
      borderRadius: 0,
      borderLeft: "3px solid #8B0000",
      fontSize: "0.9rem",
      color: "#8B0000",
      marginBottom: 16,
      fontStyle: "italic" as const,
      fontFamily: "'Libre Baskerville', serif",
    } as React.CSSProperties,
    backLink: {
      color: "#8B7B68",
      textDecoration: "none",
      fontSize: "0.8rem",
      fontFamily: "'Source Serif 4', serif",
    } as React.CSSProperties,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5EFE0",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: 48,
        padding: "60px 40px",
        position: "relative",
      }}
    >
      {/* Paper texture */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23A0926D' fill-opacity='0.05' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E\")",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Newspaper-style header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: 20,
            borderBottom: "2px solid #2C2C2C",
            paddingBottom: 12,
          }}
        >
          <div
            style={{
              fontFamily: "'Libre Baskerville', serif",
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.4em",
              color: "#8B7B68",
              marginBottom: 4,
            }}
          >
            The Chess Chronicle
          </div>
          <div
            style={{
              fontFamily: "'Libre Baskerville', serif",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#2C2C2C",
            }}
          >
            Game of the Day
          </div>
        </div>
        <ChessBoard game={game} theme={boardTheme} />
        <div
          style={{
            marginTop: 12,
            textAlign: "center",
            fontFamily: "'Source Serif 4', serif",
            fontSize: "0.75rem",
            color: "#8B7B68",
            fontStyle: "italic",
          }}
        >
          Diagram{" "}
          {game.moveHistory.length > 0
            ? Math.ceil(game.moveHistory.length / 2)
            : 1}
          {" · "}
          {game.turn === "w" ? "White" : "Black"} to play
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <GameInfo game={game} styles={infoStyles} themeName="The Parchment" />
        {/* Notation section */}
        <div
          style={{
            marginTop: 20,
            padding: "16px 20px",
            background: "#FFF8E7",
            border: "1px solid #D4C5A0",
            borderTop: "none",
            fontFamily: "'Source Serif 4', serif",
            fontSize: "0.8rem",
            color: "#6A5A48",
            lineHeight: 1.8,
            fontStyle: "italic",
          }}
        >
          <strong style={{ fontStyle: "normal", color: "#2C2C2C" }}>
            Analysis:
          </strong>{" "}
          {game.moveHistory.length === 0
            ? "The game awaits its first move. Both sides stand ready at the starting position."
            : game.gameStatus === "checkmate"
              ? "A decisive victory. The losing king finds no escape from the mating net."
              : game.gameStatus === "check"
                ? "The king is under direct attack. A response is required."
                : `After ${Math.ceil(game.moveHistory.length / 2)} move${game.moveHistory.length > 2 ? "s" : ""}, the position continues to develop.`}
        </div>
      </div>
    </div>
  );
}
