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

/**
 * Resolve a module specifier from a given file. Used by reachability to match imports to resolved paths.
 */
export function resolveModule(
  fromFile: string,
  specifier: string,
  options: { rootDir: string; extensions?: string[] },
): string | null {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  let resolved = resolveRelativeImport(fromFile, specifier, extensions);
  if (!resolved && !specifier.startsWith(".")) {
    const packageResolver = createPackageImportResolver(options.rootDir, extensions, resolveWithExtensions);
    resolved = packageResolver(fromFile, specifier);
  }
  if (resolved && resolved.includes("node_modules")) return null;
  return resolved ?? null;
}

export interface ImportEdge {
  specifier: string;
  line: number;
}

interface SpecWithUsage {
  specifier: string;
  importLine: number;
  /** Local names imported (for finding first usage). Empty for side-effect or re-export. */
  localNames: string[];
  /** Span of the import/export node to exclude when searching for usage. */
  excludeStart: number;
  excludeEnd: number;
}

function getLocalNamesFromImport(stmt: ts.ImportDeclaration): string[] {
  const names: string[] = [];
  if (!stmt.importClause) return names;
  if (stmt.importClause.name) {
    names.push(stmt.importClause.name.text);
  }
  if (stmt.importClause.namedBindings) {
    if (ts.isNamedImports(stmt.importClause.namedBindings)) {
      for (const el of stmt.importClause.namedBindings.elements) {
        names.push(el.name.text);
      }
    } else if (ts.isNamespaceImport(stmt.importClause.namedBindings)) {
      names.push(stmt.importClause.namedBindings.name.text);
    }
  }
  return names;
}

/** Returns the first line (1-based) where any of localNames is used, or undefined if none. */
function getFirstUsageLine(
  sf: ts.SourceFile,
  localNames: Set<string>,
  excludeStart: number,
  excludeEnd: number,
): number | undefined {
  if (localNames.size === 0) return undefined;
  let firstLine: number | undefined;
  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && localNames.has(node.text)) {
      const pos = node.getStart();
      if (pos < excludeStart || pos >= excludeEnd) {
        const { line } = sf.getLineAndCharacterOfPosition(pos);
        const oneBased = line + 1;
        if (firstLine === undefined || oneBased < firstLine) firstLine = oneBased;
      }
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sf, visit);
  return firstLine;
}

function collectModuleSpecifiersWithLines(sf: ts.SourceFile): SpecWithUsage[] {
  const specs: SpecWithUsage[] = [];

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const importLine = sf.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
      const localNames = getLocalNamesFromImport(stmt);
      specs.push({
        specifier: stmt.moduleSpecifier.text,
        importLine,
        localNames,
        excludeStart: stmt.getStart(),
        excludeEnd: stmt.getEnd(),
      });
    } else if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const line = sf.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
      specs.push({
        specifier: stmt.moduleSpecifier.text,
        importLine: line,
        localNames: [],
        excludeStart: stmt.getStart(),
        excludeEnd: stmt.getEnd(),
      });
    }
  }

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      specs.push({
        specifier: node.arguments[0].text,
        importLine: line,
        localNames: [],
        excludeStart: node.getStart(),
        excludeEnd: node.getEnd(),
      });
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sf, visit);

  return specs;
}

export interface ImportGraph {
  /** For each file path, the list of (importer path, line in importer) that import it. The line is the first usage of the import when available, otherwise the import statement line. */
  getImporterEdges(filePath: string): Array<{ importerPath: string; importerLine: number }>;
}

/**
 * Walk the module graph and return files plus an import graph.
 * The graph records for each file the (importer path, line in importer); the line is the first usage of the import when determinable, otherwise the import statement line.
 */
export type SourceFileCache = Map<string, ts.SourceFile>;

export interface WalkResult {
  files: string[];
  importGraph: ImportGraph;
  entryPaths: string[];
  /** Parsed source files from the walk; can be reused to avoid re-parsing. */
  sourceFileCache: SourceFileCache;
}

/**
 * Walk the module graph starting from an entry file and return all reachable
 * source files (including the entry). By default this follows only relative
 * imports. When a rootDir is provided and it is a workspace root, imports
 * that resolve to workspace packages may also be followed.
 */
export function walkSourceFiles(entry: string, options: WalkOptions = {}): WalkResult {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const visited = new Set<string>();
  const queue: string[] = [];
  const entryPaths: string[] = [];
  const graph = new Map<string, Array<{ importerPath: string; importerLine: number }>>();

  const start = resolve(entry);
  if (!existsSync(start) || !statSync(start).isFile()) {
    throw new Error(`Entry file does not exist or is not a file: ${start}`);
  }

  const rootDir = options.rootDir ?? dirname(start);
  const packageResolver = createPackageImportResolver(rootDir, extensions, resolveWithExtensions);

  queue.push(start);
  visited.add(start);
  entryPaths.push(start);

  const sourceFileCache: SourceFileCache = new Map();

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    let sf = sourceFileCache.get(current);
    if (!sf) {
      sf = parseModule(current);
      sourceFileCache.set(current, sf);
    }
    const specs = collectModuleSpecifiersWithLines(sf);

    for (const { specifier, importLine, localNames, excludeStart, excludeEnd } of specs) {
      let resolved = resolveRelativeImport(current, specifier, extensions);

      if (!resolved && !specifier.startsWith(".")) {
        resolved = packageResolver(current, specifier);
      }

      if (!resolved) continue;
      if (resolved.includes("node_modules")) continue;

      const usageLine =
        localNames.length > 0
          ? getFirstUsageLine(sf, new Set(localNames), excludeStart, excludeEnd) ?? importLine
          : importLine;

      if (!graph.has(resolved)) graph.set(resolved, []);
      graph.get(resolved)!.push({ importerPath: current, importerLine: usageLine });

      if (visited.has(resolved)) continue;
      visited.add(resolved);
      queue.push(resolved);
    }
  }

  const importGraph: ImportGraph = {
    getImporterEdges(filePath: string) {
      return graph.get(filePath) ?? [];
    },
  };

  return {
    files: Array.from(visited).sort(),
    importGraph,
    entryPaths,
    sourceFileCache,
  };
}

