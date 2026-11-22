import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function AppearanceToggle() {
  const { theme, setAppearance, switchable } = useTheme();

  if (!switchable) return null;

  const next = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Switch to dark appearance" : "Switch to light appearance";

  return (
    <button
      type="button"
      onClick={() => setAppearance(next)}
      aria-label={label}
      title={label}
      className="hktube-appearance-toggle grid size-10 shrink-0 place-items-center rounded-full border border-current/10 text-current transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
    >
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
