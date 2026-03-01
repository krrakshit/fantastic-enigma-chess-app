import { createFileRoute } from "@tanstack/react-router";
import { useChessGame } from "../lib/chess-engine";
import { ChessBoard } from "../components/ChessBoard";
import { GameInfo } from "../components/GameInfo";

export const Route = createFileRoute("/zen-garden")({
  component: ZenGardenTheme,
});

function ZenGardenTheme() {
  const game = useChessGame();

  const boardTheme = {
    lightSquare: "#E8D5B7",
    darkSquare: "#9B7B4A",
    selectedSquare: "rgba(45, 74, 62, 0.35)",
    legalMoveIndicator: "rgba(45, 74, 62, 0.3)",
    lastMoveHighlight: "rgba(45, 74, 62, 0.2)",
    checkHighlight: "rgba(180, 60, 60, 0.4)",
    boardBorder: "#6B4226",
    boardBorderWidth: 6,
    boardShadow: "0 8px 40px rgba(107, 66, 38, 0.25)",
    pieceSize: 58,
    squareSize: 70,
    coordinateColor: "#6B4226",
    coordinateFontFamily: "'Crimson Pro', serif",
  };

  const infoStyles = {
    container: {
      width: 260,
      padding: "28px 24px",
      background: "rgba(245, 240, 232, 0.92)",
      borderRadius: 4,
      border: "1px solid rgba(107, 66, 38, 0.2)",
      fontFamily: "'Crimson Pro', serif",
      color: "#3A2E20",
      boxShadow: "0 4px 20px rgba(107, 66, 38, 0.1)",
    } as React.CSSProperties,
    heading: {
      fontFamily: "'Noto Serif JP', serif",
      fontSize: "1.5rem",
      fontWeight: 700,
      color: "#2D4A3E",
      margin: "12px 0 20px",
    } as React.CSSProperties,
    text: { color: "#5A4A38" } as React.CSSProperties,
    accent: "#2D4A3E",
    bg: "#F5F0E8",
    turnIndicator: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 14px",
      background: "rgba(45, 74, 62, 0.06)",
      borderRadius: 4,
      fontSize: "0.95rem",
      color: "#2D4A3E",
    } as React.CSSProperties,
    moveItem: {
      fontSize: "0.9rem",
      color: "#6B5B48",
      fontFamily: "'Crimson Pro', serif",
    } as React.CSSProperties,
    button: {
      flex: 1,
      padding: "10px 14px",
      border: "1px solid rgba(45, 74, 62, 0.25)",
      borderRadius: 4,
      background: "rgba(45, 74, 62, 0.06)",
      color: "#2D4A3E",
      cursor: "pointer",
      fontFamily: "'Crimson Pro', serif",
      fontSize: "0.9rem",
      fontWeight: 600,
      transition: "all 0.2s",
    } as React.CSSProperties,
    statusBanner: {
      padding: "10px 14px",
      background: "rgba(45, 74, 62, 0.06)",
      borderRadius: 4,
      borderLeft: "3px solid #2D4A3E",
      fontSize: "0.9rem",
      color: "#2D4A3E",
      marginBottom: 16,
      fontWeight: 600,
    } as React.CSSProperties,
    backLink: {
      color: "#8B7B68",
      textDecoration: "none",
      fontSize: "0.85rem",
    } as React.CSSProperties,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F0E8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
        padding: 40,
        position: "relative",
      }}
    >
      {/* Subtle linen texture */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%239C8B6A' fill-opacity='0.06' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E\")",
          pointerEvents: "none",
        }}
      />

      {/* Board area with bamboo decoration */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            textAlign: "center",
            fontFamily: "'Noto Serif JP', serif",
            color: "#2D4A3E",
            fontSize: "0.85rem",
            marginBottom: 14,
            letterSpacing: "0.3em",
            opacity: 0.6,
          }}
        >
          一手一生
        </div>
        <ChessBoard game={game} theme={boardTheme} />
        <div
          style={{
            textAlign: "center",
            fontFamily: "'Crimson Pro', serif",
            color: "#8B7B68",
            fontSize: "0.8rem",
            marginTop: 10,
            fontStyle: "italic",
          }}
        >
          One move, one life
        </div>
      </div>
      <GameInfo game={game} styles={infoStyles} themeName="Zen Garden" />
    </div>
  );
}
