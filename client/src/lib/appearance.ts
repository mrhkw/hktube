export type HkTubeAppearance = "light" | "dark";
export type HkTubeColorMode = HkTubeAppearance;

export const HKTUBE_APPEARANCE_KEY = "hktube-appearance";
export const HKTUBE_APPEARANCE_EVENT = "hktube-appearance-change";
const LEGACY_THEME_KEY = "hktube-theme";

export function normalizeHkTubeAppearance(value: string | null | undefined): HkTubeAppearance {
  if (value === "dark" || value === "amoled") return "dark";
  // Previous System/Auto and old accent palettes now use the clean Light mode.
  return "light";
}

export function resolveHkTubeAppearance(appearance: HkTubeAppearance): HkTubeColorMode {
  return appearance;
}

function readStoredAppearance(): HkTubeAppearance {
  if (typeof window === "undefined") return "light";
  try {
    const current = window.localStorage.getItem(HKTUBE_APPEARANCE_KEY);
    if (current !== null) return normalizeHkTubeAppearance(current);
    return normalizeHkTubeAppearance(window.localStorage.getItem(LEGACY_THEME_KEY));
  } catch {
    return "light";
  }
}

export function getHkTubeAppearance(): HkTubeAppearance {
  return readStoredAppearance();
}

function applyAppearanceToDocument(appearance: HkTubeAppearance): HkTubeColorMode {
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.dataset.hktubeAppearance = appearance;
    root.dataset.hktubeMode = appearance;
    root.classList.toggle("dark", appearance === "dark");
    root.style.colorScheme = appearance;
  }
  return appearance;
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

/** Apply the saved Light/Black appearance before React paints and sync other tabs. */
export function initializeHkTubeAppearance(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const appearance = readStoredAppearance();
  try { window.localStorage.setItem(HKTUBE_APPEARANCE_KEY, appearance); } catch { /* storage can be blocked */ }
  publishAppearance(appearance);
  if (initialized) return;
  initialized = true;

  window.addEventListener("storage", event => {
    if (event.key !== HKTUBE_APPEARANCE_KEY && event.key !== null) return;
    const next = event.key === null ? "light" : normalizeHkTubeAppearance(event.newValue);
    publishAppearance(next);
  });
}
