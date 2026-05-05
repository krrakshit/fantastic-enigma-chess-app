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
  ocean: {
    name: "ocean",
    label: "Blue",
    lightSquare: "#EAF0F6",
    darkSquare: "#7BA4C7",
    selectedSquare: "rgba(59,130,246,.35)",
    legalMoveIndicator: "rgba(59,130,246,.3)",
    lastMoveHighlight: "rgba(59,130,246,.2)",
    checkHighlight: "rgba(239,68,68,.5)",
    boardBorder: "#3B82F6",
    accent: "#3B82F6",
  },
  classic: {
    name: "classic",
    label: "Brown",
    lightSquare: "#F0D9B5",
    darkSquare: "#B58863",
    selectedSquare: "rgba(217,119,6,.35)",
    legalMoveIndicator: "rgba(0,0,0,.12)",
    lastMoveHighlight: "rgba(255,255,0,.25)",
    checkHighlight: "rgba(239,68,68,.5)",
    boardBorder: "#8B6914",
    accent: "#B58863",
  },
  mono: {
    name: "mono",
    label: "Black",
    lightSquare: "#F0F0F0",
    darkSquare: "#555555",
    selectedSquare: "rgba(0,0,0,.25)",
    legalMoveIndicator: "rgba(0,0,0,.15)",
    lastMoveHighlight: "rgba(0,0,0,.1)",
    checkHighlight: "rgba(239,68,68,.5)",
    boardBorder: "#333333",
    accent: "#555555",
  },
};

const STORAGE_KEY = "chess_board_theme";

export function getSavedTheme(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "ocean";
}

export function saveTheme(themeName: string) {
  localStorage.setItem(STORAGE_KEY, themeName);
}

export function getThemeColors(themeName?: string): BoardThemeColors {
  const name = themeName ?? getSavedTheme();
  return BOARD_THEMES[name] ?? BOARD_THEMES.ocean;
}

/** Get all theme names for the theme picker */
export function getThemeList(): BoardThemeColors[] {
  return Object.values(BOARD_THEMES);
}
