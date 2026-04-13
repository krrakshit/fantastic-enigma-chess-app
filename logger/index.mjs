/**
 * 🔥 Async Non-Blocking Logger
 * 
 * Fire-and-forget logging — callers never wait for disk I/O.
 * Logs are buffered in memory and flushed to a JSONL file asynchronously.
 * Think of each log call as spawning a goroutine — it returns immediately.
 * 
 * Usage:
 *   import { createLogger } from '../logger/index.mjs';
 *   const log = createLogger('service-name');
 *   log.info('Server started', { port: 3000 });
 *   log.error('Something broke', { err: error.message });
 *   log.req('POST', '/graphql', 200, 45, { body: '...' });
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Resolve project root (logger/ lives one level below project root) ────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ── Log levels ───────────────────────────────────────────────────────────────
const LEVELS = /** @type {const} */ (["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]);

// ── Internal write queue ─────────────────────────────────────────────────────
// Entries are pushed here instantly; a background loop drains them to disk.

/** @type {Map<string, { queue: string[], flushing: boolean, stream: fs.WriteStream }>} */
const writers = new Map();

function getWriter(serviceName) {
  if (writers.has(serviceName)) return writers.get(serviceName);

  const logDir = path.join(PROJECT_ROOT, "logs");
  fs.mkdirSync(logDir, { recursive: true });

  const logFile = path.join(logDir, `${serviceName}.jsonl`);
  const stream = fs.createWriteStream(logFile, { flags: "a", encoding: "utf-8" });

  const writer = { queue: [], flushing: false, stream };
  writers.set(serviceName, writer);
  return writer;
}

/**
 * Drain the queue to disk. Runs in the background — never blocks the caller.
 * Batches multiple entries into a single write for efficiency.
 */
function scheduleDrain(writer) {
  if (writer.flushing || writer.queue.length === 0) return;
  writer.flushing = true;

  // Use setImmediate (or setTimeout(0) for Bun compat) to yield back to the event loop instantly
  const nextTick = typeof setImmediate !== "undefined" ? setImmediate : (fn) => setTimeout(fn, 0);

  nextTick(() => {
    // Grab everything currently in the queue
    const batch = writer.queue.splice(0, writer.queue.length);
    const payload = batch.join("\n") + "\n";

    // stream.write is already non-blocking (buffered by Node/Bun streams)
    writer.stream.write(payload, (err) => {
      if (err) {
        // If disk write fails, print to stderr but never throw
        process.stderr.write(`[logger] write error: ${err.message}\n`);
      }
      writer.flushing = false;
      // If new entries arrived while we were writing, drain again
      if (writer.queue.length > 0) scheduleDrain(writer);
    });
  });
}

/**
 * Enqueue a log entry — returns immediately (fire-and-forget).
 */
function enqueue(writer, entry) {
  writer.queue.push(JSON.stringify(entry));
  scheduleDrain(writer);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a logger instance for a specific service.
 *
 * @param {string} serviceName  e.g. "ws-elysia-backend", "main-backend", "game-analyse-backend"
 * @returns Logger instance with level methods + request logger
 */
export function createLogger(serviceName) {
  const writer = getWriter(serviceName);

  /**
   * Core log function — fire-and-forget.
   * @param {string} level
   * @param {string} message
   * @param {Record<string, any>} [meta]
   */
  function log(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: serviceName,
      message,
      ...meta,
    };

    // Also print to stdout/stderr for real-time dev visibility
    const color = level === "ERROR" || level === "FATAL" ? "\x1b[31m" : level === "WARN" ? "\x1b[33m" : "\x1b[36m";
    const reset = "\x1b[0m";
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    const line = `${color}[${entry.timestamp}] [${level}] [${serviceName}]${reset} ${message}${metaStr}`;

    if (level === "ERROR" || level === "FATAL") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }

    // Fire-and-forget to disk
    enqueue(writer, entry);
  }

  return {
    debug: (msg, meta) => log("DEBUG", msg, meta),
    info:  (msg, meta) => log("INFO",  msg, meta),
    warn:  (msg, meta) => log("WARN",  msg, meta),
    error: (msg, meta) => log("ERROR", msg, meta),
    fatal: (msg, meta) => log("FATAL", msg, meta),

    /**
     * Log an HTTP/WS request — fire-and-forget.
     * @param {string} method   HTTP method or "WS"
     * @param {string} path     URL path or WebSocket event
     * @param {number} status   HTTP status code (0 for WS)
     * @param {number} durationMs  Request duration in ms
     * @param {Record<string, any>} [meta]  Additional context
     */
    req: (method, path, status, durationMs, meta = {}) => {
      log("INFO", `${method} ${path} ${status} ${durationMs}ms`, {
        type: "request",
        method,
        path,
        status,
        durationMs,
        ...meta,
      });
    },

    /**
     * Log a WebSocket event — fire-and-forget.
     * @param {string} event    e.g. "open", "message", "close", "start", "move"
     * @param {Record<string, any>} [meta]
     */
    ws: (event, meta = {}) => {
      log("INFO", `WS:${event}`, { type: "websocket", event, ...meta });
    },

    /**
     * Log a function call — fire-and-forget.
     * @param {string} fnName   Function name
     * @param {Record<string, any>} [meta]  Arguments / context
     */
    fn: (fnName, meta = {}) => {
      log("DEBUG", `fn:${fnName}`, { type: "function", fn: fnName, ...meta });
    },

    /**
     * Gracefully close the write stream (call on shutdown).
     */
    close: () => {
      return new Promise((resolve) => {
        const w = writers.get(serviceName);
        if (!w) { resolve(); return; }
        // Drain remaining entries
        if (w.queue.length > 0) {
          const batch = w.queue.splice(0, w.queue.length);
          w.stream.write(batch.join("\n") + "\n", () => {
            w.stream.end(resolve);
          });
        } else {
          w.stream.end(resolve);
        }
      });
    },
  };
}
