import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: ResolvedTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const STORAGE_KEY = "hktube-display-theme";

function safeGetThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "system" || stored === "light" || stored === "dark") return stored;
    const legacy = window.localStorage.getItem("theme");
    if (legacy === "light" || legacy === "dark") return legacy;
  } catch {
    // Storage can be blocked by browser privacy settings.
  }
  return "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  switchable = false,
}: {
  children: React.ReactNode;
  defaultTheme?: ResolvedTheme;
  switchable?: boolean;
}) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => switchable ? safeGetThemeMode() : defaultTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const theme: ResolvedTheme = themeMode === "system" ? systemTheme : themeMode;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setSystemTheme(media.matches ? "light" : "dark");
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.themeMode = themeMode;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    document.body?.setAttribute("data-theme-mode", themeMode);
    if (switchable) {
      try { window.localStorage.setItem(STORAGE_KEY, themeMode); } catch {
        // Theme still applies for this session when storage is unavailable.
      }
    }
  }, [theme, themeMode, switchable]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (switchable) {
      try { window.localStorage.setItem(STORAGE_KEY, mode); } catch {
        // Ignore unavailable storage without blocking the UI.
      }
    }
  };
  const toggleTheme = switchable ? () => setThemeMode(theme === "light" ? "dark" : "light") : undefined;

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
