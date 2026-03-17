import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth-context";
import { apiCheckUsername } from "../lib/auth-client";

export const Route = createFileRoute("/signup")({
  component: SignUpPage,
});

const A = "#C9A84C";

// ─── Username availability debounce ──────────────────────────────────────────

type AvailState = "idle" | "checking" | "available" | "taken" | "invalid";

function useUsernameCheck(username: string) {
  const [state, setState] = useState<AvailState>("idle");
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChecked = useRef("");

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!username || username === lastChecked.current) return;

    setState("checking");
    timerRef.current = setTimeout(async () => {
      lastChecked.current = username;
      try {
        const result = await apiCheckUsername(username);
        setState(result.available ? "available" : "taken");
        setMessage(result.message);
      } catch {
        // Format error
        setState("invalid");
        setMessage("Enter a valid username.");
      }
    }, 450); // 450 ms debounce
  }, [username]);

  return { state, message };
}

// ─── Component ────────────────────────────────────────────────────────────────

function SignUpPage() {
  const { signup, status } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const { state: usernameState, message: usernameMsg } = useUsernameCheck(form.username);

  if (status === "authenticated") {
    navigate({ to: "/" });
    return null;
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.username || !form.email || !form.password) {
      setError("All fields are required.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (usernameState === "taken" || usernameState === "invalid") {
      setError("Please choose a valid, available username.");
      return;
    }

    setLoading(true);
    try {
      await signup(form.name.trim(), form.username, form.email.trim(), form.password);
      navigate({ to: "/" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(form.password);

  return (
    <div style={page}>
      <style>{css}</style>
      <div style={bgGrid} />
      <div style={bgGlow} />

      {["♚", "♛", "♜", "♝", "♞", "♟"].map((p, i) => (
        <div key={i} style={{
          position: "fixed", fontSize: `${2 + i * 0.3}rem`,
          color: "rgba(201,168,76,0.035)", pointerEvents: "none",
          top: `${8 + i * 14}%`,
          ...(i % 2 === 0 ? { left: `${2 + i * 2.5}%` } : { right: `${2 + i * 2.5}%` }),
          animation: `floatPiece ${6 + i}s ease-in-out infinite alternate`,
          animationDelay: `${i * 0.4}s`,
        }}>{p}</div>
      ))}

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 480, animation: "fadeUp .45s ease" }}>
        <Link to="/" style={{ color: "#444", textDecoration: "none", fontSize: ".8rem", display: "block", marginBottom: 12 }}>← Home</Link>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: "2.8rem", marginBottom: 10, animation: "floatPiece 4s ease-in-out infinite alternate" }}>♚</div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(1.8rem, 5vw, 2.4rem)", fontWeight: 900,
            background: `linear-gradient(135deg, ${A}, #FFE89D, ${A})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            margin: "0 0 6px",
          }}>Create account</h1>
          <p style={{ color: "#555", fontSize: ".92rem", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}>
            Join the arena. Claim your throne.
          </p>
        </div>

        <div style={card}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {error && <div style={errorBanner}><span>⚠</span> {error}</div>}

            {/* Name */}
            <Field label="Full Name" id="name" type="text"
              placeholder="Rakshit Sharma" value={form.name} onChange={set("name")} />

            {/* Username — with live availability indicator */}
            <div>
              <label style={labelStyle} htmlFor="username">Username</label>
              <div style={{ position: "relative" }}>
                <input
                  id="username"
                  type="text"
                  placeholder="rakshit99"
                  value={form.username}
                  onChange={set("username")}
                  autoComplete="username"
                  style={{
                    ...inputStyle,
                    paddingRight: 36,
                    borderColor: usernameState === "available"
                      ? "rgba(0,255,136,.4)"
                      : usernameState === "taken" || usernameState === "invalid"
                        ? "rgba(255,68,68,.4)"
                        : "rgba(255,255,255,.1)",
                    transition: "border-color .2s",
                  }}
                  onFocus={(e) => { if (usernameState === "idle") e.currentTarget.style.borderColor = A; }}
                  onBlur={(e) => { if (usernameState === "idle") e.currentTarget.style.borderColor = "rgba(255,255,255,.1)"; }}
                />
                {/* Availability icon */}
                <div style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  fontSize: ".9rem", lineHeight: 1,
                }}>
                  {usernameState === "checking" && (
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #333", borderTop: `2px solid ${A}`, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                  )}
                  {usernameState === "available" && <span style={{ color: "#00FF88" }}>✓</span>}
                  {(usernameState === "taken" || usernameState === "invalid") && <span style={{ color: "#FF6B6B" }}>✗</span>}
                </div>
              </div>
              {/* Availability message */}
              {form.username && usernameState !== "idle" && usernameState !== "checking" && (
                <p style={{
                  fontSize: ".7rem", marginTop: 5,
                  color: usernameState === "available" ? "#00FF88" : "#FF6B6B",
                }}>{usernameMsg}</p>
              )}
              <p style={{ fontSize: ".65rem", marginTop: 4, color: "#333" }}>
                3–30 chars · letters, numbers, _ and . only
              </p>
            </div>

            {/* Email */}
            <Field label="Email Address" id="email" type="email"
              placeholder="rakshit@example.com" value={form.email} onChange={set("email")}
              autoComplete="email" />

            {/* Password */}
            <div>
              <label style={labelStyle} htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="new-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = A)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.1)")}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={eyeBtn} aria-label="Toggle password">
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
              {/* Strength bar */}
              {form.password && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 3. }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: i < passwordStrength.score
                          ? passwordStrength.color
                          : "rgba(255,255,255,.07)",
                        transition: "background .2s",
                      }} />
                    ))}
                  </div>
                  <p style={{ fontSize: ".65rem", marginTop: 4, color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={labelStyle} htmlFor="confirm">Confirm Password</label>
              <input
                id="confirm"
                type={showPw ? "text" : "password"}
                placeholder="Repeat your password"
                value={form.confirm}
                onChange={set("confirm")}
                autoComplete="new-password"
                style={{
                  ...inputStyle,
                  borderColor: form.confirm && form.confirm !== form.password
                    ? "rgba(255,68,68,.4)"
                    : form.confirm && form.confirm === form.password
                      ? "rgba(0,255,136,.4)"
                      : "rgba(255,255,255,.1)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = A)}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor =
                    form.confirm && form.confirm !== form.password ? "rgba(255,68,68,.4)"
                    : form.confirm === form.password ? "rgba(0,255,136,.4)"
                    : "rgba(255,255,255,.1)";
                }}
              />
              {form.confirm && form.confirm !== form.password && (
                <p style={{ fontSize: ".7rem", marginTop: 4, color: "#FF6B6B" }}>Passwords don't match.</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              id="signup-submit"
              style={{
                marginTop: 4, padding: "14px 0", borderRadius: 10,
                border: "none", cursor: loading ? "not-allowed" : "pointer",
                background: loading ? "rgba(255,255,255,.06)" : `linear-gradient(135deg, ${A}, #FFE89D, ${A})`,
                color: loading ? "#444" : "#0A0A0F",
                fontSize: "1.05rem", fontWeight: 800,
                fontFamily: "'Playfair Display', serif",
                letterSpacing: ".04em", transition: "all .25s",
                boxShadow: loading ? "none" : `0 6px 28px rgba(201,168,76,.28)`,
              }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 15, height: 15, border: "2px solid #555", borderTop: `2px solid ${A}`, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                  Creating account…
                </span>
              ) : "Create Account →"}
            </button>

            <p style={{ textAlign: "center", color: "#555", fontSize: ".82rem", margin: 0 }}>
              Already have an account?{" "}
              <Link to="/signin" style={{ color: A, textDecoration: "none", fontWeight: 700 }}>Sign in →</Link>
            </p>
          </form>
        </div>

        <p style={{ textAlign: "center", color: "#2a2a2a", fontSize: ".7rem", marginTop: 18, fontFamily: "monospace" }}>
          Google & GitHub auth coming soon
        </p>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
        id={id} type={type} placeholder={placeholder}
        value={value} onChange={onChange} autoComplete={autoComplete}
        style={inputStyle}
        onFocus={(e) => (e.currentTarget.style.borderColor = A)}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.1)")}
      />
    </div>
  );
}

