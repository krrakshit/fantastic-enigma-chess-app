/**
 * Type declarations for the shared logger module.
 * Needed because tsconfig uses module:"commonjs" which doesn't resolve .d.mts files.
 */
declare module "../../logger/index.mjs" {
  export interface Logger {
    debug(message: string, meta?: Record<string, any>): void;
    info(message: string, meta?: Record<string, any>): void;
    warn(message: string, meta?: Record<string, any>): void;
    error(message: string, meta?: Record<string, any>): void;
    fatal(message: string, meta?: Record<string, any>): void;
    req(method: string, path: string, status: number, durationMs: number, meta?: Record<string, any>): void;
    ws(event: string, meta?: Record<string, any>): void;
    fn(fnName: string, meta?: Record<string, any>): void;
    close(): Promise<void>;
  }
  export function createLogger(serviceName: string): Logger;
}
