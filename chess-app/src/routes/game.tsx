import {
  createFileRoute,
  useNavigate,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useWebSocket } from "../lib/websocket-context";
import { useAuth } from "../lib/auth-context";

export const Route = createFileRoute("/game")({
  component: GameLobby,
});

const WS_URL = "ws://localhost:3000/ws";
const P = "#10B981";

const FACTS = [
  "There are more possible chess games than atoms in the observable universe.",
  "'Checkmate' comes from the Persian 'Shah Mat' — the king is dead.",
  "The longest possible chess game is 5,949 moves.",
  "Chess was invented in India around the 6th century AD.",
  "Deep Blue became the first computer to beat a world champion in 1997.",
  "A queen can control up to 28 squares from the center of the board.",
];

function GameLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const isChildRoute = location.pathname !== "/game";

  const { connect, send, addListener, status } = useWebSocket();
  const { user } = useAuth();

  const playerId = user?.username ?? "";
  const playerIdRef = useRef(playerId);
  playerIdRef.current = playerId;

  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState("");
  const [factIdx, setFactIdx] = useState(0);

  useEffect(() => {
    if (!isWaiting) return;
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 4500);
    return () => clearInterval(id);
  }, [isWaiting]);

  useEffect(() => {
    if (isChildRoute) return;
    connect(WS_URL);
    const unsub = addListener((msg) => {
      const pid = playerIdRef.current;
      if (msg.type === "room_created") {
        setIsWaiting(true);
      } else if (msg.type === "room_matched") {
        localStorage.setItem("gameData", JSON.stringify({
          roomId: msg.roomId, player1Id: msg.player1Id,
          player2Id: msg.player2Id, currentPlayerId: pid,
        }));
        navigate({ to: "/game/$roomId", params: { roomId: msg.roomId } });
      } else if (msg.type === "opponent_joined") {
        localStorage.setItem("gameData", JSON.stringify({
          roomId: msg.roomId, player1Id: pid,
          player2Id: msg.player2Id, currentPlayerId: pid,
        }));
        navigate({ to: "/game/$roomId", params: { roomId: msg.roomId } });
      } else if (msg.type === "error") {
        setError(String(msg.message ?? "Server error"));
      }
    });
    return unsub;
  }, [isChildRoute, navigate, connect, addListener]);

  useEffect(() => {
    if (status === "error") setError("Cannot connect to the game server. Is it running on port 3000?");
    else if (status === "connected") setError("");
  }, [status]);

  if (isChildRoute) return <Outlet />;

  const wsReady = status === "connected";

  const handleFindGame = () => {
    if (!wsReady) { setError("Not connected to server yet…"); return; }
    if (!playerId) { setError("You must be signed in to play."); return; }
    setError("");
    send({ content: "start", uid: playerId });
  };

  return (
    <div style={pageStyle}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      {["♟", "♞", "♜", "♛", "♝"].map((p, i) => (
        <div key={i} style={{
          position: "fixed", fontSize: `${1.8 + i * 0.35}rem`,
          color: "rgba(16,185,129,.03)", pointerEvents: "none", userSelect: "none",
          top: `${10 + i * 17}%`,
          ...(i % 2 === 0 ? { left: `${4 + i * 3}%` } : { right: `${4 + i * 3}%` }),
          animation: `float ${6 + i}s ease-in-out infinite alternate`,
          animationDelay: `${i * .6}s`,
        }}>{p}</div>
      ))}

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440, animation: "fadeIn .5s ease" }}>
        <a href="/" style={backLink}>← Home</a>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "3rem", marginBottom: 10, animation: "float 4s ease-in-out infinite alternate" }}>♛</div>
          <h1 style={{
            fontSize: "clamp(2rem, 6vw, 2.8rem)", fontWeight: 800, margin: "0 0 6px",
            background: `linear-gradient(135deg, ${P}, #34D399)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Chess Arena</h1>
          <p style={{ color: "#6B7280", fontSize: ".9rem" }}>Real-time 1v1 · WebSocket powered</p>
        </div>

        <div style={card}>
          {!isWaiting ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Connection status */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8,
                background: wsReady ? "rgba(16,185,129,.05)" : status === "connecting" ? "rgba(245,158,11,.05)" : "rgba(239,68,68,.05)",
                border: `1px solid ${wsReady ? "rgba(16,185,129,.2)" : status === "connecting" ? "rgba(245,158,11,.2)" : "rgba(239,68,68,.2)"}`,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: wsReady ? P : status === "connecting" ? "#F59E0B" : "#EF4444",
                  boxShadow: `0 0 8px ${wsReady ? "rgba(16,185,129,.5)" : "rgba(245,158,11,.4)"}`,
                  animation: wsReady ? "pulse 2s infinite" : "pulse .8s infinite",
                }} />
                <span style={{ fontSize: ".82rem", fontWeight: 600, color: wsReady ? P : "#F59E0B" }}>
                  {status === "connecting" && "Connecting to server…"}
                  {status === "connected" && "Server ready — let's play!"}
                  {status === "disconnected" && "Disconnected from server"}
                  {status === "error" && "Server unreachable"}
                  {status === "idle" && "Initialising…"}
                </span>
              </div>

              {error && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.18)", color: "#EF4444", fontSize: ".82rem" }}>
                  ⚠ {error}
                </div>
              )}

              <div>
                <div style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".1em", marginBottom: 6, fontWeight: 600 }}>YOUR PLAYER ID</div>
                <div style={{
                  padding: "10px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: ".85rem", color: "#6B7280",
                }}>{playerId || "—"}</div>
              </div>

              <button onClick={handleFindGame} disabled={!wsReady} style={{
                padding: "14px 0", borderRadius: 10, border: "none",
                cursor: wsReady ? "pointer" : "not-allowed",
                background: wsReady ? `linear-gradient(135deg, ${P}, #34D399)` : "rgba(255,255,255,.04)",
                color: wsReady ? "#0A0A0F" : "#4B5563",
                fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-.01em",
                transition: "all .3s",
                boxShadow: wsReady ? "0 8px 32px rgba(16,185,129,.2)" : "none",
              }}
                onMouseEnter={(e) => { if (wsReady) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                {wsReady ? "Find a Game" : "Waiting for server…"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}>
              <div style={{ position: "relative", width: 72, height: 72 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  border: `3px solid rgba(16,185,129,.12)`, borderTop: `3px solid ${P}`,
                  animation: "spin 1.5s linear infinite",
                }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>♛</div>
              </div>
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: P, margin: "0 0 6px" }}>Finding your opponent…</h2>
                <p style={{ color: "#6B7280", fontSize: ".85rem" }}>You'll be matched with the next online player</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[0, .25, .5].map((d, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: P, animation: `pulse 1.2s ${d}s infinite` }} />
                ))}
              </div>
              <div key={factIdx} style={{
                padding: "14px 18px", borderRadius: 10, maxWidth: 340, animation: "fadeIn .5s ease",
                background: "rgba(16,185,129,.04)", border: "1px solid rgba(16,185,129,.1)",
              }}>
                <div style={{ fontSize: ".6rem", color: P, fontWeight: 700, letterSpacing: ".12em", marginBottom: 6 }}>DID YOU KNOW?</div>
                <p style={{ fontSize: ".82rem", color: "#9CA3AF", lineHeight: 1.6, fontStyle: "italic", margin: 0 }}>{FACTS[factIdx]}</p>
              </div>
              <code style={{ fontSize: ".68rem", color: "#374151" }}>{playerId}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh", background: "#0A0A0F", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "40px 20px", position: "relative", overflow: "hidden",
};

const card: CSSProperties = {
  background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 16, padding: "32px 36px", boxShadow: "0 24px 64px rgba(0,0,0,.5)",
};

const backLink: CSSProperties = {
  color: "#4B5563", textDecoration: "none", fontSize: ".82rem",
  display: "block", marginBottom: 10,
};

const bgGrid: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  backgroundImage: "linear-gradient(rgba(16,185,129,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,.015) 1px,transparent 1px)",
  backgroundSize: "72px 72px",
};

const bgGlow: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  background: "radial-gradient(ellipse at 50% 30%,rgba(16,185,129,.06) 0%,transparent 55%)",
};
