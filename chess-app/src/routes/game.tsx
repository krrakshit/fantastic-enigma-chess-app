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

const WS_URL = process.env.VITE_WS_URL ?? "ws://localhost:3000/ws";
const P = "#2D6A4F";

const FACTS = [
  "There are more possible chess games than atoms in the observable universe.",
  "'Checkmate' comes from the Persian 'Shah Mat' — the king is dead.",
  "The longest possible chess game is 5,949 moves.",
  "Chess was invented in India around the 6th century AD.",
  "Deep Blue became the first computer to beat a world champion in 1997.",
  "A queen can control up to 28 squares from the center of the board.",
];

type LobbyMode = "menu" | "finding" | "creating" | "joining";

function GameLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const isChildRoute = location.pathname !== "/game";

  const { connect, send, addListener, status } = useWebSocket();
  const { user } = useAuth();

  // Guest username: auto-generate if not authenticated
  const playerId = user?.username ?? (() => {
    let guestId = localStorage.getItem("guestUsername");
    if (!guestId) {
      guestId = "guest_" + Math.random().toString(36).substring(2, 7);
      localStorage.setItem("guestUsername", guestId);
    }
    return guestId;
  })();
  const isGuest = !user;
  const playerIdRef = useRef(playerId);
  playerIdRef.current = playerId;

  const [mode, setMode] = useState<LobbyMode>("menu");
  const [error, setError] = useState("");
  const [factIdx, setFactIdx] = useState(0);

  // Play with friend state
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (mode !== "finding" && mode !== "creating") return;
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 4500);
    return () => clearInterval(id);
  }, [mode]);

  useEffect(() => {
    if (isChildRoute) return;
    connect(WS_URL);
    const unsub = addListener((msg) => {
      const pid = playerIdRef.current;
      if (msg.type === "room_created") {
        setMode("finding");
      } else if (msg.type === "private_room_created") {
        setRoomCode(msg.code);
        setMode("creating");
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
    setError("");
    localStorage.setItem("isGuest", isGuest ? "true" : "false");
    send({ content: "start", uid: playerId });
  };

  const handleCreateRoom = () => {
    if (!wsReady) { setError("Not connected to server yet…"); return; }
    setError("");
    localStorage.setItem("isGuest", isGuest ? "true" : "false");
    send({ content: "create_room", uid: playerId });
  };

  const handleJoinRoom = () => {
    if (!wsReady) { setError("Not connected to server yet…"); return; }
    if (!joinCode.trim()) { setError("Please enter a room code"); return; }
    setError("");
    localStorage.setItem("isGuest", isGuest ? "true" : "false");
    send({ content: "join_room", uid: playerId, code: joinCode.trim() });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={pageStyle}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      {["♟", "♞", "♜", "♛", "♝"].map((p, i) => (
        <div key={i} style={{
          position: "fixed", fontSize: `${1.8 + i * 0.35}rem`,
          color: "rgba(45,106,79,.03)", pointerEvents: "none", userSelect: "none",
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
            background: `linear-gradient(135deg, ${P}, #40916C)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Chess Arena</h1>
          <p style={{ color: "#6B7264", fontSize: ".9rem" }}>Real-time 1v1 · WebSocket powered</p>
        </div>

        <div style={card}>

          {/* ── Main Menu ─────────────────────────────────────────────── */}
          {mode === "menu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Connection status */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8,
                background: wsReady ? "rgba(45,106,79,.05)" : status === "connecting" ? "rgba(245,158,11,.05)" : "rgba(239,68,68,.05)",
                border: `1px solid ${wsReady ? "rgba(45,106,79,.2)" : status === "connecting" ? "rgba(245,158,11,.2)" : "rgba(239,68,68,.2)"}`,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: wsReady ? P : status === "connecting" ? "#F59E0B" : "#EF4444",
                  boxShadow: `0 0 8px ${wsReady ? "rgba(45,106,79,.5)" : "rgba(245,158,11,.4)"}`,
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
                <div style={{ fontSize: ".62rem", color: "#8B9080", letterSpacing: ".1em", marginBottom: 6, fontWeight: 600 }}>
                  {isGuest ? "PLAYING AS GUEST" : "YOUR PLAYER ID"}
                </div>
                <div style={{
                  padding: "10px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,.55)", border: `1px solid ${isGuest ? "rgba(245,158,11,.15)" : "rgba(0,0,0,.06)"}`,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: ".85rem",
                  color: isGuest ? "#F59E0B" : "#6B7280",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span>{playerId || "—"}</span>
                  {isGuest && <span style={{ fontSize: ".6rem", color: "#8B9080" }}>No chat · No history</span>}
                </div>
              </div>

              {/* Find Random Game */}
              <button onClick={handleFindGame} disabled={!wsReady} style={primaryBtn(wsReady)}
                onMouseEnter={(e) => { if (wsReady) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: "1.1rem" }}>⚔</span>
                  {wsReady ? "Find a Random Game" : "Waiting for server…"}
                </span>
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,.06)" }} />
                <span style={{ fontSize: ".68rem", color: "#8B9080", fontWeight: 600, letterSpacing: ".08em" }}>OR PLAY WITH A FRIEND</span>
                <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,.06)" }} />
              </div>

              {/* Create / Join buttons side by side */}
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={handleCreateRoom} disabled={!wsReady} style={secondaryBtn(wsReady)}
                  onMouseEnter={(e) => { if (wsReady) (e.currentTarget as HTMLElement).style.background = "rgba(45,106,79,.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(45,106,79,.04)"; }}
                >
                  <span style={{ fontSize: "1rem" }}>🏠</span>
                  <span>Create Room</span>
                </button>
                <button onClick={() => setMode("joining")} disabled={!wsReady} style={secondaryBtn(wsReady)}
                  onMouseEnter={(e) => { if (wsReady) (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,.04)"; }}
                >
                  <span style={{ fontSize: "1rem" }}>🔗</span>
                  <span>Join Room</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Finding Random Opponent ────────────────────────────────── */}
          {mode === "finding" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}>
              <div style={{ position: "relative", width: 72, height: 72 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  border: `3px solid rgba(45,106,79,.12)`, borderTop: `3px solid ${P}`,
                  animation: "spin 1.5s linear infinite",
                }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>♛</div>
              </div>
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: P, margin: "0 0 6px" }}>Finding your opponent…</h2>
                <p style={{ color: "#6B7264", fontSize: ".85rem" }}>You'll be matched with the next online player</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[0, .25, .5].map((d, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: P, animation: `pulse 1.2s ${d}s infinite` }} />
                ))}
              </div>
              <FactCard factIdx={factIdx} />
              <code style={{ fontSize: ".68rem", color: "#9CA392" }}>{playerId}</code>
              <button onClick={() => setMode("menu")} style={backToMenuBtn}>← Back to menu</button>
            </div>
          )}

          {/* ── Waiting for Friend (Room Created) ─────────────────────── */}
          {mode === "creating" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", animation: "float 4s ease-in-out infinite alternate" }}>🏠</div>
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: P, margin: "0 0 6px" }}>Room Created!</h2>
                <p style={{ color: "#6B7264", fontSize: ".85rem" }}>Share this code with your friend</p>
              </div>

              {/* Room code display */}
              <div style={{
                padding: "16px 28px", borderRadius: 12,
                background: "linear-gradient(135deg, rgba(45,106,79,.08), rgba(52,211,153,.04))",
                border: `2px dashed ${P}`,
                position: "relative",
              }}>
                <div style={{ fontSize: ".55rem", color: "#8B9080", fontWeight: 700, letterSpacing: ".15em", marginBottom: 6 }}>ROOM CODE</div>
                <div style={{
                  fontSize: "2rem", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
                  color: P, letterSpacing: ".1em",
                  textShadow: "0 0 20px rgba(45,106,79,.3)",
                }}>{roomCode}</div>
              </div>

              <button onClick={handleCopyCode} style={{
                padding: "8px 24px", borderRadius: 8, border: `1px solid ${P}40`,
                background: copied ? "rgba(45,106,79,.15)" : "rgba(45,106,79,.06)",
                color: P, fontSize: ".82rem", fontWeight: 600, cursor: "pointer",
                transition: "all .2s", display: "flex", alignItems: "center", gap: 6,
              }}>
                {copied ? "✓ Copied!" : "📋 Copy Code"}
              </button>

              {/* Waiting spinner */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 8, background: "rgba(255,255,255,.65)", border: "1px solid rgba(0,0,0,.06)" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(45,106,79,.12)", borderTop: `2px solid ${P}`, animation: "spin 1.5s linear infinite" }} />
                <span style={{ fontSize: ".82rem", color: "#6B7264" }}>Waiting for your friend to join…</span>
              </div>

              <FactCard factIdx={factIdx} />
              <button onClick={() => setMode("menu")} style={backToMenuBtn}>← Cancel & go back</button>
            </div>
          )}

          {/* ── Join a Friend's Room ──────────────────────────────────── */}
          {mode === "joining" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem" }}>🔗</div>
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#60A5FA", margin: "0 0 6px" }}>Join a Room</h2>
                <p style={{ color: "#6B7264", fontSize: ".85rem" }}>Enter the code your friend shared</p>
              </div>

              {error && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.18)", color: "#EF4444", fontSize: ".82rem", width: "100%", textAlign: "left" }}>
                  ⚠ {error}
                </div>
              )}

              <div style={{ width: "100%" }}>
                <div style={{ fontSize: ".55rem", color: "#8B9080", fontWeight: 700, letterSpacing: ".15em", marginBottom: 6, textAlign: "left" }}>ROOM CODE</div>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. KNIGHT425"
                  maxLength={20}
                  onKeyDown={(e) => { if (e.key === "Enter") handleJoinRoom(); }}
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: 10,
                    border: "1px solid rgba(59,130,246,.2)", background: "rgba(59,130,246,.04)",
                    color: "#60A5FA", fontSize: "1.2rem", fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace", letterSpacing: ".08em",
                    textAlign: "center", outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color .2s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,.5)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,.2)"; }}
                />
              </div>

              <button onClick={handleJoinRoom} disabled={!wsReady || !joinCode.trim()} style={{
                width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
                cursor: (wsReady && joinCode.trim()) ? "pointer" : "not-allowed",
                background: (wsReady && joinCode.trim()) ? "linear-gradient(135deg, #3B82F6, #60A5FA)" : "rgba(0,0,0,.04)",
                color: (wsReady && joinCode.trim()) ? "#fff" : "#4B5563",
                fontSize: "1.05rem", fontWeight: 700, transition: "all .3s",
                boxShadow: (wsReady && joinCode.trim()) ? "0 8px 32px rgba(59,130,246,.2)" : "none",
              }}
                onMouseEnter={(e) => { if (wsReady && joinCode.trim()) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                Join Game
              </button>

              <button onClick={() => { setMode("menu"); setError(""); setJoinCode(""); }} style={backToMenuBtn}>← Back to menu</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reusable sub-components ──────────────────────────────────────────────────

function FactCard({ factIdx }: { factIdx: number }) {
  return (
    <div key={factIdx} style={{
      padding: "14px 18px", borderRadius: 10, maxWidth: 340, animation: "fadeIn .5s ease",
      background: "rgba(45,106,79,.04)", border: "1px solid rgba(45,106,79,.1)",
    }}>
      <div style={{ fontSize: ".6rem", color: P, fontWeight: 700, letterSpacing: ".12em", marginBottom: 6 }}>DID YOU KNOW?</div>
      <p style={{ fontSize: ".82rem", color: "#6B7264", lineHeight: 1.6, fontStyle: "italic", margin: 0 }}>{FACTS[factIdx]}</p>
    </div>
  );
}

// ── Style helpers ────────────────────────────────────────────────────────────

function primaryBtn(wsReady: boolean): CSSProperties {
  return {
    padding: "14px 0", borderRadius: 10, border: "none",
    cursor: wsReady ? "pointer" : "not-allowed",
    background: wsReady ? `linear-gradient(135deg, ${P}, #40916C)` : "rgba(0,0,0,.04)",
    color: wsReady ? "#FAFAF7" : "#4B5563",
    fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-.01em",
    transition: "all .3s",
    boxShadow: wsReady ? "0 8px 32px rgba(45,106,79,.2)" : "none",
  };
}

function secondaryBtn(wsReady: boolean): CSSProperties {
  return {
    flex: 1, padding: "14px 10px", borderRadius: 10,
    border: `1px solid rgba(45,106,79,.15)`,
    background: "rgba(45,106,79,.04)",
    color: wsReady ? "#A7C4B5" : "#4B5563",
    fontSize: ".88rem", fontWeight: 600, cursor: wsReady ? "pointer" : "not-allowed",
    transition: "all .2s",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
  };
}

const backToMenuBtn: CSSProperties = {
  background: "none", border: "none", color: "#8B9080",
  fontSize: ".78rem", cursor: "pointer", padding: "4px 8px",
  transition: "color .2s",
};

const pageStyle: CSSProperties = {
  minHeight: "100vh", background: "#FAFAF7", color: "#1A1A1A",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "40px 20px", position: "relative", overflow: "hidden",
};

const card: CSSProperties = {
  background: "rgba(255,255,255,.6)", border: "1px solid rgba(0,0,0,.06)",
  borderRadius: 16, padding: "32px 36px", boxShadow: "0 24px 64px rgba(0,0,0,.06)",
};

const backLink: CSSProperties = {
  color: "#8B9080", textDecoration: "none", fontSize: ".82rem",
  display: "block", marginBottom: 10,
};

const bgGrid: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  backgroundImage: "linear-gradient(rgba(45,106,79,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(45,106,79,.015) 1px,transparent 1px)",
  backgroundSize: "72px 72px",
};

const bgGlow: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  background: "radial-gradient(ellipse at 50% 30%,rgba(45,106,79,.06) 0%,transparent 55%)",
};
