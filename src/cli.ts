#!/usr/bin/env node
import { argv, exit } from "node:process";
import { resolve, relative } from "node:path";
import { loadConfig } from "./config";
import { analyzeProject } from "./analyzeProject";
import type { ProjectAnalysisResult } from "./types";
import type { ResolvedConfig } from "./config";

interface CliArgs {
  configPath?: string;
  json: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = { json: false };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--config" || arg === "-c") {
      const value = args[i + 1];
      if (value && !value.startsWith("-")) {
        result.configPath = value;
        i += 1;
      }
    } else if (arg === "--json") {
      result.json = true;
    }
  }

  return result;
}

function mergeResults(results: ProjectAnalysisResult[]): ProjectAnalysisResult {
  const missingKeysSet = new Set<string>();
  const missingKeyLocations: Record<string, Array<{ filePath: string; line: number }>> = {};
  const missingKeyUsageTypes: Record<string, string> = {};
  const extraKeysSet = new Set<string>();
  const missingKeysByLanguage: Record<string, string[]> = {};
  const extraKeysByLanguage: Record<string, string[]> = {};

  for (const r of results) {
    for (const k of r.missingKeys) {
      missingKeysSet.add(k);
      if (!missingKeyLocations[k]) missingKeyLocations[k] = [];
      missingKeyLocations[k].push(...r.missingKeyLocations[k] ?? []);
      const existing = missingKeyUsageTypes[k];
      const next = r.missingKeyUsageTypes[k];
      missingKeyUsageTypes[k] = existing && next && existing !== next ? `${existing}, ${next}` : (next ?? existing ?? "");
    }
    for (const k of r.extraKeys) extraKeysSet.add(k);
    for (const k of Object.keys(r.missingKeysByLanguage)) {
      if (!missingKeysByLanguage[k]) missingKeysByLanguage[k] = [];
      const seen = new Set(missingKeysByLanguage[k]);
      for (const lang of r.missingKeysByLanguage[k] ?? []) {
        if (!seen.has(lang)) {
          seen.add(lang);
          missingKeysByLanguage[k].push(lang);
        }
      }
    }
    for (const k of Object.keys(r.extraKeysByLanguage)) {
      if (!extraKeysByLanguage[k]) extraKeysByLanguage[k] = [];
      const seen = new Set(extraKeysByLanguage[k]);
      for (const lang of r.extraKeysByLanguage[k] ?? []) {
        if (!seen.has(lang)) {
          seen.add(lang);
          extraKeysByLanguage[k].push(lang);
        }
      }
    }
  }

  const usedKeys = new Set<string>();
  const translationKeys = new Set<string>();
  for (const r of results) {
    for (const k of r.usedKeys) usedKeys.add(k);
    for (const k of r.translationKeys) translationKeys.add(k);
  }

  return {
    missingKeys: [...missingKeysSet],
    missingKeyLocations,
    missingKeyUsageTypes,
    extraKeys: [...extraKeysSet],
    missingKeysByLanguage,
    extraKeysByLanguage,
    usedKeys,
    translationKeys,
  };
}

