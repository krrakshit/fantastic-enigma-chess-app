import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../lib/auth-context";
import {
  apiAnalyseGame,
  apiEvaluatePosition,
  type AnalysisResult,
  type MoveAnalysis,
  type EvaluationResult,
} from "../lib/auth-client";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

export const Route = createFileRoute("/analyse/$roomId")({
  component: AnalysePage,
});

const P = "#10B981";
const ARROW_COLORS = ["rgba(16,185,129,0.8)", "rgba(96,165,250,0.6)", "rgba(245,158,11,0.45)"];

const CLASSIFICATION_COLORS: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  best: { bg: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.3)", text: "#10B981", label: "Best" },
  excellent: { bg: "rgba(52,211,153,.1)", border: "rgba(52,211,153,.25)", text: "#34D399", label: "Excellent" },
  good: { bg: "rgba(96,165,250,.1)", border: "rgba(96,165,250,.25)", text: "#60A5FA", label: "Good" },
  inaccuracy: { bg: "rgba(245,158,11,.1)", border: "rgba(245,158,11,.25)", text: "#F59E0B", label: "Inaccuracy" },
  mistake: { bg: "rgba(249,115,22,.1)", border: "rgba(249,115,22,.25)", text: "#F97316", label: "Mistake" },
  blunder: { bg: "rgba(239,68,68,.12)", border: "rgba(239,68,68,.3)", text: "#EF4444", label: "Blunder" },
};

