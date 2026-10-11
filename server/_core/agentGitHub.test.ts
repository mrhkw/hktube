import { describe, expect, it } from "vitest";
import { __agentGitHubInternals } from "./agentGitHub";

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