function printHumanReadable(
  missingKeys: string[],
  missingKeyLocations: Record<string, Array<{ filePath: string; line: number }>>,
  missingKeyUsageTypes: Record<string, string>,
  extraKeys: string[],
  missingKeysByLanguage: Record<string, string[]>,
  extraKeysByLanguage: Record<string, string[]>,
  projectTitle?: string,
): void {
  if (missingKeys.length === 0 && extraKeys.length === 0) {
    if (projectTitle) {
      // eslint-disable-next-line no-console
      console.log(`\n${projectTitle}`);
      // eslint-disable-next-line no-console
      console.log("No missing or extra translation keys.");
    } else {
      // eslint-disable-next-line no-console
      console.log("No missing or extra translation keys.");
    }
    return;
  }

  if (projectTitle) {
    // eslint-disable-next-line no-console
    console.log(`\n${projectTitle}`);
  }
  // eslint-disable-next-line no-console
  console.log("i18next-lint report:");

  if (missingKeys.length > 0) {
    // eslint-disable-next-line no-console
    console.log("\nMissing keys:");
    for (const key of missingKeys) {
      const languages = missingKeysByLanguage[key];
      const langList = languages?.length ? ` (missing in: ${languages.join(", ")})` : "";
      const usageLabel = missingKeyUsageTypes[key] ? ` — "${missingKeyUsageTypes[key]}"` : "";
      // eslint-disable-next-line no-console
      console.log(`  - ${key}${usageLabel}${langList}`);
      const locations = missingKeyLocations[key];
      if (locations?.length) {
        for (const loc of locations) {
          // eslint-disable-next-line no-console
          console.log(`      ${loc.filePath}:${loc.line}`);
        }
      }
    }
  }

  if (extraKeys.length > 0) {
    // eslint-disable-next-line no-console
    console.log("\nExtra keys:");
    for (const key of extraKeys) {
      const languages = extraKeysByLanguage[key];
      const langList = languages?.length ? ` (extra in: ${languages.join(", ")})` : "";
      // eslint-disable-next-line no-console
      console.log(`  - ${key}${langList}`);
    }
  }
}

function projectTitle(config: ResolvedConfig, index: number, total: number): string {
  const label = config.entry[0] ? relative(config.rootDir, config.entry[0]) : `Project ${index + 1}`;
  return total > 1 ? `Project ${index + 1}: ${label}` : "";
}

async function main(): Promise<void> {
  const args = parseArgs(argv.slice(2));
  const configPath = args.configPath
    ? resolve(args.configPath)
    : resolve("i18next-lint.config.json");

  let configs;
  try {
    configs = loadConfig(configPath);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Failed to load config from ${configPath}:`, e);
    exit(1);
  }

  const results = configs.map((c) => analyzeProject(c));
  const merged = mergeResults(results);
  const rootDir = configs[0].rootDir;

  const locationsRelativeToRoot: Record<string, Array<{ filePath: string; line: number }>> = {};
  for (const key of Object.keys(merged.missingKeyLocations)) {
    locationsRelativeToRoot[key] = merged.missingKeyLocations[key].map((loc) => ({
      filePath: relative(rootDir, loc.filePath),
      line: loc.line,
    }));
  }

  if (args.json) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          missingKeys: merged.missingKeys,
          missingKeyLocations: locationsRelativeToRoot,
          missingKeyUsageTypes: merged.missingKeyUsageTypes,
          extraKeys: merged.extraKeys,
          missingKeysByLanguage: merged.missingKeysByLanguage,
          extraKeysByLanguage: merged.extraKeysByLanguage,
        },
        null,
        2,
      ),
    );
  } else {
    if (configs.length > 1) {
      results.forEach((result, i) => {
        const title = projectTitle(configs[i], i, configs.length);
        const relLocations: Record<string, Array<{ filePath: string; line: number }>> = {};
        for (const key of Object.keys(result.missingKeyLocations)) {
          relLocations[key] = result.missingKeyLocations[key].map((loc) => ({
            filePath: relative(rootDir, loc.filePath),
            line: loc.line,
          }));
        }
        printHumanReadable(
          result.missingKeys,
          relLocations,
          result.missingKeyUsageTypes,
          result.extraKeys,
          result.missingKeysByLanguage,
          result.extraKeysByLanguage,
          title,
        );
      });
    } else {
      printHumanReadable(
        merged.missingKeys,
        locationsRelativeToRoot,
        merged.missingKeyUsageTypes,
        merged.extraKeys,
        merged.missingKeysByLanguage,
        merged.extraKeysByLanguage,
      );
    }
  }

  const hasIssues = merged.missingKeys.length > 0 || merged.extraKeys.length > 0;
  exit(hasIssues ? 1 : 0);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

