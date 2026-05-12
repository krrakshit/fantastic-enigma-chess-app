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
import { getThemeColors, getThemeList, saveTheme, getSavedTheme } from "../lib/board-themes";

export const Route = createFileRoute("/analyse/$roomId")({
  component: AnalysePage,
});

const P = "#2D6A4F";
const ARROW_COLORS = ["rgba(45,106,79,0.8)", "rgba(96,165,250,0.6)", "rgba(245,158,11,0.45)"];


const CLASSIFICATION_COLORS: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  best: { bg: "rgba(45,106,79,.12)", border: "rgba(45,106,79,.3)", text: "#2D6A4F", label: "Best" },
  excellent: { bg: "rgba(52,211,153,.1)", border: "rgba(52,211,153,.25)", text: "#40916C", label: "Excellent" },
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

  // Responsive
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const isMobile = viewportWidth < 768;
  useEffect(() => {
    const upd = () => { setViewportWidth(window.innerWidth); setViewportHeight(window.innerHeight); };
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  // Theme
  const [currentTheme, setCurrentTheme] = useState(getSavedTheme());
  const themeColors = getThemeColors(currentTheme);
  const handleThemeChange = (n: string) => { saveTheme(n); setCurrentTheme(n); };

  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 = starting position
  const [explorationMoves, setExplorationMoves] = useState<string[]>([]); // alt moves from user
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

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

  // Precompute SAN notation for all game moves
  const sanMoves = useMemo(() => {
    if (!result) return [] as string[];
    const c = new Chess();
    return result.analysis.map((m) => {
      try {
        const res = c.move({ from: m.move.slice(0,2), to: m.move.slice(2,4), promotion: m.move.length > 4 ? m.move[4] : undefined });
        return res?.san ?? m.move;
      } catch { return m.move; }
    });
  }, [result]);

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
      setSelectedSquare(null);
      return true;
    },
    [chess],
  );

  // Handle clicking a piece — show legal moves
  const onPieceClick = useCallback(
    ({ square }: { square: string }) => {
      if (selectedSquare === square) {
        setSelectedSquare(null); // deselect
        return;
      }
      // Check if square has a piece that belongs to the side to move
      const piece = chess.get(square as any);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    },
    [chess, selectedSquare],
  );

  // Handle clicking a square — either move there or select
  const onSquareClick = useCallback(
    ({ square }: { square: string }) => {
      if (!selectedSquare) {
        // If clicking on own piece, select it
        const piece = chess.get(square as any);
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square);
        }
        return;
      }

      // Check if this is a legal move from selectedSquare
      const legalMoves = chess.moves({ square: selectedSquare as any, verbose: true });
      const targetMove = legalMoves.find((m) => m.to === square);

      if (targetMove) {
        const isPromotion = targetMove.flags.includes("p");
        const uci = selectedSquare + square + (isPromotion ? "q" : "");

        // Validate
        const testChess = new Chess(chess.fen());
        try {
          testChess.move({ from: selectedSquare, to: square, promotion: isPromotion ? "q" : undefined });
        } catch {
          setSelectedSquare(null);
          return;
        }

        setExplorationMoves((prev) => [...prev, uci]);
        setSelectedSquare(null);
      } else {
        // Clicked a non-target square — try selecting it if it has own piece
        const piece = chess.get(square as any);
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square);
        } else {
          setSelectedSquare(null);
        }
      }
    },
    [chess, selectedSquare],
  );

  // Navigation
  const goToMove = useCallback(
    (index: number) => {
      setCurrentMoveIndex(index);
      setExplorationMoves([]); // reset what-if when navigating
      setEvalResult(null);
      setSelectedSquare(null);
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
    const styles: Record<string, React.CSSProperties> = {};

    // Last move highlight
    if (currentMoveIndex >= 0 && result) {
      const m = result.analysis[currentMoveIndex];
      if (m) {
        const from = m.move.slice(0, 2);
        const to = m.move.slice(2, 4);
        styles[from] = { backgroundColor: "rgba(245,158,11,0.35)" };
        styles[to] = { backgroundColor: "rgba(245,158,11,0.45)" };
      }
    }

    // Selected piece highlight
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "rgba(45,106,79,0.45)" };

      // Legal move dots
      try {
        const legalMoves = chess.moves({ square: selectedSquare as any, verbose: true });
        for (const move of legalMoves) {
          const isCapture = move.flags.includes("c") || move.flags.includes("e");
          styles[move.to] = isCapture
            ? {
                background: "radial-gradient(circle, transparent 55%, rgba(45,106,79,0.45) 56%)",
              }
            : {
                background: "radial-gradient(circle, rgba(45,106,79,0.4) 22%, transparent 23%)",
              };
        }
      } catch {
        // Invalid square
      }
    }

    return styles;
  }, [currentMoveIndex, result, selectedSquare, chess]);

  // Loading
  if (loading) {
    return (
      <div style={centerPage}>
        <div style={spinnerStyle} />
        <p style={{ color: "#6B7264", marginTop: 16, fontSize: ".9rem" }}>Analysing game with Stockfish...</p>
        <p style={{ color: "#9CA392", fontSize: ".75rem", marginTop: 6 }}>This may take a moment</p>
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
  // Stockfish scores are always from the SIDE-TO-MOVE's perspective.
  // The bar must show scores from WHITE's perspective:
  //   - After a white move → black is to move → negate the score
  //   - After a black move → white is to move → keep the score
  const currentAnalysis = currentMoveIndex >= 0 ? result.analysis[currentMoveIndex] : null;
  const isExploring = explorationMoves.length > 0;

  let rawScore: number;
  let rawMate: number | null;

  if (isExploring) {
    rawScore = evalResult?.lines?.[0]?.score ?? 0;
    rawMate = evalResult?.lines?.[0]?.mate ?? null;
  } else {
    rawScore = currentAnalysis?.score ?? 0;
    rawMate = currentAnalysis?.mate ?? null;
  }

  // Determine if black is to move (score needs negation for white's perspective)
  // In review mode: after white's move, it's black's turn → negate
  // In explore mode: use chess.turn() to check whose turn it is
  const isBlackToMove = isExploring
    ? chess.turn() === "b"
    : currentAnalysis?.color === "white"; // white just moved → black's turn

  const evalScore = isBlackToMove ? -rawScore : rawScore;
  const evalMate = rawMate !== null ? (isBlackToMove ? -rawMate : rawMate) : null;

  // Eval bar percentage (from white's perspective: 95 = white winning, 5 = black winning)
  let evalPct: number;
  if (rawMate === 0) {
    // Checkmate delivered — whoever just moved won
    const moverColor = isExploring
      ? (chess.turn() === "w" ? "black" : "white")  // it's the OTHER side that just moved
      : currentAnalysis?.color;
    evalPct = moverColor === "white" ? 100 : 0;
  } else if (evalMate !== null) {
    evalPct = evalMate > 0 ? 95 : 5;
  } else {
    evalPct = Math.max(5, Math.min(95, 50 + (evalScore / 10)));
  }

  // Responsive board size
  const boardPad = isMobile ? 8 : 0;
  const maxBoardW = isMobile ? viewportWidth - boardPad : Math.min(500, viewportWidth * 0.45);
  const maxBoardH = isMobile ? viewportHeight * 0.42 : viewportHeight - 200;
  const sq = Math.floor(Math.min(maxBoardW, maxBoardH) / 8);
  const boardPx = sq * 8;

  const whitePlayer = result.player1?.username ?? result.winner ?? "White";
  const blackPlayer = result.player2?.username ?? result.runnerup ?? "Black";

  return (
    <div style={pageStyle}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      {/* Navbar */}
      <nav style={{ width:"100%", padding: isMobile ? "10px 14px" : "10px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(250,250,247,.88)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(139,115,85,.06)", flexShrink:0, position:"sticky", top:0, zIndex:100 }}>
        <Link to="/" style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:7, background:`linear-gradient(135deg,${P},#40916C)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:".9rem", color:"#fff", fontWeight:800 }}>♛</div>
          <span style={{ fontWeight:800, color:"#1A1A1A", fontSize: isMobile ? ".92rem" : "1.05rem", letterSpacing:"-.02em" }}>Chess Arena</span>
        </Link>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <Link to="/history" style={{ padding:"5px 12px", borderRadius:6, border:"1px solid rgba(139,115,85,.1)", color:"#6B7264", textDecoration:"none", fontSize:".78rem", fontWeight:500 }}>← History</Link>
        </div>
      </nav>

      <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:1200, padding: isMobile ? "12px 8px" : "24px 24px", margin:"0 auto", animation:"fadeIn .5s ease" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? "1.3rem" : "1.6rem", fontWeight:800, color:"#1A1A1A", margin:0 }}>Game Analysis</h1>
            <p style={{ color:"#8B9080", fontSize:".78rem", marginTop:4 }}>
              {whitePlayer} vs {blackPlayer} · Room {roomId.slice(0,8)}
            </p>
          </div>
          {result.winner && (
            <div style={{ padding:"6px 16px", borderRadius:8, background:"rgba(45,106,79,.08)", border:"1px solid rgba(45,106,79,.2)", color:P, fontSize:".82rem", fontWeight:600 }}>
              🏆 {result.winner} won
            </div>
          )}
        </div>

        {/* Main layout */}
        <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 16, alignItems:"flex-start" }}>

          {/* Board column */}
          <div style={{ display:"flex", flexDirection: isMobile ? "row" : "column", gap: isMobile ? 8 : 0, alignItems: isMobile ? "flex-start" : "center", flexShrink:0 }}>

            {/* Eval Bar + Board side by side on mobile */}
            <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
              {/* Eval Bar */}
              <div style={{ width:20, height:boardPx, borderRadius:6, overflow:"hidden", background:"#E5E7EB", position:"relative", border:"1px solid rgba(0,0,0,.08)", flexShrink:0 }}>
                <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${evalPct}%`, background:"linear-gradient(to top,#f0f0f0,#d1d5db)", transition:"height 0.4s ease" }} />
                <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", fontSize:".48rem", fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color: evalPct > 50 ? "#111" : "#555", writingMode:"vertical-lr" }}>
                  {evalMate !== null ? `M${evalMate}` : `${evalScore > 0 ? "+" : ""}${(evalScore/100).toFixed(1)}`}
                </div>
              </div>

              {/* Board */}
              <div style={{ borderRadius:10, overflow:"hidden", boxShadow:`0 0 40px ${themeColors.accent}20, 0 8px 32px rgba(0,0,0,.08)`, border:`2px solid ${themeColors.boardBorder}20` }}>
                <Chessboard
                  options={{
                    position: chess.fen(),
                    onPieceDrop: onDrop as any,
                    onPieceClick: onPieceClick as any,
                    onSquareClick: onSquareClick as any,
                    animationDurationInMs: 150,
                    boardStyle: { borderRadius:"10px", width: boardPx, height: boardPx },
                    darkSquareStyle: { backgroundColor: themeColors.darkSquare },
                    lightSquareStyle: { backgroundColor: themeColors.lightSquare },
                    dropSquareStyle: { boxShadow:`inset 0 0 1px 4px ${themeColors.accent}80` },
                    squareStyles: highlightSquares as any,
                    arrows: boardArrows,
                    allowDragging: true,
                    dragActivationDistance: 8,
                    allowDrawingArrows: false,
                  }}
                />
              </div>
            </div>

            {/* Nav controls */}
            <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop: isMobile ? 0 : 12, flexDirection: isMobile ? "column" : "row" }}>
              {[
                { label:"⏮", action:() => goToMove(-1), disabled: currentMoveIndex <= -1 && !isExploring },
                { label:"◀", action: goBack, disabled: currentMoveIndex <= -1 && explorationMoves.length === 0 },
                { label:"▶", action: goForward, disabled: currentMoveIndex >= result.analysis.length - 1 || isExploring },
                { label:"⏭", action:() => goToMove(result.analysis.length - 1), disabled: currentMoveIndex >= result.analysis.length - 1 },
              ].map((btn, i) => (
                <button key={i} onClick={btn.action} disabled={btn.disabled} style={{
                  width: isMobile ? 36 : 48, height:36, borderRadius:8,
                  border:`1px solid ${btn.disabled ? "rgba(0,0,0,.08)" : "rgba(45,106,79,.2)"}`,
                  background: btn.disabled ? "rgba(255,255,255,.65)" : "rgba(45,106,79,.08)",
                  color: btn.disabled ? "#9CA3AF" : P,
                  fontSize:".95rem", cursor: btn.disabled ? "default" : "pointer",
                  transition:"all .15s", display:"flex", alignItems:"center", justifyContent:"center",
                }}>{btn.label}</button>
              ))}
            </div>

            {/* Theme picker */}
            <div style={{ background:"rgba(255,255,255,.65)", border:"1px solid rgba(0,0,0,.06)", borderRadius:10, padding:"10px 12px", marginTop: isMobile ? 0 : 10 }}>
              <div style={{ fontSize:".6rem", color:"#8B9080", letterSpacing:".1em", fontWeight:700, marginBottom:6 }}>BOARD THEME</div>
              <div style={{ display:"flex", gap:4 }}>
                {getThemeList().map(t => (
                  <button key={t.name} onClick={() => handleThemeChange(t.name)} title={t.label} style={{
                    width:24, height:24, borderRadius:5, cursor:"pointer",
                    background:`linear-gradient(135deg,${t.lightSquare} 50%,${t.darkSquare} 50%)`,
                    border: currentTheme === t.name ? `2px solid ${t.accent}` : "2px solid transparent",
                    transition:"all .2s",
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10, minWidth:0, width: isMobile ? "100%" : undefined }}>

            {/* Exploration indicator */}
            {isExploring && (
              <div style={{ padding:"8px 14px", borderRadius:8, background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.2)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:".75rem", color:"#F59E0B", fontWeight:600 }}>🔍 Exploring ({explorationMoves.length} move{explorationMoves.length > 1 ? "s" : ""})</span>
                <button onClick={() => setExplorationMoves([])} style={{ fontSize:".7rem", background:"rgba(245,158,11,.15)", border:"1px solid rgba(245,158,11,.3)", color:"#F59E0B", padding:"3px 10px", borderRadius:5, cursor:"pointer", fontWeight:600 }}>Reset</button>
              </div>
            )}

            {/* Engine Lines */}
            <div style={{ background:"rgba(255,255,255,.65)", border:"1px solid rgba(0,0,0,.06)", borderRadius:10, padding:12 }}>
              <div style={{ fontSize:".6rem", color:"#8B9080", letterSpacing:".1em", fontWeight:700, marginBottom:8 }}>ENGINE LINES {evalLoading && "⏳"}</div>
              {evalResult?.lines?.map((line, i) => (
                <div key={i} style={{ display:"flex", gap:10, alignItems:"center", padding:"5px 0", borderBottom: i < evalResult.lines.length - 1 ? "1px solid rgba(0,0,0,.04)" : "none" }}>
                  <span style={{ fontSize:".7rem", fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:P, minWidth:46, textAlign:"right" }}>
                    {line.mate !== null ? `M${line.mate}` : line.score !== null ? `${line.score > 0 ? "+" : ""}${(line.score/100).toFixed(1)}` : "—"}
                  </span>
                  <span style={{ fontSize:".7rem", color:"#6B7264", fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {line.moves.slice(0,6).join(" ")}
                  </span>
                </div>
              )) ?? <div style={{ fontSize:".75rem", color:"#9CA392" }}>Loading...</div>}
            </div>

            {/* Move list */}
            <div style={{ background:"rgba(255,255,255,.65)", border:"1px solid rgba(0,0,0,.06)", borderRadius:10, overflow:"hidden", display:"flex", flexDirection:"column", flex:1, minHeight: isMobile ? 200 : 280 }}>
              <div style={{ padding:"10px 12px 6px", borderBottom:"1px solid rgba(0,0,0,.04)" }}>
                <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 1fr", gap:2 }}>
                  <span />
                  <div style={{ display:"flex", alignItems:"center", gap:5, paddingLeft:6 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:"linear-gradient(135deg,#fff,#d1d5db)", border:"1.5px solid #ccc" }} />
                    <span style={{ fontSize:".6rem", color:"#8B9080", fontWeight:700, letterSpacing:".08em" }}>{whitePlayer.slice(0,12).toUpperCase()}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:5, paddingLeft:6 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:"linear-gradient(135deg,#4B5563,#111)", border:"1.5px solid #333" }} />
                    <span style={{ fontSize:".6rem", color:"#8B9080", fontWeight:700, letterSpacing:".08em" }}>{blackPlayer.slice(0,12).toUpperCase()}</span>
                  </div>
                </div>
              </div>
              <div style={{ overflowY:"auto", padding:"4px 6px 6px", flex:1 }}>
                <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 1fr", gap:2 }}>
                  {Array.from({ length: Math.ceil(result.analysis.length / 2) }).map((_, moveNum) => {
                    const wi = moveNum * 2, bi = moveNum * 2 + 1;
                    const w = result.analysis[wi], b = result.analysis[bi];
                    return (
                      <div key={moveNum} style={{ display:"contents" }}>
                        <span style={{ fontSize:".65rem", color:"#8B9080", fontWeight:600, padding:"3px 4px", lineHeight:"22px", textAlign:"right" }}>{moveNum + 1}.</span>
                        {w && <MoveButton move={w} san={sanMoves[wi]} isActive={currentMoveIndex === wi && !isExploring} onClick={() => goToMove(wi)} />}
                        {b ? <MoveButton move={b} san={sanMoves[bi]} isActive={currentMoveIndex === bi && !isExploring} onClick={() => goToMove(bi)} /> : <span />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Accuracy summary */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label: whitePlayer, colorLabel:"White", moves: whiteMoves, accuracy: whiteAcc, si:0 },
                { label: blackPlayer, colorLabel:"Black", moves: blackMoves, accuracy: blackAcc, si:1 },
              ].map((side) => (
                <div key={side.si} style={playerCard}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", background: side.si === 0 ? "linear-gradient(135deg,#fff,#d1d5db)" : "linear-gradient(135deg,#374151,#111)", border:"2px solid rgba(0,0,0,.1)" }} />
                    <div style={{ fontSize:".8rem", fontWeight:600, color:"#1A1A1A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:80 }}>{side.label}</div>
                    <div style={{ marginLeft:"auto", fontSize:"1.2rem", fontWeight:800, color:P }}>{side.accuracy}%</div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:4 }}>
                    {(["best","excellent","good","inaccuracy","mistake","blunder"] as const).map(cls => {
                      const c = CLASSIFICATION_COLORS[cls];
                      const count = side.moves.filter(m => m.classification === cls).length;
                      return (
                        <div key={cls} style={{ padding:"4px 5px", borderRadius:5, textAlign:"center", background:c.bg, border:`1px solid ${c.border}` }}>
                          <div style={{ fontSize:".85rem", fontWeight:700, color:c.text }}>{count}</div>
                          <div style={{ fontSize:".45rem", color:c.text, opacity:0.7, letterSpacing:".04em" }}>{c.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign:"center", paddingBottom:16 }}>
              <p style={{ color:"#9CA392", fontSize:".72rem" }}>Powered by Stockfish · Use ← → keys to navigate · Drag pieces to explore</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Move Button Component ─────────────────────────────────────────────────────


function MoveButton({
  move,
  san,
  isActive,
  onClick,
}: {
  move: MoveAnalysis;
  san: string;
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
        padding: "3px 6px", borderRadius: 4, border: isActive ? `1px solid ${c.border}` : "1px solid transparent",
        cursor: "pointer",
        background: isActive ? c.bg : hovered ? "rgba(0,0,0,.05)" : "transparent",
        color: isActive ? c.text : "#374151",
        fontSize: ".74rem", fontWeight: isActive ? 700 : 500,
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: "left", transition: "all .1s",
        display: "flex", alignItems: "center", gap: 4,
      }}
    >
      {san}
      {isActive && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.text, display: "inline-block", flexShrink: 0 }} />
      )}
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: "100vh", background: "#FAFAF7",
  display: "flex", flexDirection: "column", alignItems: "center",
  position: "relative", overflow: "hidden",
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

const spinnerStyle: CSSProperties = {
  width: 44, height: 44, border: "3px solid #1F2937",
  borderTop: `3px solid ${P}`, borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const playerCard: CSSProperties = {
  padding: "16px 18px",
  background: "rgba(255,255,255,.65)", border: "1px solid rgba(0,0,0,.06)",
  borderRadius: 12,
};
