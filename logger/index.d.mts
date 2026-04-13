/**
 * Async non-blocking logger — type declarations.
 */

export interface LogMeta {
  [key: string]: any;
}

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  fatal(message: string, meta?: LogMeta): void;

  /** Log an HTTP/WS request — fire-and-forget */
  req(method: string, path: string, status: number, durationMs: number, meta?: LogMeta): void;

  /** Log a WebSocket event — fire-and-forget */
  ws(event: string, meta?: LogMeta): void;

  /** Log a function call — fire-and-forget */
  fn(fnName: string, meta?: LogMeta): void;

  /** Gracefully close the write stream (call on shutdown) */
  close(): Promise<void>;
}

export function createLogger(serviceName: string): Logger;
