import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";



  


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
  },
  {
    name: "Pixel Dojo",
    path: "/pixel-dojo",
    desc: "Retro 8-bit · CRT scanlines, matrix green",
    gradient: "linear-gradient(135deg, #0D0208 0%, #003B00 50%, #00FF41 100%)",
    emoji: "👾",
  },
  {
    name: "Zen Garden",
    path: "/zen-garden",
    desc: "Japanese organic · Wood textures, ink brush",
    gradient: "linear-gradient(135deg, #F5F0E8 0%, #E8D5B7 50%, #2D4A3E 100%)",
    emoji: "🎋",
  },
  {
    name: "Neon Arena",
    path: "/neon-arena",
    desc: "Cyberpunk esports · Neon glow, holographic HUD",
    gradient: "linear-gradient(135deg, #0A0E1A 0%, #00F0FF 50%, #FF00E5 100%)",
    emoji: "⚡",
  },
  {
    name: "Parchment",
    path: "/parchment",
    desc: "Classical editorial · Vintage newspaper column",
    gradient: "linear-gradient(135deg, #FFF8E7 0%, #D4C5A0 50%, #8B0000 100%)",
    emoji: "📜",
  },
];

function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "'Cormorant Garamond', serif",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(2rem, 5vw, 4rem)",
          fontFamily: "'Playfair Display', serif",
          fontWeight: 900,
          background: "linear-gradient(135deg, #C9A84C, #FFE89D, #C9A84C)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: 8,
          letterSpacing: "-0.02em",
        }}
      >
        Chess Arena
      </h1>
      <Link 
        key={"/game"} 
        to={"/game"}
        style={{
          textDecoration: "none",
          marginBottom: 32,
        }}
      >
        <button 
          style={{
            padding: "15px 50px",
            fontSize: "1.2rem",
            backgroundColor: "#C9A84C",
            color: "#000",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
            transition: "all 0.3s ease",
            boxShadow: "0 8px 24px rgba(201, 168, 76, 0.3)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFE89D";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 32px rgba(201, 168, 76, 0.5)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#C9A84C";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(201, 168, 76, 0.3)";
          }}
        >
          🎮 Start Playing
        </button>
      </Link>
      <p
        style={{
          fontSize: "1.15rem",
          color: "#888",
          marginBottom: 48,
          fontStyle: "italic",
          letterSpacing: "0.05em",
        }}
      >
        Choose your battlefield — 5 unique experiences
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
          maxWidth: 1200,
          width: "100%",
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
              background: "#141418",
              border: "1px solid #222",
              transition: "all 0.3s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform =
                "translateY(-6px)";
              (e.currentTarget as HTMLElement).style.borderColor = "#444";
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 20px 40px rgba(0,0,0,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform =
                "translateY(0)";
              (e.currentTarget as HTMLElement).style.borderColor = "#222";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <div
              style={{
                height: 120,
                background: t.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
              }}
            >
              {t.emoji}
            </div>
            <div style={{ padding: "20px 24px" }}>
              <h2
                style={{
                  fontSize: "1.4rem",
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700,
                  marginBottom: 8,
                  margin: 0,
                }}
              >
                {t.name}
              </h2>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#888",
                  margin: "8px 0 0",
                  lineHeight: 1.5,
                }}
              >
                {t.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
