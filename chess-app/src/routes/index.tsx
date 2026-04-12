import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../lib/auth-context";
import { apiGetGameHistory, type Game } from "../lib/auth-client";

export const Route = createFileRoute("/")(
  { component: HomePage }
);

const P = "#10B981";

function HomePage() {
  const { status, user, signout } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && user) {
      setLoadingGames(true);
      apiGetGameHistory(user.username)
        .then((data) => {
          console.log("Game history loaded:", data);
          setGames(data);
        })
        .catch((err) => {
          console.error("Failed to load game history:", err);
        })
        .finally(() => setLoadingGames(false));
    }
  }, [status, user]);

  const recentGames = games.slice(0, 5);

  return (
    <div style={pageStyle}>

      {/* Background */}
      <div style={bgGrid} />
      <div style={bgGlow} />

      {/* Floating chess pieces */}
      {["♚", "♛", "♜", "♝", "♞", "♟"].map((p, i) => (
        <div key={i} style={{
          position: "fixed", fontSize: `${2.5 + i * 0.5}rem`,
          color: `rgba(16,185,129,0.03)`, pointerEvents: "none", userSelect: "none",
          top: `${10 + i * 13}%`,
          ...(i % 2 === 0 ? { left: `${3 + i * 2}%` } : { right: `${3 + i * 2}%` }),
          animation: `float ${7 + i}s ease-in-out infinite alternate`,
          animationDelay: `${i * 0.5}s`,
        }}>{p}</div>
      ))}

      {/* Nav */}
      <nav style={navStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.2rem" }}>♛</span>
          <span style={{ fontWeight: 800, color: P, fontSize: "1rem", letterSpacing: "-.02em" }}>Chess Arena</span>
        </div>

        {status === "loading" ? (
          <div style={{ width: 18, height: 18, border: "2px solid #222", borderTop: `2px solid ${P}`, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        ) : status === "authenticated" && user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link to="/player/$username" params={{ username: user.username }} style={{ color: "#6B7280", textDecoration: "none", fontSize: ".85rem", fontWeight: 500, transition: "color .2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}
            >Profile</Link>
            <Link to="/history" style={{ color: "#6B7280", textDecoration: "none", fontSize: ".85rem", fontWeight: 500, transition: "color .2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}
            >History</Link>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.15)",
              borderRadius: 8, padding: "5px 12px",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: `linear-gradient(135deg, ${P}, #34D399)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: ".7rem", color: "#0A0A0F",
              }}>{user.username[0].toUpperCase()}</div>
              <div>
                <div style={{ color: P, fontSize: ".78rem", fontWeight: 600, lineHeight: 1.2 }}>@{user.username}</div>
                <div style={{ color: "#4B5563", fontSize: ".62rem", lineHeight: 1.2 }}>⚡ {user.rating} ELO</div>
              </div>
            </div>
            <button onClick={() => signout()} style={signoutBtn}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#EF4444"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4B5563"; }}
            >Sign out</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/signin" style={signinLink}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P; (e.currentTarget as HTMLElement).style.borderColor = "rgba(16,185,129,.3)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6B7280"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.08)"; }}
            >Sign in</Link>
            <Link to="/signup" style={signupLink}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >Get started →</Link>
          </div>
        )}
      </nav>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", animation: "fadeIn .5s ease" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 56, marginTop: 20 }}>
          <div style={{ fontSize: "3.5rem", marginBottom: 14, animation: "float 4s ease-in-out infinite alternate" }}>♛</div>
          <h1 style={{
            fontSize: "clamp(2.5rem, 6vw, 4.2rem)", fontWeight: 900,
            background: `linear-gradient(135deg, ${P} 0%, #34D399 40%, ${P} 80%)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            margin: "0 0 14px", letterSpacing: "-.04em", lineHeight: 1.1,
          }}>Chess Arena</h1>
          <p style={{ fontSize: "clamp(.95rem, 2vw, 1.15rem)", color: "#6B7280", maxWidth: 460, margin: "0 auto 36px", lineHeight: 1.7 }}>
            Real-time multiplayer chess with deep engine analysis. Play, learn, improve.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/game" style={primaryBtn}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 48px rgba(16,185,129,.35)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(16,185,129,.2)"; }}
            >Play Multiplayer</Link>
            {status === "authenticated" && (
              <Link to="/history" style={secondaryBtn}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(16,185,129,.3)"; (e.currentTarget as HTMLElement).style.color = P; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.08)"; (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}
              >View History →</Link>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={statsRow}>
          {[
            { value: "Real-time", label: "MULTIPLAYER" },
            { value: "Stockfish", label: "ANALYSIS ENGINE" },
            { value: "Full", label: "CHESS RULES" },
            { value: "∞", label: "POSSIBLE GAMES" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 28px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,.04)" : "none", flex: 1 }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: P, marginBottom: 3 }}>{s.value}</div>
              <div style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".1em", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Games */}
        {status === "authenticated" && (
          <div style={{ width: "100%", marginTop: 56 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#E5E7EB", margin: 0 }}>Recent Games</h2>
              {games.length > 5 && (
                <Link to="/history" style={{ color: P, textDecoration: "none", fontSize: ".85rem", fontWeight: 600 }}>View all →</Link>
              )}
            </div>

            {loadingGames ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 28, height: 28, border: "2px solid #1F2937", borderTop: `2px solid ${P}`, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ color: "#4B5563", fontSize: ".85rem" }}>Loading games...</p>
              </div>
            ) : recentGames.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: 0.4 }}>♟</div>
                <p style={{ color: "#6B7280", fontSize: ".9rem", marginBottom: 16 }}>No games played yet</p>
                <Link to="/game" style={{ color: P, textDecoration: "none", fontWeight: 600 }}>Play your first game →</Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentGames.map((g) => {
                  const isWinner = g.winner === user?.username;
                  const isLoser = g.runnerup === user?.username;
                  const isDraw = g.status === "finished" && !g.winner;

                  return (
                    <div key={g.id} style={gameCard}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(16,185,129,.2)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.06)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                        {/* Result indicator */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "1rem",
                          background: isWinner ? "rgba(16,185,129,.1)" : isLoser ? "rgba(239,68,68,.1)" : "rgba(107,114,128,.1)",
                          border: `1px solid ${isWinner ? "rgba(16,185,129,.2)" : isLoser ? "rgba(239,68,68,.2)" : "rgba(107,114,128,.2)"}`,
                        }}>
                          {isWinner ? "🏆" : isLoser ? "💀" : isDraw ? "🤝" : "⏳"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: ".88rem", fontWeight: 600, color: "#E5E7EB" }}>vs {g.player1ID === user?.username ? g.player2ID : g.player1ID}</div>
                          <div style={{ fontSize: ".72rem", color: "#4B5563" }}>
                            {g.moves.length} moves{g.createdAt ? ` · ${new Date(g.createdAt).toLocaleDateString()}` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{
                          fontSize: ".72rem", fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                          background: isWinner ? "rgba(16,185,129,.1)" : isLoser ? "rgba(239,68,68,.08)" : "rgba(107,114,128,.08)",
                          color: isWinner ? P : isLoser ? "#EF4444" : "#6B7280",
                        }}>
                          {isWinner ? "Won" : isLoser ? "Lost" : isDraw ? "Draw" : "In progress"}
                        </span>
                        {g.status === "finished" && (
                          <Link to="/analyse/$roomId" params={{ roomId: g.roomID }} style={{
                            fontSize: ".72rem", fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                            background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.15)",
                            color: P, textDecoration: "none", transition: "all .2s",
                          }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,.12)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,.06)"; }}
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
        <div style={{ marginTop: 72, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,.04)", textAlign: "center", width: "100%" }}>
          <p style={{ color: "#374151", fontSize: ".75rem" }}>
            Chess Arena — React · WebSockets · Stockfish Engine
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: "100vh", background: "#0A0A0F", color: "#fff",
  display: "flex", flexDirection: "column", alignItems: "center",
  padding: "60px 16px", position: "relative", overflow: "hidden",
};

const bgGrid: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  backgroundImage: "linear-gradient(rgba(16,185,129,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.015) 1px, transparent 1px)",
  backgroundSize: "72px 72px",
};

const bgGlow: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  background: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.06) 0%, transparent 50%)",
};

const navStyle: CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
  padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "rgba(10,10,15,.8)", backdropFilter: "blur(16px)",
  borderBottom: "1px solid rgba(255,255,255,.04)",
  gap: 8, flexWrap: "wrap",
};

const signoutBtn: CSSProperties = {
  padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,.06)",
  background: "transparent", color: "#4B5563", fontSize: ".78rem", cursor: "pointer",
  transition: "all .2s",
};

const signinLink: CSSProperties = {
  padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,.08)",
  color: "#6B7280", textDecoration: "none", fontSize: ".82rem", fontWeight: 500, transition: "all .2s",
};

const signupLink: CSSProperties = {
  padding: "6px 14px", borderRadius: 7,
  background: `linear-gradient(135deg, #10B981, #34D399)`,
  color: "#0A0A0F", textDecoration: "none", fontSize: ".82rem", fontWeight: 700, transition: "all .2s",
};

const primaryBtn: CSSProperties = {
  padding: "14px 40px",
  background: `linear-gradient(135deg, #10B981, #34D399)`,
  color: "#0A0A0F", borderRadius: 10, textDecoration: "none",
  fontWeight: 700, fontSize: "1rem", letterSpacing: "-.01em",
  boxShadow: "0 8px 32px rgba(16,185,129,.2)",
  transition: "all .3s ease",
};

const secondaryBtn: CSSProperties = {
  padding: "14px 32px", border: "1px solid rgba(255,255,255,.08)",
  color: "#6B7280", borderRadius: 10, textDecoration: "none",
  fontWeight: 500, fontSize: "1rem", transition: "all .3s ease",
};

const statsRow: CSSProperties = {
  display: "flex", width: "100%", background: "rgba(255,255,255,.02)",
  border: "1px solid rgba(255,255,255,.05)", borderRadius: 14, overflow: "hidden",
  flexWrap: "wrap",
};

const gameCard: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 18px", background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 12, transition: "all .2s", cursor: "default",
};