function AnalysePage() {
  const { roomId } = Route.useParams();
  const { status, user } = useAuth();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Board state
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 = starting position
  const [explorationMoves, setExplorationMoves] = useState<string[]>([]); // alt moves from user
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  // Load analysis
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

  // Build chess instance for current position
  const chess = useMemo(() => {
    const c = new Chess();
    if (!result) return c;

    // Apply game moves up to currentMoveIndex
    const gameMoves = result.analysis.map((m) => m.move);
    const end = Math.min(currentMoveIndex + 1, gameMoves.length);
    for (let i = 0; i < end; i++) {
      const from = gameMoves[i].slice(0, 2);
      const to = gameMoves[i].slice(2, 4);
      const promotion = gameMoves[i].length > 4 ? gameMoves[i][4] : undefined;
      try {
        c.move({ from, to, promotion });
      } catch {
        break;
      }
    }

    // Apply exploration moves
    for (const m of explorationMoves) {
      const from = m.slice(0, 2);
      const to = m.slice(2, 4);
      const promotion = m.length > 4 ? m[4] : undefined;
      try {
        c.move({ from, to, promotion });
      } catch {
        break;
      }
    }

    return c;
  }, [result, currentMoveIndex, explorationMoves]);

  // Get UCI moves up to current position (for evaluation)
  const currentUciMoves = useMemo(() => {
    if (!result) return [];
    const gameMoves = result.analysis.map((m) => m.move);
    const end = Math.min(currentMoveIndex + 1, gameMoves.length);
    return [...gameMoves.slice(0, end), ...explorationMoves];
  }, [result, currentMoveIndex, explorationMoves]);

  // Evaluate position when it changes (debounced)
  const evaluateCurrentPosition = useCallback(async () => {
    setEvalLoading(true);
    try {
      const ev = await apiEvaluatePosition(currentUciMoves, 12, 3);
      setEvalResult(ev);
    } catch (err) {
      console.error("Evaluation failed:", err);
      setEvalResult(null);
    }
    setEvalLoading(false);
  }, [currentUciMoves]);

  useEffect(() => {
    if (!result) return;
    // Debounce: wait 400ms after last position change before evaluating
    const timer = setTimeout(() => {
      evaluateCurrentPosition();
    }, 400);
    return () => clearTimeout(timer);
  }, [result, currentMoveIndex, explorationMoves, evaluateCurrentPosition]);

  // Handle user making a "what-if" move on the board
  const onDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: { sourceSquare: string; targetSquare: string; piece: string }) => {
      // Check if this is a promotion
      const isPromotion =
        piece[1] === "P" &&
        ((piece[0] === "w" && targetSquare[1] === "8") ||
          (piece[0] === "b" && targetSquare[1] === "1"));

      const uci = sourceSquare + targetSquare + (isPromotion ? "q" : "");

      // Validate the move
      const testChess = new Chess(chess.fen());
      try {
        testChess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: isPromotion ? "q" : undefined,
        });
      } catch {
        return false;
      }

      setExplorationMoves((prev) => [...prev, uci]);
      return true;
    },
    [chess],
  );

  // Navigation
  const goToMove = useCallback(
    (index: number) => {
      setCurrentMoveIndex(index);
      setExplorationMoves([]); // reset what-if when navigating
      setEvalResult(null);
    },
    [],
  );

  const goBack = useCallback(() => {
    if (explorationMoves.length > 0) {
      setExplorationMoves((prev) => prev.slice(0, -1));
    } else if (currentMoveIndex >= -1) {
      goToMove(Math.max(-1, currentMoveIndex - 1));
    }
  }, [currentMoveIndex, explorationMoves, goToMove]);

  const goForward = useCallback(() => {
    if (result && currentMoveIndex < result.analysis.length - 1 && explorationMoves.length === 0) {
      goToMove(currentMoveIndex + 1);
    }
  }, [result, currentMoveIndex, explorationMoves, goToMove]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "ArrowRight") goForward();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, goForward]);

  // Build arrows from engine lines (must be before early returns)
  const boardArrows = useMemo(() => {
    if (!evalResult?.lines?.length) return [];
    return evalResult.lines
      .filter((line) => line.bestMove && line.bestMove.length >= 4)
      .map((line, i) => ({
        startSquare: line.bestMove!.slice(0, 2),
        endSquare: line.bestMove!.slice(2, 4),
        color: ARROW_COLORS[i] ?? ARROW_COLORS[2],
      }));
  }, [evalResult]);

  // Highlight squares for the current move (must be before early returns)
  const highlightSquares = useMemo(() => {
    if (currentMoveIndex < 0 || !result) return {};
    const m = result.analysis[currentMoveIndex];
    if (!m) return {};
    const from = m.move.slice(0, 2);
    const to = m.move.slice(2, 4);
    return {
      [from]: { backgroundColor: "rgba(245,158,11,0.35)" },
      [to]: { backgroundColor: "rgba(245,158,11,0.45)" },
    };
  }, [currentMoveIndex, result]);

  // Loading
  if (loading) {
    return (
      <div style={centerPage}>
        <div style={spinnerStyle} />
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
  const whiteMoves = result.analysis.filter((m) => m.color === "white");
  const blackMoves = result.analysis.filter((m) => m.color === "black");
  const acc = (moves: MoveAnalysis[]) => {
    if (moves.length === 0) return 0;
    const good = moves.filter((m) => ["best", "excellent", "good"].includes(m.classification)).length;
    return Math.round((good / moves.length) * 100);
  };
  const whiteAcc = acc(whiteMoves);
  const blackAcc = acc(blackMoves);

  // Eval bar calculation
  // During normal game review: use the pre-computed analysis score (instant, stable)
  // During "what-if" exploration: use the live evaluation from the engine
  const currentAnalysis = currentMoveIndex >= 0 ? result.analysis[currentMoveIndex] : null;
  const isExploring = explorationMoves.length > 0;

  let evalScore: number;
  let evalMate: number | null;

  if (isExploring) {
    // In exploration mode, prefer live eval (falls back to 0 if not loaded yet)
    evalScore = evalResult?.lines?.[0]?.score ?? 0;
    evalMate = evalResult?.lines?.[0]?.mate ?? null;
  } else {
    // In review mode, always use the pre-computed analysis (no flickering)
    evalScore = currentAnalysis?.score ?? 0;
    evalMate = currentAnalysis?.mate ?? null;
  }

  const evalPct = evalMate !== null
    ? (evalMate > 0 ? 95 : 5)
    : Math.max(5, Math.min(95, 50 + (evalScore / 10)));

  return (
    <div style={pageStyle}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, width: "100%", animation: "fadeIn .5s ease" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <Link to="/history" style={{ color: "#4B5563", textDecoration: "none", fontSize: ".78rem", marginBottom: 8, display: "inline-block" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4B5563"; }}
            >← Back to history</Link>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#E5E7EB", margin: 0 }}>Game Analysis</h1>
            <p style={{ color: "#4B5563", fontSize: ".78rem", marginTop: 4 }}>
              {result.winner ?? "Draw"} vs {result.runnerup ?? "—"} · Room {roomId.slice(0, 8)}
            </p>
          </div>
          {result.winner && (
            <div style={{ padding: "6px 16px", borderRadius: 8, background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)", color: P, fontSize: ".82rem", fontWeight: 600 }}>
              🏆 {result.winner} won
            </div>
          )}
        </div>

        {/* Main layout: Board + Eval + Move panel */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 36px 1fr", gap: 0, alignItems: "start" }}>

          {/* Chess Board */}
          <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 30px rgba(0,0,0,.4)", width: 440 }}>
            <Chessboard
              options={{
                position: chess.fen(),
                onPieceDrop: onDrop as any,
                animationDurationInMs: 150,
                boardStyle: { borderRadius: "12px" },
                darkSquareStyle: { backgroundColor: "#1a3a2a" },
                lightSquareStyle: { backgroundColor: "#2d5a3e" },
                dropSquareStyle: { boxShadow: "inset 0 0 1px 4px rgba(16,185,129,.5)" },
                squareStyles: highlightSquares as any,
                arrows: boardArrows,
                allowDragging: true,
                allowDrawingArrows: false,
              }}
            />
          </div>

          {/* Eval Bar */}
          <div style={{
            width: 28, height: 440, borderRadius: 6, overflow: "hidden",
            background: "#1F2937", marginLeft: 8, position: "relative",
            border: "1px solid rgba(255,255,255,.08)",
          }}>
            {/* White portion (bottom) */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: `${evalPct}%`,
              background: "linear-gradient(to top, #f0f0f0, #d1d5db)",
              transition: "height 0.4s ease",
            }} />
            {/* Score label */}
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              fontSize: ".58rem", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              color: evalPct > 50 ? "#111" : "#ddd", zIndex: 2,
              textShadow: evalPct > 50 ? "0 0 4px rgba(255,255,255,.3)" : "0 0 4px rgba(0,0,0,.3)",
              writingMode: "vertical-lr", textOrientation: "mixed",
            }}>
              {evalMate !== null ? `M${evalMate}` : `${evalScore > 0 ? "+" : ""}${(evalScore / 100).toFixed(1)}`}
            </div>
          </div>

          {/* Right Panel: Move list + Engine Lines */}
          <div style={{ marginLeft: 8, display: "flex", flexDirection: "column", gap: 10, maxHeight: 440, minWidth: 0 }}>

            {/* Exploration indicator */}
            {isExploring && (
              <div style={{
                padding: "8px 14px", borderRadius: 8,
                background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: ".75rem", color: "#F59E0B", fontWeight: 600 }}>
                  🔍 Exploring alternative ({explorationMoves.length} move{explorationMoves.length > 1 ? "s" : ""})
                </span>
                <button onClick={() => setExplorationMoves([])}
                  style={{ fontSize: ".7rem", background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)", color: "#F59E0B", padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontWeight: 600 }}
                >Reset</button>
              </div>
            )}

            {/* Engine Lines */}
            <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".1em", fontWeight: 700, marginBottom: 8 }}>ENGINE LINES {evalLoading && "⏳"}</div>
              {evalResult?.lines?.map((line, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, alignItems: "center", padding: "5px 0",
                  borderBottom: i < (evalResult.lines.length - 1) ? "1px solid rgba(255,255,255,.04)" : "none",
                }}>
                  <span style={{
                    fontSize: ".7rem", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                    color: P, minWidth: 46, textAlign: "right",
                  }}>
                    {line.mate !== null ? `M${line.mate}` : line.score !== null ? `${line.score > 0 ? "+" : ""}${(line.score / 100).toFixed(1)}` : "—"}
                  </span>
                  <span style={{ fontSize: ".72rem", color: "#9CA3AF", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {line.moves.slice(0, 6).join(" ")}
                  </span>
                </div>
              )) ?? (
                <div style={{ fontSize: ".75rem", color: "#374151" }}>Loading...</div>
              )}
            </div>

            {/* Move list (scrollable) */}
            <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".1em", fontWeight: 700, padding: "10px 12px 6px" }}>MOVES</div>
              <div style={{ overflowY: "auto", padding: "0 6px 6px", flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr", gap: 2 }}>
                  {Array.from({ length: Math.ceil(result.analysis.length / 2) }).map((_, moveNum) => {
                    const whiteIdx = moveNum * 2;
                    const blackIdx = moveNum * 2 + 1;
                    const w = result.analysis[whiteIdx];
                    const b = result.analysis[blackIdx];

                    return (
                      <div key={moveNum} style={{ display: "contents" }}>
                        <span style={{ fontSize: ".65rem", color: "#4B5563", fontWeight: 600, padding: "3px 4px", lineHeight: "22px" }}>
                          {moveNum + 1}.
                        </span>
                        {w && (
                          <MoveButton
                            move={w}
                            index={whiteIdx}
                            isActive={currentMoveIndex === whiteIdx && !isExploring}
                            onClick={() => goToMove(whiteIdx)}
                          />
                        )}
                        {b && (
                          <MoveButton
                            move={b}
                            index={blackIdx}
                            isActive={currentMoveIndex === blackIdx && !isExploring}
                            onClick={() => goToMove(blackIdx)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation controls */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {[
            { label: "⏮", action: () => goToMove(-1), disabled: currentMoveIndex <= -1 && !isExploring },
            { label: "◀", action: goBack, disabled: currentMoveIndex <= -1 && explorationMoves.length === 0 },
            { label: "▶", action: goForward, disabled: (currentMoveIndex >= result.analysis.length - 1 || isExploring) },
            { label: "⏭", action: () => goToMove(result.analysis.length - 1), disabled: currentMoveIndex >= result.analysis.length - 1 },
          ].map((btn, i) => (
            <button key={i} onClick={btn.action} disabled={btn.disabled}
              style={{
                width: 44, height: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,.1)",
                background: btn.disabled ? "rgba(255,255,255,.02)" : "rgba(16,185,129,.08)",
                color: btn.disabled ? "#374151" : "#E5E7EB",
                fontSize: "1rem", cursor: btn.disabled ? "default" : "pointer",
                transition: "all .15s", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >{btn.label}</button>
          ))}
        </div>

        {/* Accuracy summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 20 }}>
          {[
            { label: "White", moves: whiteMoves, accuracy: whiteAcc },
            { label: "Black", moves: blackMoves, accuracy: blackAcc },
          ].map((side, si) => (
            <div key={si} style={playerCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: si === 0 ? "linear-gradient(135deg,#fff,#d1d5db)" : "linear-gradient(135deg,#374151,#111)",
                  border: "2px solid rgba(255,255,255,.15)",
                }} />
                <div style={{ fontSize: ".85rem", fontWeight: 600, color: "#E5E7EB" }}>{side.label}</div>
                <div style={{ marginLeft: "auto", fontSize: "1.4rem", fontWeight: 800, color: P }}>{side.accuracy}%</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                {(["best", "excellent", "good", "inaccuracy", "mistake", "blunder"] as const).map(cls => {
                  const c = CLASSIFICATION_COLORS[cls];
                  const count = side.moves.filter(m => m.classification === cls).length;
                  return (
                    <div key={cls} style={{ padding: "5px 6px", borderRadius: 5, textAlign: "center", background: c.bg, border: `1px solid ${c.border}` }}>
                      <div style={{ fontSize: ".9rem", fontWeight: 700, color: c.text }}>{count}</div>
                      <div style={{ fontSize: ".5rem", color: c.text, opacity: 0.7, letterSpacing: ".04em" }}>{c.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <p style={{ color: "#374151", fontSize: ".72rem" }}>Powered by Stockfish · Depth 15 · Use ← → keys to navigate · Drag pieces to explore</p>
        </div>
      </div>
    </div>
  );
}

// ── Move Button Component ─────────────────────────────────────────────────────

function MoveButton({
  move,
  index: _index,
  isActive,
  onClick,
}: {
  move: MoveAnalysis;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const c = CLASSIFICATION_COLORS[move.classification] ?? CLASSIFICATION_COLORS.good;
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "3px 6px", borderRadius: 4, border: "none", cursor: "pointer",
        background: isActive ? c.bg : hovered ? "rgba(255,255,255,.04)" : "transparent",
        color: isActive ? c.text : "#D1D5DB",
        fontSize: ".74rem", fontWeight: isActive ? 700 : 500,
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: "left", transition: "all .1s",
        display: "flex", alignItems: "center", gap: 4,
      }}
    >
      {move.move}
      {isActive && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: c.text, display: "inline-block", flexShrink: 0,
        }} />
      )}
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: "100vh", background: "#0A0A0F",
  display: "flex", flexDirection: "column", alignItems: "center",
  padding: "32px 24px", position: "relative", overflow: "hidden",
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

const spinnerStyle: CSSProperties = {
  width: 44, height: 44, border: "3px solid #1F2937",
  borderTop: `3px solid ${P}`, borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const playerCard: CSSProperties = {
  padding: "16px 18px",
  background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 12,
};
