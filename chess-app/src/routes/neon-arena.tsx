import { createFileRoute } from "@tanstack/react-router";
import { useChessGame } from "../lib/chess-engine";
import { ChessBoard } from "../components/ChessBoard";
import { GameInfo } from "../components/GameInfo";

export const Route = createFileRoute("/neon-arena")({
  component: NeonArenaTheme,
});

function NeonArenaTheme() {
  const game = useChessGame();

  const boardTheme = {
    lightSquare: "rgba(0, 240, 255, 0.08)",
    darkSquare: "rgba(255, 0, 229, 0.06)",
    selectedSquare: "rgba(0, 240, 255, 0.3)",
    legalMoveIndicator: "rgba(255, 229, 0, 0.4)",
    lastMoveHighlight: "rgba(0, 240, 255, 0.15)",
    checkHighlight: "rgba(255, 0, 0, 0.4)",
    boardBorder: "#00F0FF",
    boardBorderWidth: 2,
    boardShadow:
      "0 0 30px rgba(0, 240, 255, 0.2), 0 0 60px rgba(255, 0, 229, 0.1), 0 20px 60px rgba(0,0,0,0.5)",
    pieceSize: 56,
    squareSize: 68,
    coordinateColor: "#00F0FF",
    coordinateFontFamily: "'Rajdhani', sans-serif",
  };

  const infoStyles = {
    container: {
      width: 280,
      padding: "24px 20px",
      background: "rgba(10, 14, 26, 0.9)",
      borderRadius: 8,
      border: "1px solid rgba(0, 240, 255, 0.2)",
      fontFamily: "'Rajdhani', sans-serif",
      color: "#B0E0E0",
      backdropFilter: "blur(20px)",
      boxShadow: "0 0 30px rgba(0, 240, 255, 0.05)",
    } as React.CSSProperties,
    heading: {
      fontFamily: "'Orbitron', sans-serif",
      fontSize: "1.2rem",
      fontWeight: 900,
      color: "#00F0FF",
      margin: "12px 0 20px",
      textShadow: "0 0 20px rgba(0, 240, 255, 0.5)",
      textTransform: "uppercase" as const,
      letterSpacing: "0.15em",
    } as React.CSSProperties,
    text: { color: "#6FAAAA" } as React.CSSProperties,
    accent: "#00F0FF",
    bg: "#0A0E1A",
    turnIndicator: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 14px",
      background: "rgba(0, 240, 255, 0.05)",
      border: "1px solid rgba(0, 240, 255, 0.15)",
      borderRadius: 4,
      fontSize: "1rem",
      color: "#00F0FF",
      fontWeight: 600,
    } as React.CSSProperties,
    moveItem: {
      fontSize: "0.9rem",
      color: "#6FAAAA",
      fontFamily: "'Rajdhani', sans-serif",
    } as React.CSSProperties,
    button: {
      flex: 1,
      padding: "10px 14px",
      border: "1px solid rgba(0, 240, 255, 0.3)",
      borderRadius: 4,
      background: "rgba(0, 240, 255, 0.05)",
      color: "#00F0FF",
      cursor: "pointer",
      fontFamily: "'Orbitron', sans-serif",
      fontSize: "0.65rem",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.1em",
      transition: "all 0.2s",
    } as React.CSSProperties,
    statusBanner: {
      padding: "8px 14px",
      background:
        game.gameStatus === "check"
          ? "rgba(255, 0, 0, 0.1)"
          : "rgba(0, 240, 255, 0.05)",
      border: `1px solid ${game.gameStatus === "check" ? "rgba(255, 0, 0, 0.3)" : "rgba(0, 240, 255, 0.15)"}`,
      borderRadius: 4,
      fontSize: "0.95rem",
      color: game.gameStatus === "check" ? "#FF4444" : "#00F0FF",
      marginBottom: 16,
      fontWeight: 700,
      fontFamily: "'Orbitron', sans-serif",
      textShadow: `0 0 10px ${game.gameStatus === "check" ? "rgba(255, 0, 0, 0.4)" : "rgba(0, 240, 255, 0.3)"}`,
      letterSpacing: "0.05em",
    } as React.CSSProperties,
    backLink: {
      color: "#4A7070",
      textDecoration: "none",
      fontSize: "0.8rem",
      fontFamily: "'Rajdhani', sans-serif",
    } as React.CSSProperties,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0E1A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 36,
        padding: 40,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />
      {/* Radial glow */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse at 30% 50%, rgba(0, 240, 255, 0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(255, 0, 229, 0.04) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* HUD header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            fontFamily: "'Orbitron', sans-serif",
          }}
        >
          <span
            style={{
              fontSize: "0.6rem",
              color: "#00F0FF",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              textShadow: "0 0 10px rgba(0, 240, 255, 0.5)",
            }}
          >
            Player 1
          </span>
          <span
            style={{
              fontSize: "0.5rem",
              color: "#FF00E5",
              padding: "4px 12px",
              border: "1px solid rgba(255, 0, 229, 0.3)",
              borderRadius: 2,
              textShadow: "0 0 10px rgba(255, 0, 229, 0.5)",
            }}
          >
            LIVE
          </span>
          <span
            style={{
              fontSize: "0.6rem",
              color: "#FF00E5",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              textShadow: "0 0 10px rgba(255, 0, 229, 0.5)",
            }}
          >
            Player 2
          </span>
        </div>
        <ChessBoard game={game} theme={boardTheme} />
      </div>
      <GameInfo game={game} styles={infoStyles} themeName="Neon Arena" />
    </div>
  );
}
