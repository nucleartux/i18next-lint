import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "../src/config";
import { analyzeProject } from "../src/analyzeProject";

const fixturesDeadCode = join(import.meta.dir, "fixtures", "project-dead-code");
const fixturesLazy = join(import.meta.dir, "fixtures", "project-dead-code-lazy");
const fixturesDynamicNamed = join(import.meta.dir, "fixtures", "project-dead-code-dynamic-named");
const fixturesDynamicAwait = join(import.meta.dir, "fixtures", "project-dead-code-dynamic-await");
const fixturesRoutes = join(import.meta.dir, "fixtures", "project-dead-code-routes");
const fixturesDynamicUnused = join(import.meta.dir, "fixtures", "project-dead-code-dynamic-unused");

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

describe("dead code detection - dynamic imports", () => {
  it("lazy(() => import(\"./Page\")): when variable is used, all exports of Page are used", () => {
    const configPath = join(fixturesLazy, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys.sort()).toEqual([]);
  });

  it("lazy(() => import(\"./Page\").then(m => ({ default: m.Bar }))): only Bar from Page is used", () => {
    const configPath = join(fixturesDynamicNamed, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys.sort()).toEqual(["other_key"]);
  });

  it("(await import(\"./Module\")).Bar: when variable is used, only Bar from Module is used", () => {
    const configPath = join(fixturesDynamicAwait, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys.sort()).toEqual(["other_key"]);
  });

  it("route config: entry uses routes (value); routes has lazy and routes: nestedRoutes; all lazy-loaded modules' keys used", () => {
    const configPath = join(fixturesRoutes, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys.sort()).toEqual([]);
  });

  it("lazy(() => import(\"./Page\")) but variable never used: Page is dead, its keys are extra", () => {
    const configPath = join(fixturesDynamicUnused, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys.sort()).toEqual(["page_key"]);
  });
});
