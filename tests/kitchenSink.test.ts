import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "../src/config";
import { analyzeProject } from "../src/analyzeProject";
import { buildMissingKeyChains } from "../src/chainBuilder";

const fixturesRoot = join(import.meta.dir, "fixtures", "kitchen-sink");

describe("kitchen sink integration", () => {
  it("handles mixed simple, plural, context, Trans, and multiple files", () => {
    const configPath = join(fixturesRoot, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    expect(result.missingKeys.sort()).toEqual(["missingPlural", "number_key", "ratings_count"]);
    expect(result.extraKeys.sort()).toEqual(["gender_female", "unused_key_in_kitchen"].sort());
  });

  it("produces correct dependency chains for missing keys", () => {
    const configPath = join(fixturesRoot, "i18next-lint.config.json");
    const [config] = loadConfig(configPath);
    const { result, importGraph, entryPaths } = analyzeProject(config);
    const rootDir = config.rootDir;
    const toRelative = (p: string) => p.replace(rootDir + "/", "").replace(/\\/g, "/");

    const chains = buildMissingKeyChains(result.missingKeyLocations, [{ importGraph, entryPaths }], toRelative);

    expect(result.missingKeys).toContain("missingPlural");
    expect(result.missingKeys).toContain("number_key");
    expect(result.missingKeys).toContain("ratings_count");

    // missingPlural: used in OtherPage.tsx:7, imported by index.tsx
    expect(chains.missingPlural).toHaveLength(1);
    expect(chains.missingPlural![0]).toMatch(/index\.tsx:\d+ -> .*OtherPage\.tsx:7/);

    // number_key: used in utils.ts:4, reached via index -> LazyPage -> utils
    expect(chains.number_key).toHaveLength(1);
    expect(chains.number_key![0]).toMatch(/index\.tsx:\d+ -> .*LazyPage\.tsx:\d+ -> .*utils\.ts:4/);

    // ratings_count: used directly in index.tsx
    expect(chains.ratings_count).toHaveLength(1);
    expect(chains.ratings_count![0]).toMatch(/index\.tsx:26/);
    expect(chains.ratings_count![0]).not.toContain(" -> ");
  });
});

