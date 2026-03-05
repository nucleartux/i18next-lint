import { describe, it, expect } from "bun:test";
import { join } from "node:path";

const projectSimpleExtraRoot = join(import.meta.dir, "fixtures", "project-simple-extra");
const projectWithIssuesRoot = join(import.meta.dir, "fixtures", "project-with-issues");
const projectCleanRoot = join(import.meta.dir, "fixtures", "project-clean");
const multiProjectRoot = join(import.meta.dir, "fixtures", "multi-project");

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(configDir: string, extraArgs: string[] = []): Promise<CliResult> {
  const configPath = join(configDir, "i18next-lint.config.json");
  const proc = Bun.spawn(
    ["bun", "run", "src/cli.ts", "--config", configPath, ...extraArgs],
    {
      cwd: join(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  return { exitCode: proc.exitCode, stdout, stderr };
}

describe("CLI exit codes", () => {
  it("exits with code 1 when there are extra keys", async () => {
    const { exitCode } = await runCli(projectSimpleExtraRoot);
    expect(exitCode).toBe(1);
  });

  it("exits with code 1 when there are missing or extra keys", async () => {
    const { exitCode } = await runCli(projectWithIssuesRoot);
    expect(exitCode).toBe(1);
  });

  it("exits with code 0 when there are no missing or extra keys", async () => {
    const { exitCode } = await runCli(projectCleanRoot);
    expect(exitCode).toBe(0);
  });
});

describe("CLI output", () => {
  it("prints success message when there are no issues", async () => {
    const { stdout, stderr } = await runCli(projectCleanRoot);
    expect(stdout).toContain("No missing or extra translation keys.");
    expect(stderr).toBe("");
  });

  it("prints report header and extra keys for project with extra keys", async () => {
    const { stdout } = await runCli(projectSimpleExtraRoot);
    expect(stdout).toContain("i18next-lint report:");
    expect(stdout).toContain("Extra keys:");
    expect(stdout).toContain("unused_key");
  });

  it("prints report with missing and/or extra keys", async () => {
    const { stdout } = await runCli(projectWithIssuesRoot);
    expect(stdout).toContain("i18next-lint report:");
    expect(stdout).toMatch(/Missing keys:|Extra keys:/);
  });

  it("prints dependency chain for missing keys (entry -> ... -> usage)", async () => {
    const { stdout } = await runCli(projectWithIssuesRoot);
    expect(stdout).toContain("Missing keys:");
    expect(stdout).toMatch(/->/);
  });

  it("outputs valid JSON with --json flag", async () => {
    const { stdout } = await runCli(projectCleanRoot, ["--json"]);
    const data = JSON.parse(stdout);
    expect(data).toHaveProperty("missingKeys");
    expect(data).toHaveProperty("missingKeyLocations");
    expect(data).toHaveProperty("missingKeyChains");
    expect(data).toHaveProperty("missingKeyUsageTypes");
    expect(data).toHaveProperty("extraKeys");
    expect(data).toHaveProperty("missingKeysByLanguage");
    expect(data).toHaveProperty("extraKeysByLanguage");
    expect(Array.isArray(data.missingKeys)).toBe(true);
    expect(Array.isArray(data.extraKeys)).toBe(true);
  });

  it("--json output includes extra keys when present", async () => {
    const { stdout } = await runCli(projectSimpleExtraRoot, ["--json"]);
    const data = JSON.parse(stdout);
    expect(data.extraKeys).toContain("unused_key");
  });

  it("prints config error to stderr when config cannot be loaded", async () => {
    const { exitCode, stdout, stderr } = await runCli(projectCleanRoot, [
      "--config",
      "/nonexistent/i18next-lint.config.json",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Failed to load config");
    expect(stdout).toBe("");
  });

  it("runs multi-project config and reports per-project with titles and merged exit code", async () => {
    const { exitCode, stdout } = await runCli(multiProjectRoot);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("Project 1:");
    expect(stdout).toContain("Project 2:");
    expect(stdout).toContain("extra1");
    expect(stdout).toContain("extra2");
  });

  it("multi-project --json merges results", async () => {
    const { stdout } = await runCli(multiProjectRoot, ["--json"]);
    const data = JSON.parse(stdout);
    expect(data.extraKeys).toContain("extra1");
    expect(data.extraKeys).toContain("extra2");
    expect(data.missingKeys).toEqual([]);
  });
});

