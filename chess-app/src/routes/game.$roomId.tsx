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

interface GameData {
  roomId: string;
  player1Id: string;
  player2Id: string;
  currentPlayerId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}…` : id;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ── Move History ──────────────────────────────────────────────────────────────

function formatMoveTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}

function MoveHistory({ moves, moveTimes }: { moves: Move[]; moveTimes: number[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves.length]);

  type Pair = { white?: Move; black?: Move; whiteTime?: number; blackTime?: number; num: number };
  const pairs: Pair[] = [];
  moves.forEach((m, i) => {
    if (i % 2 === 0) pairs.push({ white: m, whiteTime: moveTimes[i], num: Math.floor(i / 2) + 1 });
    else {
      pairs[pairs.length - 1].black = m;
      pairs[pairs.length - 1].blackTime = moveTimes[i];
    }
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      {pairs.length === 0 && (
        <p style={{ textAlign: "center", color: "#333", fontSize: ".8rem", fontStyle: "italic", marginTop: 20 }}>
          Game not started yet
        </p>
      )}
      {pairs.map((p) => (
        <div key={p.num} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: ".7rem", color: "#444", width: 24, textAlign: "right", flexShrink: 0 }}>
            {p.num}.
          </span>
          <span style={{
            flex: 1, padding: "3px 8px", borderRadius: 4, fontSize: ".82rem",
            fontFamily: "'Courier New', monospace", fontWeight: 600,
            background: "rgba(255,255,255,.04)", color: "#D4C49A",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{p.white?.san ?? ""}</span>
            {p.whiteTime != null && (
              <span style={{ fontSize: ".6rem", color: "#666", fontWeight: 400 }}>
                {formatMoveTime(p.whiteTime)}
              </span>
            )}
          </span>
          <span style={{
            flex: 1, padding: "3px 8px", borderRadius: 4, fontSize: ".82rem",
            fontFamily: "'Courier New', monospace",
            background: p.black ? "rgba(255,255,255,.02)" : "transparent", color: "#A09880",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{p.black?.san ?? ""}</span>
            {p.blackTime != null && (
              <span style={{ fontSize: ".6rem", color: "#666", fontWeight: 400 }}>
                {formatMoveTime(p.blackTime)}
              </span>
            )}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({
  messages,
  onSend,
  myId,
}: {
  messages: ChatMessage[];
  onSend: (msg: string) => void;
  myId: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const A = "#C9A84C";

  return (
    <div style={{
      background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)",
      borderRadius: 12, padding: 12, display: "flex", flexDirection: "column",
      minHeight: 160, maxHeight: 220,
    }}>
      <div style={{ fontSize: ".62rem", color: "#444", fontWeight: 700, letterSpacing: ".1em", marginBottom: 6 }}>
        CHAT
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,.05)", marginBottom: 6 }} />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
        {messages.length === 0 && (
          <p style={{ textAlign: "center", color: "#333", fontSize: ".72rem", fontStyle: "italic", marginTop: 8 }}>
            No messages yet
          </p>
        )}
        {messages.map((m, i) => {
          const isMe = m.senderID === myId;
          return (
            <div
              key={i}
              style={{
                alignSelf: isMe ? "flex-end" : "flex-start",
                maxWidth: "80%",
                padding: "5px 10px", borderRadius: 8,
                background: isMe ? "rgba(201,168,76,.12)" : "rgba(255,255,255,.05)",
                border: `1px solid ${isMe ? "rgba(201,168,76,.25)" : "rgba(255,255,255,.08)"}`,
              }}
            >
              <div style={{ fontSize: ".6rem", color: isMe ? A : "#555", fontWeight: 600, marginBottom: 1 }}>
                {isMe ? "You" : shortId(m.senderID)}
              </div>
              <div style={{ fontSize: ".78rem", color: isMe ? "#E8D5A0" : "#999", wordBreak: "break-word" }}>
                {m.message}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onSend(draft);
          setDraft("");
        }}
        style={{ display: "flex", gap: 6 }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          maxLength={200}
          style={{
            flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,.1)",
            background: "rgba(255,255,255,.03)", color: "#ccc", fontSize: ".78rem",
            outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "6px 12px", borderRadius: 6, border: `1px solid ${A}44`,
            background: "rgba(201,168,76,.1)", color: A, fontSize: ".78rem",
            fontWeight: 700, cursor: "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ── Player Strip ──────────────────────────────────────────────────────────────

function PlayerStrip({
  label,
  id,
  color,
  isActive,
  captures,
  points,
  timeMs,
}: {
  label: string;
  id: string;
  color: "w" | "b";
  isActive: boolean;
  captures: { type: string; color: string }[];
  points: number;
  timeMs: number;
}) {
  const A = "#C9A84C";
  const isLow = timeMs < 60_000; // under 1 minute
  return (
    <div style={{
      padding: "12px 16px", borderRadius: 10,
      background: isActive ? "rgba(201,168,76,.08)" : "rgba(255,255,255,.02)",
      border: `1px solid ${isActive ? "rgba(201,168,76,.35)" : "rgba(255,255,255,.05)"}`,
      transition: "all .3s",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        background: color === "w" ? "linear-gradient(135deg,#fff,#ddd)" : "linear-gradient(135deg,#444,#111)",
        border: `2px solid ${isActive ? A : "rgba(255,255,255,.15)"}`,
        boxShadow: isActive ? `0 0 8px ${A}66` : "none",
        transition: "all .3s",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".75rem", fontWeight: 700, color: isActive ? "#E8D5A0" : "#666", letterSpacing: ".05em" }}>
          {label}
        </div>
        <div style={{ fontSize: ".65rem", color: "#444", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shortId(id)}
        </div>
      </div>
      {/* Points badge */}
      <div style={{
        padding: "2px 8px", borderRadius: 6,
        background: points > 0 ? "rgba(201,168,76,.12)" : "rgba(255,255,255,.03)",
        border: `1px solid ${points > 0 ? "rgba(201,168,76,.3)" : "rgba(255,255,255,.06)"}`,
        fontSize: ".72rem", fontWeight: 700, color: points > 0 ? A : "#333",
        minWidth: 28, textAlign: "center", flexShrink: 0,
      }}>
        {points}pt{points !== 1 ? "s" : ""}
      </div>
      {/* Timer */}
      <div style={{
        padding: "4px 10px", borderRadius: 6, fontFamily: "monospace",
        fontSize: ".85rem", fontWeight: 700, flexShrink: 0, minWidth: 52, textAlign: "center",
        background: isActive
          ? (isLow ? "rgba(255,68,68,.15)" : "rgba(201,168,76,.12)")
          : "rgba(255,255,255,.04)",
        border: `1px solid ${isActive ? (isLow ? "rgba(255,68,68,.4)" : "rgba(201,168,76,.3)") : "rgba(255,255,255,.08)"}`,
        color: isActive ? (isLow ? "#FF6B6B" : A) : "#555",
      }}>
        {formatTime(timeMs)}
      </div>
      {captures.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {captures.slice(0, 8).map((p, i) => (
            <PieceSVG key={i} type={p.type as any} color={p.color as any} size={16} />
          ))}
        </div>
      )}
      {isActive && (
        <div style={{
          width: 7, height: 7, borderRadius: "50%", background: A,
          boxShadow: `0 0 8px ${A}`, animation: "pulse 1.5s infinite", flexShrink: 0,
        }} />
      )}
    </div>
  );
}

// ── Game Over Overlay ─────────────────────────────────────────────────────────

function GameOverOverlay({
  status,
  turn,
  myColor,
  gameResult,
  myId,
  myPoints,
  opponentPoints,
  gameStartedAt,
}: {
  status: string;
  turn: string;
  myColor: string | null;
  gameResult: GameResult | null;
  myId: string;
  myPoints: number;
  opponentPoints: number;
  gameStartedAt: string | null;
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
          send({
            content: { Winner: winner, Runnerup: runnerup, roomId: parsed.roomId },
            uid: parsed.currentPlayerId,
          } as any);
        }
      } catch (e) {}
    }
  }, [status, turn, myColor, send]);

  // For draw/stalemate, save to localStorage since no server game_over is sent
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
          winner: null,
          runnerup: null,
          winnerPoints: 0,
          runnerupPoints: 0,
          myPoints,
          opponentPoints,
          totalMoves: 0,
          status,
          roomId: session.roomId ?? "",
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds,
        };
        localStorage.setItem("gameResult", JSON.stringify({ ...session, ...result }));
      } catch (e) {}
    }
  }, [status]);

  const terminalStatuses = ["checkmate", "stalemate", "draw", "threefold", "insufficient"];
  if (!terminalStatuses.includes(status)) return null;

  const A = "#C9A84C";
  let emoji = "🤝", headline = "Draw", sub = "The game is a draw.";
  if (status === "checkmate") {
    const winner = turn === "w" ? "b" : "w";
    const iWon = winner === myColor;
    emoji = iWon ? "🏆" : "💀";
    headline = iWon ? "Victory!" : "Defeat";
    sub = iWon ? "You checkmated your opponent!" : "You were checkmated.";
  } else if (status === "stalemate") {
    sub = "Stalemate — no legal moves.";
  }

  // Use server-authoritative points if available, otherwise fall back to local
  const iAmWinner = gameResult
    ? gameResult.winner === myId
    : (turn === "w" ? "b" : "w") === myColor;
  const displayMyPts = gameResult
    ? (iAmWinner ? gameResult.winnerPoints : gameResult.runnerupPoints)
    : myPoints;
  const displayOppPts = gameResult
    ? (iAmWinner ? gameResult.runnerupPoints : gameResult.winnerPoints)
    : opponentPoints;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,.78)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "linear-gradient(135deg,#141418,#1e1e28)",
        border: `1px solid ${A}33`, borderRadius: 20,
        padding: "48px 56px", textAlign: "center",
        boxShadow: `0 32px 80px rgba(0,0,0,.6)`,
        maxWidth: 400,
      }}>
        <div style={{ fontSize: "4rem", marginBottom: 14 }}>{emoji}</div>
        <h2 style={{
          fontFamily: "'Playfair Display', serif", fontSize: "2.5rem", fontWeight: 900,
          margin: "0 0 10px",
          background: `linear-gradient(135deg,${A},#fff)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>{headline}</h2>
        <p style={{ color: "#888", fontSize: "1rem", marginBottom: 24, lineHeight: 1.6 }}>{sub}</p>
        {/* Score card */}
        {status === "checkmate" && (
          <div style={{
            display: "flex", gap: 12, marginBottom: 28,
            background: "rgba(255,255,255,.03)", borderRadius: 10, padding: "14px 18px",
            border: "1px solid rgba(255,255,255,.06)",
          }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: ".62rem", color: "#555", letterSpacing: ".1em", marginBottom: 4 }}>YOU</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: A }}>{displayMyPts}</div>
              <div style={{ fontSize: ".6rem", color: "#444" }}>pts</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,.06)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: ".62rem", color: "#555", letterSpacing: ".1em", marginBottom: 4 }}>OPPONENT</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#888" }}>{displayOppPts}</div>
              <div style={{ fontSize: ".6rem", color: "#444" }}>pts</div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link to="/game" style={{
            padding: "12px 28px",
            background: `linear-gradient(135deg,${A},${A}bb)`,
            color: "#0A0A0F", borderRadius: 8, fontWeight: 700,
            fontSize: ".9rem", textDecoration: "none",
          }}>Play Again</Link>
          <Link to="/" style={{
            padding: "12px 28px",
            border: `1px solid ${A}44`, color: A, borderRadius: 8,
            fontWeight: 600, fontSize: ".9rem", textDecoration: "none",
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
    // Prefer the full chessGameState (has FEN + moves) over raw gameData
    const storedState = localStorage.getItem("chessGameState");
    const storedData = localStorage.getItem("gameData");

    if (storedState) {
      try {
        const parsed = JSON.parse(storedState);
        // Only restore if it matches the current roomId in the URL
        if (parsed.roomId === roomId) {
          setGameData({
            roomId: parsed.roomId,
            player1Id: parsed.player1Id,
            player2Id: parsed.player2Id,
            currentPlayerId: parsed.currentPlayerId,
          });
          // If we have more than 0 moves saved, we're restoring a live session
          if (parsed.moves && parsed.moves.length > 0) {
            setWasRestored(true);
          }
          setLoading(false);
          return;
        }
      } catch { /* ignore */ }
    }

    if (storedData) {
      try { setGameData(JSON.parse(storedData)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, [roomId]);

  const game = useChessWebSocket(gameData);

  const A = "#C9A84C";
  const myColor = game.myColor;
  const flipped = myColor === "b";
  const isOver = ["checkmate", "stalemate", "draw", "threefold", "insufficient"].includes(game.gameStatus);
  const isDisabled = !game.isMyTurn || isOver;

  const boardTheme = {
    lightSquare: "#3D3D3D", darkSquare: "#1A1A1A",
    selectedSquare: "rgba(201,168,76,.4)", legalMoveIndicator: "rgba(201,168,76,.35)",
    lastMoveHighlight: "rgba(201,168,76,.18)", checkHighlight: "rgba(220,50,50,.55)",
    boardBorder: A, boardBorderWidth: 3,
    boardShadow: `0 0 60px rgba(201,168,76,.1), 0 24px 64px rgba(0,0,0,.7)`,
    pieceSize: 58, squareSize: 70,
    coordinateColor: A, coordinateFontFamily: "'Cormorant Garamond', serif",
  };

  // Board width for aligning player strips
  const boardW = boardTheme.squareSize * 8 + boardTheme.boardBorderWidth * 2;

  // ── Player IDs ──────────────────────────────────────────────────────────
  const myId = gameData?.currentPlayerId ?? "";
  const oppId = myColor === "w" ? (gameData?.player2Id ?? "…") : (gameData?.player1Id ?? "…");

  // Top = opponent's strip; bottom = my strip. Flip when playing black.
  const topColor: "w" | "b" = flipped ? "w" : "b";
  const bottomColor: "w" | "b" = flipped ? "b" : "w";
  const topId = flipped ? myId : oppId;
  const bottomId = flipped ? oppId : myId;
  const topIsMe = flipped;

  // Captures: whiteCaptured = pieces white took from black, etc.
  const whiteCaptured = game.capturedPieces.b;
  const blackCaptured = game.capturedPieces.w;
  const topCaptures = topColor === "w" ? whiteCaptured : blackCaptured;
  const bottomCaptures = bottomColor === "w" ? whiteCaptured : blackCaptured;

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0F", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(255,255,255,.08)", borderTop: `3px solid ${A}`, animation: "spin .8s linear infinite" }} />
        <p style={{ color: "#555", fontFamily: "'Cormorant Garamond', serif" }}>Loading game…</p>
      </div>
    );
  }

  // ── No session ──────────────────────────────────────────────────────────
  if (!gameData) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0F", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, fontFamily: "'Cormorant Garamond', serif" }}>
        <div style={{ fontSize: "3rem" }}>⚠️</div>
        <p style={{ color: "#FF6B6B", fontSize: "1.1rem", textAlign: "center" }}>
          Session not found.<br /><span style={{ color: "#555", fontSize: ".9rem" }}>The session may have expired.</span>
        </p>
        <Link to="/game" style={{ padding: "12px 32px", background: A, color: "#0A0A0F", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>
          Back to Lobby
        </Link>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", color: "#fff", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.25)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Overlays */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", backgroundImage:"linear-gradient(rgba(201,168,76,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.025) 1px,transparent 1px)", backgroundSize:"60px 60px" }} />
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", background:"radial-gradient(ellipse at 30% 40%,rgba(201,168,76,.05) 0%,transparent 55%)" }} />

      <GameOverOverlay
        status={game.gameStatus}
        turn={game.turn}
        myColor={myColor}
        gameResult={game.gameResult}
        myId={myId}
        myPoints={game.myPoints}
        opponentPoints={game.opponentPoints}
        gameStartedAt={game.gameStartedAt}
      />

      {/* Reconnection restored banner */}
      {wasRestored && game.connectionStatus === "connected" && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 1500, padding: "10px 20px", borderRadius: 8,
          background: "rgba(0,255,136,.12)", border: "1px solid rgba(0,255,136,.3)",
          color: "#00FF88", fontSize: ".82rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
          animation: "fadeUp .4s ease",
          boxShadow: "0 4px 24px rgba(0,255,136,.15)",
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#00FF88", boxShadow: "0 0 6px rgba(0,255,136,.8)",
            animation: "pulse 1.5s infinite",
          }} />
          ♻ Session restored — reconnected successfully
          <button
            onClick={() => setWasRestored(false)}
            style={{
              marginLeft: 8, background: "none", border: "none",
              color: "#00FF88", cursor: "pointer", fontSize: "1rem", lineHeight: 1,
            }}
          >×</button>
        </div>
      )}

      {/* Layout: board + sidebar */}
      <div style={{ display:"flex", gap:36, alignItems:"flex-start", position:"relative", zIndex:1, flexWrap:"wrap", justifyContent:"center", animation:"fadeUp .4s ease" }}>

        {/* Left: player strip + board + player strip */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, alignItems:"center" }}>
          {/* Top player (opponent usually) */}
          <div style={{ width: boardW }}>
            <PlayerStrip
              label={topIsMe ? "You" : "Opponent"}
              id={topId}
              color={topColor}
              isActive={game.turn === topColor}
              captures={topCaptures}
              points={topIsMe ? game.myPoints : game.opponentPoints}
              timeMs={topColor === "w" ? game.whiteTime : game.blackTime}
            />
          </div>

          {/* Board */}
          <div style={{ position:"relative" }}>
            {isDisabled && !isOver && (
              <div style={{ position:"absolute", inset:0, zIndex:10, cursor:"not-allowed", borderRadius:4 }} />
            )}
            <ChessBoard game={game} theme={boardTheme} flipped={flipped} disabled={isDisabled} />
          </div>

          {/* Bottom player (me usually) */}
          <div style={{ width: boardW }}>
            <PlayerStrip
              label={topIsMe ? "Opponent" : "You"}
              id={bottomId}
              color={bottomColor}
              isActive={game.turn === bottomColor}
              captures={bottomCaptures}
              points={topIsMe ? game.opponentPoints : game.myPoints}
              timeMs={bottomColor === "w" ? game.whiteTime : game.blackTime}
            />
          </div>
        </div>

        {/* Right: info panel */}
        <div style={{ width: 290, display:"flex", flexDirection:"column", gap:14, fontFamily:"'Cormorant Garamond', serif" }}>

          {/* Header card */}
          <div style={{ padding:"18px 20px", background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.06)", borderRadius:12 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <Link to="/" style={{ color:"#444", textDecoration:"none", fontSize:".8rem" }}>← Home</Link>
              {/* Live badge */}
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{
                  width:7, height:7, borderRadius:"50%",
                  background: game.connectionStatus === "connected" ? "#00FF88" : "#FFB800",
                  boxShadow: `0 0 6px ${game.connectionStatus === "connected" ? "rgba(0,255,136,.5)" : "rgba(255,184,0,.5)"}`,
                  animation:"pulse 2s infinite",
                }} />
                <span style={{ fontSize:".62rem", fontWeight:700, letterSpacing:".1em", color: game.connectionStatus === "connected" ? "#00FF88" : "#FFB800" }}>
                  {game.connectionStatus === "connected" ? "LIVE" : game.connectionStatus.toUpperCase()}
                </span>
              </div>
            </div>
            <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.4rem", fontWeight:900, margin:"0 0 3px", background:`linear-gradient(135deg,${A},#FFE89D)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              Chess Arena
            </h1>
            <div style={{ fontSize:".68rem", color:"#333", fontFamily:"monospace" }}>Room: {roomId}</div>
          </div>

          {/* Status banner */}
          {!isOver && (
            <div style={{
              padding:"10px 16px", borderRadius:8, fontSize:".88rem", fontWeight:600, letterSpacing:".03em",
              background: game.gameStatus === "check" ? "linear-gradient(90deg,rgba(255,68,68,.15),transparent)" : game.isMyTurn ? "linear-gradient(90deg,rgba(201,168,76,.1),transparent)" : "rgba(255,255,255,.03)",
              border: `1px solid ${game.gameStatus === "check" ? "rgba(255,68,68,.3)" : "rgba(201,168,76,.15)"}`,
              color: game.gameStatus === "check" ? "#FF6B6B" : game.isMyTurn ? A : "#555",
            }}>
              {game.gameStatus === "check"
                ? `⚠ ${game.turn === "w" ? "White" : "Black"} is in check!`
                : game.isMyTurn ? "⚡ Your turn to move" : "⏳ Waiting for opponent…"}
            </div>
          )}

          {/* Error message */}
          {game.errorMessage && (
            <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(255,68,68,.08)", border:"1px solid rgba(255,68,68,.2)", color:"#FF6B6B", fontSize:".82rem" }}>
              ⚠ {game.errorMessage}
            </div>
          )}

          {/* Move history */}
          <div style={{
            flex:1, background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.06)",
            borderRadius:12, padding:16, display:"flex", flexDirection:"column",
            minHeight:260, maxHeight:360,
          }}>
            <div style={{ display:"flex", gap:4, marginBottom:8 }}>
              <div style={{ width:28 }} />
              <div style={{ flex:1, fontSize:".62rem", color:"#444", fontWeight:700, letterSpacing:".1em", paddingLeft:8 }}>WHITE</div>
              <div style={{ flex:1, fontSize:".62rem", color:"#444", fontWeight:700, letterSpacing:".1em", paddingLeft:8 }}>BLACK</div>
            </div>
            <div style={{ height:1, background:"rgba(255,255,255,.05)", marginBottom:8 }} />
            <MoveHistory moves={game.moveHistory} moveTimes={game.moveTimes} />
          </div>

          {/* Chat */}
          <ChatPanel messages={game.chatMessages} onSend={game.sendChat} myId={myId} />

          {/* Footer: my color + move count + new game */}
          <div style={{ padding:"14px 16px", background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.06)", borderRadius:10, display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:".68rem", color:"#444", letterSpacing:".05em" }}>YOUR COLOR</span>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:14, height:14, borderRadius:"50%", background: myColor==="w" ? "#fff" : myColor==="b" ? "#222" : "#555", border:"2px solid #555" }} />
                <span style={{ fontSize:".82rem", color:"#888", fontWeight:600 }}>
                  {myColor === "w" ? "White" : myColor === "b" ? "Black" : "—"}
                </span>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:".68rem", color:"#444", letterSpacing:".05em" }}>MOVES</span>
              <span style={{ fontSize:".82rem", color:"#888", fontWeight:600 }}>{game.moveHistory.length}</span>
            </div>
            <Link
              to="/game"
              style={{
                display:"block", textAlign:"center", padding:"9px 0",
                border:`1px solid rgba(201,168,76,.2)`, borderRadius:8,
                color:A, textDecoration:"none", fontSize:".82rem", fontWeight:600,
                transition:"all .2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background="rgba(201,168,76,.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background="transparent"; }}
            >
              New Game
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