// ─── Password strength ────────────────────────────────────────────────────────

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "#555" };
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Too weak",  color: "#FF4444" },
    { label: "Weak",      color: "#FF8C00" },
    { label: "Fair",      color: "#FFB800" },
    { label: "Strong",    color: "#00C853" },
    { label: "Very strong", color: "#00FF88" },
  ];
  return { score, ...levels[score] };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const page: React.CSSProperties = {
  minHeight: "100vh", background: "#0A0A0F", color: "#fff",
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", padding: "48px 20px",
  position: "relative", overflow: "hidden",
  fontFamily: "'Cormorant Garamond', serif",
};
const card: React.CSSProperties = {
  background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 20, padding: "36px 40px", boxShadow: "0 32px 80px rgba(0,0,0,.55)",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: ".68rem", color: "#555",
  letterSpacing: ".1em", fontFamily: "'Cormorant Garamond', serif",
  marginBottom: 7, fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 14px",
  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 9, color: "#ddd", fontSize: ".95rem",
  fontFamily: "'Cormorant Garamond', serif",
  outline: "none", transition: "border-color .2s", boxSizing: "border-box",
};
const eyeBtn: React.CSSProperties = {
  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", color: "#555", cursor: "pointer",
  fontSize: ".95rem", padding: 0, lineHeight: 1,
};
const errorBanner: React.CSSProperties = {
  padding: "11px 14px", borderRadius: 8,
  background: "rgba(255,68,68,.08)", border: "1px solid rgba(255,68,68,.22)",
  color: "#FF6B6B", fontSize: ".84rem", display: "flex", alignItems: "center", gap: 8,
};
const bgGrid: React.CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  backgroundImage: "linear-gradient(rgba(201,168,76,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.02) 1px,transparent 1px)",
  backgroundSize: "64px 64px",
};
const bgGlow: React.CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  background: "radial-gradient(ellipse at 50% 20%,rgba(201,168,76,.08) 0%,transparent 55%)",
};
const css = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes floatPiece { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-18px) rotate(3deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  input::placeholder { color: #2e2e2e; }
  input:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 100px #111116 inset;
    -webkit-text-fill-color: #ddd;
    caret-color: #ddd;
  }
`;
