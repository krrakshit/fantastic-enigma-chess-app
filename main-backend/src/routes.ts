import express, { type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { ApolloServer, gql, AuthenticationError } from "apollo-server-express";
import { createHash, randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import {
  getGoogleAuthURL, exchangeGoogleCode, getGoogleUser,
  getGitHubAuthURL, exchangeGitHubCode, getGitHubUser, getGitHubPrimaryEmail,
} from "./oauth";
import { createLogger } from "../../logger/index.mjs";

const log = createLogger("main-backend");

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
const ML_BACKEND_URL = process.env.ML_BACKEND_URL ?? "http://localhost:8000";


// ─────────────────────────────────────────────────────────────────────────────
// Social auth helpers
// ─────────────────────────────────────────────────────────────────────────────

async function generateUniqueUsername(base: string): Promise<string> {
  const cleaned = base.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 25);
  const candidate = cleaned.length >= 3 ? cleaned : `player_${cleaned}`;

  const existing = await prisma.user.findUnique({ where: { username: candidate } });
  if (!existing) return candidate;

  for (let i = 0; i < 20; i++) {
    const attempt = `${candidate}${Math.floor(Math.random() * 9999)}`;
    const exists = await prisma.user.findUnique({ where: { username: attempt } });
    if (!exists) return attempt;
  }

  return `player_${Date.now().toString(36)}`;
}

async function findOrCreateSocialUser(
  provider: "google" | "github",
  profile: { name: string; email: string; providerUsername?: string },
) {
  const normalizedEmail = profile.email.toLowerCase();

  // Check if user already exists with this email
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return existing;

  // Generate unique username from provider profile
  const baseUsername = profile.providerUsername || profile.email.split("@")[0] || "player";
  const username = await generateUniqueUsername(baseUsername);

  // Create user with a random unusable password
  const user = await prisma.user.create({
    data: {
      name: profile.name || username,
      username,
      email: normalizedEmail,
      password: sha256(randomBytes(32).toString("hex")),
      authProvider: provider,
    },
  });

  return user;
}

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
    winner: String
    runnerup: String
    winnerPoints: Int!
    runnerupPoints: Int!
    status: GameState!
    result: String
    moves: [Move!]!
    createdAt: String!
  }

  # ── Player Profile types ───────────────────────────────────────────────

  type PlayerStats {
    wins: Int!
    losses: Int!
    draws: Int!
    totalGames: Int!
    winRate: Float!
    bestWinStreak: Int!
    avgGameLength: Float!
    mostPlayedOpenings: [String!]!
  }

  type RatingHistoryEntry {
    rating: Int!
    change: Int!
    createdAt: String!
  }

  type PlayerProfile {
    user: User!
    stats: PlayerStats!
    ratingHistory: [RatingHistoryEntry!]!
    recentGames: [Game!]!
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

  # ── Opening classification types ───────────────────────────────────────────

  type OpeningClassification {
    opening: String!
    variation: String!
    eco: String!
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

  type UserRegistered {
    registered: Boolean!
  }

  type SocialAuthUrls {
    google: String!
    github: String!
  }

  type PgnAnalysisresult {
    analysis : [MoveAnalysis!]!
    metadata : PgnMetaData!
  }

  type PgnMetadata {
    white: String
    black: String
    result: String
    date: String
    event: String
    opening: String
    eco: String
    totalMoves: Int!
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

    """
    Returns if user is regsitered or not.
    """
    isUserRegistered(username: String!): UserRegistered!

    """
    Returns OAuth redirect URLs for Google and GitHub sign-in.
    """
    socialAuthUrls: SocialAuthUrls!

    """
    Returns the public profile for a player: stats, rating history, recent games.
    """
    playerProfile(username: String!): PlayerProfile!

    """
    Classify the chess opening from a list of SAN moves (e.g. ["e4", "e5", "Nf3"]).
    Proxies to the ML backend at /classify. Requires at least 5 moves.
    """
    classifyOpening(moves: [String!]!): OpeningClassification!

    """
    analyses the pgn data
    """
    analysePgn(pgn : String! , depth : Int) : PgnAnalysisresult!
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

    """
    Complete social OAuth sign-in. Takes the provider name and the OAuth
    authorization code returned in the callback URL. Exchanges the code
    for user info, creates or finds the user, and sets JWT cookies.
    """
    completeSocialAuth(provider: String!, code: String!): AuthPayload!
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
        log.info(`📦 Returning cached analysis`, { roomId });
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
      log.info(`🔬 Running Stockfish analysis`, { roomId, moveCount: uciMoves.length });
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
        log.info(`💾 Analysis cached`, { roomId });
      } catch (saveErr) {
        log.error(`⚠ Failed to cache analysis`, { roomId, error: String(saveErr) });
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

    isUserRegistered: async (_: unknown, { username }: { username: string }) => {
      const user = await prisma.user.findUnique({ where: { username } });
      return { registered: !!user };
    },

    socialAuthUrls: () => ({
      google: getGoogleAuthURL(),
      github: getGitHubAuthURL(),
    }),

    // ── playerProfile ──────────────────────────────────────────────────────────
    playerProfile: async (_: unknown, { username }: { username: string }) => {
      const user = await prisma.user.findUnique({
        where: { username },
        select: { id: true, name: true, username: true, email: true, rating: true, createdAt: true },
      });
      if (!user) throw new Error(`Player "${username}" not found.`);

      // Fetch all finished games for this player
      const games = await prisma.game.findMany({
        where: {
          status: "finished",
          OR: [{ player1ID: username }, { player2ID: username }],
        },
        include: {
          player1: { select: { username: true, name: true, rating: true } },
          player2: { select: { username: true, name: true, rating: true } },
          moves: { orderBy: { createdAt: "asc" }, take: 2 },  // first 2 moves for opening detection
        },
        orderBy: { createdAt: "desc" },
      });

      let wins = 0, losses = 0, draws = 0;
      let bestWinStreak = 0, currentStreak = 0;
      let totalMoves = 0;
      const openingCounts: Record<string, number> = {};

      for (const g of games) {
        // Count W/L/D
        if (g.winner === username) {
          wins++;
          currentStreak++;
          bestWinStreak = Math.max(bestWinStreak, currentStreak);
        } else if (g.runnerup === username) {
          losses++;
          currentStreak = 0;
        } else {
          draws++;
          currentStreak = 0;
        }

        // Tally move count
        totalMoves += g.moves.length;

        // Detect "opening" by first white move SAN-ish: piece+from+to
        if (g.moves.length > 0) {
          const firstMove = g.moves[0];
          const key = `${firstMove.piece}${firstMove.from}-${firstMove.to}`;
          openingCounts[key] = (openingCounts[key] ?? 0) + 1;
        }
      }

      const totalGames = wins + losses + draws;
      const avgGameLength = totalGames > 0 ? Math.round((totalMoves / totalGames) * 10) / 10 : 0;
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 1000) / 10 : 0;

      // Top 5 openings
      const mostPlayedOpenings = Object.entries(openingCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => `${k} (${v})`);

      // Rating history
      const ratingHistory = await prisma.ratingHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { rating: true, change: true, createdAt: true },
      });

      // Recent games (top 10)
      const recentGames = games.slice(0, 10).map((g) => ({
        id: g.id,
        roomID: g.roomID,
        player1ID: g.player1ID,
        player2ID: g.player2ID,
        player1: g.player1,
        player2: g.player2,
        winner: g.winner,
        runnerup: g.runnerup,
        winnerPoints: g.winnerPoints,
        runnerupPoints: g.runnerupPoints,
        status: g.status,
        result: g.result,
        moves: [],
        createdAt: g.createdAt.toISOString(),
      }));

      return {
        user: { ...user, createdAt: user.createdAt.toISOString() },
        stats: { wins, losses, draws, totalGames, winRate, bestWinStreak, avgGameLength, mostPlayedOpenings },
        ratingHistory: ratingHistory.map((r) => ({
          rating: r.rating,
          change: r.change,
          createdAt: r.createdAt.toISOString(),
        })),
        recentGames,
      };
    },

    // ── classifyOpening ───────────────────────────────────────────────────────
    classifyOpening: async (_: unknown, { moves }: { moves: string[] }) => {

      log.info("🎯 Classifying opening", { moveCount: moves.length, moves });

      let response: globalThis.Response;
      try {
        response = await fetch(`${ML_BACKEND_URL}/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moves }),
        });
      } catch (networkErr) {
        log.error("❌ ML backend unreachable", { error: String(networkErr) });
        throw new Error("Opening classifier service is unavailable. Please try again later.");
      }

      if (!response.ok) {
        const errText = await response.text();
        log.error("❌ ML backend error", { status: response.status, body: errText });
        throw new Error(`Opening classifier error (${response.status}): ${errText}`);
      }

      const data = (await response.json()) as {
        opening?: string;
        variation?: string;
        eco?: string;
        // allow flexible ML response keys
        name?: string;
        Opening?: string;
        Variation?: string;
        ECO?: string;
      };

      log.info("✅ Opening classified", { data });

      return {
        opening: data.opening ?? data.Opening ?? data.name ?? "Unknown Opening",
        variation: data.variation ?? data.Variation ?? "",
        eco: data.eco ?? data.ECO ?? "",
      };
    },
    analysePgn: async (
      _: unknown,
      { pgn, depth = 12 }: { pgn: string; depth?: number },
    ) => {
      const response = await fetch(`${ANALYSIS_BACKEND_URL}/analyse-pgn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pgn, depth }),
      });
    
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`PGN analysis service error: ${err}`);
      }
    
      return await response.json();
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

    // ── completeSocialAuth ──────────────────────────────────────────────────
    completeSocialAuth: async (
      _: unknown,
      { provider, code }: { provider: string; code: string },
      ctx: GqlContext,
    ) => {
      let profile: { name: string; email: string; providerUsername?: string };

      if (provider === "google") {
        const tokens = await exchangeGoogleCode(code);
        const googleUser = await getGoogleUser(tokens.access_token);
        profile = {
          name: googleUser.name,
          email: googleUser.email,
        };
      } else if (provider === "github") {
        const tokens = await exchangeGitHubCode(code);
        const ghUser = await getGitHubUser(tokens.access_token);
        const email = ghUser.email || await getGitHubPrimaryEmail(tokens.access_token);
        profile = {
          name: ghUser.name || ghUser.login,
          email,
          providerUsername: ghUser.login,
        };
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      const user = await findOrCreateSocialUser(
        provider as "google" | "github",
        profile,
      );

      issueTokens(ctx.res, {
        sub: user.id,
        username: user.username,
        email: user.email,
      });

      return {
        ok: true,
        user: { ...user, createdAt: user.createdAt.toISOString() },
      };
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Apollo + Express bootstrap
// ─────────────────────────────────────────────────────────────────────────────

import cors from "cors";

const app = express();
app.use(cookieParser());
app.use(express.json());

// ── Request logging middleware (fire-and-forget) ────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    log.req(req.method, req.path, res.statusCode, Date.now() - start, {
      origin: req.headers.origin ?? "none",
      userAgent: req.headers["user-agent"],
    });
  });
  next();
});

