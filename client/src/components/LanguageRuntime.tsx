import { useEffect } from "react";
import { HKTUBE_LANGUAGES, applyHkLanguage, applyHkTheme } from "@/components/ThemeManager";

const LANGUAGE_KEY = "hktube-language-code";
const THEME_KEY = "hktube-theme";

function readLanguage() {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(LANGUAGE_KEY) || "en";
  return HKTUBE_LANGUAGES.some(item => item.code === stored) ? stored : "en";
}

function syncPreferences() {
  const language = readLanguage();
  applyHkLanguage(language);
  const theme = localStorage.getItem(THEME_KEY) || "violet";
  applyHkTheme(theme);
  document.documentElement.dataset.hktubeLanguage = language;
}

export function LanguageRuntime() {
  useEffect(() => {
    let scheduled = false;
    const sync = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        syncPreferences();
      });
    };

    syncPreferences();
    window.addEventListener("hktube-language-change", sync);
    window.addEventListener("hktube-theme-change", sync);
    window.addEventListener("storage", sync);

    const observer = new MutationObserver(() => sync());
    observer.observe(document.body, { childList: true, subtree: true, attributes: false });

    return () => {
      observer.disconnect();
      window.removeEventListener("hktube-language-change", sync);
      window.removeEventListener("hktube-theme-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return null;
}
