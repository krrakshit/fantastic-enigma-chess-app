import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../lib/auth-context";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

const P = "#10B981";

function AuthCallbackPage() {
  const { completeSocialAuth, status } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state"); // "google" or "github"

    if (!code || !state) {
      setError("Missing OAuth parameters. Please try signing in again.");
      return;
    }

    const provider = state; // state carries the provider name

    completeSocialAuth(provider, code)
      .then(() => {
        navigate({ to: "/" });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Social sign-in failed.");
      });
  }, [completeSocialAuth, navigate]);

  // If already authenticated (e.g. page refresh), redirect home
  useEffect(() => {
    if (status === "authenticated" && !error) {
      navigate({ to: "/" });
    }
  }, [status, error, navigate]);

  return (
    <div style={page}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 420 }}>
        {error ? (
          <>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>⚠️</div>
            <h1 style={{
              fontSize: "1.5rem", fontWeight: 700, color: "#EF4444",
              margin: "0 0 12px",
            }}>Authentication Failed</h1>
            <p style={{ color: "#6B7280", fontSize: ".9rem", marginBottom: 24 }}>
              {error}
            </p>
            <a href="/signin" style={{
              display: "inline-block", padding: "12px 32px",
              background: `linear-gradient(135deg, ${P}, #34D399)`,
              color: "#0A0A0F", borderRadius: 10, textDecoration: "none",
              fontWeight: 700, fontSize: ".95rem",
            }}>
              Back to Sign In
            </a>
          </>
        ) : (
          <>
            <div style={{
              width: 48, height: 48, margin: "0 auto 20px",
              border: `3px solid rgba(16,185,129,.15)`,
              borderTop: `3px solid ${P}`,
              borderRadius: "50%",
              animation: "spin .8s linear infinite",
            }} />
            <h1 style={{
              fontSize: "1.4rem", fontWeight: 700,
              background: `linear-gradient(135deg, ${P}, #34D399)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              margin: "0 0 8px",
            }}>Completing sign in…</h1>
            <p style={{ color: "#6B7280", fontSize: ".85rem" }}>
              Verifying your account with the provider
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const page: CSSProperties = {
  minHeight: "100vh", background: "#0A0A0F", color: "#fff",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  padding: "48px 20px", position: "relative", overflow: "hidden",
};

const bgGrid: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  backgroundImage: "linear-gradient(rgba(16,185,129,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,.015) 1px,transparent 1px)",
  backgroundSize: "72px 72px",
};

const bgGlow: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  background: "radial-gradient(ellipse at 50% 25%,rgba(16,185,129,.06) 0%,transparent 55%)",
};
