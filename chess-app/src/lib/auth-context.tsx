import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  apiMe,
  apiRefreshToken,
  apiSignin,
  apiSignout,
  apiSignup,
  apiGetSocialAuthUrls,
  apiCompleteSocialAuth,
  type AuthUser,
} from "./auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  /** Current auth status — use this to show loading states */
  status: AuthStatus;
  /** The authenticated user, or null */
  user: AuthUser | null;
  /** Register a new account. Throws on error. */
  signup: (
    name: string,
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  /** Sign in. Throws on error. */
  signin: (usernameOrEmail: string, password: string) => Promise<void>;
  /** Start social OAuth flow — redirects the browser to the provider. */
  socialSignIn: (provider: "google" | "github") => Promise<void>;
  /** Complete social OAuth — called from the callback page with the code. */
  completeSocialAuth: (provider: string, code: string) => Promise<void>;
  /** Sign out everywhere (clears cookies). */
  signout: () => Promise<void>;
  /**
   * Manually trigger a token refresh.
   * Called automatically on mount and on a timer.
   * Returns the refreshed user or null.
   */
  refresh: () => Promise<AuthUser | null>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Access token lifetime ─────────────────────────────────────────────────────
// The access token lives 15 minutes on the server.
// We proactively refresh it every 13 minutes so it never actually expires
// while the tab is open.
const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 min

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Start / stop the proactive refresh timer ──────────────────────────────
  const startRefreshTimer = useCallback(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(async () => {
      const refreshed = await apiRefreshToken();
      if (!refreshed) {
        // Refresh token itself expired → force logout
        setUser(null);
        setStatus("unauthenticated");
        clearInterval(refreshTimer.current!);
      } else {
        setUser(refreshed);
      }
    }, REFRESH_INTERVAL_MS);
  }, []);

  const stopRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  // ── Boot: check if there's an existing session ────────────────────────────
  useEffect(() => {
    (async () => {
      // 1. Try to read the current user via the access_token cookie
      let me = await apiMe();

      // 2. If no valid access token, try a silent refresh
      if (!me) {
        me = await apiRefreshToken();
      }

      if (me) {
        setUser(me);
        setStatus("authenticated");
        startRefreshTimer();
      } else {
        setStatus("unauthenticated");
      }
    })();

    return () => stopRefreshTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const signup = useCallback(
    async (name: string, username: string, email: string, password: string) => {
      const newUser = await apiSignup(name, username, email, password);
      setUser(newUser);
      setStatus("authenticated");
      startRefreshTimer();
    },
    [startRefreshTimer],
  );

  const signin = useCallback(
    async (usernameOrEmail: string, password: string) => {
      const authedUser = await apiSignin(usernameOrEmail, password);
      setUser(authedUser);
      setStatus("authenticated");
      startRefreshTimer();
    },
    [startRefreshTimer],
  );

  const signout = useCallback(async () => {
    await apiSignout();
    setUser(null);
    setStatus("unauthenticated");
    stopRefreshTimer();
  }, [stopRefreshTimer]);

  const socialSignIn = useCallback(async (provider: "google" | "github") => {
    const urls = await apiGetSocialAuthUrls();
    window.location.href = provider === "google" ? urls.google : urls.github;
  }, []);

  const completeSocialAuth = useCallback(
    async (provider: string, code: string) => {
      const authedUser = await apiCompleteSocialAuth(provider, code);
      setUser(authedUser);
      setStatus("authenticated");
      startRefreshTimer();
    },
    [startRefreshTimer],
  );

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    const refreshed = await apiRefreshToken();
    if (refreshed) {
      setUser(refreshed);
      setStatus("authenticated");
    } else {
      setUser(null);
      setStatus("unauthenticated");
    }
    return refreshed;
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, signup, signin, socialSignIn, completeSocialAuth, signout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/**
 * Convenience hook — returns true only when auth status is fully resolved
 * and the user is authenticated.
 */
export function useRequireAuth(): AuthUser {
  const { status, user } = useAuth();
  if (status === "loading") throw new Error("Auth still loading");
  if (!user) throw new Error("Not authenticated");
  return user;
}
