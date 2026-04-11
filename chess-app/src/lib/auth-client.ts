 /**
 * Thin GraphQL client that talks to the auth server at localhost:4000/graphql.
 * Cookies (access_token + refresh_token) are sent automatically by the browser
 * because we use credentials: "include".
 *
 * All mutations/queries here correspond 1-to-1 with the server schema.
 */

const GQL_URL = import.meta.env.VITE_GQL_URL ?? "http://localhost:4000/graphql";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  rating: number;
  createdAt: string;
}

export interface AuthPayload {
  ok: boolean;
  user: AuthUser;
}

export interface RefreshPayload {
  ok: boolean;
  user: AuthUser | null;
}

export interface SignOutPayload {
  success: boolean;
  message: string;
}

export interface UsernameAvailability {
  username: string;
  available: boolean;
  message: string;
}

export interface SocialAuthUrls {
  google: string;
  github: string;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // send & receive HttpOnly cookies
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  return json.data as T;
}

// ─── Auth mutations ───────────────────────────────────────────────────────────

export async function apiSignup(
  name: string,
  username: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const data = await gql<{ signup: AuthPayload }>(
    `mutation Signup($name: String!, $username: String!, $email: String!, $password: String!) {
      signup(name: $name, username: $username, email: $email, password: $password) {
        ok
        user { id name username email rating createdAt }
      }
    }`,
    { name, username, email, password },
  );
  return data.signup.user;
}

export async function apiSignin(
  usernameOrEmail: string,
  password: string,
): Promise<AuthUser> {
  const data = await gql<{ signin: AuthPayload }>(
    `mutation Signin($usernameOrEmail: String!, $password: String!) {
      signin(usernameOrEmail: $usernameOrEmail, password: $password) {
        ok
        user { id name username email rating createdAt }
      }
    }`,
    { usernameOrEmail, password },
  );
  return data.signin.user;
}

/**
 * Silently refreshes both tokens using the refresh_token cookie.
 * Returns the user if successful, null if the session has expired.
 */
export async function apiRefreshToken(): Promise<AuthUser | null> {
  try {
    const data = await gql<{ refreshToken: RefreshPayload }>(
      `mutation RefreshToken {
        refreshToken {
          ok
          user { id name username email rating createdAt }
        }
      }`,
    );
    return data.refreshToken.ok ? data.refreshToken.user : null;
  } catch {
    return null;
  }
}

export async function apiSignout(): Promise<void> {
  await gql<{ signout: SignOutPayload }>(
    `mutation Signout {
      signout { success message }
    }`,
  ).catch(() => null); // best-effort; cookies get cleared regardless
}

// ─── Auth queries ─────────────────────────────────────────────────────────────

/**
 * Returns the currently authenticated user (reads access_token cookie).
 * Returns null if not authenticated or token expired.
 */
export async function apiMe(): Promise<AuthUser | null> {
  try {
    const data = await gql<{ me: AuthUser | null }>(
      `query Me {
        me { id name username email rating createdAt }
      }`,
    );
    return data.me;
  } catch {
    return null;
  }
}

/**
 * Instagram-style username availability check.
 */
export async function apiCheckUsername(
  username: string,
): Promise<UsernameAvailability> {
  const data = await gql<{ checkUsernameAvailability: UsernameAvailability }>(
    `query CheckUsername($username: String!) {
      checkUsernameAvailability(username: $username) {
        username available message
      }
    }`,
    { username },
  );
  return data.checkUsernameAvailability;
}

// ─── Social auth ──────────────────────────────────────────────────────────────

/**
 * Returns the OAuth redirect URLs for Google and GitHub.
 */
export async function apiGetSocialAuthUrls(): Promise<SocialAuthUrls> {
  const data = await gql<{ socialAuthUrls: SocialAuthUrls }>(
    `query SocialAuthUrls {
      socialAuthUrls {
        google
        github
      }
    }`,
  );
  return data.socialAuthUrls;
}

/**
 * Completes the OAuth sign-in flow by exchanging the authorization code.
 * Sets JWT cookies on the response and returns the user.
 */
export async function apiCompleteSocialAuth(
  provider: string,
  code: string,
): Promise<AuthUser> {
  const data = await gql<{ completeSocialAuth: AuthPayload }>(
    `mutation CompleteSocialAuth($provider: String!, $code: String!) {
      completeSocialAuth(provider: $provider, code: $code) {
        ok
        user { id name username email rating createdAt }
      }
    }`,
    { provider, code },
  );
  return data.completeSocialAuth.user;
}

