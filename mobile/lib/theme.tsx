import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DARK_MODE_KEY = "elemetric_dark_mode";

// ── Theme colour palettes ─────────────────────────────────────────────────────

export const darkTheme = {
  isDark: true,
  bg:           "#07152b",
  bgCard:       "rgba(255,255,255,0.04)",
  bgCardBorder: "rgba(255,255,255,0.08)",
  bgInput:      "rgba(255,255,255,0.06)",
  text:         "#ffffff",
  textMuted:    "rgba(255,255,255,0.55)",
  textDim:      "rgba(255,255,255,0.35)",
  brand:        "#f97316",
  accent:       "#f97316",
  success:      "#22c55e",
  danger:       "#ef4444",
  divider:      "rgba(255,255,255,0.07)",
};

export const lightTheme = {
  isDark: false,
  bg:           "#f0f4f8",
  bgCard:       "#ffffff",
  bgCardBorder: "rgba(0,0,0,0.08)",
  bgInput:      "#ffffff",
  text:         "#0b1220",
  textMuted:    "rgba(11,18,32,0.55)",
  textDim:      "rgba(11,18,32,0.35)",
  brand:        "#f97316",
  accent:       "#ea6a0a",
  success:      "#16a34a",
  danger:       "#dc2626",
  divider:      "rgba(0,0,0,0.07)",
};

export type Theme = typeof darkTheme;

// ── Context ───────────────────────────────────────────────────────────────────

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_KEY).then((val) => {
      // Default is dark (null → dark). Only switch if explicitly "false".
      if (val === "false") setIsDark(false);
    });
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem(DARK_MODE_KEY, next ? "true" : "false");
  };

  return (
    <ThemeContext.Provider
      value={{ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme() {
  return useContext(ThemeContext);
}
