import express, { type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { ApolloServer, gql, AuthenticationError } from "apollo-server-express";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Config — override via env vars in production
// ─────────────────────────────────────────────────────────────────────────────

const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? "chess_access_secret_CHANGE_ME";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? "chess_refresh_secret_CHANGE_ME";

/** Access token lifetime: 15 minutes (short-lived) */
const ACCESS_TTL = "15m";
/** Refresh token lifetime: 7 days (long-lived) */
const REFRESH_TTL = "7d";

const COOKIE_BASE = {
  httpOnly: true,                                   // JS cannot read — XSS safe
  sameSite: "lax" as const,                        // CSRF protection
  secure: process.env.NODE_ENV === "production",   // HTTPS-only in production
} as const;

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

// ─────────────────────────────────────────────────────────────────────────────
// JWT payload types
// ─────────────────────────────────────────────────────────────────────────────

interface TokenBase {
  sub: string;      // user ID
  username: string;
  email: string;
}

type AccessPayload  = TokenBase & { type: "access" };
type RefreshPayload = TokenBase & { type: "refresh" };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function signAccess(data: TokenBase): string {
  return jwt.sign({ ...data, type: "access" } satisfies AccessPayload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

function signRefresh(data: TokenBase): string {
  return jwt.sign({ ...data, type: "refresh" } satisfies RefreshPayload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TTL,
  });
}

function verifyAccess(token: string): AccessPayload {
  const p = jwt.verify(token, JWT_ACCESS_SECRET) as AccessPayload;
  if (p.type !== "access") throw new Error("wrong token type");
  return p;
}

function verifyRefresh(token: string): RefreshPayload {
  const p = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshPayload;
  if (p.type !== "refresh") throw new Error("wrong token type");
  return p;
}

/** Set the short-lived access token cookie (15 min) */
function setAccessCookie(res: Response, token: string) {
  res.cookie(ACCESS_COOKIE, token, {
    ...COOKIE_BASE,
    maxAge: 15 * 60 * 1000, // 15 min in ms
  });
}

/** Set the long-lived refresh token cookie (7 days) */
function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    ...COOKIE_BASE,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
}

/** Clears both auth cookies — effectively signs the user out client-side */
function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...COOKIE_BASE });
  res.clearCookie(REFRESH_COOKIE, { ...COOKIE_BASE });
}

/** Issue + set both tokens as cookies in one call */
function issueTokens(res: Response, data: TokenBase) {
  setAccessCookie(res, signAccess(data));
  setRefreshCookie(res, signRefresh(data));
}

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL Schema
// ─────────────────────────────────────────────────────────────────────────────

