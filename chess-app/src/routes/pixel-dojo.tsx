import { createFileRoute } from "@tanstack/react-router";
import { useChessGame } from "../lib/chess-engine";
import { ChessBoard } from "../components/ChessBoard";
import { GameInfo } from "../components/GameInfo";

export const Route = createFileRoute("/pixel-dojo")({
  component: PixelDojoTheme,
});

function PixelDojoTheme() {
  const game = useChessGame();

  const boardTheme = {
    lightSquare: "#1A3A1A",
    darkSquare: "#0D1F0D",
    selectedSquare: "rgba(0, 255, 65, 0.3)",
    legalMoveIndicator: "rgba(0, 255, 65, 0.4)",
    lastMoveHighlight: "rgba(0, 255, 65, 0.15)",
    checkHighlight: "rgba(255, 107, 53, 0.5)",
    boardBorder: "#00FF41",
    boardBorderWidth: 3,
    boardShadow:
      "0 0 40px rgba(0, 255, 65, 0.15), 0 0 80px rgba(0, 255, 65, 0.05)",
    pieceSize: 56,
    squareSize: 68,
    coordinateColor: "#00FF41",
    coordinateFontFamily: "'Press Start 2P', monospace",
  };

  const infoStyles = {
    container: {
      width: 300,
      padding: "24px 20px",
      background: "#0D0208",
      borderRadius: 0,
      border: "2px solid #00FF41",
      fontFamily: "'VT323', monospace",
      color: "#00FF41",
      boxShadow:
        "0 0 20px rgba(0, 255, 65, 0.1), inset 0 0 60px rgba(0, 255, 65, 0.03)",
    } as React.CSSProperties,
    heading: {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: "1rem",
      fontWeight: 400,
      color: "#00FF41",
      margin: "12px 0 20px",
      textShadow: "0 0 10px rgba(0, 255, 65, 0.5)",
    } as React.CSSProperties,
    text: { color: "#00CC33" } as React.CSSProperties,
    accent: "#00FF41",
    bg: "#0D0208",
    turnIndicator: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 12px",
      background: "rgba(0, 255, 65, 0.05)",
      border: "1px solid rgba(0, 255, 65, 0.2)",
      fontSize: "1.1rem",
      color: "#00FF41",
    } as React.CSSProperties,
    moveItem: {
      fontSize: "1rem",
      color: "#00CC33",
      fontFamily: "'VT323', monospace",
    } as React.CSSProperties,
    button: {
      flex: 1,
      padding: "8px 12px",
      border: "2px solid #00FF41",
      borderRadius: 0,
      background: "transparent",
      color: "#00FF41",
      cursor: "pointer",
      fontFamily: "'Press Start 2P', monospace",
      fontSize: "0.6rem",
      transition: "all 0.15s",
      textTransform: "uppercase" as const,
    } as React.CSSProperties,
    statusBanner: {
      padding: "8px 12px",
      background: "rgba(0, 255, 65, 0.05)",
      border: "1px solid rgba(0, 255, 65, 0.3)",
      fontSize: "1rem",
      color: "#00FF41",
      marginBottom: 16,
      fontFamily: "'VT323', monospace",
      textShadow: "0 0 8px rgba(0, 255, 65, 0.4)",
    } as React.CSSProperties,
    backLink: {
      color: "#00CC33",
      textDecoration: "none",
      fontSize: "0.7rem",
      fontFamily: "'Press Start 2P', monospace",
    } as React.CSSProperties,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0D0208",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: 40,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* CRT scanline effect */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(0, 255, 65, 0.03) 0px, rgba(0, 255, 65, 0.03) 1px, transparent 1px, transparent 3px)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />
      {/* Screen glow */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(0, 255, 65, 0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            color: "#00FF41",
            fontSize: "0.6rem",
            textAlign: "center",
            marginBottom: 12,
            textShadow: "0 0 10px rgba(0, 255, 65, 0.5)",
            letterSpacing: "0.1em",
          }}
        >
          {">> PLAYER "}
          {game.turn === "w" ? "1" : "2"}
          {" <<"}
        </div>
        <ChessBoard game={game} theme={boardTheme} />
      </div>
      <GameInfo game={game} styles={infoStyles} themeName="PIXEL DOJO" />
    </div>
  );
}
