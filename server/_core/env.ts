const SUPABASE_PUBLIC_KEY = "sb_publishable__1sh69umIE7vUSobZfp1Tw__D5ud-2S";
const OWNER_EMAILS = new Set(["hanifnazamdin30@gmail.com", "hanifnazamdin6@gmail.com"]);
const firstNonEmpty = (...values: Array<string | undefined>) => values.find(value => Boolean(value?.trim()))?.trim() ?? "";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(email && OWNER_EMAILS.has(email.trim().toLowerCase()));
}

export const ENV = {
  // OAuth client identifiers and service base URL are public configuration.
  // Keep the server auth project aligned with the browser client. A stale
  // SUPABASE_URL from an older deployment can make a valid live Gmail token
  // look unauthorized even though the navbar session is active.
  appId: firstNonEmpty(process.env.VITE_APP_ID, "oW2FhxeMWaMQ3fzfsPSX4q"),
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: firstNonEmpty(process.env.OAUTH_SERVER_URL, "https://api.manus.im"),
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: firstNonEmpty(process.env.GROQ_MODEL, "openai/gpt-oss-20b"),
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiBaseUrl: firstNonEmpty(process.env.OPENAI_BASE_URL, "https://api.openai.com/v1"),
  openAiModel: firstNonEmpty(process.env.OPENAI_MODEL, "gpt-4o-mini"),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // Google’s current OpenAI-compatible Gemini example uses this model. An
  // explicitly configured GEMINI_MODEL still takes precedence.
  geminiModel: firstNonEmpty(process.env.GEMINI_MODEL, "gemini-3.8-flash"),
  supabaseUrl: firstNonEmpty(process.env.VITE_SUPABASE_URL, "https://jpdvunotyykfqmmkhmml.supabase.co"),
  supabaseAnonKey: firstNonEmpty(process.env.VITE_SUPABASE_ANON_KEY, SUPABASE_PUBLIC_KEY),
  supabaseServiceRoleKey: firstNonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY),
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
};
