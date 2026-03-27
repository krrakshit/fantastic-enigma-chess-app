import { fork } from "child_process";
import { createRequire } from "module";
import path from "path";
import express from "express";

const app = express();
app.use(express.json());

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
    console.log(`✅ Analysed ${moves.length} moves in ${elapsed}s (${(elapsed / moves.length * 1000).toFixed(0)}ms/move)`);
    res.json({ analysis: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// Position evaluation (MultiPV = N, single position)
app.post("/evaluate", async (req, res) => {
  const { moves = [], depth = 15, lines = 3 } = req.body;

  if (!Array.isArray(moves)) {
    return res.status(400).json({ error: "moves must be an array" });
  }

  try {
    const numLines = Math.min(Math.max(lines, 1), 5);
    const output = await analysePositionMultiPV(moves, depth, numLines);
    const result = parseMultiPV(output, numLines);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

sendCommand("uci");
sendCommand("setoption name Hash value 128");   // 128MB transposition table
sendCommand("isready");

console.log("⚡ Engine config: Hash=128MB, FullAnalysis=depth12, Evaluate=movetime500ms");

app.listen(7000, () => console.log("♟ Chess analysis server on :7000"));

process.on("SIGINT", () => {
  sendCommand("quit");
  engine.kill();
  process.exit();
});