import { afterEach, describe, expect, it, vi } from "vitest";
import { __agentGitHubInternals, getRepositorySecurityOverview } from "./agentGitHub";

describe("guarded agent GitHub operations", () => {
  it("allows normal repository source files", () => {
    expect(__agentGitHubInternals.validatePath("server/_core/aiAgent.ts")).toBe("server/_core/aiAgent.ts");
    expect(__agentGitHubInternals.validatePath("drizzle/0001_safe_migration.sql")).toBe("drizzle/0001_safe_migration.sql");
  });

  it("rejects traversal, environment files, workflow files, and package manifests", () => {
    for (const path of ["../.env", ".env.production", "server/../../secret.txt", ".github/workflows/deploy.yml", "package.json", "pnpm-lock.yaml"]) {
      expect(() => __agentGitHubInternals.validatePath(path)).toThrow();
    }
  });

  it("accepts only isolated ai-agent branches for code writes", () => {
    expect(__agentGitHubInternals.validateAgentBranch("ai-agent/fix-upload-abc12345")).toBe("ai-agent/fix-upload-abc12345");
    for (const branch of ["main", "feat/other", "ai-agent/fix", "ai-agent/../../main-abc12345"]) {
      expect(() => __agentGitHubInternals.validateAgentBranch(branch)).toThrow();
    }
  });
});


describe("read-only GitHub security overview", () => {
  const originalToken = process.env.GITHUB_TOKEN;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  });

  it("reports Dependabot and code scanning alerts without returning provider secrets", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        number: 12, html_url: "https://github.com/mrhkw/hktube/security/dependabot/12",
        security_advisory: { summary: "Dependency issue", severity: "high" },
        dependency: { package: { name: "example-package" }, manifest_path: "pnpm-lock.yaml" },
      }]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        number: 4, html_url: "https://github.com/mrhkw/hktube/security/code-scanning/4",
        rule: { id: "js/injection", description: "Potential injection issue", severity: "warning" },
        most_recent_instance: { location: { path: "server/example.ts", start_line: 22 } },
      }]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getRepositorySecurityOverview();
    expect(result.status).toBe("PARTIAL_OR_VERIFIED");
    expect(result.sources.dependabot).toMatchObject({ status: "VERIFIED", openCount: 1, alerts: [{ package: "example-package", severity: "high" }] });
    expect(result.sources.codeScanning).toMatchObject({ status: "VERIFIED", openCount: 1, alerts: [{ ruleId: "js/injection", file: "server/example.ts", line: 22 }] });
    expect(JSON.stringify(result)).not.toContain("test-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not treat inaccessible security alerts as zero vulnerabilities", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret details", { status: 403 })));
    const result = await getRepositorySecurityOverview();
    expect(result.status).toBe("BLOCKED");
    expect(result.sources.dependabot.status).toBe("BLOCKED");
    expect(result.sources.codeScanning.status).toBe("BLOCKED");
    expect(JSON.stringify(result)).not.toContain("secret details");
  });
});
