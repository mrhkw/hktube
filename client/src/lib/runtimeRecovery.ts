const RECOVERY_KEY = "hktube-runtime-recovery-v2";
const RECOVERY_WINDOW_MS = 30_000;

type RecoveryRecord = { href: string; at: number };

function readRecoveryRecord(): RecoveryRecord | null {
  try {
    const raw = sessionStorage.getItem(RECOVERY_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<RecoveryRecord>;
    return typeof value.href === "string" && typeof value.at === "number" ? value as RecoveryRecord : null;
  } catch {
    return null;
  }
}

function markRecoveryAttempt() {
  try {
    sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ href: window.location.href, at: Date.now() } satisfies RecoveryRecord));
  } catch {
    // Private browsing/storage restrictions must never become a second client error.
  }
}

export function isLikelyAssetLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /(?:Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|dynamically imported module|preload)/i.test(message);
}

async function clearRuntimeCaches() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith("hktube-shell-")).map(key => caches.delete(key)));
    }
  } catch {
    // Cache cleanup is best effort; the reload still gets a fresh navigation.
  }

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((registrations ?? []).map(registration => registration.unregister()));
  } catch {
    // A browser without Service Worker access can still recover via reload.
  }
}

/**
 * Clears only HkTube's runtime caches and performs at most one recovery reload
 * for the current route. Returning false means the same failure already
 * happened after recovery and must be shown to the error boundary.
 */
export async function recoverFromAssetLoadFailure(): Promise<boolean> {
  const previous = readRecoveryRecord();
  const sameRecentAttempt = previous && previous.href === window.location.href && Date.now() - previous.at < RECOVERY_WINDOW_MS;
  if (sameRecentAttempt) return false;

  markRecoveryAttempt();
  await clearRuntimeCaches();
  window.location.reload();
  return true;
}

export function clearRecoveryMarker() {
  try { sessionStorage.removeItem(RECOVERY_KEY); } catch {}
}
