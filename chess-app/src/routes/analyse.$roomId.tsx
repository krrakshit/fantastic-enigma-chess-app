 import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../lib/auth-context";
import { apiAnalyseGame, type AnalysisResult, type MoveAnalysis } from "../lib/auth-client";

export const Route = createFileRoute("/analyse/$roomId")({
  component: AnalysePage,
});

const P = "#10B981";

const CLASSIFICATION_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  best:       { bg: "rgba(16,185,129,.1)",  border: "rgba(16,185,129,.25)", text: "#10B981", label: "Best" },
  excellent:  { bg: "rgba(52,211,153,.08)", border: "rgba(52,211,153,.2)",  text: "#34D399", label: "Excellent" },
  good:       { bg: "rgba(96,165,250,.08)", border: "rgba(96,165,250,.2)",  text: "#60A5FA", label: "Good" },
  inaccuracy: { bg: "rgba(245,158,11,.08)", border: "rgba(245,158,11,.2)",  text: "#F59E0B", label: "Inaccuracy" },
  mistake:    { bg: "rgba(249,115,22,.08)", border: "rgba(249,115,22,.2)",  text: "#F97316", label: "Mistake" },
  blunder:    { bg: "rgba(239,68,68,.1)",   border: "rgba(239,68,68,.25)",  text: "#EF4444", label: "Blunder" },
};

