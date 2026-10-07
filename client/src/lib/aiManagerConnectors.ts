export type ConnectorCategory = "AI" | "Communication" | "Content" | "Data" | "Developer" | "Finance" | "Marketing" | "Productivity" | "Storage" | "Infrastructure" | "Automation";

export type ConnectorDefinition = {
  id: string;
  name: string;
  category: ConnectorCategory;
  auth: "OAuth" | "API Key" | "MCP" | "Webhook" | "OAuth/API" | "OAuth/API Key" | "OAuth/MCP" | "OAuth/Bot";
  capabilities: string[];
  agentUses: string[];
  status: "available" | "setup-required";
};

const C = (id: string, name: string, category: ConnectorCategory, auth: ConnectorDefinition["auth"], capabilities: string[], agentUses: string[] = capabilities) => ({
  id, name, category, auth, capabilities, agentUses, status: "setup-required" as const,
});

export const AI_MANAGER_CONNECTORS: ConnectorDefinition[] = [
  C("gmail", "Gmail", "Communication", "OAuth", ["email", "threads", "search", "labels"], ["search and summarize mail", "draft approved replies"]),
  C("google-drive", "Google Drive", "Storage", "OAuth", ["files", "folders", "search", "permissions"], ["find and manage approved files"]),
  C("google-docs", "Google Docs", "Productivity", "OAuth", ["documents", "content", "comments"], ["read and update approved documents"]),
  C("google-sheets", "Google Sheets", "Data", "OAuth", ["spreadsheets", "cells", "ranges"], ["read and update approved spreadsheet data"]),
  C("google-calendar", "Google Calendar", "Productivity", "OAuth", ["calendars", "events", "attendees"], ["read and manage approved events"]),
  C("github", "GitHub", "Developer", "OAuth/MCP", ["repositories", "issues", "pull requests", "code", "actions", "releases"], ["inspect code", "review PRs", "create/update issues", "run verified development workflows"]),
  C("gitlab", "GitLab", "Developer", "OAuth/API Key", ["repositories", "issues", "merge requests", "CI/CD"], ["review code", "manage issues and merge requests"]),
  C("bitbucket", "Bitbucket", "Developer", "OAuth/API Key", ["repositories", "pull requests", "pipelines"], ["inspect repositories", "review pull requests"]),
  C("vercel", "Vercel", "Infrastructure", "OAuth/API Key", ["projects", "deployments", "logs", "domains", "environment configuration"], ["inspect deployments", "diagnose failures", "manage approved deployment workflows"]),
  C("supabase", "Supabase", "Infrastructure", "OAuth/API Key", ["database", "Auth", "Storage", "Edge Functions", "logs"], ["audit schema", "inspect data safely", "verify backend state"]),
  C("cloudflare", "Cloudflare", "Infrastructure", "API Key", ["DNS", "Workers", "R2", "analytics"], ["inspect infrastructure", "manage approved configuration"]),
  C("aws", "AWS", "Infrastructure", "API Key", ["cloud resources", "IAM-scoped services", "logs"], ["inspect resources", "run approved infrastructure tasks"]),
  C("s3", "Amazon S3", "Storage", "API Key", ["buckets", "objects", "metadata"], ["upload/download/manage approved objects"]),
  C("r2", "Cloudflare R2", "Storage", "API Key", ["buckets", "objects", "metadata"], ["manage media and storage objects"]),
  C("slack", "Slack", "Communication", "OAuth", ["channels", "messages", "threads", "events"], ["read authorized conversations", "send approved messages", "react to events"]),
  C("discord", "Discord", "Communication", "OAuth/Bot", ["servers", "channels", "messages", "events"], ["read authorized channels", "send approved messages"]),
  C("telegram", "Telegram", "Communication", "API Key", ["bots", "messages", "webhooks"], ["send bot messages", "process bot events"]),
  C("teams", "Microsoft Teams", "Communication", "OAuth", ["teams", "channels", "messages", "events"], ["read authorized conversations", "send approved messages"]),
  C("outlook-email", "Outlook Email", "Communication", "OAuth", ["mail", "threads", "folders"], ["search and summarize mail", "draft approved replies"]),
  C("outlook-calendar", "Outlook Calendar", "Productivity", "OAuth", ["events", "calendars"], ["read and manage approved events"]),
  C("notion", "Notion", "Productivity", "OAuth", ["pages", "databases", "comments"], ["search knowledge", "create/update approved pages"]),
  C("linear", "Linear", "Productivity", "OAuth", ["issues", "projects", "comments", "cycles"], ["triage work", "create/update issues"]),
  C("jira", "Jira", "Productivity", "OAuth/API Key", ["issues", "projects", "comments", "workflows"], ["triage and update approved issues"]),
  C("trello", "Trello", "Productivity", "OAuth/API Key", ["boards", "lists", "cards"], ["organize and update tasks"]),
  C("asana", "Asana", "Productivity", "OAuth", ["tasks", "projects", "teams"], ["manage approved tasks"]),
  C("clickup", "ClickUp", "Productivity", "OAuth/API Key", ["tasks", "spaces", "lists"], ["manage approved work"]),
  C("monday", "Monday.com", "Productivity", "OAuth/API Key", ["boards", "items", "updates"], ["manage approved work"]),
  C("airtable", "Airtable", "Data", "OAuth/API Key", ["bases", "tables", "records"], ["query and update approved records"]),
  C("dropbox", "Dropbox", "Storage", "OAuth", ["files", "folders", "search"], ["find and manage approved files"]),
  C("onedrive", "OneDrive", "Storage", "OAuth", ["files", "folders", "search"], ["find and manage approved files"]),
  C("sharepoint", "SharePoint", "Storage", "OAuth", ["sites", "files", "lists"], ["search and manage authorized content"]),
  C("box", "Box", "Storage", "OAuth", ["files", "folders", "search"], ["find and manage approved files"]),
  C("figma", "Figma", "Productivity", "OAuth", ["files", "comments", "design metadata"], ["inspect design context", "manage supported comments"]),
  C("youtube", "YouTube", "Content", "OAuth", ["channels", "videos", "playlists", "comments", "analytics"], ["research channel performance", "manage supported content", "review comments"]),
  C("instagram", "Instagram", "Content", "OAuth", ["media", "comments", "insights"], ["manage supported professional content", "review engagement"]),
  C("facebook", "Facebook", "Content", "OAuth", ["Pages", "posts", "comments", "insights"], ["manage supported Page content", "moderate supported interactions"]),
  C("tiktok", "TikTok", "Content", "OAuth", ["account/content data", "publishing where approved", "analytics where approved"], ["research performance", "manage only API-approved creator actions"]),
  C("x", "X", "Content", "OAuth/API Key", ["posts", "replies", "search", "account data"], ["research and manage API-approved content"]),
  C("linkedin", "LinkedIn", "Content", "OAuth", ["profile/Page content", "publishing where approved", "analytics"], ["manage API-approved professional content"]),
  C("reddit", "Reddit", "Content", "OAuth", ["posts", "comments", "moderation/data where approved"], ["research communities", "manage API-approved content"]),
  C("pinterest", "Pinterest", "Content", "OAuth", ["pins", "boards", "analytics"], ["manage API-approved content"]),
  C("stripe", "Stripe", "Finance", "OAuth/API Key", ["customers", "products", "subscriptions", "payments"], ["inspect and manage only approved financial operations"]),
  C("paypal", "PayPal", "Finance", "OAuth/API Key", ["account and payment APIs"], ["run approved payment operations"]),
  C("shopify", "Shopify", "Commerce", "OAuth", ["products", "orders", "customers", "store data"], ["manage approved store operations"]),
  C("wordpress", "WordPress", "Content", "OAuth/API Key", ["posts", "pages", "media", "comments"], ["publish/update approved content"]),
  C("resend", "Resend", "Communication", "API Key", ["email", "domains", "templates", "delivery"], ["send approved transactional email", "inspect delivery"]),
  C("twilio", "Twilio", "Communication", "API Key", ["messaging", "webhooks"], ["send approved notifications", "process events"]),
  C("hubspot", "HubSpot", "Marketing", "OAuth", ["CRM", "contacts", "deals", "tickets"], ["research and update approved CRM data"]),
  C("salesforce", "Salesforce", "Marketing", "OAuth", ["leads", "contacts", "opportunities", "cases"], ["research and update approved CRM data"]),
  C("zendesk", "Zendesk", "Communication", "OAuth/API Key", ["tickets", "users", "support data"], ["triage support work"]),
  C("google-analytics", "Google Analytics", "Marketing", "OAuth", ["reports", "properties", "events"], ["generate verified analytics reports"]),
  C("search-console", "Google Search Console", "Marketing", "OAuth", ["search performance", "sites", "queries"], ["audit SEO/search performance"]),
  C("zapier", "Zapier", "Automation", "OAuth/API Key", ["workflows", "webhooks", "app actions"], ["trigger approved automations"]),
  C("make", "Make", "Automation", "OAuth/API Key", ["scenarios", "webhooks", "automation"], ["run approved workflows"]),
  C("mcp", "MCP Server", "AI", "MCP", ["remote tools", "resources", "prompts"], ["discover and call authorized tools"]),
  C("rest-api", "Custom REST API", "AI", "API Key", ["HTTP APIs", "JSON", "webhooks"], ["call user-configured APIs with schema validation"]),
  C("webhook", "Webhook", "Automation", "Webhook", ["event intake", "signed callbacks"], ["react to verified events"]),
  C("browser", "Browser / Live Research", "AI", "OAuth/API Key", ["web research", "page reading", "approved browser actions"], ["research current information", "verify public sources"]),
];

export const CONNECTOR_CATEGORIES = ["All", ...Array.from(new Set(AI_MANAGER_CONNECTORS.map(item => item.category)))];
