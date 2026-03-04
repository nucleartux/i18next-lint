import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve, join, extname } from "node:path";
import ts from "typescript";
import { createPackageImportResolver } from "./workspacePackages";

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export interface WalkOptions {
  /**
   * File extensions considered as source modules.
   * Defaults to .ts, .tsx, .js, .jsx.
   */
  extensions?: string[];

  /**
   * Optional root directory of the project/monorepo. When provided and the
   * directory appears to be a workspace root (has a package.json with
   * workspaces), non-relative imports that resolve to workspace packages
   * may be followed.
   */
  rootDir?: string;
}

function getScriptKind(filePath: string): ts.ScriptKind {
  const ext = extname(filePath);
  switch (ext) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".ts":
      return ts.ScriptKind.TS;
    case ".js":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function parseModule(filePath: string): ts.SourceFile {
  const code = readFileSync(filePath, "utf8");
  return ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
}

function resolveWithExtensions(basePath: string, extensions: string[]): string | null {
  // If basePath already has an extension, try it directly.
  if (extname(basePath)) {
    if (existsSync(basePath) && statSync(basePath).isFile()) {
      return basePath;
    }
  }

  // Try with known extensions.
  for (const ext of extensions) {
    const candidate = basePath + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  // Try index.* resolution (./dir -> ./dir/index.tsx, etc.)
  for (const ext of extensions) {
    const candidate = join(basePath, "index" + ext);
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function resolveRelativeImport(fromFile: string, specifier: string, extensions: string[]): string | null {
  if (!specifier.startsWith(".")) return null;
  const baseDir = dirname(fromFile);
  const raw = resolve(baseDir, specifier);
  return resolveWithExtensions(raw, extensions);
}

function collectModuleSpecifiers(sf: ts.SourceFile): string[] {
  const specs: string[] = [];

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      specs.push(stmt.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      specs.push(stmt.moduleSpecifier.text);
    }
  }

  function visit(node: ts.Node) {
    // Dynamic import('...')
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sf, visit);

  return specs;
}

/**
 * Walk the module graph starting from an entry file and return all reachable
 * source files (including the entry). By default this follows only relative
 * imports. When a rootDir is provided and it is a workspace root, imports
 * that resolve to workspace packages may also be followed.
 */
export function walkSourceFiles(entry: string, options: WalkOptions = {}): string[] {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const visited = new Set<string>();
  const queue: string[] = [];

  const start = resolve(entry);
  if (!existsSync(start) || !statSync(start).isFile()) {
    throw new Error(`Entry file does not exist or is not a file: ${start}`);
  }

  const rootDir = options.rootDir ?? dirname(start);
  const packageResolver = createPackageImportResolver(rootDir, extensions, resolveWithExtensions);

  queue.push(start);
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const sf = parseModule(current);
    const specs = collectModuleSpecifiers(sf);

    for (const spec of specs) {
      let resolved = resolveRelativeImport(current, spec, extensions);

      if (!resolved && !spec.startsWith(".")) {
        resolved = packageResolver(current, spec);
      }

      if (!resolved) continue;
      if (resolved.includes("node_modules")) continue;
      if (visited.has(resolved)) continue;
      visited.add(resolved);
      queue.push(resolved);
    }
  }

  return Array.from(visited).sort();
}