// ── CORS configuration ─────────────────────────────────────────────────────
// Build the allowlist from CORS_ORIGINS env var (comma-separated).
// In production, only your frontend domain(s) should be listed.
const ALLOWED_ORIGINS: string[] = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [
      "http://localhost:3000",
      "http://localhost:4173",
      "http://localhost:5174",
      "http://localhost:5000",
    ];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    // only in development. In production, always require an origin.
    if (!origin) {
      if (process.env.NODE_ENV === "production") {
        callback(new Error("Missing origin header — request blocked by CORS policy."));
      } else {
        callback(null, true);
      }
      return;
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      log.warn(`🚫 CORS blocked request`, { origin });
      callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
    }
  },
  credentials: true,               // Required for cookies (access_token, refresh_token)
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Apollo-Require-Preflight",     // Apollo client sends this
    "X-Apollo-Operation-Name",
  ],
  maxAge: 86400,                    // Cache preflight response for 24 hours
};

// Apply CORS globally — this handles ALL routes including preflight OPTIONS
app.use(cors(corsOptions));

// Health check endpoint (useful for load balancers / monitoring)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function startServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: process.env.NODE_ENV !== "production",
    context: buildContext,
    // Disable automatic persisted queries to prevent DoS via unbounded cache
    // See: https://go.apollo.dev/s/cache-backends
    persistedQueries: false,
  });

  await server.start();

  // Let Express `cors` middleware handle CORS — disable Apollo's built-in handling
  server.applyMiddleware({
    app: app as any,
    path: "/graphql",
    cors: false,       // ← Important: Express cors middleware is handling this
  });

  const port = Number(process.env.PORT ?? 4000);
  app.listen({ port }, () => {
    log.info(`🚀 GraphQL API  →  http://localhost:${port}/graphql`);
    log.info(`📊 Playground   →  http://localhost:${port}/graphql`);
    log.info(`🔒 CORS origins`, { origins: ALLOWED_ORIGINS });
  });
}

startServer().catch((err) => log.error("Failed to start server", { error: String(err) }));