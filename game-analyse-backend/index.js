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

// Queue of pending resolvers waiting for "bestmove"
let pendingResolve = null;
let outputBuffer = [];

engine.stdout.on("data", (data) => {
  const lines = data.toString().trim().split("\n");
  for (const line of lines) {
    outputBuffer.push(line);
    // "bestmove" signals that Stockfish is done analyzing this position
    if (line.startsWith("bestmove") && pendingResolve) {
      pendingResolve([...outputBuffer]);
      outputBuffer = [];
      pendingResolve = null;
    }
  }
});

function sendCommand(cmd) {
  engine.stdin.write(cmd + "\n");
}

// Analyse a single position — returns a promise that resolves when bestmove arrives
function analysePosition(moves, depth = 15) {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    outputBuffer = [];

    const movesStr = moves.length > 0 ? `moves ${moves.join(" ")}` : "";
    sendCommand(`position startpos ${movesStr}`);
    sendCommand(`go depth ${depth}`);
  });
}

// Parse centipawn score and best move from Stockfish output lines
function parseAnalysis(lines) {
  let score = null;
  let bestMove = null;
  let mate = null;

  for (const line of lines) {
    // Extract score from the last "info depth" line
    if (line.includes("info depth") && line.includes(" score ")) {
      const cpMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);
      if (cpMatch) score = parseInt(cpMatch[1]);
      if (mateMatch) mate = parseInt(mateMatch[1]);
    }
    // Extract best move
    if (line.startsWith("bestmove")) {
      const parts = line.split(" ");
      bestMove = parts[1]; // e.g. "d2d4"
    }
  }

  return { score, mate, bestMove };
}

// Classify the move quality based on score drop (like chess.com)
function classifyMove(prevScore, currScore, isWhiteTurn) {
  // Normalize scores to always be from the perspective of the side that just moved
  const scoreDrop = isWhiteTurn
    ? (prevScore ?? 0) - (currScore ?? 0)   // white just moved, higher cp = better for white
    : (currScore ?? 0) - (prevScore ?? 0);  // black just moved, lower cp = better for black

  if (scoreDrop <= 0)   return "best";       // Score improved or stayed same
  if (scoreDrop < 20)   return "excellent";
  if (scoreDrop < 50)   return "good";
  if (scoreDrop < 100)  return "inaccuracy";
  if (scoreDrop < 200)  return "mistake";
  return "blunder";
}

// Main analysis endpoint
// Body: { moves: ["e2e4", "e7e5", "g1f3", ...], depth: 15 }
app.post("/analyse", async (req, res) => {
  const { moves, depth = 15 } = req.body;

  if (!moves || !Array.isArray(moves)) {
    return res.status(400).json({ error: "moves array required" });
  }

  try {
    const results = [];
    let prevScore = 0; // Starting score is 0 (equal position)

    // Analyse each position (after each move)
    for (let i = 0; i < moves.length; i++) {
      const movesUpToHere = moves.slice(0, i + 1);
      const lines = await analysePosition(movesUpToHere, depth);
      const { score, mate, bestMove } = parseAnalysis(lines);

      const isWhiteTurn = i % 2 === 0; // Move 0 = white's first move
      const classification = classifyMove(prevScore, score ?? 0, isWhiteTurn);

      results.push({
        moveNumber: Math.floor(i / 2) + 1,
        move: moves[i],
        color: isWhiteTurn ? "white" : "black",
        score,       // centipawns (null if mate)
        mate,        // moves to mate (null if not)
        bestMove,    // engine's top suggestion
        classification,
      });

      prevScore = score ?? prevScore;
    }

    res.json({ analysis: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// Init engine
sendCommand("uci");
sendCommand("isready");

app.listen(7000, () => console.log("Chess analysis server on :7000"));

process.on("SIGINT", () => {
  sendCommand("quit");
  engine.kill();
  process.exit();
});