const VERCEL_API = "https://api.vercel.com";
const DEFAULT_PROJECT_ID = "prj_LL0NmUD6dRdekzY0CKDo4R5ROQ8U";

type VercelErrorCode = "VERCEL_NOT_CONFIGURED" | "VERCEL_INVALID_INPUT" | "VERCEL_REQUEST_FAILED";

export class AgentVercelError extends Error {
  constructor(readonly code: VercelErrorCode) {
    super(code);
    this.name = "AgentVercelError";
  }
}

function configuration() {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = (process.env.VERCEL_PROJECT_ID || DEFAULT_PROJECT_ID).trim();
  if (!token) throw new AgentVercelError("VERCEL_NOT_CONFIGURED");
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(projectId)) throw new AgentVercelError("VERCEL_INVALID_INPUT");
  return { token, projectId };
}

async function request<T>(path: string): Promise<T> {
  const { token } = configuration();
  const response = await fetch(`${VERCEL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new AgentVercelError("VERCEL_REQUEST_FAILED");
  return await response.json() as T;
}

export async function getVercelProjectStatus() {
  const { projectId } = configuration();
  const project = await request<{
    id: string; name: string; framework?: string | null; rootDirectory?: string | null;
    buildCommand?: string | null; productionBranch?: string | null; updatedAt?: number;
  }>(`/v9/projects/${encodeURIComponent(projectId)}`);
  return {
    status: "VERIFIED",
    provider: "Vercel",
    projectId: project.id,
    projectName: project.name,
    framework: project.framework ?? null,
    rootDirectory: project.rootDirectory ?? null,
    buildCommand: project.buildCommand ?? null,
    productionBranch: project.productionBranch ?? null,
    updatedAt: project.updatedAt ? new Date(project.updatedAt).toISOString() : null,
    permissions: "read-only",
  };
}

export async function listVercelDeployments(limit = 5) {
  const { projectId } = configuration();
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new AgentVercelError("VERCEL_INVALID_INPUT");
  const result = await request<{ deployments?: Array<{
    uid?: string; id?: string; url?: string; state?: string; readyState?: string;
    created?: number; target?: string | null; meta?: Record<string, unknown>;
  }> }>(`/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=${limit}`);
  return {
    status: "VERIFIED",
    projectId,
    checkedCount: (result.deployments ?? []).length,
    deployments: (result.deployments ?? []).map(item => ({
      id: item.uid ?? item.id ?? null,
      url: item.url ? `https://${item.url.replace(/^https?:\/\//, "")}` : null,
      state: item.state ?? item.readyState ?? "UNKNOWN",
      readyState: item.readyState ?? null,
      target: item.target ?? null,
      createdAt: item.created ? new Date(item.created).toISOString() : null,
      commitSha: typeof item.meta?.githubCommitSha === "string" ? item.meta.githubCommitSha : null,
      branch: typeof item.meta?.githubCommitRef === "string" ? item.meta.githubCommitRef : null,
    })),
    permissions: "read-only",
  };
}

export const __agentVercelInternals = { DEFAULT_PROJECT_ID };
