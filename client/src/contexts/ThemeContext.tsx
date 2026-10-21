import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getHkTubeAppearance,
  HKTUBE_APPEARANCE_EVENT,
  initializeHkTubeAppearance,
  resolveHkTubeAppearance,
  setHkTubeAppearance,
  type HkTubeAppearance,
  type HkTubeColorMode,
} from "@/lib/appearance";

interface ThemeContextType {
  theme: HkTubeColorMode;
  appearance: HkTubeAppearance;
  setAppearance: (appearance: HkTubeAppearance) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: HkTubeAppearance;
  switchable?: boolean;
}

function getSystemPrefersDark(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  switchable = false,
}: ThemeProviderProps) {
  const [appearance, setAppearanceState] = useState<HkTubeAppearance>(
    () => switchable ? getHkTubeAppearance() : defaultTheme,
  );
  const [theme, setTheme] = useState<HkTubeColorMode>(
    () => resolveHkTubeAppearance(switchable ? getHkTubeAppearance() : defaultTheme, getSystemPrefersDark()),
  );

  useEffect(() => {
    initializeHkTubeAppearance();
    const syncAppearance = (event: Event) => {
      const detail = (event as CustomEvent<{ appearance?: HkTubeAppearance; mode?: HkTubeColorMode }>).detail;
      if (detail?.appearance) setAppearanceState(detail.appearance);
      if (detail?.mode) setTheme(detail.mode);
    };
    window.addEventListener(HKTUBE_APPEARANCE_EVENT, syncAppearance);
    return () => window.removeEventListener(HKTUBE_APPEARANCE_EVENT, syncAppearance);
  }, []);

  useEffect(() => {
    if (!switchable) {
      const fixedAppearance = defaultTheme;
      const mode = resolveHkTubeAppearance(fixedAppearance, getSystemPrefersDark());
      document.documentElement.dataset.hktubeAppearance = fixedAppearance;
      document.documentElement.dataset.hktubeMode = mode;
      document.documentElement.classList.toggle("dark", mode === "dark");
      document.documentElement.style.colorScheme = mode;
      setAppearanceState(fixedAppearance);
      setTheme(mode);
    }
  }, [defaultTheme, switchable]);

  const updateAppearance = (value: HkTubeAppearance) => {
    if (!switchable) return;
    setHkTubeAppearance(value);
  };

  const toggleTheme = switchable
    ? () => updateAppearance(theme === "dark" ? "light" : "dark")
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, appearance, setAppearance: updateAppearance, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
