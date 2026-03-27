import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../lib/auth-context";

export const Route = createFileRoute("/signin")({
  component: SignInPage,
});

const P = "#10B981";

function SignInPage() {
  const { signin, status } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ usernameOrEmail: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  if (status === "authenticated") {
    navigate({ to: "/" });
    return null;
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.usernameOrEmail.trim() || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signin(form.usernameOrEmail.trim(), form.password);
      navigate({ to: "/" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={page}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      {/* Floating pieces */}
      {["♚", "♛", "♜", "♝", "♞"].map((p, i) => (
        <div key={i} style={{
          position: "fixed", fontSize: `${2.2 + i * 0.3}rem`,
          color: "rgba(16,185,129,0.03)", pointerEvents: "none", userSelect: "none",
          top: `${12 + i * 16}%`,
          ...(i % 2 === 0 ? { left: `${3 + i * 3}%` } : { right: `${3 + i * 3}%` }),
          animation: `float ${6 + i}s ease-in-out infinite alternate`,
          animationDelay: `${i * 0.5}s`,
        }}>{p}</div>
      ))}

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, animation: "fadeIn .45s ease" }}>
        <Link to="/" style={backLink}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4B5563"; }}
        >← Home</Link>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: "2.8rem", marginBottom: 10, animation: "float 4s ease-in-out infinite alternate" }}>♛</div>
          <h1 style={{
            fontSize: "clamp(1.8rem, 5vw, 2.4rem)", fontWeight: 800,
            background: `linear-gradient(135deg, ${P}, #34D399)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            margin: "0 0 6px",
          }}>Welcome back</h1>
          <p style={{ color: "#6B7280", fontSize: ".9rem" }}>Sign in to continue your reign</p>
        </div>

        {/* Card */}
        <div style={card}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {error && (
              <div style={errorBanner}><span>⚠</span> {error}</div>
            )}

            <Field label="Username or Email" id="usernameOrEmail" type="text"
              placeholder="username or email" value={form.usernameOrEmail}
              onChange={set("usernameOrEmail")} autoComplete="username" />

            {/* Password */}
            <div>
              <label style={labelStyle} htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input id="password" type={showPw ? "text" : "password"}
                  placeholder="••••••••" value={form.password}
                  onChange={set("password")} autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = P)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={eyeBtn} aria-label={showPw ? "Hide password" : "Show password"}
                >{showPw ? "🙈" : "👁"}</button>
              </div>
            </div>

            <button type="submit" disabled={loading} id="signin-submit" style={{
              ...submitBtn,
              background: loading ? "rgba(255,255,255,.04)" : `linear-gradient(135deg, ${P}, #34D399)`,
              color: loading ? "#4B5563" : "#0A0A0F",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 6px 28px rgba(16,185,129,.2)",
            }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid #374151", borderTop: `2px solid ${P}`, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                  Signing in…
                </span>
              ) : "Sign In"}
            </button>

            <p style={{ textAlign: "center", color: "#6B7280", fontSize: ".82rem", margin: 0 }}>
              No account?{" "}
              <Link to="/signup" style={{ color: P, textDecoration: "none", fontWeight: 600 }}>Create one →</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, id, type, placeholder, value, onChange, autoComplete }: {
  label: string; id: string; type: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      <input id={id} type={type} placeholder={placeholder} value={value}
        onChange={onChange} autoComplete={autoComplete} style={inputStyle}
        onFocus={(e) => (e.currentTarget.style.borderColor = P)}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
      />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const page: CSSProperties = {
  minHeight: "100vh", background: "#0A0A0F", color: "#fff",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  padding: "48px 20px", position: "relative", overflow: "hidden",
};

const card: CSSProperties = {
  background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 16, padding: "32px 36px", boxShadow: "0 24px 64px rgba(0,0,0,.5)",
};

const labelStyle: CSSProperties = {
  display: "block", fontSize: ".7rem", color: "#6B7280",
  letterSpacing: ".08em", marginBottom: 7, fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 8, color: "#E5E7EB", fontSize: ".9rem",
  outline: "none", transition: "border-color .2s", boxSizing: "border-box",
};

const eyeBtn: CSSProperties = {
  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", color: "#4B5563", cursor: "pointer",
  fontSize: ".9rem", padding: 0, lineHeight: 1,
};

const submitBtn: CSSProperties = {
  marginTop: 4, padding: "13px 0", borderRadius: 10, border: "none",
  fontSize: "1rem", fontWeight: 700, letterSpacing: "-.01em",
  transition: "all .25s", position: "relative", overflow: "hidden",
};

const errorBanner: CSSProperties = {
  padding: "10px 14px", borderRadius: 8,
  background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
  color: "#EF4444", fontSize: ".82rem", display: "flex", alignItems: "center", gap: 8,
};

const backLink: CSSProperties = {
  color: "#4B5563", textDecoration: "none", fontSize: ".82rem",
  display: "block", marginBottom: 12, transition: "color .2s",
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
