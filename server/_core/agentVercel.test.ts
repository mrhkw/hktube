import { afterEach, describe, expect, it, vi } from "vitest";
import { __agentVercelInternals, getVercelProjectStatus, listVercelDeployments } from "./agentVercel";

describe("read-only Vercel agent adapter", () => {
  const originalToken = process.env.VERCEL_TOKEN;
  const originalProject = process.env.VERCEL_PROJECT_ID;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalToken === undefined) delete process.env.VERCEL_TOKEN;
    else process.env.VERCEL_TOKEN = originalToken;
    if (originalProject === undefined) delete process.env.VERCEL_PROJECT_ID;
    else process.env.VERCEL_PROJECT_ID = originalProject;
  });

  it("uses the configured HkTube project default and blocks missing credentials", async () => {
    delete process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_PROJECT_ID;
    expect(__agentVercelInternals.DEFAULT_PROJECT_ID).toBe("prj_LL0NmUD6dRdekzY0CKDo4R5ROQ8U");
    await expect(getVercelProjectStatus()).rejects.toMatchObject({ code: "VERCEL_NOT_CONFIGURED" });
  });

  it("returns only safe read-only project metadata", async () => {
    process.env.VERCEL_TOKEN = "test-token";
    process.env.VERCEL_PROJECT_ID = "project_123";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "project_123", name: "hktube", framework: "vite", rootDirectory: null,
      buildCommand: "pnpm build", productionBranch: "main", updatedAt: 1791724328258,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getVercelProjectStatus();
    expect(result).toMatchObject({ status: "VERIFIED", provider: "Vercel", projectName: "hktube", permissions: "read-only" });
    expect(JSON.stringify(result)).not.toContain("test-token");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer test-token" } });
  });

  it("limits deployment queries and returns normalized deployment evidence", async () => {
    process.env.VERCEL_TOKEN = "test-token";
    process.env.VERCEL_PROJECT_ID = "project_123";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      deployments: [{
        uid: "dpl_123", url: "hktube.example.vercel.app", state: "READY", target: "production",
        created: 1791724328258, meta: { githubCommitSha: "abc123", githubCommitRef: "main" },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await listVercelDeployments(1);
    expect(result).toMatchObject({
      status: "VERIFIED", checkedCount: 1, permissions: "read-only",
      deployments: [{ id: "dpl_123", url: "https://hktube.example.vercel.app", state: "READY", target: "production", commitSha: "abc123", branch: "main" }],
    });
    await expect(listVercelDeployments(11)).rejects.toMatchObject({ code: "VERCEL_INVALID_INPUT" });
  });

  it("does not expose provider response bodies on failure", async () => {
    process.env.VERCEL_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private token details", { status: 403 })));
    await expect(getVercelProjectStatus()).rejects.toMatchObject({ code: "VERCEL_REQUEST_FAILED" });
  });
});
