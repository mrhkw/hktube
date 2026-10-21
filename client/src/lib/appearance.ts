export type HkTubeAppearance = "system" | "light" | "dark";
export type HkTubeColorMode = Exclude<HkTubeAppearance, "system">;

export const HKTUBE_APPEARANCE_KEY = "hktube-appearance";
export const HKTUBE_APPEARANCE_EVENT = "hktube-appearance-change";
const LEGACY_THEME_KEY = "hktube-theme";

export function normalizeHkTubeAppearance(value: string | null | undefined): HkTubeAppearance {
  if (value === "light" || value === "dark" || value === "system") return value;
  if (value === "auto" || value === "automatic") return "system";
  // AMOLED was the previous second dark palette; fold it into the one Dark mode.
  if (value === "amoled") return "dark";
  // Old palette ids (violet, blue, cyan, etc.) are no longer separate themes.
  return "system";
}

export function resolveHkTubeAppearance(
  appearance: HkTubeAppearance,
  systemPrefersDark: boolean,
): HkTubeColorMode {
  if (appearance === "system") return systemPrefersDark ? "dark" : "light";
  return appearance;
}

function readStoredAppearance(): HkTubeAppearance {
  if (typeof window === "undefined") return "system";
  try {
    const current = window.localStorage.getItem(HKTUBE_APPEARANCE_KEY);
    if (current !== null) return normalizeHkTubeAppearance(current);
    return normalizeHkTubeAppearance(window.localStorage.getItem(LEGACY_THEME_KEY));
  } catch {
    return "system";
  }
}

export function getHkTubeAppearance(): HkTubeAppearance {
  return readStoredAppearance();
}

function prefersDark(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyAppearanceToDocument(appearance: HkTubeAppearance): HkTubeColorMode {
  const mode = resolveHkTubeAppearance(appearance, prefersDark());
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.dataset.hktubeAppearance = appearance;
    root.dataset.hktubeMode = mode;
    root.classList.toggle("dark", mode === "dark");
    root.style.colorScheme = mode;
  }
  return mode;
}

function publishAppearance(appearance: HkTubeAppearance): void {
  const mode = applyAppearanceToDocument(appearance);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HKTUBE_APPEARANCE_EVENT, {
      detail: { appearance, mode },
    }));
  }
}

export function setHkTubeAppearance(value: HkTubeAppearance): HkTubeAppearance {
  const appearance = normalizeHkTubeAppearance(value);
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(HKTUBE_APPEARANCE_KEY, appearance); } catch { /* storage can be blocked */ }
  }
  publishAppearance(appearance);
  return appearance;
}

let initialized = false;

/** Apply the saved appearance before React paints, and keep System mode in sync. */
export function initializeHkTubeAppearance(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const appearance = readStoredAppearance();
  try { window.localStorage.setItem(HKTUBE_APPEARANCE_KEY, appearance); } catch { /* storage can be blocked */ }
  publishAppearance(appearance);
  if (initialized) return;
  initialized = true;

  window.addEventListener("storage", event => {
    if (event.key !== HKTUBE_APPEARANCE_KEY && event.key !== null) return;
    const next = event.key === null ? "system" : normalizeHkTubeAppearance(event.newValue);
    publishAppearance(next);
  });

  if (typeof window.matchMedia === "function") {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemAppearanceChange = () => {
      if (readStoredAppearance() === "system") publishAppearance("system");
    };
    if (typeof media.addEventListener === "function") media.addEventListener("change", onSystemAppearanceChange);
    else media.addListener(onSystemAppearanceChange);
  }
}
