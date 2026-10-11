import { Buffer } from "node:buffer";

const API = "https://api.github.com";
const DEFAULT_REPOSITORY = "mrhkw/hktube";
const MAX_FILE_BYTES = 80_000;

type GitHubErrorCode = "GITHUB_NOT_CONFIGURED" | "GITHUB_INVALID_INPUT" | "GITHUB_NOT_FOUND" | "GITHUB_REQUEST_FAILED";

export class AgentGitHubError extends Error {
  constructor(readonly code: GitHubErrorCode) {
    super(code);
    this.name = "AgentGitHubError";
  }
}

function configuration() {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repository = (process.env.HKTUBE_GITHUB_REPO || DEFAULT_REPOSITORY).trim();
  const baseBranch = (process.env.HKTUBE_GITHUB_BASE_BRANCH || "main").trim();
  if (!token) throw new AgentGitHubError("GITHUB_NOT_CONFIGURED");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^[A-Za-z0-9._/-]{1,100}$/.test(baseBranch) || baseBranch.includes("..")) {
    throw new AgentGitHubError("GITHUB_INVALID_INPUT");
  }
  return { token, repository, baseBranch };
}

async function request<T>(path: string, init: RequestInit = {}, allowNotFound = false): Promise<T | null> {
  const { token } = configuration();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) {
    if (response.status === 404) throw new AgentGitHubError("GITHUB_NOT_FOUND");
    throw new AgentGitHubError("GITHUB_REQUEST_FAILED");
  }
  return await response.json() as T;
}

function encodePath(path: string) {
  return path.split("/").map(part => encodeURIComponent(part)).join("/");
}

function validatePath(path: string) {
  const normalized = path.trim().replace(/^\/+/, "");
  if (!normalized || normalized.length > 240 || normalized.split("/").some(part => !part || part === "." || part === "..") || /[\\\0\r\n]/.test(normalized)) {
    throw new AgentGitHubError("GITHUB_INVALID_INPUT");
  }
  const lower = normalized.toLowerCase();
  if (
    lower.startsWith(".github/workflows/") ||
    lower === ".github/workflows" ||
    lower.startsWith(".env") ||
    lower.includes("/.env") ||
    lower === "vercel.json" ||
    lower === "package.json" ||
    /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/.test(lower)
  ) {
    throw new AgentGitHubError("GITHUB_INVALID_INPUT");
  }
  return normalized;
}

function validateAgentBranch(branch: string) {
  const value = branch.trim();
  if (!/^ai-agent\/[a-z0-9][a-z0-9-]{1,70}-[a-z0-9]{4,20}$/.test(value)) {
    throw new AgentGitHubError("GITHUB_INVALID_INPUT");
  }
  return value;
}

export async function getRepositoryStatus() {
  const { repository, baseBranch } = configuration();
  const repo = await request<{ full_name: string; private: boolean; default_branch: string; pushed_at: string | null; html_url: string }>(`/repos/${repository}`);
  const ref = await request<{ object: { sha: string; type: string } }>(`/repos/${repository}/git/ref/heads/${encodeURIComponent(baseBranch)}`);
  return {
    status: "VERIFIED",
    repository: repo!.full_name,
    private: repo!.private,
    defaultBranch: repo!.default_branch,
    configuredBaseBranch: baseBranch,
    pushedAt: repo!.pushed_at,
    baseCommit: ref!.object.sha,
    url: repo!.html_url,
  };
}

export async function readRepositoryFile(path: string, ref?: string) {
  const { repository, baseBranch } = configuration();
  const safePath = validatePath(path);
  const safeRef = (ref || baseBranch).trim();
  if (!safeRef || safeRef.length > 100 || safeRef.includes("..") || /[\r\n]/.test(safeRef)) throw new AgentGitHubError("GITHUB_INVALID_INPUT");
  const file = await request<{ type: string; encoding?: string; size?: number; content?: string; path: string; html_url?: string }>(
    `/repos/${repository}/contents/${encodePath(safePath)}?ref=${encodeURIComponent(safeRef)}`,
  );
  if (!file || file.type !== "file" || file.encoding !== "base64" || typeof file.content !== "string" || (file.size ?? 0) > MAX_FILE_BYTES) {
    throw new AgentGitHubError("GITHUB_INVALID_INPUT");
  }
  return {
    status: "VERIFIED",
    repository,
    path: file.path,
    ref: safeRef,
    content: Buffer.from(file.content, "base64").toString("utf8"),
    sizeBytes: file.size ?? Buffer.byteLength(file.content, "base64"),
    url: file.html_url ?? null,
  };
}

export async function createAgentBranch(label: string) {
  const { repository, baseBranch } = configuration();
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "task";
  const ref = await request<{ object: { sha: string } }>(`/repos/${repository}/git/ref/heads/${encodeURIComponent(baseBranch)}`);
  const branch = `ai-agent/${slug}-${Date.now().toString(36)}`;
  await request(`/repos/${repository}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: ref!.object.sha }),
  });
  return { status: "CREATED", repository, branch, baseBranch, baseCommit: ref!.object.sha, executed: true };
}

export async function commitAgentFile(input: { path: string; content: string; branch: string; message: string }) {
  const { repository } = configuration();
  const branch = validateAgentBranch(input.branch);
  const path = validatePath(input.path);
  if (typeof input.content !== "string" || Buffer.byteLength(input.content, "utf8") > MAX_FILE_BYTES) throw new AgentGitHubError("GITHUB_INVALID_INPUT");
  const message = input.message.trim().replace(/[\r\n]+/g, " ").slice(0, 120);
  if (!message) throw new AgentGitHubError("GITHUB_INVALID_INPUT");

  const existing = await request<{ sha?: string; type?: string }>(
    `/repos/${repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
    {},
    true,
  );
  if (existing && existing.type !== "file") throw new AgentGitHubError("GITHUB_INVALID_INPUT");
  const body: Record<string, string> = {
    message,
    content: Buffer.from(input.content, "utf8").toString("base64"),
    branch,
  };
  if (existing?.sha) body.sha = existing.sha;
  const result = await request<{ content?: { path?: string }; commit?: { sha?: string; html_url?: string } }>(
    `/repos/${repository}/contents/${encodePath(path)}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
  if (!result?.commit?.sha) throw new AgentGitHubError("GITHUB_REQUEST_FAILED");
  return { status: "COMMITTED_TO_AGENT_BRANCH", repository, branch, path: result.content?.path ?? path, commit: result.commit.sha, url: result.commit.html_url ?? null, productionChanged: false };
}

export async function openAgentPullRequest(input: { branch: string; title: string; body: string }) {
  const { repository, baseBranch } = configuration();
  const branch = validateAgentBranch(input.branch);
  const title = input.title.trim().replace(/[\r\n]+/g, " ").slice(0, 180);
  const body = input.body.trim().slice(0, 5_000);
  if (!title || !body) throw new AgentGitHubError("GITHUB_INVALID_INPUT");
  const pr = await request<{ number: number; html_url: string; state: string; draft: boolean }>(
    `/repos/${repository}/pulls`,
    { method: "POST", body: JSON.stringify({ title, body, head: branch, base: baseBranch, draft: true }) },
  );
  return { status: "PULL_REQUEST_CREATED", repository, branch, baseBranch, number: pr!.number, url: pr!.html_url, state: pr!.state, draft: pr!.draft, productionChanged: false, requiresHumanReview: true };
}

export const __agentGitHubInternals = { validatePath, validateAgentBranch, MAX_FILE_BYTES };
