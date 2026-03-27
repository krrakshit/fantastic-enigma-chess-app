import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../lib/auth-context";
import { apiCheckUsername } from "../lib/auth-client";

export const Route = createFileRoute("/signup")({
  component: SignUpPage,
});

const P = "#10B981";

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
        setState("invalid");
        setMessage("Enter a valid username.");
      }
    }, 450);
  }, [username]);

  return { state, message };
}

function SignUpPage() {
  const { signup, status } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const { state: usernameState, message: usernameMsg } = useUsernameCheck(form.username);

  if (status === "authenticated") { navigate({ to: "/" }); return null; }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.username || !form.email || !form.password) { setError("All fields are required."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (usernameState === "taken" || usernameState === "invalid") { setError("Please choose a valid, available username."); return; }

    setLoading(true);
    try {
      await signup(form.name.trim(), form.username, form.email.trim(), form.password);
      navigate({ to: "/" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally { setLoading(false); }
  };

  const pwStrength = getPasswordStrength(form.password);

  return (
    <div style={page}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      {["♚", "♛", "♜", "♝", "♞", "♟"].map((p, i) => (
        <div key={i} style={{
          position: "fixed", fontSize: `${1.8 + i * 0.25}rem`,
          color: "rgba(16,185,129,0.03)", pointerEvents: "none",
          top: `${8 + i * 14}%`,
          ...(i % 2 === 0 ? { left: `${2 + i * 2.5}%` } : { right: `${2 + i * 2.5}%` }),
          animation: `float ${6 + i}s ease-in-out infinite alternate`,
          animationDelay: `${i * 0.4}s`,
        }}>{p}</div>
      ))}

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 460, animation: "fadeIn .45s ease" }}>
        <Link to="/" style={backLink}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4B5563"; }}
        >← Home</Link>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 10, animation: "float 4s ease-in-out infinite alternate" }}>♚</div>
          <h1 style={{
            fontSize: "clamp(1.7rem, 5vw, 2.3rem)", fontWeight: 800,
            background: `linear-gradient(135deg, ${P}, #34D399)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 6px",
          }}>Create account</h1>
          <p style={{ color: "#6B7280", fontSize: ".88rem" }}>Join the arena. Claim your throne.</p>
        </div>

        <div style={card}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {error && <div style={errorBanner}><span>⚠</span> {error}</div>}

            <Field label="Full Name" id="name" type="text" placeholder="Rakshit Sharma" value={form.name} onChange={set("name")} />

            {/* Username with availability */}
            <div>
              <label style={labelStyle} htmlFor="username">Username</label>
              <div style={{ position: "relative" }}>
                <input id="username" type="text" placeholder="rakshit99"
                  value={form.username} onChange={set("username")} autoComplete="username"
                  style={{
                    ...inputStyle, paddingRight: 36,
                    borderColor: usernameState === "available" ? "rgba(16,185,129,.4)"
                      : usernameState === "taken" || usernameState === "invalid" ? "rgba(239,68,68,.4)"
                      : "rgba(255,255,255,.08)",
                  }}
                  onFocus={(e) => { if (usernameState === "idle") e.currentTarget.style.borderColor = P; }}
                  onBlur={(e) => { if (usernameState === "idle") e.currentTarget.style.borderColor = "rgba(255,255,255,.08)"; }}
                />
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: ".85rem" }}>
                  {usernameState === "checking" && (
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #1F2937", borderTop: `2px solid ${P}`, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                  )}
                  {usernameState === "available" && <span style={{ color: P }}>✓</span>}
                  {(usernameState === "taken" || usernameState === "invalid") && <span style={{ color: "#EF4444" }}>✗</span>}
                </div>
              </div>
              {form.username && usernameState !== "idle" && usernameState !== "checking" && (
                <p style={{ fontSize: ".68rem", marginTop: 4, color: usernameState === "available" ? P : "#EF4444" }}>{usernameMsg}</p>
              )}
              <p style={{ fontSize: ".62rem", marginTop: 3, color: "#374151" }}>3–30 chars · letters, numbers, _ and . only</p>
            </div>

            <Field label="Email Address" id="email" type="email" placeholder="rakshit@example.com" value={form.email} onChange={set("email")} autoComplete="email" />

            {/* Password */}
            <div>
              <label style={labelStyle} htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input id="password" type={showPw ? "text" : "password"}
                  placeholder="At least 6 characters" value={form.password}
                  onChange={set("password")} autoComplete="new-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = P)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={eyeBtn} aria-label="Toggle password">
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
              {form.password && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: i < pwStrength.score ? pwStrength.color : "rgba(255,255,255,.06)",
                        transition: "background .2s",
                      }} />
                    ))}
                  </div>
                  <p style={{ fontSize: ".62rem", marginTop: 3, color: pwStrength.color }}>{pwStrength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label style={labelStyle} htmlFor="confirm">Confirm Password</label>
              <input id="confirm" type={showPw ? "text" : "password"}
                placeholder="Repeat your password" value={form.confirm}
                onChange={set("confirm")} autoComplete="new-password"
                style={{
                  ...inputStyle,
                  borderColor: form.confirm && form.confirm !== form.password ? "rgba(239,68,68,.4)"
                    : form.confirm && form.confirm === form.password ? "rgba(16,185,129,.4)"
                    : "rgba(255,255,255,.08)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = P)}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = form.confirm && form.confirm !== form.password
                    ? "rgba(239,68,68,.4)" : form.confirm === form.password ? "rgba(16,185,129,.4)" : "rgba(255,255,255,.08)";
                }}
              />
              {form.confirm && form.confirm !== form.password && (
                <p style={{ fontSize: ".68rem", marginTop: 3, color: "#EF4444" }}>Passwords don't match.</p>
              )}
            </div>

            <button type="submit" disabled={loading} id="signup-submit" style={{
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
                  <span style={{ width: 15, height: 15, border: "2px solid #374151", borderTop: `2px solid ${P}`, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                  Creating account…
                </span>
              ) : "Create Account →"}
            </button>

            <p style={{ textAlign: "center", color: "#6B7280", fontSize: ".82rem", margin: 0 }}>
              Already have an account?{" "}
              <Link to="/signin" style={{ color: P, textDecoration: "none", fontWeight: 600 }}>Sign in →</Link>
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

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "#4B5563" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Too weak", color: "#EF4444" },
    { label: "Weak", color: "#F97316" },
    { label: "Fair", color: "#F59E0B" },
    { label: "Strong", color: "#10B981" },
    { label: "Very strong", color: "#34D399" },
  ];
  return { score, ...levels[score] };
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
  display: "block", fontSize: ".68rem", color: "#6B7280",
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
  background: "radial-gradient(ellipse at 50% 20%,rgba(16,185,129,.06) 0%,transparent 55%)",
};
