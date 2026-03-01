import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  Link,
  useLocation,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Chess Arena — 5 Themes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Press+Start+2P&family=VT323&family=Noto+Serif+JP:wght@400;700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap",
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body style={{ margin: 0, padding: 0, minHeight: "100vh" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
