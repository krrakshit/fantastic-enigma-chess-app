import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type WsStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

type MessageHandler = (msg: Record<string, any>) => void;

interface WebSocketContextValue {
  /** Current connection status */
  status: WsStatus;
  /**
   * Connect to `url`. Does nothing if already open/connecting to that URL.
   * The connection is kept alive across route navigations.
   */
  connect: (url: string) => void;
  /** Send a serialisable object through the open socket. */
  send: (data: object) => boolean;
  /**
   * Subscribe to all incoming messages.
   * Returns an unsubscribe function — call it in your useEffect cleanup.
   */
  addListener: (handler: MessageHandler) => () => void;
  /** Forcibly close the socket (e.g. when the player wants to quit). */
  disconnect: () => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const currentUrlRef = useRef<string>("");
  const [status, setStatus] = useState<WsStatus>("idle");
  const listenersRef = useRef<Set<MessageHandler>>(new Set());

  const connect = useCallback((url: string) => {
    // Already open/connecting to the same URL — reuse it
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING) &&
      currentUrlRef.current === url
    ) {
      return;
    }

    // Close any stale socket first
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    setStatus("connecting");
    currentUrlRef.current = url;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("disconnected");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        // Broadcast to all registered listeners
        listenersRef.current.forEach((h) => h(msg));
      } catch {
        // ignore malformed frames
      }
    };
  }, []);

  const send = useCallback((data: object): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const addListener = useCallback((handler: MessageHandler) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
      currentUrlRef.current = "";
      listenersRef.current.clear();
      setStatus("idle");
    }
  }, []);

  return (
    <WebSocketContext.Provider
      value={{ status, connect, send, addListener, disconnect }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used inside <WebSocketProvider>");
  }
  return ctx;
}
