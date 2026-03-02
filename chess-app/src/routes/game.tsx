import { createFileRoute, useNavigate, Outlet, useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute('/game')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're on a child route (/game/{roomId})
  const isChildRoute = location.pathname !== '/game';

  const [playerId, setPlayerId] = useState<string>("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState("");

  // Use ref so the onmessage closure always has the latest playerId
  const playerIdRef = useRef<string>("");

  useEffect(() => {
    // If we're on a child route, don't set up a new WebSocket connection
    if (isChildRoute) return;

    // Generate unique player ID
    const generatedPlayerId = "player_" + Math.random().toString(36).substring(2, 11);
    setPlayerId(generatedPlayerId);
    playerIdRef.current = generatedPlayerId;

    // Create WebSocket connection
    const newWs = new WebSocket("ws://localhost:3000/ws");

    newWs.onopen = () => {
      console.log("Connected to WebSocket server");
      setWs(newWs);
    };

    newWs.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("Failed to connect to server");
    };

    newWs.onclose = () => {
      console.log("Disconnected from WebSocket server");
      // Only clear localStorage if we're still on the /game lobby page,
      // NOT if we've navigated away to a game room.
      if (window.location.pathname === '/game') {
        localStorage.removeItem("gameData");
      }
    };

    // Set up message handler
    newWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received message:", message);

        // Read playerId from ref to avoid stale closure
        const currentPlayerId = playerIdRef.current;

        if (message.type === "room_created") {
          setIsWaiting(true);
          console.log("Waiting for opponent in room:", message.roomId);
        } else if (message.type === "room_matched") {
          console.log("Room matched, redirecting...");
          const gameData = {
            roomId: message.roomId,
            player1Id: message.player1Id,
            player2Id: message.player2Id,
            currentPlayerId: currentPlayerId,
          };
          console.log("Storing game data:", gameData);
          localStorage.setItem("gameData", JSON.stringify(gameData));
          console.log("localStorage set, navigating to /game/" + message.roomId);
          // Close the WebSocket BEFORE navigating so onclose doesn't fire after navigation
          newWs.onclose = null; // Remove the handler so it won't clear localStorage
          newWs.close();
          navigate({ to: `/game/$roomId`, params: { roomId: message.roomId } });
        } else if (message.type === "opponent_joined") {
          console.log("Opponent joined:", message.player2Id);
          const gameData = {
            roomId: message.roomId,
            player1Id: currentPlayerId,
            player2Id: message.player2Id,
            currentPlayerId: currentPlayerId,
          };
          console.log("Storing game data:", gameData);
          localStorage.setItem("gameData", JSON.stringify(gameData));
          console.log("localStorage set, navigating to /game/" + message.roomId);
          // Close the WebSocket BEFORE navigating so onclose doesn't fire after navigation
          newWs.onclose = null; // Remove the handler so it won't clear localStorage
          newWs.close();
          navigate({ to: `/game/$roomId`, params: { roomId: message.roomId } });
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    return () => {
      // Clean up: only close if still open. The onclose may or may not clear localStorage
      // depending on whether we nullified the handler before navigating.
      if (newWs && newWs.readyState !== WebSocket.CLOSED && newWs.readyState !== WebSocket.CLOSING) {
        newWs.close();
      }
    };
  }, [isChildRoute, navigate]);

  // If we're on a child route, render the Outlet for that route
  if (isChildRoute) {
    return <Outlet />;
  }

  const joinServer = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("Not connected to server");
      return;
    }

    // Send start message
    ws.send(JSON.stringify({
      content: "start",
      uid: playerId,
    }));
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "'Cormorant Garamond', serif",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", marginBottom: "20px" }}>Chess Arena</h1>

      {error && (
        <div style={{ color: "#FF6B6B", marginBottom: "20px", fontSize: "1.1rem" }}>
          {error}
        </div>
      )}

      {!isWaiting ? (
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.2rem", marginBottom: "20px" }}>
            Your Player ID: <strong>{playerId}</strong>
          </p>
          <button
            onClick={joinServer}
            disabled={!ws || ws.readyState !== WebSocket.OPEN}
            style={{
              padding: "15px 40px",
              fontSize: "1.1rem",
              backgroundColor: ws && ws.readyState === WebSocket.OPEN ? "#C9A84C" : "#666",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              cursor: ws && ws.readyState === WebSocket.OPEN ? "pointer" : "not-allowed",
              fontWeight: "bold",
            }}
          >
            Start Game
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.3rem", marginBottom: "20px", color: "#C9A84C" }}>
            ⏳ Waiting for an opponent to join...
          </p>
          <p style={{ fontSize: "1rem", color: "#888" }}>
            Your Player ID: <strong>{playerId}</strong>
          </p>
          <div
            style={{
              marginTop: "30px",
              display: "flex",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#C9A84C",
                animation: "pulse 1s infinite",
              }}
            />
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#C9A84C",
                animation: "pulse 1s infinite 0.2s",
              }}
            />
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#C9A84C",
                animation: "pulse 1s infinite 0.4s",
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}
