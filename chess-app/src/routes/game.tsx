import {
  createFileRoute,
  useNavigate,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../lib/websocket-context";

export const Route = createFileRoute("/game")({
  component: GameLobby,
});

const WS_URL = "ws://localhost:3000/ws";

const FACTS = [
  "There are more possible chess games than atoms in the observable universe.",
  "'Checkmate' comes from the Persian 'Shah Mat' — the king is dead.",
  "The longest possible chess game is 5,949 moves.",
  "Chess was invented in India around the 6th century AD.",
  "Deep Blue became the first computer to beat a world champion in 1997.",
  "A queen can control up to 28 squares from the center of the board.",
];

// ─────────────────────────────────────────────────────────────────────────────

function GameLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const isChildRoute = location.pathname !== "/game";

  // Global persistent WebSocket — shared with the game room
  const { connect, send, addListener, status } = useWebSocket();

  // Generate a stable player ID once on mount
  const [playerId] = useState(
    () => "player_" + Math.random().toString(36).substring(2, 11)
  );
  const playerIdRef = useRef(playerId);

  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState("");
  const [factIdx, setFactIdx] = useState(0);

  // Rotate facts while waiting
  useEffect(() => {
    if (!isWaiting) return;
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 4500);
    return () => clearInterval(id);
  }, [isWaiting]);

  // Connect once and listen for matchmaking messages
  useEffect(() => {
    if (isChildRoute) return;

    // This is a no-op if the socket is already open (e.g. coming back from a game)
    connect(WS_URL);

    const unsub = addListener((msg) => {
      const pid = playerIdRef.current;

      if (msg.type === "room_created") {
        setIsWaiting(true);
      } else if (msg.type === "room_matched") {
        // We are player 2
        localStorage.setItem(
          "gameData",
          JSON.stringify({
            roomId: msg.roomId,
            player1Id: msg.player1Id,
            player2Id: msg.player2Id,
            currentPlayerId: pid,
          })
        );
        // Navigate WITHOUT closing the socket — the server keeps our socket ref
        navigate({ to: "/game/$roomId", params: { roomId: msg.roomId } });
      } else if (msg.type === "opponent_joined") {
        // We are player 1
        localStorage.setItem(
          "gameData",
          JSON.stringify({
            roomId: msg.roomId,
            player1Id: pid,
            player2Id: msg.player2Id,
            currentPlayerId: pid,
          })
        );
        navigate({ to: "/game/$roomId", params: { roomId: msg.roomId } });
      } else if (msg.type === "error") {
        setError(String(msg.message ?? "Server error"));
      }
    });

    return unsub; // remove listener on cleanup — socket stays open
  }, [isChildRoute, navigate, connect, addListener]);

  // Show connection errors
  useEffect(() => {
    if (status === "error")
      setError("Cannot connect to the game server. Is it running on port 3000?");
    else if (status === "connected")
      setError("");
  }, [status]);

  // Child route (e.g. /game/roomId) — just render it
  if (isChildRoute) return <Outlet />;

  const wsReady = status === "connected";

  const handleFindGame = () => {
    if (!wsReady) {
      setError("Not connected to server yet…");
      return;
    }
    setError("");
    send({ content: "start", uid: playerId });
  };

  const A = "#C9A84C"; // accent gold

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        color: "#fff",
        fontFamily: "'Cormorant Garamond', serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.35; transform:scale(1.25); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes float {
          from { transform: translateY(0) rotate(-3deg); }
          to   { transform: translateY(-18px) rotate(3deg); }
        }
      `}</style>

      {/* Grid bg */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none",
        backgroundImage:"linear-gradient(rgba(201,168,76,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.025) 1px,transparent 1px)",
        backgroundSize:"60px 60px",
      }} />
      {/* Glow */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none",
        background:"radial-gradient(ellipse at 50% 30%,rgba(201,168,76,.07) 0%,transparent 55%)",
      }} />

      {/* Floating pieces */}
      {["♟","♞","♜","♛","♝"].map((p, i) => (
        <div key={i} style={{
          position:"fixed", fontSize:`${2+i*.4}rem`,
          color:"rgba(201,168,76,.04)", pointerEvents:"none", userSelect:"none",
          top:`${10+i*17}%`,
          ...(i%2===0 ? { left:`${4+i*3}%` } : { right:`${4+i*3}%` }),
          animation:`float ${6+i}s ease-in-out infinite alternate`,
          animationDelay:`${i*.6}s`,
        }}>{p}</div>
      ))}

      {/* Card */}
      <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:460, animation:"fadeUp .5s ease" }}>
        {/* Back */}
        <a href="/" style={{ color:"#444", textDecoration:"none", fontSize:".8rem", display:"block", marginBottom:10 }}>← Home</a>

        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontSize:"3.2rem", marginBottom:10, animation:"float 4s ease-in-out infinite alternate" }}>♛</div>
          <h1 style={{
            fontFamily:"'Playfair Display', serif", fontSize:"clamp(2rem,6vw,3rem)",
            fontWeight:900, margin:"0 0 8px",
            background:`linear-gradient(135deg,${A},#FFE89D,${A})`,
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          }}>Chess Arena</h1>
          <p style={{ color:"#555", fontSize:"1rem", fontStyle:"italic" }}>Real-time 1v1 · WebSocket powered</p>
        </div>

        {/* Main panel */}
        <div style={{
          background:"rgba(255,255,255,.025)", border:"1px solid rgba(255,255,255,.07)",
          borderRadius:20, padding:"36px 40px",
          boxShadow:"0 32px 80px rgba(0,0,0,.5)",
        }}>
          {!isWaiting ? (
            <div style={{ display:"flex", flexDirection:"column", gap:22 }}>

              {/* Connection status */}
              <div style={{
                display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
                borderRadius:8,
                background: wsReady ? "rgba(0,255,136,.05)" : status==="connecting" ? "rgba(255,184,0,.05)" : "rgba(255,68,68,.05)",
                border:`1px solid ${wsReady ? "rgba(0,255,136,.2)" : status==="connecting" ? "rgba(255,184,0,.2)" : "rgba(255,68,68,.2)"}`,
              }}>
                <div style={{
                  width:8, height:8, borderRadius:"50%",
                  background: wsReady ? "#00FF88" : status==="connecting" ? "#FFB800" : "#FF4444",
                  boxShadow:`0 0 8px ${wsReady ? "rgba(0,255,136,.6)" : "rgba(255,184,0,.5)"}`,
                  animation: wsReady ? "pulse 2s infinite" : "pulse .8s infinite",
                }} />
                <span style={{ fontSize:".82rem", fontWeight:600, color: wsReady ? "#00FF88" : "#FFB800" }}>
                  {status === "connecting" && "Connecting to server…"}
                  {status === "connected" && "Server ready — let's play!"}
                  {status === "disconnected" && "Disconnected from server"}
                  {status === "error" && "Server unreachable"}
                  {status === "idle" && "Initialising…"}
                </span>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  padding:"12px 16px", borderRadius:10,
                  background:"rgba(255,68,68,.08)", border:"1px solid rgba(255,68,68,.2)",
                  color:"#FF6B6B", fontSize:".85rem", lineHeight:1.5,
                }}>⚠ {error}</div>
              )}

              {/* Player ID */}
              <div>
                <div style={{ fontSize:".68rem", color:"#444", letterSpacing:".1em", marginBottom:8 }}>YOUR PLAYER ID</div>
                <div style={{
                  padding:"11px 14px", borderRadius:8,
                  background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)",
                  fontFamily:"monospace", fontSize:".88rem", color:"#666", wordBreak:"break-all",
                }}>{playerId}</div>
              </div>

              {/* CTA */}
              <button
                onClick={handleFindGame}
                disabled={!wsReady}
                style={{
                  padding:"16px 0", borderRadius:12, border:"none", cursor: wsReady ? "pointer" : "not-allowed",
                  background: wsReady ? `linear-gradient(135deg,${A},#FFE89D,${A})` : "rgba(255,255,255,.06)",
                  color: wsReady ? "#0A0A0F" : "#444",
                  fontSize:"1.1rem", fontWeight:700, fontFamily:"'Playfair Display', serif",
                  letterSpacing:".04em", transition:"all .3s",
                  boxShadow: wsReady ? `0 8px 32px rgba(201,168,76,.25)` : "none",
                }}
                onMouseEnter={(e) => { if(wsReady)(e.currentTarget as HTMLElement).style.transform="translateY(-2px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform="translateY(0)"; }}
              >
                {wsReady ? "🎮  Find a Game" : "Waiting for server…"}
              </button>
            </div>
          ) : (
            /* Waiting screen */
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:28, textAlign:"center" }}>
              {/* Spinner */}
              <div style={{ position:"relative", width:80, height:80 }}>
                <div style={{
                  width:80, height:80, borderRadius:"50%",
                  border:"3px solid rgba(201,168,76,.12)",
                  borderTop:`3px solid ${A}`,
                  animation:"spin 1.5s linear infinite",
                }} />
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"2.2rem" }}>♛</div>
              </div>

              <div>
                <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.6rem", fontWeight:700, color:A, margin:"0 0 8px" }}>
                  Finding your opponent…
                </h2>
                <p style={{ color:"#555", fontSize:".9rem" }}>You'll be matched with the next online player</p>
              </div>

              {/* Dots */}
              <div style={{ display:"flex", gap:10 }}>
                {[0,.25,.5].map((d,i) => (
                  <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:A, animation:`pulse 1.2s ${d}s infinite` }} />
                ))}
              </div>

              {/* Rotating fact */}
              <div key={factIdx} style={{
                padding:"16px 20px", borderRadius:12, maxWidth:360, animation:"fadeUp .5s ease",
                background:"rgba(201,168,76,.05)", border:"1px solid rgba(201,168,76,.1)",
              }}>
                <div style={{ fontSize:".65rem", color:A, fontWeight:700, letterSpacing:".12em", marginBottom:8 }}>DID YOU KNOW?</div>
                <p style={{ fontSize:".85rem", color:"#888", lineHeight:1.6, fontStyle:"italic", margin:0 }}>
                  {FACTS[factIdx]}
                </p>
              </div>

              <code style={{ fontSize:".7rem", color:"#333" }}>{playerId}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