const typeDefs = gql`
  type User {
    id: String!
    name: String!
    username: String!
    email: String!
    rating: Int!
    createdAt: String!
  }

  """
  Both access_token and refresh_token are set as HttpOnly cookies.
  No token string is returned in the JSON response — only the user profile.
  """
  type AuthPayload {
    ok: Boolean!
    user: User!
  }

  type SignOutPayload {
    success: Boolean!
    message: String!
  }

  """
  Result of a token refresh attempt.
  On success, both cookies are rotated. On failure, both cookies are cleared.
  """
  type RefreshPayload {
    ok: Boolean!
    user: User
  }

  type UsernameAvailability {
    username: String!
    available: Boolean!
    message: String!
  }

  type Query {
    """
    Returns the currently authenticated user by verifying the access_token cookie.
    Returns null if unauthenticated or token has expired (call refreshToken first).
    """
    me: User

    """
    Instagram-style username availability check.
    Validates format and checks uniqueness in the database.
    """
    checkUsernameAvailability(username: String!): UsernameAvailability!
  }

  type Mutation {
    """
    Register a new account.
    Sets access_token (15 min) and refresh_token (7 days) as HttpOnly cookies.
    """
    signup(
      name: String!
      username: String!
      email: String!
      password: String!
    ): AuthPayload!

    """
    Sign in with username or email + password.
    Sets access_token (15 min) and refresh_token (7 days) as HttpOnly cookies.
    """
    signin(usernameOrEmail: String!, password: String!): AuthPayload!

    """
    Use the refresh_token cookie to silently get a fresh access_token.
    Both tokens are re-issued (rotation). If the refresh token is invalid
    or expired, both cookies are cleared and ok=false is returned.
    """
    refreshToken: RefreshPayload!

    """
    Sign out: clears both HttpOnly cookies on the client.
    Stateless — no DB call needed.
    """
    signout: SignOutPayload!
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL context
// ─────────────────────────────────────────────────────────────────────────────

interface GqlContext {
  req: Request;
  res: Response;
  /** Decoded access token payload, or null if missing/expired/invalid */
  currentUser: AccessPayload | null;
}

function buildContext({ req, res }: { req: Request; res: Response }): GqlContext {
  let currentUser: AccessPayload | null = null;
  const raw: string | undefined = req.cookies?.[ACCESS_COOKIE];
  if (raw) {
    try {
      currentUser = verifyAccess(raw);
    } catch {
      // Expired or tampered — client should call refreshToken
    }
  }
  return { req, res, currentUser };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolvers
// ─────────────────────────────────────────────────────────────────────────────

const resolvers = {
  Query: {
    // ── me ───────────────────────────────────────────────────────────────────
    me: async (_: unknown, __: unknown, ctx: GqlContext) => {
      if (!ctx.currentUser) return null;
      const user = await prisma.user.findUnique({
        where: { id: ctx.currentUser.sub },
        select: { id: true, name: true, username: true, email: true, rating: true, createdAt: true },
      });
      if (!user) return null;
      return { ...user, createdAt: user.createdAt.toISOString() };
    },

    // ── checkUsernameAvailability ─────────────────────────────────────────────
    checkUsernameAvailability: async (_: unknown, { username }: { username: string }) => {
      // Format rules (matching Instagram's)
      if (username.length < 3)
        return { username, available: false, message: "Must be at least 3 characters." };
      if (username.length > 30)
        return { username, available: false, message: "Must be 30 characters or fewer." };
      if (!/^[a-zA-Z0-9_.]+$/.test(username))
        return { username, available: false, message: "Only letters, numbers, _ and . allowed." };
      if (/^[._]|[._]$/.test(username))
        return { username, available: false, message: "Cannot start or end with . or _" };
      if (/[._]{2}/.test(username))
        return { username, available: false, message: "No consecutive . or _ characters." };

      const taken = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
        select: { id: true },
      });

      if (taken) {
        const suggestion = `${username}${Math.floor(Math.random() * 999)}`;
        return {
          username,
          available: false,
          message: `"${username}" is taken. Try "${suggestion}"?`,
        };
      }

      return {
        username,
        available: true,
        message: `"${username}" is available! ✓`,
      };
    },
  },

  Mutation: {
    // ── signup ────────────────────────────────────────────────────────────────
    signup: async (
      _: unknown,
      { name, username, email, password }:
        { name: string; username: string; email: string; password: string },
      ctx: GqlContext,
    ) => {
      if (!name.trim()) throw new Error("Name is required.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");

      const normalizedUsername = username.toLowerCase();
      const normalizedEmail    = email.toLowerCase();

      const existing = await prisma.user.findFirst({
        where: { OR: [{ username: normalizedUsername }, { email: normalizedEmail }] },
      });
      if (existing) {
        throw new Error(
          existing.username === normalizedUsername
            ? `Username "${username}" is already taken.`
            : `Email "${email}" is already registered.`,
        );
      }

      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          username: normalizedUsername,
          email: normalizedEmail,
          password: sha256(password),
        },
      });

      issueTokens(ctx.res, { sub: user.id, username: user.username, email: user.email });

      return { ok: true, user: { ...user, createdAt: user.createdAt.toISOString() } };
    },

    // ── signin ────────────────────────────────────────────────────────────────
    signin: async (
      _: unknown,
      { usernameOrEmail, password }: { usernameOrEmail: string; password: string },
      ctx: GqlContext,
    ) => {
      const normalized = usernameOrEmail.toLowerCase();
      const user = await prisma.user.findFirst({
        where: { OR: [{ username: normalized }, { email: normalized }] },
      });

      if (!user || user.password !== sha256(password)) {
        throw new AuthenticationError("Invalid credentials.");
      }

      issueTokens(ctx.res, { sub: user.id, username: user.username, email: user.email });

      return { ok: true, user: { ...user, createdAt: user.createdAt.toISOString() } };
    },

    // ── refreshToken ──────────────────────────────────────────────────────────
    /**
     * Stateless refresh:
     *  1. Read refresh_token cookie and verify its JWT signature + expiry
     *  2. If valid → re-issue both tokens (rotation)
     *  3. If invalid/expired → clear cookies, return ok=false
     *  No DB call — the JWT signature IS the proof of authenticity.
     */
    refreshToken: async (_: unknown, __: unknown, ctx: GqlContext) => {
      const raw: string | undefined = ctx.req.cookies?.[REFRESH_COOKIE];
      if (!raw) {
        clearAuthCookies(ctx.res);
        return { ok: false, user: null };
      }

      try {
        const payload = verifyRefresh(raw);

        // Re-issue both tokens (rotates refresh token)
        issueTokens(ctx.res, {
          sub: payload.sub,
          username: payload.username,
          email: payload.email,
        });

        // Optionally fetch fresh user data from DB to pick up rating changes etc.
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, name: true, username: true, email: true, rating: true, createdAt: true },
        });

        return {
          ok: true,
          user: user ? { ...user, createdAt: user.createdAt.toISOString() } : null,
        };
      } catch {
        // JWT expired or tampered
        clearAuthCookies(ctx.res);
        return { ok: false, user: null };
      }
    },

    // ── signout ───────────────────────────────────────────────────────────────
    /**
     * Stateless signout — just clears both cookies.
     * No DB call needed since tokens aren't stored server-side.
     */
    signout: (_: unknown, __: unknown, ctx: GqlContext) => {
      clearAuthCookies(ctx.res);
      return { success: true, message: "Signed out successfully." };
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Apollo + Express bootstrap
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
app.use(cookieParser());
app.use(express.json());

async function startServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    context: buildContext,
  });

  await server.start();

  server.applyMiddleware({
    app: app as any,
    path: "/graphql",
    cors: {
      // Allow credentials (cookies) from the Vite dev server
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5000",
      ],
      credentials: true,
    },
  });

  app.listen({ port: 4000 }, () => {
    console.log("🚀 GraphQL API  →  http://localhost:4000/graphql");
    console.log("📊 Playground   →  http://localhost:4000/graphql");
  });
}

startServer().catch(console.error);