// ─────────────────────────────────────────────────────────────────────────────
// OAuth2 helpers for Google and GitHub
// Direct implementation — no extra DB tables needed
// ─────────────────────────────────────────────────────────────────────────────

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "";
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "";
export const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5000";
export const OAUTH_REDIRECT_URI = `${FRONTEND_URL}/auth/callback`;

// ── Google ──────────────────────────────────────────────────────────────────

export function getGoogleAuthURL(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    state: "google",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ access_token: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string }>;
}

export async function getGoogleUser(accessToken: string): Promise<{
  sub: string; name: string; email: string; picture: string;
}> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  return res.json() as any;
}

// ── GitHub ───────────────────────────────────────────────────────────────────

export function getGitHubAuthURL(): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    scope: "read:user user:email",
    state: "github",
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGitHubCode(code: string): Promise<{ access_token: string }> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error("GitHub token exchange failed");
  const data = await res.json() as any;
  if (data.error) throw new Error(`GitHub error: ${data.error_description}`);
  return data;
}

export async function getGitHubUser(accessToken: string): Promise<{
  login: string; name: string | null; email: string | null; avatar_url: string;
}> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) throw new Error("Failed to fetch GitHub user info");
  return res.json() as any;
}

export async function getGitHubPrimaryEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) throw new Error("Failed to fetch GitHub emails");
  const emails: Array<{ email: string; primary: boolean; verified: boolean }> = await res.json() as any;
  const primary = emails.find(e => e.primary && e.verified);
  if (!primary) throw new Error("No verified primary email found on GitHub account");
  return primary.email;
}