// ─── Game types ───────────────────────────────────────────────────────────────

export interface GamePlayer {
  username: string;
  name: string;
  rating: number;
}

export interface GameMove {
  id: string;
  roomID: string;
  playerID: string;
  piece: string;
  from: string;
  to: string;
  time: number;
  points: number;
  promotion: string | null;
  createdAt: string;
}

export interface Game {
  id?: string;
  roomID: string;
  player1ID: string;
  player2ID: string;
  player1?: GamePlayer;
  player2?: GamePlayer;
  winner: string | null;
  runnerup: string | null;
  winnerPoints: number;
  runnerupPoints: number;
  status: "start" | "finished";
  result?: string | null;
  moves: GameMove[];
  createdAt?: string;
}

export interface MoveAnalysis {
  moveNumber: number;
  move: string;
  color: string;
  score: number | null;
  mate: number | null;
  bestMove: string | null;
  classification: string;
}

export interface AnalysisResult {
  roomID: string;
  player1?: GamePlayer;
  player2?: GamePlayer;
  winner: string | null;
  runnerup: string | null;
  status: string;
  analysis: MoveAnalysis[];
}

// ─── Game queries ─────────────────────────────────────────────────────────────

export async function apiGetGameHistory(username: string): Promise<Game[]> {
  const data = await gql<{ getAllGamesPlayedByUser: Game[] }>(
    `query GetGameHistory($username: String!) {
      getAllGamesPlayedByUser(username: $username) {
        roomID
        player1ID
        player2ID
        winner
        runnerup
        winnerPoints
        runnerupPoints
        status
        moves {
          id
          roomID
          playerID
          piece
          from
          to
          time
          points
          promotion
          createdAt
        }
      }
    }`,
    { username },
  );
  return data.getAllGamesPlayedByUser;
}

export async function apiAnalyseGame(
  username: string,
  roomId: string,
): Promise<AnalysisResult> {
  const data = await gql<{ analysegame: AnalysisResult }>(
    `query Analysegame($username: String!, $roomId: String!) {
      analysegame(username: $username, roomId: $roomId) {
        roomID
        winner
        runnerup
        status
        analysis {
          moveNumber
          move
          color
          score
          mate
          bestMove
          classification
        }
      }
    }`,
    { username, roomId },
  );
  return data.analysegame;
}

// ─── Position evaluation (what-if) ────────────────────────────────────────────

export interface EngineLine {
  rank: number;
  score: number | null;
  mate: number | null;
  moves: string[];
  bestMove: string | null;
}

export interface EvaluationResult {
  lines: EngineLine[];
  bestMove: string | null;
}

export async function apiEvaluatePosition(
  moves: string[],
  depth = 15,
  lines = 3,
): Promise<EvaluationResult> {
  const data = await gql<{ evaluatePosition: EvaluationResult }>(
    `query EvaluatePosition($moves: [String!]!, $depth: Int, $lines: Int) {
      evaluatePosition(moves: $moves, depth: $depth, lines: $lines) {
        lines {
          rank
          score
          mate
          moves
          bestMove
        }
        bestMove
      }
    }`,
    { moves, depth, lines },
  );
  return data.evaluatePosition;
}

// ─── Player Profile ───────────────────────────────────────────────────────────

export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winRate: number;
  bestWinStreak: number;
  avgGameLength: number;
  mostPlayedOpenings: string[];
}

export interface RatingHistoryEntry {
  rating: number;
  change: number;
  createdAt: string;
}

export interface PlayerProfile {
  user: AuthUser;
  stats: PlayerStats;
  ratingHistory: RatingHistoryEntry[];
  recentGames: Game[];
}

export async function apiGetPlayerProfile(username: string): Promise<PlayerProfile> {
  const data = await gql<{ playerProfile: PlayerProfile }>(
    `query PlayerProfile($username: String!) {
      playerProfile(username: $username) {
        user { id name username email rating createdAt }
        stats {
          wins losses draws totalGames winRate
          bestWinStreak avgGameLength mostPlayedOpenings
        }
        ratingHistory { rating change createdAt }
        recentGames {
          roomID player1ID player2ID winner runnerup
          winnerPoints runnerupPoints status result createdAt
          player1 { username name rating }
          player2 { username name rating }
        }
      }
    }`,
    { username },
  );
  return data.playerProfile;
}

