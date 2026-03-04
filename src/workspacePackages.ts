import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface WorkspacePackageMeta {
  name: string;
  dir: string;
  pkgJsonPath: string;
  /**
   * Relative entry candidates inside the package directory.
   * Examples: "src/index.tsx", "src/index", "dist/index.js"
   */
  entryCandidates: string[];
}

export type WorkspacePackageMap = Map<string, WorkspacePackageMeta>;

function readRootPackageJson(rootDir: string): any | null {
  const pkgPath = resolve(rootDir, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const raw = readFileSync(pkgPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractWorkspacePatterns(pkgJson: any): string[] {
  if (!pkgJson || !pkgJson.workspaces) return [];

  const { workspaces } = pkgJson;
  if (Array.isArray(workspaces)) {
    return workspaces.slice();
  }
  if (workspaces && Array.isArray(workspaces.packages)) {
    return workspaces.packages.slice();
  }
  return [];
}

function collectEntryCandidates(pkgJson: any): string[] {
  const candidates: string[] = [];

  const pushIfString = (value: unknown) => {
    if (typeof value === "string") {
      candidates.push(value);
    }
  };

  pushIfString(pkgJson?.source);
  pushIfString(pkgJson?.module);
  pushIfString(pkgJson?.main);

  const exportsField = pkgJson?.exports;
  if (typeof exportsField === "string") {
    candidates.push(exportsField);
  } else if (exportsField && typeof exportsField === "object") {
    const dotExport = (exportsField as Record<string, unknown>)["."];
    pushIfString(dotExport);
  }

  // Deduplicate while preserving order.
  return Array.from(new Set(candidates));
}

function resolveWorkspacePattern(rootDir: string, pattern: string): string[] {
  // Very small subset of globbing:
  // - "<dir>/*" => all direct subdirectories of <dir>
  // - "<dir>" (no wildcard) => that exact directory if it exists
  const hasWildcard = pattern.includes("*");

  if (!hasWildcard) {
    const absDir = resolve(rootDir, pattern);
    if (existsSync(absDir) && statSync(absDir).isDirectory()) {
      return [absDir];
    }
    return [];
  }

  const starIndex = pattern.indexOf("*");
  const basePart = pattern.slice(0, starIndex);
  const baseDir = resolve(rootDir, basePart);

  if (!existsSync(baseDir) || !statSync(baseDir).isDirectory()) {
    return [];
  }

  const result: string[] = [];
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dirPath = join(baseDir, entry.name);
    result.push(dirPath);
  }

  return result;
}

export function loadWorkspacePackages(rootDir: string): WorkspacePackageMap {
  const pkgJson = readRootPackageJson(rootDir);
  const patterns = extractWorkspacePatterns(pkgJson);
  const map: WorkspacePackageMap = new Map();

  if (patterns.length === 0) {
    return map;
  }

  for (const pattern of patterns) {
    const candidateDirs = resolveWorkspacePattern(rootDir, pattern);
    

    for (const dir of candidateDirs) {
      const pkgJsonPath = join(dir, "package.json");
      if (!existsSync(pkgJsonPath) || !statSync(pkgJsonPath).isFile()) {
        continue;
      }

      try {
        const raw = readFileSync(pkgJsonPath, "utf8");
        const parsed = JSON.parse(raw) as any;
        if (!parsed?.name || typeof parsed.name !== "string") {
          continue;
        }


        const entryCandidates = collectEntryCandidates(parsed);

        map.set(parsed.name, {
          name: parsed.name,
          dir,
          pkgJsonPath,
          entryCandidates,
        });
      } catch {
        // Ignore invalid package.json files in workspaces – they won't
        // participate in resolution.
        continue;
      }
    }
  }

  return map;
}

function extractPackageNameAndRest(
  specifier: string,
): { pkgName: string; restPath: string } | null {
  if (!specifier || specifier.startsWith(".")) return null;

  const parts = specifier.split("/");
  if (specifier.startsWith("@")) {
    if (parts.length < 2) return null;
    const pkgName = `${parts[0]}/${parts[1]}`;
    const restPath = parts.slice(2).join("/");
    return { pkgName, restPath };
  }

  const pkgName = parts[0];
  const restPath = parts.slice(1).join("/");
  return { pkgName, restPath };
}

function isPathInside(baseDir: string, candidate: string): boolean {
  const normalizedBase = resolve(baseDir);
  const normalizedCandidate = resolve(candidate);
  return normalizedCandidate === normalizedBase || normalizedCandidate.startsWith(normalizedBase + "/");
}

export function createPackageImportResolver(
  rootDir: string,
  extensions: string[],
  resolveWithExtensions: (basePath: string, extensions: string[]) => string | null,
): (fromFile: string, specifier: string) => string | null {
  const workspacePackages = loadWorkspacePackages(rootDir);
  if (workspacePackages.size === 0) {
    return () => null;
  }

  return function resolvePackageImport(_fromFile: string, specifier: string): string | null {
    const parsed = extractPackageNameAndRest(specifier);
    if (!parsed) return null;

    const info = workspacePackages.get(parsed.pkgName);
    if (!info) return null;

    // If there is a path after the package name, treat it as a file inside the package.
    if (parsed.restPath) {
      // First, try resolving the path relative to the package root, e.g.
      //   "@org/ui/button" -> "<pkgDir>/button.tsx"
      const directBasePath = resolve(info.dir, parsed.restPath);
      const directResolved = resolveWithExtensions(directBasePath, extensions);
      if (directResolved && isPathInside(info.dir, directResolved)) {
        return directResolved;
      }

      // If that fails, fall back to looking under a conventional "src" directory:
      //   "@org/ui/button" -> "<pkgDir>/src/button.tsx"
      const srcBasePath = resolve(info.dir, "src", parsed.restPath);
      const srcResolved = resolveWithExtensions(srcBasePath, extensions);
      if (srcResolved && isPathInside(info.dir, srcResolved)) {
        return srcResolved;
      }

      return null;
    }

    // Bare package import – try known entry candidates, then fall back to src/index.
    for (const rel of info.entryCandidates) {
      const basePath = resolve(info.dir, rel);
      const resolved = resolveWithExtensions(basePath, extensions);
      if (resolved && isPathInside(info.dir, resolved)) {
        return resolved;
      }
    }

    const fallbackBase = join(info.dir, "src", "index");
    const fallbackResolved = resolveWithExtensions(fallbackBase, extensions);
    if (fallbackResolved && isPathInside(info.dir, fallbackResolved)) {
      return fallbackResolved;
    }

    return null;
  };
}

