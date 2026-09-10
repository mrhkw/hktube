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
  applyHkTheme(localStorage.getItem(THEME_KEY) || "violet");
  document.documentElement.dataset.hktubeLanguage = language;
}

export function LanguageRuntime() {
  useEffect(() => {
    syncPreferences();
    const onPreferenceChange = () => syncPreferences();
    window.addEventListener("hktube-language-change", onPreferenceChange);
    window.addEventListener("hktube-language-updated", onPreferenceChange);
    window.addEventListener("hktube-theme-change", onPreferenceChange);
    window.addEventListener("storage", onPreferenceChange);
    // Route changes replace React DOM nodes. Re-apply the selected language periodically
    // so newly rendered pages inherit the same preference without mutating the DOM in a loop.
    const interval = window.setInterval(syncPreferences, 1200);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("hktube-language-change", onPreferenceChange);
      window.removeEventListener("hktube-language-updated", onPreferenceChange);
      window.removeEventListener("hktube-theme-change", onPreferenceChange);
      window.removeEventListener("storage", onPreferenceChange);
    };
  }, []);
  return null;
}