function AnalysePage() {
  const { roomId } = Route.useParams();
  const { status, user } = useAuth();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMove, setSelectedMove] = useState<number | null>(null);

  useEffect(() => {
    if (status === "authenticated" && user) {
      apiAnalyseGame(user.username, roomId)
        .then(setResult)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else if (status !== "loading") {
      setLoading(false);
      setError("Sign in to view analysis.");
    }
  }, [status, user, roomId]);

  if (loading) {
    return (
      <div style={centerPage}>
        <div style={{ width: 44, height: 44, border: "3px solid #1F2937", borderTop: `3px solid ${P}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ color: "#6B7280", marginTop: 16, fontSize: ".9rem" }}>Analysing game with Stockfish...</p>
        <p style={{ color: "#374151", fontSize: ".75rem", marginTop: 6 }}>This may take a moment</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centerPage}>
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>⚠️</div>
        <p style={{ color: "#EF4444", fontSize: ".95rem", textAlign: "center", maxWidth: 400 }}>{error}</p>
        <Link to="/history" style={{ color: P, textDecoration: "none", fontWeight: 600, marginTop: 16 }}>← Back to history</Link>
      </div>
    );
  }

  if (!result) return null;

  // Stats
  const whiteMoves = result.analysis.filter(m => m.color === "white");
  const blackMoves = result.analysis.filter(m => m.color === "black");

  const countClassification = (moves: MoveAnalysis[], cls: string) => moves.filter(m => m.classification === cls).length;

  const acc = (moves: MoveAnalysis[]) => {
    if (moves.length === 0) return 0;
    const good = moves.filter(m => ["best", "excellent", "good"].includes(m.classification)).length;
    return Math.round((good / moves.length) * 100);
  };

  const whiteAcc = acc(whiteMoves);
  const blackAcc = acc(blackMoves);
  const selected = selectedMove !== null ? result.analysis[selectedMove] : null;

  return (
    <div style={pageStyle}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, width: "100%", animation: "fadeIn .5s ease" }}>
        {/* Header */}
        <Link to="/history" style={{ color: "#4B5563", textDecoration: "none", fontSize: ".82rem", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4B5563"; }}
        >← Back to history</Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#E5E7EB", margin: "0 0 4px" }}>Game Analysis</h1>
            <p style={{ color: "#4B5563", fontSize: ".82rem" }}>
              {result.winner ?? "Draw"} vs {result.runnerup ?? "—"} · Room {roomId.slice(0, 8)}…
            </p>
          </div>
          {result.winner && (
            <div style={{
              padding: "6px 16px", borderRadius: 8,
              background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)",
              color: P, fontSize: ".82rem", fontWeight: 600,
            }}>🏆 {result.winner} won</div>
          )}
        </div>

        {/* Player accuracy cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
          {[
            { label: "White", moves: whiteMoves, accuracy: whiteAcc },
            { label: "Black", moves: blackMoves, accuracy: blackAcc },
          ].map((side, si) => (
            <div key={si} style={playerCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: si === 0 ? "linear-gradient(135deg,#fff,#d1d5db)" : "linear-gradient(135deg,#374151,#111)",
                  border: "2px solid rgba(255,255,255,.15)",
                }} />
                <div>
                  <div style={{ fontSize: ".88rem", fontWeight: 600, color: "#E5E7EB" }}>{side.label}</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: P }}>{side.accuracy}%</div>
                  <div style={{ fontSize: ".6rem", color: "#4B5563", letterSpacing: ".08em" }}>ACCURACY</div>
                </div>
              </div>
              {/* Classification breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {(["best", "excellent", "good", "inaccuracy", "mistake", "blunder"] as const).map(cls => {
                  const c = CLASSIFICATION_COLORS[cls];
                  const count = countClassification(side.moves, cls);
                  return (
                    <div key={cls} style={{
                      padding: "6px 8px", borderRadius: 6, textAlign: "center",
                      background: c.bg, border: `1px solid ${c.border}`,
                    }}>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: c.text }}>{count}</div>
                      <div style={{ fontSize: ".58rem", color: c.text, opacity: 0.7, letterSpacing: ".04em" }}>{c.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Move list */}
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 80px 90px 90px", padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.015)" }}>
            {["#", "Move", "Color", "Score", "Quality"].map(h => (
              <div key={h} style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".1em", fontWeight: 700 }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {result.analysis.map((m, i) => {
              const c = CLASSIFICATION_COLORS[m.classification] ?? CLASSIFICATION_COLORS.good;
              const isSelected = selectedMove === i;

              return (
                <div key={i}
                  onClick={() => setSelectedMove(isSelected ? null : i)}
                  style={{
                    display: "grid", gridTemplateColumns: "50px 1fr 80px 90px 90px",
                    padding: "10px 18px", cursor: "pointer",
                    background: isSelected ? "rgba(16,185,129,.06)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,.01)",
                    borderBottom: "1px solid rgba(255,255,255,.03)",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.03)"; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,.01)"; }}
                >
                  <span style={{ fontSize: ".78rem", color: "#4B5563", fontWeight: 600 }}>{m.moveNumber}</span>
                  <span style={{ fontSize: ".85rem", fontWeight: 600, color: "#E5E7EB", fontFamily: "'JetBrains Mono', monospace" }}>{m.move}</span>
                  <span style={{ fontSize: ".78rem", color: m.color === "white" ? "#D1D5DB" : "#6B7280" }}>{m.color}</span>
                  <span style={{ fontSize: ".78rem", fontFamily: "'JetBrains Mono', monospace", color: "#9CA3AF" }}>
                    {m.mate !== null ? `M${m.mate}` : m.score !== null ? `${m.score > 0 ? "+" : ""}${(m.score / 100).toFixed(1)}` : "—"}
                  </span>
                  <span style={{
                    fontSize: ".7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                    background: c.bg, color: c.text, display: "inline-block", width: "fit-content",
                  }}>{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Move Detail panel */}
        {selected && (
          <div style={{
            marginTop: 16, padding: "18px 22px", background: "rgba(255,255,255,.025)",
            border: "1px solid rgba(16,185,129,.15)", borderRadius: 12,
            animation: "fadeIn .3s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".08em" }}>MOVE {selected.moveNumber}</span>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#E5E7EB" }}>{selected.move}</div>
              </div>
              <div style={{ height: 32, width: 1, background: "rgba(255,255,255,.08)" }} />
              <div>
                <span style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".08em" }}>CLASSIFICATION</span>
                <div style={{ fontSize: ".95rem", fontWeight: 600, color: (CLASSIFICATION_COLORS[selected.classification] ?? CLASSIFICATION_COLORS.good).text }}>
                  {(CLASSIFICATION_COLORS[selected.classification] ?? CLASSIFICATION_COLORS.good).label}
                </div>
              </div>
              <div style={{ height: 32, width: 1, background: "rgba(255,255,255,.08)" }} />
              <div>
                <span style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".08em" }}>ENGINE SCORE</span>
                <div style={{ fontSize: ".95rem", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: "#9CA3AF" }}>
                  {selected.mate !== null ? `Mate in ${selected.mate}` : selected.score !== null ? `${(selected.score / 100).toFixed(2)}` : "—"}
                </div>
              </div>
              {selected.bestMove && (
                <>
                  <div style={{ height: 32, width: 1, background: "rgba(255,255,255,.08)" }} />
                  <div>
                    <span style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".08em" }}>BEST MOVE</span>
                    <div style={{ fontSize: ".95rem", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: P }}>{selected.bestMove}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <p style={{ color: "#374151", fontSize: ".72rem" }}>Powered by Stockfish · Depth 15</p>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: "100vh", background: "#0A0A0F",
  display: "flex", flexDirection: "column", alignItems: "center",
  padding: "48px 24px", position: "relative", overflow: "hidden",
};

const centerPage: CSSProperties = {
  minHeight: "100vh", background: "#0A0A0F",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
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

const playerCard: CSSProperties = {
  padding: "20px 22px",
  background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 14,
};
