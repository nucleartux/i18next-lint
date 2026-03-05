import { parentPort, workerData } from "node:worker_threads";
import { analyzeProject } from "./analyzeProject";
import type { ResolvedConfig } from "./config";
import type { ImportGraph } from "./sourceWalker";

export interface SerializedAnalyzeProjectResult {
  result: {
    missingKeys: string[];
    missingKeyLocations: Record<string, Array<{ filePath: string; line: number }>>;
    missingKeyUsageTypes: Record<string, string>;
    extraKeys: string[];
    missingKeysByLanguage: Record<string, string[]>;
    extraKeysByLanguage: Record<string, string[]>;
    usedKeys: string[];
    translationKeys: string[];
  };
  graphData: Record<string, Array<{ importerPath: string; importerLine: number }>>;
  entryPaths: string[];
}

function collectGraphData(
  importGraph: ImportGraph,
  missingKeyLocations: Record<string, Array<{ filePath: string; line: number }>>,
  entryPaths: string[],
): Record<string, Array<{ importerPath: string; importerLine: number }>> {
  const entrySet = new Set(entryPaths);
  let files = new Set<string>();
  for (const locations of Object.values(missingKeyLocations)) {
    for (const loc of locations) {
      files.add(loc.filePath);
    }
  }
  let prevSize = 0;
  while (files.size > prevSize) {
    prevSize = files.size;
    const next = new Set(files);
    for (const file of files) {
      if (entrySet.has(file)) continue;
      const edges = importGraph.getImporterEdges(file);
      for (const e of edges) {
        next.add(e.importerPath);
      }
    }
    files = next;
  }
  const graphData: Record<string, Array<{ importerPath: string; importerLine: number }>> = {};
  for (const file of files) {
    const edges = importGraph.getImporterEdges(file);
    if (edges.length > 0) {
      graphData[file] = edges;
    }
  }
  return graphData;
}

function run(): void {
  const config = workerData?.config as ResolvedConfig | undefined;
  if (!config) {
    parentPort?.postMessage({ error: "Missing config in workerData" });
    return;
  }
  try {
    const { result, importGraph, entryPaths } = analyzeProject(config);
    const graphData = collectGraphData(
      importGraph,
      result.missingKeyLocations,
      entryPaths,
    );
    const payload: SerializedAnalyzeProjectResult = {
      result: {
        missingKeys: result.missingKeys,
        missingKeyLocations: result.missingKeyLocations,
        missingKeyUsageTypes: result.missingKeyUsageTypes,
        extraKeys: result.extraKeys,
        missingKeysByLanguage: result.missingKeysByLanguage,
        extraKeysByLanguage: result.extraKeysByLanguage,
        usedKeys: [...result.usedKeys],
        translationKeys: [...result.translationKeys],
      },
      graphData,
      entryPaths,
    };
    parentPort?.postMessage(payload);
  } catch (err) {
    parentPort?.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
}

run();
