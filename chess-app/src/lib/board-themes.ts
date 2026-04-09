/**
 * Chess Arena — Board Themes
 *
 * Theme definitions for board squares, accents, and UI colors.
 * Persisted in localStorage for guests, DB for logged-in users (via UserPreferences).
 */

export interface BoardThemeColors {
  lightSquare: string;
  darkSquare: string;
  selectedSquare: string;
  legalMoveIndicator: string;
  lastMoveHighlight: string;
  checkHighlight: string;
  boardBorder: string;
  accent: string;
  name: string;
  label: string;
}

export const BOARD_THEMES: Record<string, BoardThemeColors> = {
  emerald: {
    name: "emerald",
    label: "Emerald",
    lightSquare: "#2D3748",
    darkSquare: "#1A202C",
    selectedSquare: "rgba(16,185,129,.35)",
    legalMoveIndicator: "rgba(16,185,129,.3)",
    lastMoveHighlight: "rgba(16,185,129,.15)",
    checkHighlight: "rgba(239,68,68,.5)",
    boardBorder: "#10B981",
    accent: "#10B981",
  },
  classic: {
    name: "classic",
    label: "Classic",
    lightSquare: "#F0D9B5",
    darkSquare: "#B58863",
    selectedSquare: "rgba(255,215,0,.45)",
    legalMoveIndicator: "rgba(0,0,0,.15)",
    lastMoveHighlight: "rgba(255,255,0,.3)",
    checkHighlight: "rgba(239,68,68,.5)",
    boardBorder: "#8B6914",
    accent: "#DAA520",
  },
  ocean: {
    name: "ocean",
    label: "Ocean",
    lightSquare: "#DEE3E6",
    darkSquare: "#8CA2AD",
    selectedSquare: "rgba(59,130,246,.35)",
    legalMoveIndicator: "rgba(59,130,246,.3)",
    lastMoveHighlight: "rgba(59,130,246,.2)",
    checkHighlight: "rgba(239,68,68,.5)",
    boardBorder: "#3B82F6",
    accent: "#3B82F6",
  },
  wood: {
    name: "wood",
    label: "Wood",
    lightSquare: "#E8C99B",
    darkSquare: "#A17A4D",
    selectedSquare: "rgba(217,119,6,.35)",
    legalMoveIndicator: "rgba(217,119,6,.3)",
    lastMoveHighlight: "rgba(217,119,6,.2)",
    checkHighlight: "rgba(239,68,68,.5)",
    boardBorder: "#92400E",
    accent: "#D97706",
  },
  midnight: {
    name: "midnight",
    label: "Midnight",
    lightSquare: "#3D4A5C",
    darkSquare: "#27303F",
    selectedSquare: "rgba(139,92,246,.35)",
    legalMoveIndicator: "rgba(139,92,246,.3)",
    lastMoveHighlight: "rgba(139,92,246,.2)",
    checkHighlight: "rgba(239,68,68,.5)",
    boardBorder: "#8B5CF6",
    accent: "#8B5CF6",
  },
  arctic: {
    name: "arctic",
    label: "Arctic",
    lightSquare: "#E2E8F0",
    darkSquare: "#94A3B8",
    selectedSquare: "rgba(6,182,212,.35)",
    legalMoveIndicator: "rgba(6,182,212,.3)",
    lastMoveHighlight: "rgba(6,182,212,.2)",
    checkHighlight: "rgba(239,68,68,.5)",
    boardBorder: "#06B6D4",
    accent: "#06B6D4",
  },
};

const STORAGE_KEY = "chess_board_theme";

export function getSavedTheme(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "emerald";
}

export function saveTheme(themeName: string) {
  localStorage.setItem(STORAGE_KEY, themeName);
}

export function getThemeColors(themeName?: string): BoardThemeColors {
  const name = themeName ?? getSavedTheme();
  return BOARD_THEMES[name] ?? BOARD_THEMES.emerald;
}

/** Get all theme names for the theme picker */
export function getThemeList(): BoardThemeColors[] {
  return Object.values(BOARD_THEMES);
}
