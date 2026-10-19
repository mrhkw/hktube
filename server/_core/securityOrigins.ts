type SecurityOriginEnvironment = {
  ALLOWED_ORIGINS?: string;
  VERCEL_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  NODE_ENV?: string;
};

function currentEnvironment(): SecurityOriginEnvironment {
  return {
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
}

const CANONICAL_ORIGINS = ["https://hktube.vercel.app"];
const LOCAL_DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
];

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeDeploymentUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized = value.trim();
  return normalizeOrigin(/^[a-z][a-z\d+.-]*:\/\//i.test(normalized) ? normalized : `https://${normalized}`);
}

export function configuredSecurityOrigins(
  env: SecurityOriginEnvironment = currentEnvironment(),
): ReadonlySet<string> {
  const configured = [
    ...CANONICAL_ORIGINS,
    ...(env.ALLOWED_ORIGINS ?? "").split(","),
    env.VERCEL_URL ?? "",
    env.VERCEL_PROJECT_PRODUCTION_URL ?? "",
    ...(env.NODE_ENV === "production" ? [] : LOCAL_DEVELOPMENT_ORIGINS),
  ];
  return new Set(configured.map(normalizeDeploymentUrl).filter((origin): origin is string => Boolean(origin)));
}

/** Exact-origin allowlist. Incoming Host/X-Forwarded-* headers are never evidence of trust. */
export function isAllowedSecurityOrigin(
  origin: string,
  env: SecurityOriginEnvironment = currentEnvironment(),
): boolean {
  const normalized = normalizeOrigin(origin);
  return normalized !== null && configuredSecurityOrigins(env).has(normalized);
}
