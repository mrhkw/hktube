export type CredentialField = {
  key: string;
  label: string;
  placeholder: string;
  helper: string;
  secret?: boolean;
  required?: boolean;
  inputMode?: "url" | "text";
};

export type CredentialMode = "api-key" | "oauth" | "mcp" | "webhook";

const API_KEY: CredentialField = {
  key: "apiKey",
  label: "API key / token",
  placeholder: "Paste the service API key or token",
  helper: "Create a least-privileged key in the service's developer or API settings. HkTube encrypts it before storage.",
  secret: true,
  required: true,
};

const OAUTH: CredentialField[] = [
  { key: "clientId", label: "OAuth Client ID", placeholder: "client_id", helper: "Create an OAuth application in the provider developer console.", required: true },
  { key: "clientSecret", label: "OAuth Client Secret", placeholder: "client_secret", helper: "Copy the secret from the same OAuth application. Never paste it into chat.", secret: true, required: true },
];

export function getCredentialMode(auth: string): CredentialMode {
  if (auth === "MCP") return "mcp";
  if (auth === "Webhook") return "webhook";
  if (auth === "OAuth") return "oauth";
  return "api-key";
}

export function getCredentialFields(connectorId: string, auth: string, mode?: CredentialMode): CredentialField[] {
  if (connectorId === "supabase") return [
    { key: "projectUrl", label: "Project URL", placeholder: "https://your-project.supabase.co", helper: "Supabase Dashboard → Project Settings → Data API → Project URL.", inputMode: "url", required: true },
    { key: "apiKey", label: "Supabase API key", placeholder: "sb_secret_… or a least-privileged project key", helper: "Use the least-privileged key required by the agent. Do not use a service-role key unless the task genuinely requires it.", secret: true, required: true },
  ];
  if (connectorId === "cloudflare") return [
    { key: "apiToken", label: "Cloudflare API Token", placeholder: "Paste your scoped Cloudflare API token", helper: "Cloudflare Dashboard → My Profile → API Tokens → Create Token. Prefer scoped API tokens over the legacy global API key.", secret: true, required: true },
    { key: "accountId", label: "Account ID", placeholder: "Optional Cloudflare account ID", helper: "Needed only for account-scoped operations.", required: false },
  ];
  if (connectorId === "vercel") return [
    { key: "token", label: "Vercel Token", placeholder: "Paste your Vercel access token", helper: "Vercel Dashboard → Account Settings → Tokens. Create a token with only the permissions this agent needs.", secret: true, required: true },
    { key: "teamId", label: "Team ID", placeholder: "Optional team ID", helper: "Leave empty when the account's personal scope is enough.", required: false },
  ];
  if (connectorId === "whatsapp") return [
    { key: "accessToken", label: "WhatsApp Cloud API access token", placeholder: "Paste your Meta WhatsApp access token", helper: "Meta for Developers → WhatsApp → API Setup. Use a token with only the permissions required for your WhatsApp Business API workflow.", secret: true, required: true },
    { key: "phoneNumberId", label: "Phone Number ID", placeholder: "123456789012345", helper: "Meta for Developers → WhatsApp → API Setup → Phone number ID.", required: true },
    { key: "businessAccountId", label: "WhatsApp Business Account ID", placeholder: "Optional WABA ID", helper: "Meta Business / WhatsApp Manager. Required for some account-level operations.", required: false },
  ];
  if (connectorId === "github") return [
    { key: "token", label: "GitHub token", placeholder: "github_pat_…", helper: "Use a fine-grained token with the smallest repository permissions required. GitHub treats tokens like passwords.", secret: true, required: true },
  ];
  const resolvedMode = mode ?? getCredentialMode(auth);
  if (resolvedMode === "oauth") return OAUTH;
  if (resolvedMode === "mcp") return [
    { key: "serverUrl", label: "MCP Server URL", placeholder: "https://mcp.example.com", helper: "Use the HTTPS endpoint of the MCP server you control or explicitly trust.", inputMode: "url", required: true },
    { key: "token", label: "MCP token", placeholder: "Optional bearer token", helper: "Only required when the MCP server protects its endpoint with a token.", secret: true, required: false },
  ];
  if (resolvedMode === "webhook") return [
    { key: "webhookUrl", label: "Webhook URL", placeholder: "https://…", helper: "Paste the HTTPS webhook endpoint that should receive provider events.", inputMode: "url", required: true },
    { key: "webhookSecret", label: "Webhook signing secret", placeholder: "Optional signing secret", helper: "Use the provider's signing secret when webhook verification is supported.", secret: true, required: false },
  ];
  return [API_KEY];
}
