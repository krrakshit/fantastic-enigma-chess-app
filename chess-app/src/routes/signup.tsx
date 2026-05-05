import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../lib/auth-context";
import { apiCheckUsername } from "../lib/auth-client";

export const Route = createFileRoute("/signup")({
  component: SignUpPage,
});

const P = "#2D6A4F";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 16, height: 16, border: "2px solid #374151",
      borderTop: `2px solid ${P}`, borderRadius: "50%",
      display: "inline-block", animation: "spin .7s linear infinite",
    }} />
  );
}

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
  const { signup, socialSignIn, status } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);

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

  const handleSocial = async (provider: "google" | "github") => {
    setSocialLoading(provider);
    setError("");
    try {
      await socialSignIn(provider);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `${provider} sign up failed.`);
      setSocialLoading(null);
    }
  };

  const pwStrength = getPasswordStrength(form.password);

  return (
    <div style={page}>
      <div style={bgGrid} />
      <div style={bgGlow} />

      {["♚", "♛", "♜", "♝", "♞", "♟"].map((p, i) => (
        <div key={i} style={{
          position: "fixed", fontSize: `${1.8 + i * 0.25}rem`,
          color: "rgba(45,106,79,0.03)", pointerEvents: "none",
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
            background: `linear-gradient(135deg, ${P}, #40916C)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 6px",
          }}>Create account</h1>
          <p style={{ color: "#6B7264", fontSize: ".88rem" }}>Join the arena. Claim your throne.</p>
        </div>

        <div style={card}>
          {/* Social buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              id="signup-google"
              disabled={!!socialLoading}
              onClick={() => handleSocial("google")}
              style={{ ...socialBtn, opacity: socialLoading === "github" ? 0.5 : 1 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.15)"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,.06)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,.08)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.6)"; }}
            >
              {socialLoading === "google" ? <Spinner /> : <GoogleIcon />} Sign up with Google
            </button>
            <button
              type="button"
              id="signup-github"
              disabled={!!socialLoading}
              onClick={() => handleSocial("github")}
              style={{ ...socialBtn, opacity: socialLoading === "google" ? 0.5 : 1 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.15)"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,.06)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,.08)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.6)"; }}
            >
              {socialLoading === "github" ? <Spinner /> : <GitHubIcon />} Sign up with GitHub
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 18px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,.06)" }} />
            <span style={{ color: "#8B9080", fontSize: ".72rem", letterSpacing: ".06em", fontWeight: 500 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,.06)" }} />
          </div>

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
                    borderColor: usernameState === "available" ? "rgba(45,106,79,.4)"
                      : usernameState === "taken" || usernameState === "invalid" ? "rgba(239,68,68,.4)"
                      : "rgba(0,0,0,.08)",
                  }}
                  onFocus={(e) => { if (usernameState === "idle") e.currentTarget.style.borderColor = P; }}
                  onBlur={(e) => { if (usernameState === "idle") e.currentTarget.style.borderColor = "rgba(0,0,0,.08)"; }}
                />
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: ".85rem" }}>
                  {usernameState === "checking" && (
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #E5E5E0", borderTop: `2px solid ${P}`, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                  )}
                  {usernameState === "available" && <span style={{ color: P }}>✓</span>}
                  {(usernameState === "taken" || usernameState === "invalid") && <span style={{ color: "#EF4444" }}>✗</span>}
                </div>
              </div>
              {form.username && usernameState !== "idle" && usernameState !== "checking" && (
                <p style={{ fontSize: ".68rem", marginTop: 4, color: usernameState === "available" ? P : "#EF4444" }}>{usernameMsg}</p>
              )}
              <p style={{ fontSize: ".62rem", marginTop: 3, color: "#9CA392" }}>3–30 chars · letters, numbers, _ and . only</p>
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
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(0,0,0,.08)")}
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
                        background: i < pwStrength.score ? pwStrength.color : "rgba(0,0,0,.06)",
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
                    : form.confirm && form.confirm === form.password ? "rgba(45,106,79,.4)"
                    : "rgba(0,0,0,.08)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = P)}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = form.confirm && form.confirm !== form.password
                    ? "rgba(239,68,68,.4)" : form.confirm === form.password ? "rgba(45,106,79,.4)" : "rgba(0,0,0,.08)";
                }}
              />
              {form.confirm && form.confirm !== form.password && (
                <p style={{ fontSize: ".68rem", marginTop: 3, color: "#EF4444" }}>Passwords don't match.</p>
              )}
            </div>

            <button type="submit" disabled={loading} id="signup-submit" style={{
              ...submitBtn,
              background: loading ? "rgba(0,0,0,.04)" : `linear-gradient(135deg, ${P}, #40916C)`,
              color: loading ? "#4B5563" : "#FAFAF7",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 6px 28px rgba(45,106,79,.2)",
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

            <p style={{ textAlign: "center", color: "#6B7264", fontSize: ".82rem", margin: 0 }}>
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
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(0,0,0,.08)")}
      />
    </div>
  );
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "#8B9080" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Too weak", color: "#EF4444" },
    { label: "Weak", color: "#F97316" },
    { label: "Fair", color: "#F59E0B" },
    { label: "Strong", color: "#2D6A4F" },
    { label: "Very strong", color: "#40916C" },
  ];
  return { score, ...levels[score] };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const page: CSSProperties = {
  minHeight: "100vh", background: "#FAFAF7", color: "#1A1A1A",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  padding: "48px 20px", position: "relative", overflow: "hidden",
};
const card: CSSProperties = {
  background: "rgba(255,255,255,.6)", border: "1px solid rgba(0,0,0,.06)",
  borderRadius: 16, padding: "32px 36px", boxShadow: "0 24px 64px rgba(0,0,0,.06)",
};
const labelStyle: CSSProperties = {
  display: "block", fontSize: ".68rem", color: "#6B7264",
  letterSpacing: ".08em", marginBottom: 7, fontWeight: 600,
};
const inputStyle: CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(255,255,255,.55)", border: "1px solid rgba(0,0,0,.08)",
  borderRadius: 8, color: "#1A1A1A", fontSize: ".9rem",
  outline: "none", transition: "border-color .2s", boxSizing: "border-box",
};
const eyeBtn: CSSProperties = {
  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", color: "#8B9080", cursor: "pointer",
  fontSize: ".9rem", padding: 0, lineHeight: 1,
};
const submitBtn: CSSProperties = {
  marginTop: 4, padding: "13px 0", borderRadius: 10, border: "none",
  fontSize: "1rem", fontWeight: 700, letterSpacing: "-.01em",
  transition: "all .25s", position: "relative", overflow: "hidden",
};
const socialBtn: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  padding: "11px 0", borderRadius: 10,
  background: "rgba(255,255,255,.6)", border: "1px solid rgba(0,0,0,.08)",
  color: "#2D2D2D", fontSize: ".88rem", fontWeight: 500,
  cursor: "pointer", transition: "all .2s", width: "100%",
};
const errorBanner: CSSProperties = {
  padding: "10px 14px", borderRadius: 8,
  background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
  color: "#EF4444", fontSize: ".82rem", display: "flex", alignItems: "center", gap: 8,
};
const backLink: CSSProperties = {
  color: "#8B9080", textDecoration: "none", fontSize: ".82rem",
  display: "block", marginBottom: 12, transition: "color .2s",
};
const bgGrid: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  backgroundImage: "linear-gradient(rgba(45,106,79,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(45,106,79,.015) 1px,transparent 1px)",
  backgroundSize: "72px 72px",
};
const bgGlow: CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  background: "radial-gradient(ellipse at 50% 20%,rgba(45,106,79,.06) 0%,transparent 55%)",
};
