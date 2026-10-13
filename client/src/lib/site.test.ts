import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  canonicalUrl,
  canonicalUrlFromLocation,
  DEFAULT_SITE_ORIGIN,
  normalizeSiteOrigin,
  PUBLIC_SITEMAP_ROUTES,
  renderRobotsTxt,
  renderSitemapXml,
  resolveSiteOrigin,
  RETIRED_SITE_HOSTS,
} from "@shared/site";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../../..");

/** Retired hosts are referenced only through this constant, never as a literal. */
const RETIRED_HOST = RETIRED_SITE_HOSTS[0];
const RETIRED_ORIGIN = `https://${RETIRED_HOST}`;

describe("site origin normalisation", () => {
  it("accepts a bare https origin and ignores a trailing slash", () => {
    expect(normalizeSiteOrigin("https://hktube.vercel.app")).toBe("https://hktube.vercel.app");
    expect(normalizeSiteOrigin("https://hktube.vercel.app/")).toBe("https://hktube.vercel.app");
    expect(normalizeSiteOrigin("  http://localhost:3000  ")).toBe("http://localhost:3000");
  });

  it("rejects values that would corrupt every canonical URL built from them", () => {
    expect(normalizeSiteOrigin(undefined)).toBeUndefined();
    expect(normalizeSiteOrigin("")).toBeUndefined();
    expect(normalizeSiteOrigin("hktube.vercel.app")).toBeUndefined();
    expect(normalizeSiteOrigin(`${DEFAULT_SITE_ORIGIN}/path`)).toBeUndefined();
    expect(normalizeSiteOrigin(`${DEFAULT_SITE_ORIGIN}/?source=pwa`)).toBeUndefined();
    expect(normalizeSiteOrigin(`${DEFAULT_SITE_ORIGIN}#top`)).toBeUndefined();
    expect(normalizeSiteOrigin("javascript:alert(1)")).toBeUndefined();
    expect(normalizeSiteOrigin(42)).toBeUndefined();
  });

  it("prefers SITE_URL, then APP_URL, then the production default", () => {
    expect(resolveSiteOrigin({ SITE_URL: "https://staging.example.com" })).toBe("https://staging.example.com");
    expect(resolveSiteOrigin({ APP_URL: "https://preview.example.com" })).toBe("https://preview.example.com");
    expect(resolveSiteOrigin({ SITE_URL: "https://staging.example.com", APP_URL: "https://preview.example.com" })).toBe(
      "https://staging.example.com"
    );
    // An unusable SITE_URL must not block a usable APP_URL.
    expect(resolveSiteOrigin({ SITE_URL: "not a url", APP_URL: "https://preview.example.com" })).toBe(
      "https://preview.example.com"
    );
    expect(resolveSiteOrigin({})).toBe(DEFAULT_SITE_ORIGIN);
    expect(resolveSiteOrigin(undefined)).toBe(DEFAULT_SITE_ORIGIN);
  });
});

describe("canonical URLs", () => {
  it("builds absolute URLs for site-relative paths", () => {
    expect(canonicalUrl()).toBe(`${DEFAULT_SITE_ORIGIN}/`);
    expect(canonicalUrl("/")).toBe(`${DEFAULT_SITE_ORIGIN}/`);
    expect(canonicalUrl("/watch/12")).toBe(`${DEFAULT_SITE_ORIGIN}/watch/12`);
    expect(canonicalUrl("shorts")).toBe(`${DEFAULT_SITE_ORIGIN}/shorts`);
  });

  it("drops the fragment but keeps a query that identifies the resource", () => {
    expect(canonicalUrlFromLocation("https://hktube.vercel.app/watch/12#comments")).toBe(
      "https://hktube.vercel.app/watch/12"
    );
    expect(canonicalUrlFromLocation("https://hktube.vercel.app/search?q=cats")).toBe(
      "https://hktube.vercel.app/search?q=cats"
    );
    // A malformed value is returned untouched rather than publishing a bad URL.
    expect(canonicalUrlFromLocation("not-a-url")).toBe("not-a-url");
  });
});

describe("crawler-facing files", () => {
  it("ships a sitemap that matches the shared route list", () => {
    const shipped = readFileSync(path.join(repoRoot, "client/public/sitemap.xml"), "utf8");
    expect(shipped).toBe(renderSitemapXml(DEFAULT_SITE_ORIGIN));
  });

  it("ships a robots.txt that matches the shared renderer", () => {
    const shipped = readFileSync(path.join(repoRoot, "client/public/robots.txt"), "utf8");
    expect(shipped).toBe(renderRobotsTxt(DEFAULT_SITE_ORIGIN));
  });

  it("points every sitemap entry at the production origin", () => {
    const xml = renderSitemapXml(DEFAULT_SITE_ORIGIN);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    expect(locs).toHaveLength(PUBLIC_SITEMAP_ROUTES.length);
    for (const loc of locs) expect(loc.startsWith(`${DEFAULT_SITE_ORIGIN}/`)).toBe(true);
  });

  it("keeps owner-only and account surfaces out of the sitemap", () => {
    const xml = renderSitemapXml(DEFAULT_SITE_ORIGIN);
    for (const privateRoute of ["/admin", "/studio", "/settings", "/wallet", "/algorithm", "/auth", "/delete-account"]) {
      expect(xml).not.toContain(`>${DEFAULT_SITE_ORIGIN}${privateRoute}<`);
    }
  });
});

/**
 * The regression guard. `hkw.vercel.app` was hard-coded across the canonical
 * link, share tags, sitemap, and robots.txt, which told search engines the real
 * HkTube pages lived on a host the project does not serve. This walks every
 * crawler-facing source file and fails if a retired host comes back.
 */
describe("retired host guard", () => {
  const TEXT_EXTENSIONS = new Set([".html", ".txt", ".xml", ".json", ".js", ".ts", ".tsx", ".css", ".svg", ".webmanifest"]);

  function walk(dir: string, collected: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(full, collected);
      } else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
        collected.push(full);
      }
    }
    return collected;
  }

  const crawlerFacingFiles = [
    path.join(repoRoot, "client/index.html"),
    ...walk(path.join(repoRoot, "client/public")),
    ...walk(path.join(repoRoot, "client/src")).filter(file => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx")),
  ].filter(file => existsSync(file) && file !== fileURLToPath(import.meta.url));

  it("scans the real crawler-facing surface", () => {
    // Guards against the guard silently scanning nothing after a refactor.
    expect(crawlerFacingFiles.length).toBeGreaterThan(20);
    expect(crawlerFacingFiles).toContain(path.join(repoRoot, "client/index.html"));
    expect(crawlerFacingFiles).toContain(path.join(repoRoot, "client/public/sitemap.xml"));
    expect(crawlerFacingFiles).toContain(path.join(repoRoot, "client/public/robots.txt"));
  });

  it("never names a retired host", () => {
    const offenders: string[] = [];
    for (const file of crawlerFacingFiles) {
      const contents = readFileSync(file, "utf8");
      if (contents.includes(RETIRED_HOST)) offenders.push(path.relative(repoRoot, file));
    }
    expect(offenders).toEqual([]);
  });

  it("never declares a retired host as the canonical origin", () => {
    const offenders: string[] = [];
    for (const file of crawlerFacingFiles) {
      const contents = readFileSync(file, "utf8");
      if (contents.includes(`canonical" href="${RETIRED_ORIGIN}`)) offenders.push(path.relative(repoRoot, file));
    }
    expect(offenders).toEqual([]);
  });
});
