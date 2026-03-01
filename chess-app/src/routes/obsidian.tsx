import { createFileRoute } from "@tanstack/react-router";
import { useChessGame } from "../lib/chess-engine";
import { ChessBoard } from "../components/ChessBoard";
import { GameInfo } from "../components/GameInfo";

export const Route = createFileRoute("/obsidian")({
  component: ObsidianTheme,
});

function ObsidianTheme() {
  const game = useChessGame();

  const boardTheme = {
    lightSquare: "#3D3D3D",
    darkSquare: "#1A1A1A",
    selectedSquare: "rgba(201, 168, 76, 0.4)",
    legalMoveIndicator: "rgba(201, 168, 76, 0.35)",
    lastMoveHighlight: "rgba(201, 168, 76, 0.2)",
    checkHighlight: "rgba(180, 40, 40, 0.6)",
    boardBorder: "#C9A84C",
    boardBorderWidth: 3,
    boardShadow:
      "0 0 60px rgba(201, 168, 76, 0.15), 0 20px 60px rgba(0,0,0,0.6)",
    pieceSize: 58,
    squareSize: 70,
    coordinateColor: "#C9A84C",
    coordinateFontFamily: "'Cormorant Garamond', serif",
  };

  const infoStyles = {
    container: {
      width: 280,
      padding: "32px 28px",
      background: "rgba(20, 20, 30, 0.8)",
      borderRadius: 12,
      border: "1px solid rgba(201, 168, 76, 0.2)",
      backdropFilter: "blur(20px)",
      fontFamily: "'Cormorant Garamond', serif",
      color: "#E8E0D0",
    } as React.CSSProperties,
    heading: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "1.6rem",
      fontWeight: 700,
      color: "#C9A84C",
      margin: "12px 0 20px",
    } as React.CSSProperties,
    text: { color: "#B0A890" } as React.CSSProperties,
    accent: "#C9A84C",
    bg: "#0A0A0A",
    turnIndicator: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 14px",
      background: "rgba(201, 168, 76, 0.08)",
      borderRadius: 8,
      fontSize: "0.95rem",
      color: "#D4C49A",
    } as React.CSSProperties,
    moveItem: {
      fontSize: "0.85rem",
      color: "#A09880",
      fontFamily: "'Cormorant Garamond', serif",
    } as React.CSSProperties,
    button: {
      flex: 1,
      padding: "10px 16px",
      border: "1px solid rgba(201, 168, 76, 0.3)",
      borderRadius: 8,
      background: "rgba(201, 168, 76, 0.08)",
      color: "#C9A84C",
      cursor: "pointer",
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: "0.9rem",
      fontWeight: 600,
      transition: "all 0.2s",
    } as React.CSSProperties,
    statusBanner: {
      padding: "10px 14px",
      background: "rgba(201, 168, 76, 0.1)",
      borderRadius: 8,
      borderLeft: "3px solid #C9A84C",
      fontSize: "0.9rem",
      color: "#D4C49A",
      marginBottom: 16,
      fontWeight: 600,
    } as React.CSSProperties,
    backLink: {
      color: "#666",
      textDecoration: "none",
      fontSize: "0.85rem",
      transition: "color 0.2s",
    } as React.CSSProperties,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at center, #1A1A2E 0%, #0A0A0A 70%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        padding: 40,
      }}
    >
      {/* Subtle texture overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A84C' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <ChessBoard game={game} theme={boardTheme} />
      </div>
      <GameInfo game={game} styles={infoStyles} themeName="Obsidian" />
    </div>
  );
}
