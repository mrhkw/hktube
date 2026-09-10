import { useEffect } from "react";

export const HKTUBE_THEMES = [
  { id: "violet", name: "Violet", accent: "#7c5cff" },
  { id: "blue", name: "Ocean Blue", accent: "#3b82f6" },
  { id: "cyan", name: "Cyan", accent: "#06b6d4" },
  { id: "teal", name: "Teal", accent: "#14b8a6" },
  { id: "green", name: "Emerald", accent: "#10b981" },
  { id: "lime", name: "Lime", accent: "#84cc16" },
  { id: "amber", name: "Amber", accent: "#f59e0b" },
  { id: "orange", name: "Orange", accent: "#f97316" },
  { id: "red", name: "Ruby", accent: "#ef4444" },
  { id: "pink", name: "Pink", accent: "#ec4899" },
  { id: "fuchsia", name: "Fuchsia", accent: "#d946ef" },
  { id: "indigo", name: "Indigo", accent: "#6366f1" },
] as const;

export const HKTUBE_LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
] as const;

export function applyHkTheme(themeId: string) {
  const theme = HKTUBE_THEMES.find(item => item.id === themeId) || HKTUBE_THEMES[0];
  document.documentElement.dataset.hktubeTheme = theme.id;
  document.documentElement.style.setProperty("--hktube-accent", theme.accent);
  document.documentElement.style.setProperty("--hktube-accent-soft", `${theme.accent}22`);
  document.documentElement.style.setProperty("--hktube-accent-ring", `${theme.accent}55`);
  localStorage.setItem("hktube-theme", theme.id);
}

export function applyHkLanguage(code: string) {
  const language = HKTUBE_LANGUAGES.find(item => item.code === code) || HKTUBE_LANGUAGES[0];
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.code === "ur" || language.code === "ar" ? "rtl" : "ltr";
  localStorage.setItem("hktube-language-code", language.code);
  window.dispatchEvent(new CustomEvent("hktube-language-updated", { detail: language.code }));
}

export function ThemeManager() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("hktube-theme") || "violet";
    const savedLanguage = localStorage.getItem("hktube-language-code") || localStorage.getItem("hktube-language")?.slice(0, 2).toLowerCase() || "en";
    applyHkTheme(savedTheme);
    applyHkLanguage(savedLanguage);
  }, []);

  return <style>{`\n    :root { --hktube-accent:#7c5cff; --hktube-accent-soft:#7c5cff22; --hktube-accent-ring:#7c5cff55; }\n    body [class*="bg-violet-500"] { background-color:var(--hktube-accent)!important; }\n    body [class*="text-violet-300"], body [class*="text-violet-200"], body [class*="text-violet-100"] { color:var(--hktube-accent)!important; }\n    body [class*="border-violet-400"], body [class*="border-violet-300"] { border-color:var(--hktube-accent-ring)!important; }\n    body [class*="from-violet-500"] { --tw-gradient-from:var(--hktube-accent)!important; }\n    body [class*="to-violet-600"] { --tw-gradient-to:var(--hktube-accent)!important; }\n    body [class*="focus-visible:border-violet-400"]:focus-visible { border-color:var(--hktube-accent)!important; }\n    [data-hktube-theme="blue"]{}\n  `}</style>;
}
