import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useAuth } from "../lib/auth-context";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const themes = [
  {
    name: "Obsidian",
    path: "/obsidian",
    desc: "Dark luxury · Gold & marble midnight",
    gradient: "linear-gradient(135deg, #0A0A0A 0%, #1A1A2E 50%, #C9A84C 100%)",
    emoji: "🌑",
    accent: "#C9A84C",
  },
  {
    name: "Pixel Dojo",
    path: "/pixel-dojo",
    desc: "Retro 8-bit · CRT scanlines, matrix green",
    gradient: "linear-gradient(135deg, #0D0208 0%, #003B00 50%, #00FF41 100%)",
    emoji: "👾",
    accent: "#00FF41",
  },
  {
    name: "Zen Garden",
    path: "/zen-garden",
    desc: "Japanese organic · Wood textures, ink brush",
    gradient: "linear-gradient(135deg, #F5F0E8 0%, #E8D5B7 50%, #2D4A3E 100%)",
    emoji: "🎋",
    accent: "#2D4A3E",
  },
  {
    name: "Neon Arena",
    path: "/neon-arena",
    desc: "Cyberpunk esports · Neon glow, holographic HUD",
    gradient: "linear-gradient(135deg, #0A0E1A 0%, #00F0FF 50%, #FF00E5 100%)",
    emoji: "⚡",
    accent: "#00F0FF",
  },
  {
    name: "Parchment",
    path: "/parchment",
    desc: "Classical editorial · Vintage newspaper column",
    gradient: "linear-gradient(135deg, #FFF8E7 0%, #D4C5A0 50%, #8B0000 100%)",
    emoji: "📜",
    accent: "#8B0000",
  },
];

