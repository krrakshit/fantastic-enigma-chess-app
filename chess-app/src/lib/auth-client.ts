/**
 * Thin GraphQL client that talks to the auth server at localhost:4000/graphql.
 * Cookies (access_token + refresh_token) are sent automatically by the browser
 * because we use credentials: "include".
 *
 * All mutations/queries here correspond 1-to-1 with the server schema.
 */

const GQL_URL = "http://localhost:4000/graphql";

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
