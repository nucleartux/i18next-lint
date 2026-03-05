import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "../src/config";
import { analyzeProject } from "../src/analyzeProject";

const fixturesDeadCode = join(import.meta.dir, "fixtures", "project-dead-code");

describe("dead code detection", () => {
  it("reports key2 and comp2 as extra when deadCodeDetection is true", () => {
    const configPath = join(fixturesDeadCode, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);
    // fun2 is never called; Comp2 is imported but never used in JSX
    expect(result.extraKeys.sort()).toEqual(["comp2", "key2"]);
    expect(result.missingKeys).toEqual([]);
  });

  it("with deadCodeDetection false, all keys in discovered files are used (no extra)", () => {
    const configPath = join(fixturesDeadCode, "i18next-lint.config.no-dead-code.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);
    expect(result.extraKeys).toEqual([]);
    expect(result.missingKeys).toEqual([]);
  });
});
