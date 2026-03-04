import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { buildLocationChain, buildMissingKeyChains } from "../src/chainBuilder";
import type { ImportGraph } from "../src/sourceWalker";
import { loadConfig } from "../src/config";
import { analyzeProject } from "../src/analyzeProject";

function createMockGraph(
  edges: Record<string, Array<{ importerPath: string; importerLine: number }>>,
): ImportGraph {
  return {
    getImporterEdges(filePath: string) {
      return edges[filePath] ?? [];
    },
  };
}

describe("chainBuilder - buildLocationChain", () => {
  const toRelative = (p: string) => p.replace(/^\/root\//, "");

  it("returns single location when usage is in an entry file", () => {
    const graph = createMockGraph({});
    const chain = buildLocationChain(
      "/root/entry.tsx",
      10,
      [{ importGraph: graph, entryPaths: ["/root/entry.tsx"] }],
      toRelative,
    );
    expect(chain).toBe("entry.tsx:10");
  });

  it("builds one-hop chain: entry -> file with usage", () => {
    const graph = createMockGraph({
      "/root/utils.ts": [{ importerPath: "/root/entry.tsx", importerLine: 5 }],
    });
    const chain = buildLocationChain(
      "/root/utils.ts",
      20,
      [{ importGraph: graph, entryPaths: ["/root/entry.tsx"] }],
      toRelative,
    );
    expect(chain).toBe("entry.tsx:5 -> utils.ts:20");
  });

  it("builds two-hop chain: entry -> mid -> usage file", () => {
    const graph = createMockGraph({
      "/root/utils.ts": [{ importerPath: "/root/Page.tsx", importerLine: 3 }],
      "/root/Page.tsx": [{ importerPath: "/root/entry.tsx", importerLine: 7 }],
    });
    const chain = buildLocationChain(
      "/root/utils.ts",
      55,
      [{ importGraph: graph, entryPaths: ["/root/entry.tsx"] }],
      toRelative,
    );
    expect(chain).toBe("entry.tsx:7 -> Page.tsx:3 -> utils.ts:55");
  });

  it("builds three-hop chain correctly", () => {
    const graph = createMockGraph({
      "/root/d.ts": [{ importerPath: "/root/c.ts", importerLine: 1 }],
      "/root/c.ts": [{ importerPath: "/root/b.ts", importerLine: 2 }],
      "/root/b.ts": [{ importerPath: "/root/a.ts", importerLine: 3 }],
    });
    const chain = buildLocationChain(
      "/root/d.ts",
      4,
      [{ importGraph: graph, entryPaths: ["/root/a.ts"] }],
      toRelative,
    );
    expect(chain).toBe("a.ts:3 -> b.ts:2 -> c.ts:1 -> d.ts:4");
  });

  it("uses first importer when file has multiple importers", () => {
    const graph = createMockGraph({
      "/root/utils.ts": [
        { importerPath: "/root/CompA.tsx", importerLine: 1 },
        { importerPath: "/root/CompB.tsx", importerLine: 2 },
      ],
    });
    const chain = buildLocationChain(
      "/root/utils.ts",
      10,
      [{ importGraph: graph, entryPaths: ["/root/CompA.tsx", "/root/CompB.tsx"] }],
      toRelative,
    );
    expect(chain).toBe("CompA.tsx:1 -> utils.ts:10");
  });

  it("falls back to single location when file has no importers (not in graph)", () => {
    const graph = createMockGraph({});
    const chain = buildLocationChain(
      "/root/orphan.ts",
      5,
      [{ importGraph: graph, entryPaths: ["/root/entry.tsx"] }],
      toRelative,
    );
    expect(chain).toBe("orphan.ts:5");
  });

  it("tries next graph when first has no path to entry", () => {
    const graph1 = createMockGraph({});
    const graph2 = createMockGraph({
      "/root/utils.ts": [{ importerPath: "/root/entry.tsx", importerLine: 3 }],
    });
    const chain = buildLocationChain(
      "/root/utils.ts",
      10,
      [
        { importGraph: graph1, entryPaths: ["/root/entry.tsx"] },
        { importGraph: graph2, entryPaths: ["/root/entry.tsx"] },
      ],
      toRelative,
    );
    expect(chain).toBe("entry.tsx:3 -> utils.ts:10");
  });
});

describe("chainBuilder - buildMissingKeyChains", () => {
  const toRelative = (p: string) => p.replace(/^\/root\//, "");

  it("returns empty object for no locations", () => {
    const graph = createMockGraph({});
    const chains = buildMissingKeyChains({}, [{ importGraph: graph, entryPaths: ["/root/entry.tsx"] }], toRelative);
    expect(chains).toEqual({});
  });

  it("builds chains for each key and each location", () => {
    const graph = createMockGraph({
      "/root/OtherPage.tsx": [{ importerPath: "/root/index.tsx", importerLine: 3 }],
      "/root/utils.ts": [
        { importerPath: "/root/LazyPage.tsx", importerLine: 3 },
      ],
      "/root/LazyPage.tsx": [{ importerPath: "/root/index.tsx", importerLine: 7 }],
    });
    const missingKeyLocations: Record<string, Array<{ filePath: string; line: number }>> = {
      missingPlural: [{ filePath: "/root/OtherPage.tsx", line: 7 }],
      number_key: [{ filePath: "/root/utils.ts", line: 4 }],
      ratings_count: [{ filePath: "/root/index.tsx", line: 26 }],
    };
    const chains = buildMissingKeyChains(
      missingKeyLocations,
      [{ importGraph: graph, entryPaths: ["/root/index.tsx"] }],
      toRelative,
    );
    expect(chains.missingPlural).toEqual(["index.tsx:3 -> OtherPage.tsx:7"]);
    expect(chains.number_key).toEqual(["index.tsx:7 -> LazyPage.tsx:3 -> utils.ts:4"]);
    expect(chains.ratings_count).toEqual(["index.tsx:26"]);
  });

  it("builds multiple chains per key when key is used in multiple places", () => {
    const graph = createMockGraph({
      "/root/a.ts": [{ importerPath: "/root/entry.tsx", importerLine: 1 }],
      "/root/b.ts": [{ importerPath: "/root/entry.tsx", importerLine: 2 }],
    });
    const missingKeyLocations: Record<string, Array<{ filePath: string; line: number }>> = {
      same_key: [
        { filePath: "/root/a.ts", line: 10 },
        { filePath: "/root/b.ts", line: 20 },
      ],
    };
    const chains = buildMissingKeyChains(
      missingKeyLocations,
      [{ importGraph: graph, entryPaths: ["/root/entry.tsx"] }],
      toRelative,
    );
    expect(chains.same_key).toEqual(["entry.tsx:1 -> a.ts:10", "entry.tsx:2 -> b.ts:20"]);
  });
});

describe("chainBuilder - integration with real project (kitchen-sink)", () => {
  it("produces correct dependency chains for missing keys", () => {
    const fixturesRoot = join(import.meta.dir, "fixtures", "kitchen-sink");
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