function HomePage() {
  const { status, user, signout } = useAuth();

  return (
    <div style={pageStyle}>
      <style>{animations}</style>

      {/* ── Background layers ─────────────────────────────────────────── */}
      <div style={bgGrid} />
      <div style={bgGlow} />

      {/* ── Auth Nav Bar ──────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "14px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(10,10,15,.7)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,.05)",
      }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, color: "#C9A84C", fontSize: "1.05rem", letterSpacing: ".04em" }}>♛ Chess Arena</span>
        {status === "loading" ? (
          <div style={{ width: 20, height: 20, border: "2px solid #222", borderTop: "2px solid #C9A84C", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        ) : status === "authenticated" && user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 9,
              background: "rgba(201,168,76,.06)", border: "1px solid rgba(201,168,76,.15)",
              borderRadius: 8, padding: "6px 12px",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "linear-gradient(135deg,#C9A84C,#FFE89D)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: ".75rem", color: "#0A0A0F",
              }}>{user.username[0].toUpperCase()}</div>
              <div>
                <div style={{ color: "#C9A84C", fontSize: ".78rem", fontWeight: 700, lineHeight: 1.2 }}>@{user.username}</div>
                <div style={{ color: "#444", fontSize: ".65rem", lineHeight: 1.2 }}>⚡ {user.rating} ELO</div>
              </div>
            </div>
            <button
              onClick={() => signout()}
              style={{
                padding: "7px 14px", borderRadius: 7,
                border: "1px solid rgba(255,255,255,.08)",
                background: "transparent", color: "#555",
                fontSize: ".78rem", cursor: "pointer",
                fontFamily: "'Cormorant Garamond', serif",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#FF6B6B"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,107,107,.3)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#555"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.08)"; }}
            >Sign out</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <Link to="/signin" style={{
              padding: "7px 16px", borderRadius: 7,
              border: "1px solid rgba(255,255,255,.09)",
              color: "#888", textDecoration: "none",
              fontSize: ".82rem", fontFamily: "'Cormorant Garamond', serif",
              transition: "all .2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#C9A84C"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,76,.3)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#888"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.09)"; }}
            >Sign in</Link>
            <Link to="/signup" style={{
              padding: "7px 16px", borderRadius: 7,
              background: "linear-gradient(135deg,#C9A84C,#FFE89D)",
              color: "#0A0A0F", textDecoration: "none",
              fontSize: ".82rem", fontWeight: 800,
              fontFamily: "'Playfair Display', serif",
              transition: "all .2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >Join free →</Link>
          </div>
        )}
      </div>

      {/* ── Floating decorative pieces ────────────────────────────────── */}
      {["♚", "♛", "♜", "♝", "♞", "♟"].map((p, i) => (
        <div
          key={i}
          style={{
            position: "fixed",
            fontSize: `${3 + i * 0.6}rem`,
            color: `rgba(201,168,76,0.03)`,
            top: `${8 + i * 14}%`,
            left: i % 2 === 0 ? `${2 + i * 2}%` : undefined,
            right: i % 2 !== 0 ? `${2 + i * 2}%` : undefined,
            pointerEvents: "none",
            userSelect: "none",
            animation: `floatPiece ${7 + i}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.5}s`,
          }}
        >
          {p}
        </div>
      ))}

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1240,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "fadeIn 0.6s ease",
        }}
      >
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: "4rem", marginBottom: 16, animation: "floatPiece 4s ease-in-out infinite alternate" }}>
            ♛
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(2.5rem, 7vw, 5rem)",
              fontWeight: 900,
              background: "linear-gradient(135deg, #C9A84C 0%, #FFE89D 40%, #C9A84C 80%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              margin: "0 0 16px",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            Chess Arena
          </h1>
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
              color: "#666",
              fontStyle: "italic",
              marginBottom: 40,
              letterSpacing: "0.04em",
            }}
          >
            The game of kings — five immersive experiences, one battlefield
          </p>

          {/* Primary CTA */}
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              to="/game"
              style={{
                padding: "16px 48px",
                background: "linear-gradient(135deg, #C9A84C 0%, #FFE89D 50%, #C9A84C 100%)",
                backgroundSize: "200% 100%",
                color: "#0A0A0F",
                borderRadius: 12,
                textDecoration: "none",
                fontWeight: 900,
                fontSize: "1.1rem",
                fontFamily: "'Playfair Display', serif",
                boxShadow: "0 8px 32px rgba(201,168,76,0.3)",
                transition: "all 0.3s ease",
                letterSpacing: "0.04em",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 48px rgba(201,168,76,0.4)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(201,168,76,0.3)";
              }}
            >
              🎮 Play Multiplayer
            </Link>
            <a
              href="#themes"
              style={{
                padding: "16px 40px",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#888",
                borderRadius: 12,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "1rem",
                fontFamily: "'Cormorant Garamond', serif",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,76,0.3)";
                (e.currentTarget as HTMLElement).style.color = "#C9A84C";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLElement).style.color = "#888";
              }}
            >
              Solo Play ↓
            </a>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 72,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {[
            { value: "5", label: "Unique Themes" },
            { value: "∞", label: "Possible Games" },
            { value: "Real-time", label: "Multiplayer" },
            { value: "Full", label: "Chess Rules" },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                padding: "24px 36px",
                textAlign: "center",
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "1.8rem",
                  fontWeight: 900,
                  background: "linear-gradient(135deg, #C9A84C, #FFE89D)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  marginBottom: 4,
                }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#444", letterSpacing: "0.08em" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Theme Gallery ──────────────────────────────────────────────── */}
        <div id="themes" style={{ width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "2rem",
                fontWeight: 700,
                color: "#fff",
                margin: "0 0 8px",
              }}
            >
              Choose Your Battlefield
            </h2>
            <p style={{ color: "#555", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}>
              Each theme is a completely different visual experience
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {themes.map((t) => (
              <Link
                key={t.path}
                to={t.path}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "#111116",
                  border: "1px solid rgba(255,255,255,0.06)",
                  transition: "all 0.35s ease",
                  display: "block",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "translateY(-8px)";
                  el.style.borderColor = "rgba(201,168,76,0.3)";
                  el.style.boxShadow = "0 24px 60px rgba(0,0,0,0.5)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "translateY(0)";
                  el.style.borderColor = "rgba(255,255,255,0.06)";
                  el.style.boxShadow = "none";
                }}
              >
                {/* Gradient preview */}
                <div
                  style={{
                    height: 140,
                    background: t.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "3.5rem",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {t.emoji}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(to bottom, transparent 50%, rgba(17,17,22,0.6) 100%)",
                    }}
                  />
                </div>

                {/* Info */}
                <div style={{ padding: "20px 24px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <h3
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: "1.3rem",
                        fontWeight: 700,
                        margin: 0,
                        color: "#fff",
                      }}
                    >
                      {t.name}
                    </h3>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "3px 8px",
                        border: `1px solid ${t.accent}44`,
                        borderRadius: 4,
                        color: t.accent,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                      }}
                    >
                      SOLO
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "0.88rem",
                      color: "#555",
                      margin: 0,
                      lineHeight: 1.5,
                      fontFamily: "'Cormorant Garamond', serif",
                    }}
                  >
                    {t.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 80,
            paddingTop: 32,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            textAlign: "center",
            width: "100%",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: 8, opacity: 0.4 }}>♟</div>
          <p style={{ color: "#333", fontSize: "0.78rem", fontFamily: "'Cormorant Garamond', serif" }}>
            Chess Arena — Built with React, chess.js, and Elysia WebSockets
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#0A0A0F",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "60px 24px",
  position: "relative",
  overflow: "hidden",
};

const bgGrid: CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(201,168,76,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.02) 1px, transparent 1px)",
  backgroundSize: "80px 80px",
  pointerEvents: "none",
};

const bgGlow: CSSProperties = {
  position: "fixed",
  inset: 0,
  background:
    "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 50%)",
  pointerEvents: "none",
};

const animations = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes floatPiece {
    from { transform: translateY(0) rotate(-3deg); }
    to { transform: translateY(-18px) rotate(3deg); }
  }
`;
