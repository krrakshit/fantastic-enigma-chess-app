import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../lib/auth-context";

export const Route = createFileRoute("/signin")({
  component: SignInPage,
});

const A = "#C9A84C";

function SignInPage() {
  const { signin, status } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ usernameOrEmail: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Already logged in → redirect home
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
      <style>{css}</style>

      {/* Background layers */}
      <div style={bgGrid} />
      <div style={bgGlow} />

      {/* Floating pieces */}
      {["♚", "♛", "♜", "♝", "♞"].map((p, i) => (
        <div key={i} style={{
          position: "fixed", fontSize: `${2.4 + i * 0.35}rem`,
          color: "rgba(201,168,76,0.04)", pointerEvents: "none", userSelect: "none",
          top: `${12 + i * 16}%`,
          ...(i % 2 === 0 ? { left: `${3 + i * 3}%` } : { right: `${3 + i * 3}%` }),
          animation: `floatPiece ${6 + i}s ease-in-out infinite alternate`,
          animationDelay: `${i * 0.5}s`,
        }}>{p}</div>
      ))}

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440, animation: "fadeUp .45s ease" }}>
        {/* Back link */}
        <Link to="/" style={{ color: "#444", textDecoration: "none", fontSize: ".8rem", display: "block", marginBottom: 12 }}>
          ← Home
        </Link>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "3rem", marginBottom: 10, animation: "floatPiece 4s ease-in-out infinite alternate" }}>♛</div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(1.9rem, 5vw, 2.6rem)", fontWeight: 900,
            background: `linear-gradient(135deg, ${A}, #FFE89D, ${A})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            margin: "0 0 6px",
          }}>Welcome back</h1>
          <p style={{ color: "#555", fontSize: ".95rem", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}>
            Sign in to continue your reign
          </p>
        </div>

        {/* Card */}
        <div style={card}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Error banner */}
            {error && (
              <div style={errorBanner}>
                <span>⚠</span> {error}
              </div>
            )}

            {/* Username or email */}
            <Field
              label="Username or Email"
              id="usernameOrEmail"
              type="text"
              placeholder="rakshit99 or rakshit@example.com"
              value={form.usernameOrEmail}
              onChange={set("usernameOrEmail")}
              autoComplete="username"
            />

            {/* Password */}
            <div>
              <label style={labelStyle} htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = A)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.1)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "#555", cursor: "pointer",
                    fontSize: ".95rem", padding: 0, lineHeight: 1,
                  }}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              id="signin-submit"
              style={{
                marginTop: 6, padding: "14px 0", borderRadius: 10,
                border: "none", cursor: loading ? "not-allowed" : "pointer",
                background: loading
                  ? "rgba(255,255,255,.06)"
                  : `linear-gradient(135deg, ${A}, #FFE89D, ${A})`,
                color: loading ? "#444" : "#0A0A0F",
                fontSize: "1.05rem", fontWeight: 800,
                fontFamily: "'Playfair Display', serif",
                letterSpacing: ".04em",
                transition: "all .25s",
                boxShadow: loading ? "none" : `0 6px 28px rgba(201,168,76,.28)`,
                position: "relative", overflow: "hidden",
              }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid #555", borderTop: `2px solid ${A}`, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                  Signing in…
                </span>
              ) : "Sign In"}
            </button>

            {/* Footer */}
            <p style={{ textAlign: "center", color: "#555", fontSize: ".82rem", margin: 0 }}>
              No account?{" "}
              <Link to="/signup" style={{ color: A, textDecoration: "none", fontWeight: 700 }}>
                Create one →
              </Link>
            </p>
          </form>
        </div>

        {/* Divider hint */}
        <p style={{ textAlign: "center", color: "#2a2a2a", fontSize: ".72rem", marginTop: 20, fontFamily: "monospace" }}>
          Google & GitHub auth coming soon
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label, id, type, placeholder, value, onChange, autoComplete,
}: {
  label: string; id: string; type: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        style={inputStyle}
        onFocus={(e) => (e.currentTarget.style.borderColor = A)}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.1)")}
      />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0A0A0F",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 20px",
  position: "relative",
  overflow: "hidden",
  fontFamily: "'Cormorant Garamond', serif",
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 20,
  padding: "36px 40px",
  boxShadow: "0 32px 80px rgba(0,0,0,.55)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: ".68rem",
  color: "#555",
  letterSpacing: ".1em",
  fontFamily: "'Cormorant Garamond', serif",
  marginBottom: 8,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 9,
  color: "#ddd",
  fontSize: ".95rem",
  fontFamily: "'Cormorant Garamond', serif",
  outline: "none",
  transition: "border-color .2s",
  boxSizing: "border-box",
};

const errorBanner: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: 8,
  background: "rgba(255,68,68,.08)",
  border: "1px solid rgba(255,68,68,.22)",
  color: "#FF6B6B",
  fontSize: ".84rem",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const bgGrid: React.CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  backgroundImage: "linear-gradient(rgba(201,168,76,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.02) 1px,transparent 1px)",
  backgroundSize: "64px 64px",
};

const bgGlow: React.CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  background: "radial-gradient(ellipse at 50% 25%,rgba(201,168,76,.08) 0%,transparent 55%)",
};

const css = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes floatPiece { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-18px) rotate(3deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  input::placeholder { color: #333; }
  input:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 100px #111116 inset;
    -webkit-text-fill-color: #ddd;
    caret-color: #ddd;
  }
`;
