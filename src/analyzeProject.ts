import { ResolvedConfig } from "./config";
import { ProjectAnalysisResult, Usage } from "./types";
import { walkSourceFiles } from "./sourceWalker";
import { extractUsagesFromFile } from "./usageExtractor";
import { loadTranslationFiles } from "./translationLoader";
import { analyze } from "./analyzer";

export function analyzeProject(config: ResolvedConfig): ProjectAnalysisResult {
  const allFiles = new Set<string>();
  for (const entry of config.entry) {
    const files = walkSourceFiles(entry, { rootDir: config.rootDir });
    for (const f of files) allFiles.add(f);
  }
  const files = Array.from(allFiles);

  const usages: Usage[] = [];
  for (const file of files) {
    usages.push(...extractUsagesFromFile(file, { contextSeparator: config.contextSeparator }));
  }

  const translations = loadTranslationFiles(config.translations, config.contextSeparator);

  return analyze({
    translations,
    usages,
    contextSeparator: config.contextSeparator,
    pluralSeparator: config.pluralSeparator,
  });
}

