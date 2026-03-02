import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { ChessBoard } from "../components/ChessBoard";

export const Route = createFileRoute('/game/$roomId')({
  component: GameRoom,
})

interface GameData {
  roomId: string;
  player1Id: string;
  player2Id: string;
  currentPlayerId: string;
}

function GameRoom() {
  const { roomId } = Route.useParams();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Read game data from localStorage synchronously on mount
    const storedGameData = localStorage.getItem("gameData");
    console.log("GameRoom mounted. roomId:", roomId, "storedData:", storedGameData);

    if (storedGameData) {
      try {
        const data: GameData = JSON.parse(storedGameData);
        setGameData(data);
      } catch (error) {
        console.error("Error parsing game data:", error);
      }
    }

    setIsLoading(false);
  }, [roomId]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "20px",
      }}>
        <p style={{ fontSize: "1.2rem" }}>Loading game data...</p>
        <div style={{ display: "flex", gap: "10px" }}>
          {[0, 0.2, 0.4].map((delay, i) => (
            <div
              key={i}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#C9A84C",
                animation: `pulse 1s infinite ${delay}s`,
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
      }}>
        <p style={{ fontSize: "1.2rem", color: "#FF6B6B" }}>
          ⚠ Game data not found. The session may have expired.
        </p>
        <Link
          to="/game"
          style={{
            padding: "12px 30px",
            backgroundColor: "#C9A84C",
            color: "#000",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "bold",
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1rem",
          }}
        >
          Return to Lobby
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        color: "#fff",
        padding: "20px",
        fontFamily: "'Cormorant Garamond', serif",
      }}
    >
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
      }}>
        <h1 style={{ textAlign: "center", fontSize: "2.5rem", marginBottom: "30px" }}>
          Chess Arena — Room {roomId}
        </h1>

        {/* Game Info */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "30px",
        }}>
          <div style={{
            backgroundColor: "#1A1A2E",
            padding: "20px",
            borderRadius: "8px",
            borderLeft: `4px solid ${gameData.currentPlayerId === gameData.player1Id ? "#00FF41" : "#C9A84C"}`,
          }}>
            <p style={{ marginBottom: "10px", fontSize: "1.1rem" }}>
              <strong>Player 1 {gameData.currentPlayerId === gameData.player1Id ? "(You)" : ""}</strong>
            </p>
            <p style={{
              color: gameData.currentPlayerId === gameData.player1Id ? "#00FF41" : "#888",
              fontSize: "0.9rem",
              wordBreak: "break-all",
            }}>
              {gameData.player1Id}
            </p>
          </div>

          <div style={{
            backgroundColor: "#1A1A2E",
            padding: "20px",
            borderRadius: "8px",
            borderLeft: `4px solid ${gameData.currentPlayerId === gameData.player2Id ? "#00FF41" : "#FF00E5"}`,
          }}>
            <p style={{ marginBottom: "10px", fontSize: "1.1rem" }}>
              <strong>Player 2 {gameData.currentPlayerId === gameData.player2Id ? "(You)" : ""}</strong>
            </p>
            <p style={{
              color: gameData.currentPlayerId === gameData.player2Id ? "#00FF41" : "#888",
              fontSize: "0.9rem",
              wordBreak: "break-all",
            }}>
              {gameData.player2Id}
            </p>
          </div>
        </div>

        {/* Chess Board */}
        <div style={{
          backgroundColor: "#1A1A2E",
          padding: "20px",
          borderRadius: "8px",
          display: "flex",
          justifyContent: "center",
        }}>
          <ChessBoard />
        </div>

        {/* Room Info */}
        <div style={{
          marginTop: "30px",
          padding: "20px",
          backgroundColor: "#0D4A29",
          borderRadius: "8px",
          textAlign: "center",
          color: "#00FF41",
        }}>
          <p style={{ fontSize: "1.1rem" }}>
            ✓ Opponent connected! Game is ready.
          </p>
          <p style={{ fontSize: "0.9rem", color: "#888", marginTop: "10px" }}>
            Room ID: <strong>{roomId}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
