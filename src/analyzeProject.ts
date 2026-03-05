import { ResolvedConfig } from "./config";
import { ProjectAnalysisResult, Usage } from "./types";
import { walkSourceFiles, type ImportGraph, type SourceFileCache, type WalkResult } from "./sourceWalker";
import { extractUsagesFromFile } from "./usageExtractor";
import { loadTranslationFiles } from "./translationLoader";
import { analyze } from "./analyzer";
import { filterReachableUsages } from "./reachability";

function mergeWalkResults(walkResults: WalkResult[]): WalkResult {
  const allFiles = new Set<string>();
  const allEntryPaths = new Set<string>();
  const graphMap = new Map<string, Array<{ importerPath: string; importerLine: number }>>();
  const sourceFileCache: SourceFileCache = new Map();

  for (const wr of walkResults) {
    for (const f of wr.files) allFiles.add(f);
    for (const e of wr.entryPaths) allEntryPaths.add(e);
    for (const [path, sf] of wr.sourceFileCache) {
      if (!sourceFileCache.has(path)) sourceFileCache.set(path, sf);
    }
    for (const file of wr.files) {
      const edges = wr.importGraph.getImporterEdges(file);
      if (edges.length > 0) {
        const existing = graphMap.get(file) ?? [];
        for (const edge of edges) {
          if (!existing.some((e) => e.importerPath === edge.importerPath && e.importerLine === edge.importerLine)) {
            existing.push(edge);
          }
        }
        graphMap.set(file, existing);
      }
    }
  }

  const importGraph: ImportGraph = {
    getImporterEdges(filePath: string) {
      return graphMap.get(filePath) ?? [];
    },
  };

  return {
    files: Array.from(allFiles).sort(),
    importGraph,
    entryPaths: Array.from(allEntryPaths),
    sourceFileCache,
  };
}

export interface AnalyzeProjectResult {
  result: ProjectAnalysisResult;
  importGraph: ImportGraph;
  entryPaths: string[];
}

export function analyzeProject(config: ResolvedConfig): AnalyzeProjectResult {
  const walkResults: WalkResult[] = [];
  for (const entry of config.entry) {
    walkResults.push(walkSourceFiles(entry, { rootDir: config.rootDir }));
  }
  const { files, importGraph, entryPaths, sourceFileCache } = mergeWalkResults(walkResults);

  const usages: Usage[] = [];
  for (const file of files) {
    usages.push(
      ...extractUsagesFromFile(file, { contextSeparator: config.contextSeparator }, sourceFileCache),
    );
  }

  const usagesToAnalyze = filterReachableUsages(
    usages,
    files,
    entryPaths,
    importGraph,
    config.rootDir,
    sourceFileCache,
  );

  const translations = loadTranslationFiles(config.translations, config.contextSeparator);

  const result = analyze({
    translations,
    usages: usagesToAnalyze,
    contextSeparator: config.contextSeparator,
    pluralSeparator: config.pluralSeparator,
  });

  return { result, importGraph, entryPaths };
}

