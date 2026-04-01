import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { ChessBoard } from "../components/ChessBoard";
import { useChessWebSocket, INITIAL_TIME_MS, type GameResult, type ChatMessage } from "../lib/useChessWebSocket";
import { PieceSVG } from "../lib/piece-svgs";
import type { Move } from "chess.js";
import { useWebSocket } from "../lib/websocket-context";

export const Route = createFileRoute("/game/$roomId")({
  component: GameRoom,
});

const P = "#10B981";

interface GameData {
  roomId: string;
  player1Id: string;
  player2Id: string;
  currentPlayerId: string;
}

function shortId(id: string) { return id.length > 16 ? `${id.slice(0, 8)}…` : id; }

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatMoveTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Move History ──────────────────────────────────────────────────────────────

function MoveHistory({ moves, moveTimes }: { moves: Move[]; moveTimes: number[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [moves.length]);

  type Pair = { white?: Move; black?: Move; whiteTime?: number; blackTime?: number; num: number };
  const pairs: Pair[] = [];
  moves.forEach((m, i) => {
    if (i % 2 === 0) pairs.push({ white: m, whiteTime: moveTimes[i], num: Math.floor(i / 2) + 1 });
    else { pairs[pairs.length - 1].black = m; pairs[pairs.length - 1].blackTime = moveTimes[i]; }
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      {pairs.length === 0 && (
        <p style={{ textAlign: "center", color: "#374151", fontSize: ".78rem", fontStyle: "italic", marginTop: 16 }}>
          Game not started yet
        </p>
      )}
      {pairs.map((p) => (
        <div key={p.num} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: ".68rem", color: "#4B5563", width: 24, textAlign: "right", flexShrink: 0 }}>{p.num}.</span>
          <span style={{
            flex: 1, padding: "3px 8px", borderRadius: 4, fontSize: ".8rem",
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
            background: "rgba(255,255,255,.03)", color: "#D1D5DB",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{p.white?.san ?? ""}</span>
            {p.whiteTime != null && <span style={{ fontSize: ".58rem", color: "#6B7280", fontWeight: 400 }}>{formatMoveTime(p.whiteTime)}</span>}
          </span>
          <span style={{
            flex: 1, padding: "3px 8px", borderRadius: 4, fontSize: ".8rem",
            fontFamily: "'JetBrains Mono', monospace",
            background: p.black ? "rgba(255,255,255,.015)" : "transparent", color: "#9CA3AF",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{p.black?.san ?? ""}</span>
            {p.blackTime != null && <span style={{ fontSize: ".58rem", color: "#6B7280", fontWeight: 400 }}>{formatMoveTime(p.blackTime)}</span>}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({ messages, onSend, myId }: { messages: ChatMessage[]; onSend: (msg: string) => void; myId: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  return (
    <div style={{
      background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)",
      borderRadius: 10, padding: 12, display: "flex", flexDirection: "column",
      minHeight: 140, maxHeight: 200,
    }}>
      <div style={{ fontSize: ".6rem", color: "#4B5563", fontWeight: 700, letterSpacing: ".1em", marginBottom: 5 }}>CHAT</div>
      <div style={{ height: 1, background: "rgba(255,255,255,.04)", marginBottom: 5 }} />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
        {messages.length === 0 && (
          <p style={{ textAlign: "center", color: "#374151", fontSize: ".7rem", fontStyle: "italic", marginTop: 6 }}>No messages yet</p>
        )}
        {messages.map((m, i) => {
          const isMe = m.senderID === myId;
          return (
            <div key={i} style={{
              alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "80%",
              padding: "4px 10px", borderRadius: 7,
              background: isMe ? "rgba(16,185,129,.1)" : "rgba(255,255,255,.04)",
              border: `1px solid ${isMe ? "rgba(16,185,129,.2)" : "rgba(255,255,255,.06)"}`,
            }}>
              <div style={{ fontSize: ".58rem", color: isMe ? P : "#4B5563", fontWeight: 600, marginBottom: 1 }}>
                {isMe ? "You" : shortId(m.senderID)}
              </div>
              <div style={{ fontSize: ".76rem", color: isMe ? "#A7F3D0" : "#9CA3AF", wordBreak: "break-word" }}>{m.message}</div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (!draft.trim()) return; onSend(draft); setDraft(""); }} style={{ display: "flex", gap: 5 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message…" maxLength={200}
          style={{
            flex: 1, padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,.08)",
            background: "rgba(255,255,255,.02)", color: "#D1D5DB", fontSize: ".76rem", outline: "none",
          }} />
        <button type="submit" style={{
          padding: "5px 12px", borderRadius: 6, border: `1px solid rgba(16,185,129,.2)`,
          background: "rgba(16,185,129,.08)", color: P, fontSize: ".76rem", fontWeight: 700, cursor: "pointer",
        }}>Send</button>
      </form>
    </div>
  );
}

// ── Player Strip ──────────────────────────────────────────────────────────────

function PlayerStrip({ label, id, color, isActive, captures, points, timeMs }: {
  label: string; id: string; color: "w" | "b"; isActive: boolean;
  captures: { type: string; color: string }[]; points: number; timeMs: number;
}) {
  const isLow = timeMs < 60_000;
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 10,
      background: isActive ? "rgba(16,185,129,.06)" : "rgba(255,255,255,.02)",
      border: `1px solid ${isActive ? "rgba(16,185,129,.25)" : "rgba(255,255,255,.05)"}`,
      transition: "all .3s", display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        background: color === "w" ? "linear-gradient(135deg,#fff,#d1d5db)" : "linear-gradient(135deg,#4B5563,#111)",
        border: `2px solid ${isActive ? P : "rgba(255,255,255,.12)"}`,
        boxShadow: isActive ? `0 0 6px rgba(16,185,129,.4)` : "none",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".72rem", fontWeight: 600, color: isActive ? "#A7F3D0" : "#6B7280", letterSpacing: ".04em" }}>{label}</div>
        <div style={{ fontSize: ".62rem", color: "#374151", fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortId(id)}</div>
      </div>
      <div style={{
        padding: "2px 7px", borderRadius: 5,
        background: points > 0 ? "rgba(16,185,129,.08)" : "rgba(255,255,255,.02)",
        border: `1px solid ${points > 0 ? "rgba(16,185,129,.2)" : "rgba(255,255,255,.05)"}`,
        fontSize: ".68rem", fontWeight: 700, color: points > 0 ? P : "#374151",
        minWidth: 26, textAlign: "center", flexShrink: 0,
      }}>{points}pt{points !== 1 ? "s" : ""}</div>
      <div style={{
        padding: "3px 9px", borderRadius: 5, fontFamily: "'JetBrains Mono', monospace",
        fontSize: ".82rem", fontWeight: 700, flexShrink: 0, minWidth: 48, textAlign: "center",
        background: isActive ? (isLow ? "rgba(239,68,68,.12)" : "rgba(16,185,129,.08)") : "rgba(255,255,255,.03)",
        border: `1px solid ${isActive ? (isLow ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.2)") : "rgba(255,255,255,.06)"}`,
        color: isActive ? (isLow ? "#EF4444" : P) : "#6B7280",
      }}>{formatTime(timeMs)}</div>
      {captures.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {captures.slice(0, 8).map((p, i) => (
            <PieceSVG key={i} type={p.type as any} color={p.color as any} size={14} />
          ))}
        </div>
      )}
      {isActive && (
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: P, boxShadow: `0 0 6px ${P}`, animation: "pulse 1.5s infinite", flexShrink: 0 }} />
      )}
    </div>
  );
}

// ── Game Over Overlay ─────────────────────────────────────────────────────────

function GameOverOverlay({ status, turn, myColor, gameResult, myId, myPoints, opponentPoints, gameStartedAt }: {
  status: string; turn: string; myColor: string | null; gameResult: GameResult | null;
  myId: string; myPoints: number; opponentPoints: number; gameStartedAt: string | null;
}) {
  const { send } = useWebSocket();
  const hasSentGameOver = useRef(false);

  useEffect(() => {
    if (status === "checkmate" && !hasSentGameOver.current) {
      const winnerColor = turn === "w" ? "b" : "w";
      const iAmWinner = winnerColor === myColor;
      if (!iAmWinner) return;
      hasSentGameOver.current = true;
      try {
        const raw = localStorage.getItem("gameData");
        if (raw) {
          const parsed = JSON.parse(raw);
          const winner = winnerColor === "w" ? parsed.player1Id : parsed.player2Id;
          const runnerup = winnerColor === "w" ? parsed.player2Id : parsed.player1Id;
          send({ content: { Winner: winner, Runnerup: runnerup, roomId: parsed.roomId }, uid: parsed.currentPlayerId } as any);
        }
      } catch (e) {}
    }
  }, [status, turn, myColor, send]);

  useEffect(() => {
    const drawStatuses = ["stalemate", "draw", "threefold", "insufficient"];
    if (drawStatuses.includes(status)) {
      try {
        const raw = localStorage.getItem("gameData");
        const session = raw ? JSON.parse(raw) : {};
        const endedAt = new Date();
        const startedAt = gameStartedAt ? new Date(gameStartedAt) : endedAt;
        const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
        const result: GameResult = {
          winner: null, runnerup: null, winnerPoints: 0, runnerupPoints: 0,
          myPoints, opponentPoints, totalMoves: 0, status,
          roomId: session.roomId ?? "", startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(), durationSeconds,
        };
        localStorage.setItem("gameResult", JSON.stringify({ ...session, ...result }));
      } catch (e) {}
    }
  }, [status]);

  const terminalStatuses = ["checkmate", "stalemate", "draw", "threefold", "insufficient"];
  if (!terminalStatuses.includes(status)) return null;

  let emoji = "🤝", headline = "Draw", sub = "The game is a draw.";
  if (status === "checkmate") {
    const winner = turn === "w" ? "b" : "w";
    const iWon = winner === myColor;
    emoji = iWon ? "🏆" : "💀";
    headline = iWon ? "Victory!" : "Defeat";
    sub = iWon ? "You checkmated your opponent!" : "You were checkmated.";
  } else if (status === "stalemate") { sub = "Stalemate — no legal moves."; }

  const iAmWinner = gameResult ? gameResult.winner === myId : (turn === "w" ? "b" : "w") === myColor;
  const displayMyPts = gameResult ? (iAmWinner ? gameResult.winnerPoints : gameResult.runnerupPoints) : myPoints;
  const displayOppPts = gameResult ? (iAmWinner ? gameResult.runnerupPoints : gameResult.winnerPoints) : opponentPoints;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        background: "linear-gradient(135deg,#111116,#1a1a22)", border: `1px solid rgba(16,185,129,.15)`,
        borderRadius: 18, padding: "44px 52px", textAlign: "center",
        boxShadow: "0 32px 80px rgba(0,0,0,.6)", maxWidth: 380,
      }}>
        <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>{emoji}</div>
        <h2 style={{
          fontSize: "2.2rem", fontWeight: 800, margin: "0 0 8px",
          background: `linear-gradient(135deg, ${P}, #34D399)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>{headline}</h2>
        <p style={{ color: "#9CA3AF", fontSize: ".95rem", marginBottom: 22, lineHeight: 1.6 }}>{sub}</p>

        {status === "checkmate" && (
          <div style={{
            display: "flex", gap: 12, marginBottom: 24, background: "rgba(255,255,255,.02)",
            borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(255,255,255,.05)",
          }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: ".6rem", color: "#4B5563", letterSpacing: ".1em", marginBottom: 3 }}>YOU</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: P }}>{displayMyPts}</div>
              <div style={{ fontSize: ".58rem", color: "#374151" }}>pts</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,.05)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: ".6rem", color: "#4B5563", letterSpacing: ".1em", marginBottom: 3 }}>OPPONENT</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#9CA3AF" }}>{displayOppPts}</div>
              <div style={{ fontSize: ".58rem", color: "#374151" }}>pts</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link to="/game" style={{
            padding: "10px 24px", background: `linear-gradient(135deg, ${P}, #34D399)`,
            color: "#0A0A0F", borderRadius: 8, fontWeight: 700, fontSize: ".88rem", textDecoration: "none",
          }}>Play Again</Link>
          <Link to="/" style={{
            padding: "10px 24px", border: `1px solid rgba(16,185,129,.2)`, color: P,
            borderRadius: 8, fontWeight: 600, fontSize: ".88rem", textDecoration: "none",
          }}>Home</Link>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function GameRoom() {
  const { roomId } = Route.useParams();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [wasRestored, setWasRestored] = useState(false);

  useEffect(() => {
    const storedState = localStorage.getItem("chessGameState");
    const storedData = localStorage.getItem("gameData");
    if (storedState) {
      try {
        const parsed = JSON.parse(storedState);
        if (parsed.roomId === roomId) {
          setGameData({ roomId: parsed.roomId, player1Id: parsed.player1Id, player2Id: parsed.player2Id, currentPlayerId: parsed.currentPlayerId });
          if (parsed.moves && parsed.moves.length > 0) setWasRestored(true);
          setLoading(false); return;
        }
      } catch {}
    }
    if (storedData) { try { setGameData(JSON.parse(storedData)); } catch {} }
    setLoading(false);
  }, [roomId]);

  const game = useChessWebSocket(gameData);

  const myColor = game.myColor;
  const flipped = myColor === "b";
  const isOver = ["checkmate", "stalemate", "draw", "threefold", "insufficient"].includes(game.gameStatus);
  const isDisabled = !game.isMyTurn || isOver;

  const boardTheme = {
    lightSquare: "#2D3748", darkSquare: "#1A202C",
    selectedSquare: "rgba(16,185,129,.35)", legalMoveIndicator: "rgba(16,185,129,.3)",
    lastMoveHighlight: "rgba(16,185,129,.15)", checkHighlight: "rgba(239,68,68,.5)",
    boardBorder: P, boardBorderWidth: 3,
    boardShadow: `0 0 50px rgba(16,185,129,.08), 0 20px 60px rgba(0,0,0,.6)`,
    pieceSize: 58, squareSize: 70,
    coordinateColor: P, coordinateFontFamily: "'Inter', sans-serif",
  };

  const boardW = boardTheme.squareSize * 8 + boardTheme.boardBorderWidth * 2;

  const myId = gameData?.currentPlayerId ?? "";
  const isGuest = localStorage.getItem("isGuest") === "true" || myId.startsWith("guest_");
  const oppId = myColor === "w" ? (gameData?.player2Id ?? "…") : (gameData?.player1Id ?? "…");
  const topColor: "w" | "b" = flipped ? "w" : "b";
  const bottomColor: "w" | "b" = flipped ? "b" : "w";
  const topId = flipped ? myId : oppId;
  const bottomId = flipped ? oppId : myId;
  const topIsMe = flipped;

  const whiteCaptured = game.capturedPieces.b;
  const blackCaptured = game.capturedPieces.w;
  const topCaptures = topColor === "w" ? whiteCaptured : blackCaptured;
  const bottomCaptures = bottomColor === "w" ? whiteCaptured : blackCaptured;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0F", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #1F2937", borderTop: `3px solid ${P}`, animation: "spin .8s linear infinite" }} />
        <p style={{ color: "#6B7280" }}>Loading game…</p>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0F", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: "2.5rem" }}>⚠️</div>
        <p style={{ color: "#EF4444", fontSize: "1rem", textAlign: "center" }}>
          Session not found.<br /><span style={{ color: "#6B7280", fontSize: ".85rem" }}>The session may have expired.</span>
        </p>
        <Link to="/game" style={{ padding: "10px 28px", background: P, color: "#0A0A0F", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>Back to Lobby</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", color: "#fff", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(16,185,129,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,.015) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 30% 40%,rgba(16,185,129,.04) 0%,transparent 55%)" }} />

      <GameOverOverlay status={game.gameStatus} turn={game.turn} myColor={myColor}
        gameResult={game.gameResult} myId={myId} myPoints={game.myPoints}
        opponentPoints={game.opponentPoints} gameStartedAt={game.gameStartedAt} />

      {wasRestored && game.connectionStatus === "connected" && (
        <div style={{
          position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 1500,
          padding: "8px 18px", borderRadius: 8, background: "rgba(16,185,129,.1)",
          border: "1px solid rgba(16,185,129,.25)", color: P, fontSize: ".8rem",
          fontWeight: 600, display: "flex", alignItems: "center", gap: 8, animation: "fadeIn .4s ease",
          boxShadow: "0 4px 20px rgba(16,185,129,.12)",
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: P, boxShadow: `0 0 6px ${P}`, animation: "pulse 1.5s infinite" }} />
          ♻ Session restored
          <button onClick={() => setWasRestored(false)} style={{ marginLeft: 6, background: "none", border: "none", color: P, cursor: "pointer", fontSize: ".95rem", lineHeight: 1 }}>×</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 32, alignItems: "flex-start", position: "relative", zIndex: 1, flexWrap: "wrap", justifyContent: "center", animation: "fadeIn .4s ease" }}>
        {/* Board column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <div style={{ width: boardW }}>
            <PlayerStrip label={topIsMe ? "You" : "Opponent"} id={topId} color={topColor}
              isActive={game.turn === topColor} captures={topCaptures}
              points={topIsMe ? game.myPoints : game.opponentPoints}
              timeMs={topColor === "w" ? game.whiteTime : game.blackTime} />
          </div>
          <div style={{ position: "relative" }}>
            {isDisabled && !isOver && <div style={{ position: "absolute", inset: 0, zIndex: 10, cursor: "not-allowed", borderRadius: 4 }} />}
            <ChessBoard game={game} theme={boardTheme} flipped={flipped} disabled={isDisabled} />
          </div>
          <div style={{ width: boardW }}>
            <PlayerStrip label={topIsMe ? "Opponent" : "You"} id={bottomId} color={bottomColor}
              isActive={game.turn === bottomColor} captures={bottomCaptures}
              points={topIsMe ? game.opponentPoints : game.myPoints}
              timeMs={bottomColor === "w" ? game.whiteTime : game.blackTime} />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Header card */}
          <div style={{ padding: "16px 18px", background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Link to="/" style={{ color: "#4B5563", textDecoration: "none", fontSize: ".78rem" }}>← Home</Link>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: game.connectionStatus === "connected" ? P : "#F59E0B",
                  boxShadow: `0 0 5px ${game.connectionStatus === "connected" ? "rgba(16,185,129,.5)" : "rgba(245,158,11,.5)"}`,
                  animation: "pulse 2s infinite",
                }} />
                <span style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".1em", color: game.connectionStatus === "connected" ? P : "#F59E0B" }}>
                  {game.connectionStatus === "connected" ? "LIVE" : game.connectionStatus.toUpperCase()}
                </span>
              </div>
            </div>
            <h1 style={{
              fontSize: "1.2rem", fontWeight: 800, margin: "0 0 2px",
              background: `linear-gradient(135deg, ${P}, #34D399)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Chess Arena</h1>
            <div style={{ fontSize: ".65rem", color: "#374151", fontFamily: "'JetBrains Mono', monospace" }}>Room: {roomId}</div>
          </div>

          {/* Status */}
          {!isOver && (
            <div style={{
              padding: "9px 14px", borderRadius: 8, fontSize: ".85rem", fontWeight: 600,
              background: game.gameStatus === "check" ? "linear-gradient(90deg,rgba(239,68,68,.1),transparent)"
                : game.isMyTurn ? "linear-gradient(90deg,rgba(16,185,129,.08),transparent)" : "rgba(255,255,255,.02)",
              border: `1px solid ${game.gameStatus === "check" ? "rgba(239,68,68,.25)" : "rgba(16,185,129,.12)"}`,
              color: game.gameStatus === "check" ? "#EF4444" : game.isMyTurn ? P : "#6B7280",
            }}>
              {game.gameStatus === "check"
                ? `⚠ ${game.turn === "w" ? "White" : "Black"} is in check!`
                : game.isMyTurn ? "⚡ Your turn to move" : "⏳ Waiting for opponent…"}
            </div>
          )}

          {game.errorMessage && (
            <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.18)", color: "#EF4444", fontSize: ".8rem" }}>
              ⚠ {game.errorMessage}
            </div>
          )}

          {/* Move history */}
          <div style={{
            flex: 1, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)",
            borderRadius: 10, padding: 14, display: "flex", flexDirection: "column",
            minHeight: 240, maxHeight: 340,
          }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              <div style={{ width: 28 }} />
              <div style={{ flex: 1, fontSize: ".6rem", color: "#4B5563", fontWeight: 700, letterSpacing: ".1em", paddingLeft: 8 }}>WHITE</div>
              <div style={{ flex: 1, fontSize: ".6rem", color: "#4B5563", fontWeight: 700, letterSpacing: ".1em", paddingLeft: 8 }}>BLACK</div>
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,.04)", marginBottom: 6 }} />
            <MoveHistory moves={game.moveHistory} moveTimes={game.moveTimes} />
          </div>

          {isGuest ? (
            <div style={{
              padding: "14px 18px", borderRadius: 10,
              background: "rgba(245,158,11,.04)", border: "1px solid rgba(245,158,11,.12)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: ".62rem", color: "#F59E0B", fontWeight: 700, letterSpacing: ".1em", marginBottom: 4 }}>GUEST MODE</div>
              <p style={{ fontSize: ".72rem", color: "#6B7280", margin: 0 }}>
                Sign up to unlock chat, game history, and analysis.
              </p>
            </div>
          ) : (
            <ChatPanel messages={game.chatMessages} onSend={game.sendChat} myId={myId} />
          )}

          {/* Footer info */}
          <div style={{ padding: "12px 14px", background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".05em" }}>YOUR COLOR</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: myColor === "w" ? "#fff" : myColor === "b" ? "#333" : "#4B5563", border: "2px solid #4B5563" }} />
                <span style={{ fontSize: ".8rem", color: "#9CA3AF", fontWeight: 600 }}>
                  {myColor === "w" ? "White" : myColor === "b" ? "Black" : "—"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: ".62rem", color: "#4B5563", letterSpacing: ".05em" }}>MOVES</span>
              <span style={{ fontSize: ".8rem", color: "#9CA3AF", fontWeight: 600 }}>{game.moveHistory.length}</span>
            </div>
            <Link to="/game" style={{
              display: "block", textAlign: "center", padding: "8px 0",
              border: `1px solid rgba(16,185,129,.15)`, borderRadius: 8,
              color: P, textDecoration: "none", fontSize: ".8rem", fontWeight: 600, transition: "all .2s",
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,.06)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >New Game</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
