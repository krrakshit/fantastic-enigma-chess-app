import { fork } from "child_process";
import { createRequire } from "module";
import path from "path";
import express from "express";
import { createLogger } from "../logger/index.mjs";
import { Chess } from "chess.js"
const log = createLogger("game-analyse-backend");

const app = express();
app.use(express.json());


function pgnToUciMoves(pgn) {
  const chess = new Chess();
  
  // Load the PGN
  chess.loadPgn(pgn);
  
  // Get full verbose move history
  const history = chess.history({ verbose: true });
  
  // Convert each move to UCI format (from + to + promotion if any)
  const uciMoves = history.map((move) => {
    const base = move.from + move.to;
    return move.promotion ? base + move.promotion : base;
  });
  
  return uciMoves;
}
// ── Request logging middleware (fire-and-forget) ────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    log.req(req.method, req.path, res.statusCode, Date.now() - start);
  });
  next();
});

app.post("/analyse-pgn", async (req, res) => {
  const { pgn, depth = 15 } = req.body;

  if (!pgn || typeof pgn !== "string") {
    return res.status(400).json({ error: "pgn string required" });
  }

  // Parse PGN into UCI moves
  let uciMoves;
  try {
    uciMoves = pgnToUciMoves(pgn.trim());
  } catch (err) {
    return res.status(400).json({ 
      error: "Invalid PGN format", 
      details: String(err) 
    });
  }

  if (uciMoves.length === 0) {
    return res.status(400).json({ error: "PGN contains no moves" });
  }

  log.info(`📋 PGN analysis request`, { moveCount: uciMoves.length });

  // Feed into existing analysis pipeline
  try {
    const startTime = Date.now();
    const results = [];
    let prevScore = 0;

    sendCommand("ucinewgame");
    sendCommand("isready");

    for (let i = 0; i < uciMoves.length; i++) {
      const movesUpToHere = uciMoves.slice(0, i + 1);
      const lines = await analysePosition(movesUpToHere, depth);
      const { score, mate, bestMove } = parseAnalysis(lines);

      const isWhiteTurn = i % 2 === 0;
      const classification = classifyMove(prevScore, score ?? 0, isWhiteTurn);

      results.push({
        moveNumber: Math.floor(i / 2) + 1,
        move: uciMoves[i],
        color: isWhiteTurn ? "white" : "black",
        score,
        mate,
        bestMove,
        classification,
      });

      prevScore = score ?? prevScore;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log.info(`✅ PGN Analysis complete`, { 
      moveCount: uciMoves.length, 
      elapsedSec: elapsed 
    });

    // Also extract metadata from PGN headers
    const chess = new Chess();
    chess.loadPgn(pgn.trim());
    const headers = chess.header();

    res.json({ 
      analysis: results,
      metadata: {
        white: headers.White ?? null,
        black: headers.Black ?? null,
        result: headers.Result ?? null,
        date: headers.Date ?? null,
        event: headers.Event ?? null,
        opening: headers.Opening ?? null,
        eco: headers.ECO ?? null,
        totalMoves: uciMoves.length,
      }
    });
  } catch (err) {
    log.error("PGN Analysis failed", { error: String(err) });
    res.status(500).json({ error: "Analysis failed" });
  }
});

const require = createRequire(import.meta.url);
const stockfishPath = path.join(
  path.dirname(require.resolve("stockfish/package.json")),
  "bin",
  "stockfish-18-single.js"
);

const engine = fork(stockfishPath, [], {
  stdio: ["pipe", "pipe", "pipe", "ipc"],
  silent: true,
});

// ── Engine communication layer (serialized via queue) ─────────────────────────

let pendingResolve = null;
let outputBuffer = [];
let engineBusy = false;
const requestQueue = [];

engine.stdout.on("data", (data) => {
  const lines = data.toString().trim().split("\n");
  for (const line of lines) {
    outputBuffer.push(line);
    if (line.startsWith("bestmove") && pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      engineBusy = false;
      resolve([...outputBuffer]);
      outputBuffer = [];
      // Process next item in queue
      processQueue();
    }
  }
});

function sendCommand(cmd) {
  engine.stdin.write(cmd + "\n");
}

function processQueue() {
  if (engineBusy || requestQueue.length === 0) return;
  const next = requestQueue.shift();
  engineBusy = true;
  next();
}

// Enqueue an engine task — ensures only one request talks to engine at a time
function enqueueEngine(taskFn) {
  return new Promise((resolve, reject) => {
    requestQueue.push(() => {
      taskFn(resolve, reject);
    });
    processQueue();
  });
}

// Analyse a single position (MultiPV = 1)
function analysePosition(moves, depth = 12) {
  return enqueueEngine((resolve) => {
    pendingResolve = resolve;
    outputBuffer = [];

    sendCommand("setoption name MultiPV value 1");
    const movesStr = moves.length > 0 ? `moves ${moves.join(" ")}` : "";
    sendCommand(`position startpos ${movesStr}`);
    sendCommand(`go depth ${depth}`);
  });
}

// Analyse a position with multiple principal variations
function analysePositionMultiPV(moves, depth = 10, numLines = 3) {
  return enqueueEngine((resolve) => {
    pendingResolve = resolve;
    outputBuffer = [];

    sendCommand(`setoption name MultiPV value ${numLines}`);
    const movesStr = moves.length > 0 ? `moves ${moves.join(" ")}` : "";
    sendCommand(`position startpos ${movesStr}`);
    // Use movetime for faster interactive evaluation (500ms cap)
    sendCommand(`go movetime 500`);
  });
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function parseAnalysis(lines) {
  let score = null;
  let bestMove = null;
  let mate = null;

  for (const line of lines) {
    if (line.includes("info depth") && line.includes(" score ")) {
      const cpMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);
      if (cpMatch) score = parseInt(cpMatch[1]);
      if (mateMatch) mate = parseInt(mateMatch[1]);
    }
    if (line.startsWith("bestmove")) {
      const parts = line.split(" ");
      bestMove = parts[1];
    }
  }

  return { score, mate, bestMove };
}

function classifyMove(prevScore, currScore, isWhiteTurn) {
  const scoreDrop = isWhiteTurn
    ? (prevScore ?? 0) - (currScore ?? 0)
    : (currScore ?? 0) - (prevScore ?? 0);

  if (scoreDrop <= 0)  return "best";
  if (scoreDrop < 20)  return "excellent";
  if (scoreDrop < 50)  return "good";
  if (scoreDrop < 100) return "inaccuracy";
  if (scoreDrop < 200) return "mistake";
  return "blunder";
}

function parseMultiPV(lines, numLines = 3) {
  const pvLines = {};

  for (const line of lines) {
    if (line.includes("info depth") && line.includes(" multipv ")) {
      const pvMatch = line.match(/multipv (\d+)/);
      if (pvMatch) {
        pvLines[parseInt(pvMatch[1])] = line;
      }
    }
  }

  const results = [];
  for (let i = 1; i <= numLines; i++) {
    const line = pvLines[i];
    if (!line) continue;

    let score = null;
    let mate = null;
    const cpMatch = line.match(/score cp (-?\d+)/);
    const mateMatch = line.match(/score mate (-?\d+)/);
    if (cpMatch) score = parseInt(cpMatch[1]);
    if (mateMatch) mate = parseInt(mateMatch[1]);

    const pvMoveMatch = line.match(/ pv (.+)$/);
    const pvMoves = pvMoveMatch ? pvMoveMatch[1].trim().split(" ") : [];

    results.push({
      rank: i,
      score,
      mate,
      moves: pvMoves,
      bestMove: pvMoves[0] || null,
    });
  }

  let engineBest = null;
  for (const line of lines) {
    if (line.startsWith("bestmove")) {
      engineBest = line.split(" ")[1];
    }
  }

  return { lines: results, bestMove: engineBest };
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

// Full game analysis (MultiPV = 1, move by move)
app.post("/analyse", async (req, res) => {
  const { moves, depth = 15 } = req.body;

  if (!moves || !Array.isArray(moves)) {
    return res.status(400).json({ error: "moves array required" });
  }

  try {
    const startTime = Date.now();
    const results = [];
    let prevScore = 0;

    // Reset engine state for fresh sequential analysis (hash table will build up efficiently)
    sendCommand("ucinewgame");
    sendCommand("isready");

    for (let i = 0; i < moves.length; i++) {
      const movesUpToHere = moves.slice(0, i + 1);
      const lines = await analysePosition(movesUpToHere, depth);
      const { score, mate, bestMove } = parseAnalysis(lines);

      const isWhiteTurn = i % 2 === 0;
      const classification = classifyMove(prevScore, score ?? 0, isWhiteTurn);

      results.push({
        moveNumber: Math.floor(i / 2) + 1,
        move: moves[i],
        color: isWhiteTurn ? "white" : "black",
        score,
        mate,
        bestMove,
        classification,
      });

      prevScore = score ?? prevScore;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log.info(`✅ Analysis complete`, { moveCount: moves.length, elapsedSec: elapsed, msPerMove: (elapsed / moves.length * 1000).toFixed(0) });
    res.json({ analysis: results });
  } catch (err) {
    log.error("Analysis failed", { error: String(err) });
    res.status(500).json({ error: "Analysis failed" });
  }
});

const evaluateCache = new Map();
const MAX_CACHE_SIZE = 5000;

// Position evaluation (MultiPV = N, single position)
app.post("/evaluate", async (req, res) => {
  const { moves = [], depth = 15, lines = 3 } = req.body;

  if (!Array.isArray(moves)) {
    return res.status(400).json({ error: "moves must be an array" });
  }

  try {
    const numLines = Math.min(Math.max(lines, 1), 5);
    const cacheKey = `${moves.join(", ")}|${depth}|${numLines}`;

    if (evaluateCache.has(cacheKey)) {
      return res.json(evaluateCache.get(cacheKey));
    }

    const output = await analysePositionMultiPV(moves, depth, numLines);
    const result = parseMultiPV(output, numLines);
    
    if (evaluateCache.size >= MAX_CACHE_SIZE) {
      const firstKey = evaluateCache.keys().next().value;
      evaluateCache.delete(firstKey);
    }
    evaluateCache.set(cacheKey, result);

    res.json(result);
  } catch (err) {
    log.error("Evaluation failed", { error: String(err) });
    res.status(500).json({ error: "Evaluation failed" });
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

sendCommand("uci");
sendCommand("setoption name Hash value 128");   // 128MB transposition table
sendCommand("isready");

log.info("⚡ Engine config", { hash: "128MB", fullAnalysisDepth: 12, evaluateMode: "movetime500ms" });

const PORT = Number(7000);
app.listen(PORT, () => log.info(`♟ Chess analysis server started`, { port: PORT }));

process.on("SIGINT", () => {
  log.info("Shutting down engine...");
  sendCommand("quit");
  engine.kill();
  log.close().then(() => process.exit());
});