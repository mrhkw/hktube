const OWNER_EMAILS = new Set(["hanifnazamdin30@gmail.com", "hanifnazamdin6@gmail.com"]);

export function isOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(email && OWNER_EMAILS.has(email.trim().toLowerCase()));
}

export const ENV = {
  // OAuth client identifiers and service base URL are public configuration.
  // Keep explicit Vercel variables as the preferred source; the fallback keeps
  // a missing build/runtime public setting from breaking the exchange endpoint.
  appId: process.env.VITE_APP_ID ?? "oW2FhxeMWaMQ3fzfsPSX4q",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "https://api.manus.im",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
