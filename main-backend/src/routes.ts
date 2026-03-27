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

type AccessPayload = TokenBase & { type: "access" };
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
    maxAge: 15 * 60 * 1000,
  });
}

/** Set the long-lived refresh token cookie (7 days) */
function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    ...COOKIE_BASE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
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

const ANALYSIS_BACKEND_URL = process.env.ANALYSIS_BACKEND_URL ?? "http://localhost:7000";

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL Schema
// ─────────────────────────────────────────────────────────────────────────────

const typeDefs = gql`
  # ── Enums ──────────────────────────────────────────────────────────────────

  enum GameState {
    start
    finished
  }

  enum Promotion {
    q
    r
    b
    n
  }

  # ── User ───────────────────────────────────────────────────────────────────

  type User {
    id: String!
    name: String!
    username: String!
    email: String!
    rating: Int!
    createdAt: String!
  }

  # ── Move ───────────────────────────────────────────────────────────────────

  type Move {
    id: String!
    roomID: String!
    playerID: String!
    piece: String!
    from: String!
    to: String!
    time: Int!
    points: Int!
    promotion: Promotion       # null for normal moves
    createdAt: String!
  }

  # ── Game player summary (subset of User) ───────────────────────────────────

  type GamePlayer {
    username: String!
    name: String!
    rating: Int!
  }

  # ── Game ───────────────────────────────────────────────────────────────────

  type Game {
    id: String!
    roomID: String!
    player1ID: String!
    player2ID: String!
    player1: GamePlayer!
    player2: GamePlayer!
    winner: String           # null while in progress
    runnerup: String         # null while in progress
    winnerPoints: Int!
    runnerupPoints: Int!
    status: GameState!
    moves: [Move!]!
    createdAt: String!
  }

  # ── Analysis types ───────────────────────────────────────────────────────

  type MoveAnalysis {
    moveNumber: Int!
    move: String!
    color: String!
    score: Int
    mate: Int
    bestMove: String
    classification: String!
  }

  type AnalysisResult {
    roomID: String!
    player1: GamePlayer!
    player2: GamePlayer!
    winner: String
    runnerup: String
    status: GameState!
    analysis: [MoveAnalysis!]!
  }

  # ── Evaluate position types ─────────────────────────────────────────────────

  type EngineLine {
    rank: Int!
    score: Int
    mate: Int
    moves: [String!]!
    bestMove: String
  }

  type EvaluationResult {
    lines: [EngineLine!]!
    bestMove: String
  }

  # ── Auth payloads ───────────────────────────────────────────────────────────

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

  # ── Queries ─────────────────────────────────────────────────────────────────

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

    """
    Returns all games played by the given username, newest first.
    Includes full move list and both players' profiles.
    """
    getAllGamesPlayedByUser(username: String!): [Game!]!

    """
    Analyse a finished game. Validates game exists, is finished, and the user
    actually played in it. Then runs Stockfish engine analysis on every move.
    """
    analysegame(username: String!, roomId: String!): AnalysisResult!

    """
    Evaluate a position given a sequence of UCI moves from startpos.
    Returns the engine's top N lines with scores — used for "what-if" exploration.
    """
    evaluatePosition(moves: [String!]!, depth: Int, lines: Int): EvaluationResult!
  }

  # ── Mutations ───────────────────────────────────────────────────────────────

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

      return { username, available: true, message: `"${username}" is available! ✓` };
    },

    // ── getAllGamesPlayedByUser ────────────────────────────────────────────────
    getAllGamesPlayedByUser: async (_: unknown, { username }: { username: string }) => {
      const games = await prisma.game.findMany({
        where: {
          OR: [
            { player1ID: username },
            { player2ID: username },
          ],
        },
        include: {
          moves: {
            orderBy: { createdAt: "asc" },
          },
          player1: {
            select: { username: true, name: true, rating: true },
          },
          player2: {
            select: { username: true, name: true, rating: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      // Serialize DateTime fields to ISO strings
      return games.map((game) => ({
        ...game,
        createdAt: game.createdAt.toISOString(),
        moves: game.moves.map((move) => ({
          ...move,
          createdAt: move.createdAt.toISOString(),
          // Prisma returns null for optional fields — GraphQL null is fine here
          promotion: move.promotion ?? null,
        })),
      }));
    },

    // ── analysegame ─────────────────────────────────────────────────────────
    analysegame: async (
      _: unknown,
      { username, roomId }: { username: string; roomId: string },
    ) => {
      // 1. Fetch the game with moves and players
      const game = await prisma.game.findUnique({
        where: { roomID: roomId },
        include: {
          moves: { orderBy: { createdAt: "asc" } },
          player1: { select: { username: true, name: true, rating: true } },
          player2: { select: { username: true, name: true, rating: true } },
        },
      });

      if (!game) throw new Error(`Game with roomId "${roomId}" not found.`);

      // 2. Check game is finished
      if (game.status !== "finished") {
        throw new Error("Analysis is only available for finished games.");
      }

      // 3. Verify the user actually played in this game
      if (game.player1ID !== username && game.player2ID !== username) {
        throw new Error("You did not participate in this game.");
      }

      // 4. Check if analysis is already cached in DB
      const cachedAnalysis = await prisma.gameAnalysis.findUnique({
        where: { roomID: roomId },
        include: {
          moves: { orderBy: { moveNumber: "asc" } },
        },
      });

      if (cachedAnalysis) {
        console.log(`📦 Returning cached analysis for room ${roomId}`);
        return {
          roomID: game.roomID,
          player1: game.player1,
          player2: game.player2,
          winner: game.winner,
          runnerup: game.runnerup,
          status: game.status,
          analysis: cachedAnalysis.moves.map((m) => ({
            moveNumber: m.moveNumber,
            move: m.move,
            color: m.color,
            score: m.score,
            mate: m.mate,
            bestMove: m.bestMove,
            classification: m.classification,
          })),
        };
      }

      // 5. Convert moves to UCI format (from+to+promotion)
      const uciMoves = game.moves.map((m) => {
        const base = m.from + m.to;
        return m.promotion ? base + m.promotion : base;
      });

      // 6. Call the analysis microservice
      console.log(`🔬 Running Stockfish analysis for room ${roomId} (${uciMoves.length} moves)...`);
      const response = await fetch(`${ANALYSIS_BACKEND_URL}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moves: uciMoves, depth: 15 }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Analysis service error: ${err}`);
      }

      const { analysis } = (await response.json()) as {
        analysis: Array<{
          moveNumber: number;
          move: string;
          color: string;
          score: number | null;
          mate: number | null;
          bestMove: string | null;
          classification: string;
        }>;
      };

      // 7. Save analysis to DB for caching
      try {
        await prisma.gameAnalysis.create({
          data: {
            roomID: roomId,
            moves: {
              create: analysis.map((m) => ({
                moveNumber: m.moveNumber,
                move: m.move,
                color: m.color,
                score: m.score,
                mate: m.mate,
                bestMove: m.bestMove,
                classification: m.classification,
              })),
            },
          },
        });
        console.log(`💾 Analysis cached for room ${roomId}`);
      } catch (saveErr) {
        console.error(`⚠ Failed to cache analysis for room ${roomId}:`, saveErr);
        // Non-fatal — still return the result
      }

      // 8. Return combined result
      return {
        roomID: game.roomID,
        player1: game.player1,
        player2: game.player2,
        winner: game.winner,
        runnerup: game.runnerup,
        status: game.status,
        analysis,
      };
    },

    // ── evaluatePosition ──────────────────────────────────────────────────────
    evaluatePosition: async (
      _: unknown,
      { moves, depth = 15, lines = 3 }: { moves: string[]; depth?: number; lines?: number },
    ) => {
      const response = await fetch(`${ANALYSIS_BACKEND_URL}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moves, depth, lines }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Evaluation service error: ${err}`);
      }

      return (await response.json()) as {
        lines: Array<{
          rank: number;
          score: number | null;
          mate: number | null;
          moves: string[];
          bestMove: string | null;
        }>;
        bestMove: string | null;
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
      const normalizedEmail = email.toLowerCase();

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
    refreshToken: async (_: unknown, __: unknown, ctx: GqlContext) => {
      const raw: string | undefined = ctx.req.cookies?.[REFRESH_COOKIE];
      if (!raw) {
        clearAuthCookies(ctx.res);
        return { ok: false, user: null };
      }

      try {
        const payload = verifyRefresh(raw);

        issueTokens(ctx.res, {
          sub: payload.sub,
          username: payload.username,
          email: payload.email,
        });

        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, name: true, username: true, email: true, rating: true, createdAt: true },
        });

        return {
          ok: true,
          user: user ? { ...user, createdAt: user.createdAt.toISOString() } : null,
        };
      } catch {
        clearAuthCookies(ctx.res);
        return { ok: false, user: null };
      }
    },

    // ── signout ───────────────────────────────────────────────────────────────
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