import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "../src/config";
import { analyzeProject } from "../src/analyzeProject";

const fixturesSimpleExtra = join(import.meta.dir, "fixtures", "project-simple-extra");
const fixturesMonorepo = join(import.meta.dir, "fixtures", "monorepo-workspaces");
const fixturesMultiEntry = join(import.meta.dir, "fixtures", "project-multi-entry");

describe("analyzeProject - integration of core pieces", () => {
  it("reports extra keys from translations when there are no usages", () => {
    const configPath = join(fixturesSimpleExtra, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual(["unused_key"]);
  });

  it("follows workspace package imports in a monorepo", () => {
    const configPath = join(fixturesMonorepo, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual([]);
  });

  it("analyzes from multiple entries (array config) with merged file set", () => {
    const configPath = join(fixturesMultiEntry, "i18next-lint.config.entry-array.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    expect(resolved.entry).toHaveLength(2);
    expect(result.missingKeys.sort()).toEqual(["b"]);
    expect(result.extraKeys.sort()).toEqual(["extra_key"]);
  });

  it("analyzes from glob entry pattern", () => {
    const configPath = join(fixturesMultiEntry, "i18next-lint.config.entry-glob.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    expect(resolved.entry.length).toBeGreaterThanOrEqual(1);
    expect(result.missingKeys.sort()).toEqual(["b", "c"]);
    expect(result.extraKeys.sort()).toEqual(["extra_key"]);
  });
});

