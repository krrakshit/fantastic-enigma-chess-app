import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../lib/auth-context";
import { apiGetGameHistory, type Game } from "../lib/auth-client";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

const P = "#2D6A4F";

function HistoryPage() {
  const { status, user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated" && user) {
      apiGetGameHistory(user.username)
        .then(setGames)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [status, user]);

  if (status === "loading" || loading) {
    return (
      <div style={centerPage}>
        <div style={{ width: 36, height: 36, border: "2px solid #E5E5E0", borderTop: `2px solid ${P}`, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
        <p style={{ color: "#6B7264", marginTop: 16 }}>Loading history...</p>
      </div>
    );
  }

  if (status !== "authenticated" || !user) {
    return (
      <div style={centerPage}>
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔒</div>
        <p style={{ color: "#6B7264", marginBottom: 16 }}>Sign in to view your game history</p>
        <Link to="/signin" style={{ color: P, textDecoration: "none", fontWeight: 600 }}>Sign in →</Link>
      </div>
    );
  }

  // Stats
  const totalGames = games.length;
  const wins = games.filter(g => g.winner === user.username).length;
  const losses = games.filter(g => g.runnerup === user.username).length;
  const _draws = totalGames - wins - losses; // used for display stats
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  return (
    <div style={pageStyle}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 820, width: "100%", animation: "fadeIn .5s ease" }}>
        <Link to="/" style={{ color: "#8B9080", textDecoration: "none", fontSize: ".82rem", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4B5563"; }}
        >← Home</Link>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#1A1A1A", marginBottom: 8 }}>Game History</h1>
        <p style={{ color: "#6B7264", fontSize: ".9rem", marginBottom: 32 }}>Your matches, results, and analysis.</p>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 36 }}>
          {[
            { label: "Games", value: totalGames, color: "#1A1A1A" },
            { label: "Wins", value: wins, color: P },
            { label: "Losses", value: losses, color: "#EF4444" },
            { label: "Win Rate", value: `${winRate}%`, color: P },
          ].map((s, i) => (
            <div key={i} style={statCard}>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: ".68rem", color: "#8B9080", letterSpacing: ".08em", fontWeight: 600, marginTop: 2 }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Games list */}
        {games.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, background: "rgba(255,255,255,.65)", border: "1px solid rgba(0,0,0,.06)", borderRadius: 16 }}>
            <div style={{ fontSize: "3rem", marginBottom: 14, opacity: 0.4 }}>♟</div>
            <p style={{ color: "#6B7264" }}>No games yet. Go play!</p>
            <Link to="/game" style={{ color: P, textDecoration: "none", fontWeight: 600, marginTop: 12, display: "inline-block" }}>Find a game →</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {games.map((g) => {
              const isWinner = g.winner === user.username;
              const isLoser = g.runnerup === user.username;
              const isDraw = g.status === "finished" && !g.winner;
              const opponentId = g.player1ID === user.username ? g.player2ID : g.player1ID;
              const myPoints = isWinner ? g.winnerPoints : g.runnerupPoints;

              return (
                <div key={g.id} style={gameRow}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(45,106,79,.2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,.06)"; }}
                >
                  {/* Result */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0,
                    background: isWinner ? "rgba(45,106,79,.1)" : isLoser ? "rgba(239,68,68,.08)" : "rgba(107,114,128,.08)",
                  }}>
                    {isWinner ? "🏆" : isLoser ? "💀" : isDraw ? "🤝" : "⏳"}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: ".9rem", fontWeight: 600, color: "#1A1A1A" }}>
                      vs <span style={{ color: P }}>{opponentId}</span>
                    </div>
                    <div style={{ fontSize: ".72rem", color: "#8B9080", marginTop: 2 }}>
                      {g.moves.length} moves · {myPoints} pts{g.createdAt ? ` · ${new Date(g.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                    </div>
                  </div>

                  {/* Result badge */}
                  <span style={{
                    fontSize: ".72rem", fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                    background: isWinner ? "rgba(45,106,79,.1)" : isLoser ? "rgba(239,68,68,.08)" : "rgba(107,114,128,.08)",
                    color: isWinner ? P : isLoser ? "#EF4444" : "#6B7280",
                    flexShrink: 0,
                  }}>
                    {isWinner ? "Won" : isLoser ? "Lost" : isDraw ? "Draw" : "Live"}
                  </span>

                  {/* Analyse button */}
                  {g.status === "finished" && (
                    <Link to="/analyse/$roomId" params={{ roomId: g.roomID }} style={analyseBtn}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(45,106,79,.15)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(45,106,79,.06)"; }}
                    >Analyse ↗</Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: "100vh", background: "#FAFAF7",
  display: "flex", flexDirection: "column", alignItems: "center",
  padding: "48px 24px", position: "relative", overflow: "hidden",
};

const centerPage: CSSProperties = {
  minHeight: "100vh", background: "#FAFAF7",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
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

const statCard: CSSProperties = {
  padding: "20px 16px", textAlign: "center",
  background: "rgba(255,255,255,.65)", border: "1px solid rgba(0,0,0,.06)",
  borderRadius: 12,
};

const gameRow: CSSProperties = {
  display: "flex", alignItems: "center", gap: 14,
  padding: "14px 18px", background: "rgba(255,255,255,.65)",
  border: "1px solid rgba(0,0,0,.06)", borderRadius: 12,
  transition: "all .2s",
};

const analyseBtn: CSSProperties = {
  fontSize: ".72rem", fontWeight: 600, padding: "4px 12px", borderRadius: 6,
  background: "rgba(45,106,79,.06)", border: "1px solid rgba(45,106,79,.15)",
  color: P, textDecoration: "none", transition: "all .2s", flexShrink: 0,
};
