import type { ImportGraph } from "./sourceWalker";

export type GraphEntry = { importGraph: ImportGraph; entryPaths: string[] };

/**
 * Build the dependency chain from an entry point to (filePath, line).
 * Returns a string like "entry.tsx:5 -> utils.ts:13 -> usage.ts:55".
 * If multiple graph/entry sets are given (e.g. multi-project), tries each until a chain is built.
 */
export function buildLocationChain(
  filePath: string,
  line: number,
  graphs: GraphEntry[],
  toRelative: (absPath: string) => string,
): string {
  for (const { importGraph, entryPaths } of graphs) {
    const entrySet = new Set(entryPaths);
    const chain: Array<{ filePath: string; line: number }> = [{ filePath, line }];
    let current = filePath;

    while (!entrySet.has(current)) {
      const edges = importGraph.getImporterEdges(current);
      if (edges.length === 0) break;
      const first = edges[0];
      chain.unshift({ filePath: first.importerPath, line: first.importerLine });
      current = first.importerPath;
    }

    if (entrySet.has(current) || chain.length > 1) {
      return chain.map(({ filePath: p, line: l }) => `${toRelative(p)}:${l}`).join(" -> ");
    }
  }
  return toRelative(filePath) + ":" + line;
}

export function buildMissingKeyChains(
  missingKeyLocations: Record<string, Array<{ filePath: string; line: number }>>,
  graphs: GraphEntry[],
  toRelative: (absPath: string) => string,
): Record<string, string[]> {
  const chains: Record<string, string[]> = {};
  for (const key of Object.keys(missingKeyLocations)) {
    const locations = missingKeyLocations[key];
    chains[key] = locations.map((loc) => buildLocationChain(loc.filePath, loc.line, graphs, toRelative));
  }
  return chains;
}
