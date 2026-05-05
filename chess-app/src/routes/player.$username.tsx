import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { apiGetPlayerProfile, type PlayerProfile } from "../lib/auth-client";

export const Route = createFileRoute("/player/$username")({
  component: PlayerProfilePage,
});

const P = "#2D6A4F";

function PlayerProfilePage() {
  const { username } = Route.useParams();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiGetPlayerProfile(username)
      .then(setProfile)
      .catch((err) => setError(err.message ?? "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={bgGrid} />
        <div style={bgGlow} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #1F2937", borderTop: `3px solid ${P}`, borderRadius: "50%", animation: "spin .8s linear infinite", marginBottom: 16 }} />
          <p style={{ color: "#6B7264", fontSize: ".9rem" }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={pageStyle}>
        <div style={bgGrid} />
        <div style={bgGlow} />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginTop: 120 }}>
          <div style={{ fontSize: "3rem", marginBottom: 16, opacity: 0.3 }}>👤</div>
          <h2 style={{ color: "#1A1A1A", fontSize: "1.5rem", marginBottom: 8 }}>Player Not Found</h2>
          <p style={{ color: "#6B7264", marginBottom: 24 }}>{error ?? `No player with username "${username}"`}</p>
          <Link to="/" style={{ color: P, textDecoration: "none", fontWeight: 600 }}>← Back to Home</Link>
        </div>
      </div>
    );
  }

  const { user, stats, ratingHistory, recentGames } = profile;

  return (
    <div style={pageStyle}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      {/* Nav */}
      <nav style={navStyle}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <span style={{ fontSize: "1.2rem" }}>♛</span>
          <span style={{ fontWeight: 800, color: P, fontSize: "1rem", letterSpacing: "-.02em" }}>Chess Arena</span>
        </Link>
        <Link to="/" style={{ color: "#6B7264", textDecoration: "none", fontSize: ".85rem", fontWeight: 500 }}>← Home</Link>
      </nav>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, width: "100%", animation: "fadeIn .5s ease" }}>

        {/* Profile Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 24, padding: "32px 28px",
          background: "rgba(255,255,255,.65)", border: "1px solid rgba(0,0,0,.06)",
          borderRadius: 18, marginBottom: 24,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: `linear-gradient(135deg, ${P}, #40916C)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: "2rem", color: "#FAFAF7",
            flexShrink: 0,
          }}>
            {user.username[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#1A1A1A", margin: "0 0 4px", lineHeight: 1.2 }}>
              @{user.username}
            </h1>
            <div style={{ fontSize: ".85rem", color: "#6B7264", marginBottom: 8 }}>{user.name}</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: P, fontWeight: 800, fontSize: "1.1rem" }}>⚡ {user.rating}</span>
                <span style={{ color: "#8B9080", fontSize: ".7rem" }}>ELO</span>
              </div>
              <div style={{ fontSize: ".75rem", color: "#8B9080" }}>
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 24 }}>
          {[
            { label: "WINS", value: stats.wins, color: "#2D6A4F" },
            { label: "LOSSES", value: stats.losses, color: "#EF4444" },
            { label: "DRAWS", value: stats.draws, color: "#F59E0B" },
            { label: "TOTAL", value: stats.totalGames, color: "#6366F1" },
            { label: "WIN RATE", value: `${stats.winRate}%`, color: P },
            { label: "BEST STREAK", value: stats.bestWinStreak, color: "#40916C" },
          ].map((s, i) => (
            <div key={i} style={{
              padding: "18px 14px", background: "rgba(255,255,255,.65)",
              border: "1px solid rgba(0,0,0,.06)", borderRadius: 12, textAlign: "center",
            }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color, marginBottom: 3 }}>{s.value}</div>
              <div style={{ fontSize: ".6rem", color: "#8B9080", letterSpacing: ".1em", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Two Column: Rating History + Openings */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Rating Graph (simple sparkline) */}
          <div style={{
            padding: "20px 22px", background: "rgba(255,255,255,.65)",
            border: "1px solid rgba(0,0,0,.06)", borderRadius: 14,
          }}>
            <h3 style={{ fontSize: ".85rem", fontWeight: 700, color: "#1A1A1A", margin: "0 0 14px" }}>Rating History</h3>
            {ratingHistory.length === 0 ? (
              <p style={{ color: "#8B9080", fontSize: ".8rem" }}>No rating history yet</p>
            ) : (
              <RatingChart entries={ratingHistory} />
            )}
          </div>

          {/* Openings + More Stats */}
          <div style={{
            padding: "20px 22px", background: "rgba(255,255,255,.65)",
            border: "1px solid rgba(0,0,0,.06)", borderRadius: 14,
          }}>
            <h3 style={{ fontSize: ".85rem", fontWeight: 700, color: "#1A1A1A", margin: "0 0 14px" }}>Game Insights</h3>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: ".68rem", color: "#8B9080", letterSpacing: ".08em", marginBottom: 6 }}>AVG GAME LENGTH</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: P }}>{stats.avgGameLength} moves</div>
            </div>
            <div>
              <div style={{ fontSize: ".68rem", color: "#8B9080", letterSpacing: ".08em", marginBottom: 6 }}>TOP OPENINGS</div>
              {stats.mostPlayedOpenings.length === 0 ? (
                <p style={{ color: "#8B9080", fontSize: ".8rem" }}>No data yet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {stats.mostPlayedOpenings.map((o, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "4px 8px", background: "rgba(255,255,255,.65)",
                      borderRadius: 6, fontSize: ".75rem", color: "#6B7264",
                    }}>
                      <span style={{ color: P, fontWeight: 700, width: 18 }}>#{i + 1}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{o}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Games */}
        <div style={{
          padding: "20px 22px", background: "rgba(255,255,255,.65)",
          border: "1px solid rgba(0,0,0,.06)", borderRadius: 14, marginBottom: 40,
        }}>
          <h3 style={{ fontSize: ".85rem", fontWeight: 700, color: "#1A1A1A", margin: "0 0 14px" }}>Recent Games</h3>
          {recentGames.length === 0 ? (
            <p style={{ color: "#8B9080", fontSize: ".8rem" }}>No games played yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentGames.map((g) => {
                const isWinner = g.winner === username;
                const isLoser = g.runnerup === username;
                const isDraw = g.status === "finished" && !g.winner;
                const opponent = g.player1ID === username ? g.player2ID : g.player1ID;

                return (
                  <div key={g.roomID} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px", background: "rgba(255,255,255,.65)",
                    border: "1px solid rgba(0,0,0,.04)", borderRadius: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 7, display: "flex",
                        alignItems: "center", justifyContent: "center", fontSize: ".9rem",
                        background: isWinner ? "rgba(45,106,79,.1)" : isLoser ? "rgba(239,68,68,.1)" : "rgba(107,114,128,.1)",
                        border: `1px solid ${isWinner ? "rgba(45,106,79,.2)" : isLoser ? "rgba(239,68,68,.2)" : "rgba(107,114,128,.2)"}`,
                      }}>
                        {isWinner ? "🏆" : isLoser ? "💀" : isDraw ? "🤝" : "⏳"}
                      </div>
                      <div>
                        <Link to="/player/$username" params={{ username: opponent }} style={{
                          fontSize: ".82rem", fontWeight: 600, color: "#1A1A1A", textDecoration: "none",
                        }}>vs {opponent}</Link>
                        <div style={{ fontSize: ".65rem", color: "#8B9080" }}>
                          {g.result ?? "checkmate"} · {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{
                        fontSize: ".68rem", fontWeight: 600, padding: "2px 8px", borderRadius: 5,
                        background: isWinner ? "rgba(45,106,79,.1)" : isLoser ? "rgba(239,68,68,.08)" : "rgba(107,114,128,.08)",
                        color: isWinner ? P : isLoser ? "#EF4444" : "#6B7280",
                      }}>
                        {isWinner ? "Won" : isLoser ? "Lost" : isDraw ? "Draw" : "In progress"}
                      </span>
                      <Link to="/analyse/$roomId" params={{ roomId: g.roomID }} style={{
                        fontSize: ".68rem", fontWeight: 600, padding: "2px 8px", borderRadius: 5,
                        background: "rgba(45,106,79,.06)", border: `1px solid ${P}25`, color: P,
                        textDecoration: "none",
                      }}>Analyse</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Simple Rating Chart (SVG sparkline) ──────────────────────────────────────

function RatingChart({ entries }: { entries: { rating: number; change: number; createdAt: string }[] }) {
  if (entries.length < 2) {
    return <p style={{ color: "#8B9080", fontSize: ".8rem" }}>Not enough data for graph (need 2+ games)</p>;
  }

  const W = 320, H = 100, PAD = 8;
  const ratings = entries.map((e) => e.rating);
  const min = Math.min(...ratings) - 10;
  const max = Math.max(...ratings) + 10;
  const range = max - min || 1;

  const points = entries.map((e, i) => {
    const x = PAD + (i / (entries.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (e.rating - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(" ");

  const lastEntry = entries[entries.length - 1];
  const trend = lastEntry.change >= 0 ? P : "#EF4444";

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        <defs>
          <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={P} stopOpacity="0.3" />
            <stop offset="100%" stopColor={P} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Fill area */}
        <polygon
          points={`${PAD},${H - PAD} ${points} ${W - PAD},${H - PAD}`}
          fill="url(#ratingGrad)"
        />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={P}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current dot */}
        {entries.length > 0 && (() => {
          const last = entries[entries.length - 1];
          const x = PAD + ((entries.length - 1) / (entries.length - 1)) * (W - PAD * 2);
          const y = PAD + (1 - (last.rating - min) / range) * (H - PAD * 2);
          return <circle cx={x} cy={y} r="4" fill={trend} />;
        })()}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: ".65rem", color: "#8B9080" }}>{ratings[0]} ELO</span>
        <span style={{ fontSize: ".75rem", fontWeight: 700, color: trend }}>
          {lastEntry.rating} ELO ({lastEntry.change >= 0 ? "+" : ""}{lastEntry.change})
        </span>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: "100vh", background: "#FAFAF7", color: "#1A1A1A",
  display: "flex", flexDirection: "column", alignItems: "center",
  padding: "60px 24px", position: "relative", overflow: "hidden",
};

const bgGrid: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  backgroundImage: "linear-gradient(rgba(45,106,79,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(45,106,79,0.015) 1px, transparent 1px)",
  backgroundSize: "72px 72px",
};

const bgGlow: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  background: "radial-gradient(ellipse at 50% 0%, rgba(45,106,79,0.06) 0%, transparent 50%)",
};

const navStyle: CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
  padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "rgba(250,250,247,.88)", backdropFilter: "blur(16px)",
  borderBottom: "1px solid rgba(0,0,0,.04)",
};
