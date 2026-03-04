import { describe, it, expect } from "bun:test";
import { join, resolve } from "node:path";
import { walkSourceFiles } from "../src/sourceWalker";

const fixturesDir = join(import.meta.dir, "fixtures", "source-walker");
const monorepoDir = join(import.meta.dir, "fixtures", "monorepo-workspaces");

function p(relative: string): string {
  return resolve(fixturesDir, relative);
}

describe("sourceWalker - static imports", () => {
  it("collects files reachable via static relative imports", () => {
    const entry = p("entry.ts");
    const files = walkSourceFiles(entry);
    const rel = files.map((f) => f.replace(fixturesDir + "/", "")).sort();
    expect(rel).toEqual(["a.ts", "b.ts", "c.ts", "entry.ts"]);
  });
});

describe("sourceWalker - workspace package imports", () => {
  it("includes files imported from workspace packages", () => {
    const entry = resolve(monorepoDir, "packages/app/src/test.tsx");
    const files = walkSourceFiles(entry, { rootDir: monorepoDir });
    const rel = files.map((f) => f.replace(monorepoDir + "/", "")).sort();

    expect(rel).toEqual(["packages/app/src/test.tsx", "packages/common/scripts/header.tsx", "packages/ui/src/button.tsx"].sort());

    expect(files.every((f) => !f.includes("node_modules"))).toBe(true);
  });
});

describe("sourceWalker - dynamic imports", () => {
  it("includes files imported via dynamic import()", () => {
    const entry = p("entry.dynamic.ts");
    const files = walkSourceFiles(entry);
    const rel = files.map((f) => f.replace(fixturesDir + "/", "")).sort();
    expect(rel).toEqual(["dynamicTarget.ts", "entry.dynamic.ts"]);
  });
});

describe("sourceWalker - React.lazy imports", () => {
  it("includes lazily imported components", () => {
    const entry = p("entry.lazy.tsx");
    const files = walkSourceFiles(entry);
    const rel = files.map((f) => f.replace(fixturesDir + "/", "")).sort();
    expect(rel).toEqual(["LazyComponent.tsx", "entry.lazy.tsx"]);
  });
});

