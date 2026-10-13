/**
 * Canonical site origin plus the crawler-facing route list for HkTube.
 *
 * HkTube is served from `hktube.vercel.app`. Several SEO surfaces used to
 * hard-code an older `hkw.vercel.app` host that HkTube no longer serves, which
 * pointed `<link rel="canonical">`, `og:url`, `og:image`, `robots.txt`, and
 * `sitemap.xml` at a domain the project does not control. A canonical link
 * pointing at a foreign host tells search engines to index that host instead of
 * this one, and social crawlers resolve the share preview against it too.
 *
 * Keeping the origin in one module — and asserting it in
 * `client/src/lib/site.test.ts` — makes that class of drift fail the build
 * instead of shipping silently.
 */

/** Production origin. Mirrored in `client/index.html`, which cannot import TS. */
export const DEFAULT_SITE_ORIGIN = "https://hktube.vercel.app";

/**
 * Hosts HkTube no longer serves. Crawler-facing assets must never name these;
 * the guard test in `client/src/lib/site.test.ts` enforces that.
 */
export const RETIRED_SITE_HOSTS = ["hkw.vercel.app"] as const;

/**
 * Publicly indexable routes, in sitemap order. Authenticated or owner-only
 * surfaces (`/admin`, `/studio`, `/settings`, `/wallet`, `/algorithm`, `/auth`)
 * are deliberately excluded and stay disallowed in `robots.txt`.
 */
export const PUBLIC_SITEMAP_ROUTES = [
  "/",
  "/explore",
  "/shorts",
  "/trending",
  "/about",
  "/contact",
  "/help",
  "/community",
  "/privacy",
  "/terms",
  "/cookies",
  "/advertising",
  "/impressum",
] as const;

/**
 * Accepts a configured origin and returns a bare `scheme://host[:port]` string,
 * or `undefined` when the value is unusable. Anything with a path, query,
 * fragment, or whitespace is rejected rather than silently trimmed, because a
 * malformed origin would corrupt every canonical URL built from it.
 */
export function normalizeSiteOrigin(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  return /^https?:\/\/[^/\s?#]+$/i.test(trimmed) ? trimmed : undefined;
}

/**
 * Resolves the site origin, preferring an explicit `SITE_URL` override over the
 * `APP_URL` value already used for outbound email links. Falls back to the
 * production default when neither is configured.
 */
export function resolveSiteOrigin(env: Record<string, string | undefined> | undefined): string {
  if (!env) return DEFAULT_SITE_ORIGIN;
  return normalizeSiteOrigin(env.SITE_URL) ?? normalizeSiteOrigin(env.APP_URL) ?? DEFAULT_SITE_ORIGIN;
}

let resolvedOrigin: string | undefined;

/**
 * The origin this deployment should advertise. Server-side `SITE_URL`/
 * `APP_URL` win when present; the browser bundle has no `process` object, so
 * the lookup is guarded and falls back to the production default.
 */
export function siteOrigin(): string {
  if (resolvedOrigin) return resolvedOrigin;
  const env = typeof process === "undefined" ? undefined : process.env;
  resolvedOrigin = resolveSiteOrigin(env);
  return resolvedOrigin;
}

/** Absolute URL for a site-relative path. Fragments are never included. */
export function canonicalUrl(pathname = "/"): string {
  const origin = siteOrigin();
  if (!pathname || pathname === "/") return `${origin}/`;
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${path}`;
}

/**
 * Canonical form of a live browser URL. The fragment is dropped because it is
 * never part of the addressable resource and would otherwise leak anchors such
 * as `/watch/123#comments` into `<link rel="canonical">`.
 */
export function canonicalUrlFromLocation(href: string): string {
  try {
    const url = new URL(href);
    url.hash = "";
    return url.toString();
  } catch {
    // Non-absolute or malformed values are returned untouched; the caller keeps
    // its previously rendered canonical rather than publishing a bad one.
    return href;
  }
}

/** Renders `sitemap.xml`. Checked against the shipped file by the guard test. */
export function renderSitemapXml(origin: string = siteOrigin()): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PUBLIC_SITEMAP_ROUTES.map(route => {
      const loc = route === "/" ? `${origin}/` : `${origin}${route}`;
      return `  <url><loc>${loc}</loc></url>`;
    }),
    "</urlset>",
    "",
  ];
  return lines.join("\n");
}

/** Renders `robots.txt`. Checked against the shipped file by the guard test. */
export function renderRobotsTxt(origin: string = siteOrigin()): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /wallet",
    "Disallow: /delete-account",
    "Disallow: /auth",
    "Disallow: /settings",
    "Disallow: /studio",
    "Disallow: /algorithm",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}
