import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../lib/auth-context";
import { apiGetGameHistory, type Game } from "../lib/auth-client";

export const Route = createFileRoute("/")(
  { component: HomePage }
);

const G = "#2D6A4F";
const GL = "#40916C";
const B = "#8B7355";


function HomePage() {
  const { status, user, signout } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && user) {
      setLoadingGames(true);
      apiGetGameHistory(user.username)
        .then((data) => setGames(data))
        .catch(() => {})
        .finally(() => setLoadingGames(false));
    }
  }, [status, user]);

  const recentGames = games.slice(0, 5);

  return (
    <div style={pageStyle}>

      {/* Animated chessboard background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        opacity: 0.025,
        backgroundImage: `
          linear-gradient(45deg, ${G} 25%, transparent 25%),
          linear-gradient(-45deg, ${G} 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, ${G} 75%),
          linear-gradient(-45deg, transparent 75%, ${G} 75%)
        `,
        backgroundSize: "60px 60px",
        backgroundPosition: "0 0, 0 30px, 30px -30px, -30px 0px",
        animation: "boardFade 8s ease-in-out infinite",
      }} />
      {/* Warm radial glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse at 30% 20%, rgba(45,106,79,.04) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(139,115,85,.03) 0%, transparent 50%)` }} />

      {/* Nav */}
      <nav style={navStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${G}, ${GL})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem", color: "#fff", fontWeight: 800,
          }}>♛</div>
          <span style={{ fontWeight: 800, color: "#1A1A1A", fontSize: "1.05rem", letterSpacing: "-.02em" }}>Chess Arena</span>
        </div>

        {status === "loading" ? (
          <div style={{ width: 18, height: 18, border: `2px solid #E5E5E0`, borderTop: `2px solid ${G}`, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        ) : status === "authenticated" && user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link to="/player/$username" params={{ username: user.username }} style={{ color: "#6B7264", textDecoration: "none", fontSize: ".85rem", fontWeight: 500, transition: "color .2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = G; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6B7264"; }}
            >Profile</Link>
            <Link to="/history" style={{ color: "#6B7264", textDecoration: "none", fontSize: ".85rem", fontWeight: 500, transition: "color .2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = G; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6B7264"; }}
            >History</Link>
            <Link to="/analyse/pgn" style={{ color: "#6B7264", textDecoration: "none", fontSize: ".85rem", fontWeight: 500, transition: "color .2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = G; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6B7264"; }}
            >Analyse PGN</Link>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: `rgba(45,106,79,.05)`, border: `1px solid rgba(45,106,79,.1)`,
              borderRadius: 8, padding: "5px 12px",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: `linear-gradient(135deg, ${G}, ${GL})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: ".7rem", color: "#fff",
              }}>{user.username[0].toUpperCase()}</div>
              <div>
                <div style={{ color: G, fontSize: ".78rem", fontWeight: 600, lineHeight: 1.2 }}>@{user.username}</div>
                <div style={{ color: B, fontSize: ".62rem", lineHeight: 1.2 }}>⚡ {user.rating} ELO</div>
              </div>
            </div>
            <button onClick={() => signout()} style={signoutBtn}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#C0392B"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#9CA392"; }}
            >Sign out</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/signin" style={signinLink}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = G; (e.currentTarget as HTMLElement).style.borderColor = `rgba(45,106,79,.2)`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6B7264"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,115,85,.12)"; }}
            >Sign in</Link>
            <Link to="/signup" style={signupLink}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px rgba(45,106,79,.2)`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >Get started →</Link>
          </div>
        )}
      </nav>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", animation: "fadeIn .5s ease" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48, marginTop: 20 }}>
          {/* Animated mini board */}
          <div style={{
            display: "inline-grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0,
            borderRadius: 12, overflow: "hidden", marginBottom: 28,
            boxShadow: `0 8px 32px rgba(45,106,79,.08)`, border: `1px solid rgba(139,115,85,.1)`,
          }}>
            {Array.from({ length: 16 }).map((_, i) => {
              const row = Math.floor(i / 4);
              const col = i % 4;
              const isLight = (row + col) % 2 === 0;
              return (
                <div key={i} style={{
                  width: 28, height: 28,
                  background: isLight ? "#F0E6D3" : "#B8956A",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: ".7rem", color: isLight ? "rgba(139,115,85,.5)" : "rgba(240,230,211,.6)",
                  animation: `fadeIn ${0.3 + i * 0.05}s ease both`,
                }}>
                  {[0, 3, 5, 6, 9, 10, 12, 15].includes(i) ? ["♜","♞","♝","♛","♚","♝","♞","♜"][[0,3,5,6,9,10,12,15].indexOf(i)] : ""}
                </div>
              );
            })}
          </div>

          <h1 style={{
            fontSize: "clamp(2.2rem, 5vw, 3.8rem)", fontWeight: 900,
            color: "#1A1A1A", margin: "0 0 6px", letterSpacing: "-.04em", lineHeight: 1.1,
          }}>
            Play Chess<span style={{ color: G }}>.</span> Get Better<span style={{ color: B }}>.</span>
          </h1>
          <p style={{
            fontSize: "clamp(.9rem, 1.8vw, 1.1rem)", color: "#6B7264",
            maxWidth: 440, margin: "12px auto 36px", lineHeight: 1.7,
          }}>
            Real-time multiplayer with post-game Stockfish analysis. No accounts required to start.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/game" style={primaryBtn}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 48px rgba(45,106,79,.25)`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px rgba(45,106,79,.12)`; }}
            >Play Now →</Link>
            {status === "authenticated" && (
              <Link to="/history" style={secondaryBtn}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `rgba(45,106,79,.2)`; (e.currentTarget as HTMLElement).style.color = G; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,115,85,.12)"; (e.currentTarget as HTMLElement).style.color = "#6B7264"; }}
              >Game History</Link>
            )}
          </div>
        </div>

        {/* Info strip */}
        <div style={statsRow}>
          {[
            { icon: "⚡", value: "Real-time", label: "WebSocket multiplayer" },
            { icon: "🔬", value: "Stockfish 16", label: "Post-game analysis" },
            { icon: "♟", value: "Full rules", label: "Castling · en passant · promotion" },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: "22px 20px", textAlign: "center",
              borderRight: i < 2 ? `1px solid rgba(139,115,85,.08)` : "none",
            }}>
              <div style={{ fontSize: "1.3rem", marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: ".95rem", fontWeight: 700, color: "#1A1A1A", marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: ".7rem", color: "#9CA392", letterSpacing: ".02em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Games */}
        {status === "authenticated" && (
          <div style={{ width: "100%", marginTop: 56 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1A1A1A", margin: 0 }}>Recent Games</h2>
              {games.length > 5 && (
                <Link to="/history" style={{ color: G, textDecoration: "none", fontSize: ".82rem", fontWeight: 600 }}>View all →</Link>
              )}
            </div>

            {loadingGames ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 24, height: 24, border: `2px solid #E5E5E0`, borderTop: `2px solid ${G}`, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ color: "#9CA392", fontSize: ".85rem" }}>Loading…</p>
              </div>
            ) : recentGames.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "44px 20px",
                background: "rgba(255,255,255,.6)", border: `1px solid rgba(139,115,85,.08)`, borderRadius: 14,
              }}>
                <div style={{ fontSize: "2rem", marginBottom: 10, opacity: 0.35 }}>♟</div>
                <p style={{ color: "#6B7264", fontSize: ".88rem", marginBottom: 14 }}>No games played yet</p>
                <Link to="/game" style={{ color: G, textDecoration: "none", fontWeight: 600, fontSize: ".88rem" }}>Play your first game →</Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recentGames.map((g) => {
                  const isWinner = g.winner === user?.username;
                  const isLoser = g.runnerup === user?.username;
                  const isDraw = g.status === "finished" && !g.winner;
                  return (
                    <div key={g.id} style={gameCard}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `rgba(45,106,79,.15)`; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,115,85,.08)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: ".95rem",
                          background: isWinner ? `rgba(45,106,79,.06)` : isLoser ? "rgba(192,57,43,.06)" : "rgba(139,115,85,.06)",
                        }}>
                          {isWinner ? "🏆" : isLoser ? "💀" : isDraw ? "🤝" : "⏳"}
                        </div>
                        <div>
                          <div style={{ fontSize: ".85rem", fontWeight: 600, color: "#1A1A1A" }}>vs {g.player1ID === user?.username ? g.player2ID : g.player1ID}</div>
                          <div style={{ fontSize: ".7rem", color: "#9CA392" }}>
                            {g.moves.length} moves{g.createdAt ? ` · ${new Date(g.createdAt).toLocaleDateString()}` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{
                          fontSize: ".7rem", fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                          background: isWinner ? `rgba(45,106,79,.06)` : isLoser ? "rgba(192,57,43,.06)" : "rgba(139,115,85,.06)",
                          color: isWinner ? G : isLoser ? "#C0392B" : "#6B7264",
                        }}>
                          {isWinner ? "Won" : isLoser ? "Lost" : isDraw ? "Draw" : "In progress"}
                        </span>
                        {g.status === "finished" && (
                          <Link to="/analyse/$roomId" params={{ roomId: g.roomID }} style={{
                            fontSize: ".7rem", fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                            background: `rgba(45,106,79,.05)`, border: `1px solid rgba(45,106,79,.1)`,
                            color: G, textDecoration: "none", transition: "all .2s",
                          }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `rgba(45,106,79,.1)`; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `rgba(45,106,79,.05)`; }}
                          >Analyse</Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 64, paddingTop: 24, borderTop: `1px solid rgba(139,115,85,.08)`, textAlign: "center", width: "100%" }}>
          <p style={{ color: "#9CA392", fontSize: ".72rem" }}>
            Chess Arena — React · WebSockets · Stockfish
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: "100vh", background: "#FAFAF7", color: "#1A1A1A",
  display: "flex", flexDirection: "column", alignItems: "center",
  padding: "60px 24px", position: "relative", overflow: "hidden",
};

