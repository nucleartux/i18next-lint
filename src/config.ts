import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import fg from "fast-glob";
import { LintConfig, LintConfigFile, PluralStyle, TranslationConfigEntry } from "./types";

export interface ResolvedConfig {
  entry: string[];
  translations: {
    filePath: string;
    pluralStyle: PluralStyle;
  }[];
  contextSeparator: string;
  pluralSeparator: string;
  rootDir: string;
}

function isGlobPattern(str: string): boolean {
  return /[*?\[\]{}]/.test(str);
}

function expandEntrySpec(rootDir: string, spec: string): string[] {
  if (isGlobPattern(spec)) {
    const files = fg.sync(spec, { cwd: rootDir, absolute: true, onlyFiles: true });
    return files;
  }
  const absolute = resolve(rootDir, spec);
  return [absolute];
}

function resolveEntry(rootDir: string, parsed: LintConfig["entry"]): string[] {
  const specs = Array.isArray(parsed) ? parsed : [parsed];
  const resolved: string[] = [];
  for (const spec of specs) {
    if (typeof spec !== "string") {
      throw new Error(`Config entry must be a string or array of strings, got ${typeof spec}`);
    }
    resolved.push(...expandEntrySpec(rootDir, spec));
  }
  if (resolved.length === 0) {
    throw new Error("Config entry matched no files (check paths or glob patterns)");
  }
  return resolved;
}

function normalizeTranslationEntry(entry: string | TranslationConfigEntry): TranslationConfigEntry {
  if (typeof entry === "string") {
    return { file: entry, plurals: "simple" };
  }
  return {
    file: entry.file,
    plurals: entry.plurals ?? "simple",
  };
}

function resolveOneProject(rootDir: string, parsed: LintConfig): ResolvedConfig {
  if (parsed.entry === undefined || parsed.entry === null) {
    throw new Error("Config missing required field: entry");
  }
  if (!parsed.translations || !Array.isArray(parsed.translations) || parsed.translations.length === 0) {
    throw new Error("Config missing required field: translations (non-empty array)");
  }

  const contextSeparator = parsed.contextSeparator ?? "_";
  const pluralSeparator = parsed.pluralSeparator ?? "_";

  const entry = resolveEntry(rootDir, parsed.entry);
  const normalizedTranslations = parsed.translations.map(normalizeTranslationEntry);

  return {
    entry,
    translations: normalizedTranslations.map((t) => ({
      filePath: resolve(rootDir, t.file),
      pluralStyle: t.plurals ?? "simple",
    })),
    contextSeparator,
    pluralSeparator,
    rootDir,
  };
}

export function loadConfig(configPath: string): ResolvedConfig[] {
  const absolutePath = resolve(configPath);
  const raw = readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw) as LintConfigFile;

  const rootDir = dirname(absolutePath);
  const projects = Array.isArray(parsed) ? parsed : [parsed];

  if (projects.length === 0) {
    throw new Error("Config must be a non-empty object or array of project configs");
  }

  return projects.map((p) => resolveOneProject(rootDir, p));
}