const navStyle: CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
  padding: "10px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "rgba(250,250,247,.88)", backdropFilter: "blur(16px)",
  borderBottom: `1px solid rgba(139,115,85,.06)`,
};

const signoutBtn: CSSProperties = {
  padding: "5px 12px", borderRadius: 6, border: `1px solid rgba(139,115,85,.1)`,
  background: "transparent", color: "#9CA392", fontSize: ".78rem", cursor: "pointer", transition: "all .2s",
};

const signinLink: CSSProperties = {
  padding: "6px 14px", borderRadius: 7, border: `1px solid rgba(139,115,85,.12)`,
  color: "#6B7264", textDecoration: "none", fontSize: ".82rem", fontWeight: 500, transition: "all .2s",
};

const signupLink: CSSProperties = {
  padding: "6px 14px", borderRadius: 7,
  background: `linear-gradient(135deg, #2D6A4F, #40916C)`,
  color: "#fff", textDecoration: "none", fontSize: ".82rem", fontWeight: 700, transition: "all .3s",
};

const primaryBtn: CSSProperties = {
  padding: "14px 36px",
  background: `linear-gradient(135deg, #2D6A4F, #40916C)`,
  color: "#fff", borderRadius: 10, textDecoration: "none",
  fontWeight: 700, fontSize: "1rem", letterSpacing: "-.01em",
  boxShadow: `0 6px 24px rgba(45,106,79,.12)`, transition: "all .3s ease",
};

const secondaryBtn: CSSProperties = {
  padding: "14px 28px", border: `1px solid rgba(139,115,85,.12)`,
  color: "#6B7264", borderRadius: 10, textDecoration: "none",
  fontWeight: 500, fontSize: "1rem", transition: "all .3s ease",
};

const statsRow: CSSProperties = {
  display: "flex", width: "100%", background: "rgba(255,255,255,.6)",
  border: `1px solid rgba(139,115,85,.08)`, borderRadius: 14, overflow: "hidden",
  backdropFilter: "blur(8px)",
};

const gameCard: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 16px", background: "rgba(255,255,255,.5)", border: `1px solid rgba(139,115,85,.08)`,
  borderRadius: 10, transition: "all .2s", cursor: "default",
};
