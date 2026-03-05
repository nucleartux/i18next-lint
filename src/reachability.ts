import ts from "typescript";
import { readFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import type { ImportGraph } from "./sourceWalker";
import { resolveModule } from "./sourceWalker";
import type { Usage } from "./types";

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export type SourceFileCache = Map<string, ts.SourceFile>;

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

function getOrParse(filePath: string, cache: SourceFileCache): ts.SourceFile {
  let sf = cache.get(filePath);
  if (!sf) {
    sf = parseModule(filePath);
    cache.set(filePath, sf);
  }
  return sf;
}

export interface DeclarationInfo {
  name?: string;
  lineStart: number;
  lineEnd: number;
}

/**
 * Which export names (including "default") from each resolved module path are used in this file.
 * Only identifiers that are "references" (not declaration sites) count as used.
 */
function getUsedImportBindingsInFile(
  filePath: string,
  rootDir: string,
  cache: SourceFileCache,
): Map<string, Set<string>> {
  const sf = getOrParse(filePath, cache);
  const result = new Map<string, Set<string>>();
  const usedNames = new Set<string>();

  function isReference(node: ts.Identifier): boolean {
    const parent = node.parent;
    if (!parent) return true;
    if (ts.isImportSpecifier(parent) && parent.name === node) return false;
    if (ts.isImportClause(parent) && parent.name === node) return false;
    if (ts.isNamespaceImport(parent) && parent.name === node) return false;
    if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
    if (ts.isFunctionDeclaration(parent) && parent.name === node) return false;
    if (ts.isClassDeclaration(parent) && parent.name === node) return false;
    if (ts.isParameter(parent) && parent.name === node) return false;
    return true;
  }

  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && isReference(node)) {
      usedNames.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sf, visit);

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause || !stmt.moduleSpecifier) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const specifier = stmt.moduleSpecifier.text;
    const resolved = resolveModule(filePath, specifier, { rootDir, extensions: DEFAULT_EXTENSIONS });
    if (!resolved) continue;

    const usedFromThisImport = new Set<string>();
    if (stmt.importClause.name) {
      if (usedNames.has(stmt.importClause.name.text)) {
        usedFromThisImport.add("default");
      }
    }
    if (stmt.importClause.namedBindings) {
      if (ts.isNamedImports(stmt.importClause.namedBindings)) {
        for (const el of stmt.importClause.namedBindings.elements) {
          const exportName = el.propertyName ? el.propertyName.text : el.name.text;
          if (usedNames.has(el.name.text)) {
            usedFromThisImport.add(exportName);
          }
        }
      } else if (ts.isNamespaceImport(stmt.importClause.namedBindings)) {
        if (usedNames.has(stmt.importClause.namedBindings.name.text)) {
          usedFromThisImport.add("*");
        }
      }
    }
    if (usedFromThisImport.size > 0) {
      const existing = result.get(resolved) ?? new Set<string>();
      usedFromThisImport.forEach((n) => existing.add(n));
      result.set(resolved, existing);
    }
  }

  collectDynamicImportBindings(sf, filePath, rootDir, usedNames, result, cache);
  return result;
}

/**
 * Detect dynamic import patterns and add used exports when the assigned variable is used.
 * - Any call(fn) where fn contains import("./Page"): variable used → all exports of Page ("*").
 * - Any callback that returns .then(c => c.Bar) or (await import("./Page")).Bar: variable used → only Bar.
 */
function collectDynamicImportBindings(
  sf: ts.SourceFile,
  filePath: string,
  rootDir: string,
  usedNames: Set<string>,
  result: Map<string, Set<string>>,
  cache: SourceFileCache,
): void {
  function resolveSpec(spec: string): string | null {
    const resolved = resolveModule(filePath, spec, { rootDir, extensions: DEFAULT_EXTENSIONS });
    return resolved && !resolved.includes("node_modules") ? resolved : null;
  }

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const varName = node.name.text;
      if (!usedNames.has(varName)) {
        ts.forEachChild(node, visit);
        return;
      }
      const init = node.initializer;
      if (ts.isCallExpression(init) && init.arguments.length >= 1) {
        const arg0 = init.arguments[0];
        const namedExport = getNamedExportFromDynamicImportCallback(arg0);
        if (namedExport) {
          const { specifier, exportName } = namedExport;
          const resolved = resolveSpec(specifier);
          if (resolved) {
            const set = result.get(resolved) ?? new Set<string>();
            set.add(exportName);
            result.set(resolved, set);
          }
        } else {
          const spec = getImportSpecifierFromCallback(arg0);
          if (spec) {
            const resolved = resolveSpec(spec);
            if (resolved) {
              const set = result.get(resolved) ?? new Set<string>();
              set.add("*");
              result.set(resolved, set);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sf, visit);
}

function getImportSpecifierFromCallback(callback: ts.Node): string | null {
  let spec: string | null = null;
  function walk(n: ts.Node): void {
    if (spec) return;
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      n.arguments.length >= 1 &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      spec = (n.arguments[0] as ts.StringLiteral).text;
      return;
    }
    n.forEachChild(walk);
  }
  walk(callback);
  return spec;
}

function getNamedExportFromDynamicImportCallback(callback: ts.Node): { specifier: string; exportName: string } | null {
  const specifier = getImportSpecifierFromCallback(callback);
  if (!specifier) return null;

  let exportName: string | null = null;
  function walk(n: ts.Node): void {
    if (exportName) return;
    if (ts.isAwaitExpression(n)) {
      const inner = n.expression;
      if (ts.isCallExpression(inner) && inner.expression.kind === ts.SyntaxKind.ImportKeyword) {
        let p: ts.Node | undefined = n.parent;
        if (ts.isParenthesizedExpression(p)) p = p.parent;
        if (p && ts.isPropertyAccessExpression(p) && ts.isIdentifier(p.name)) {
          exportName = p.name.text;
        }
      }
    }
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.name)) {
      const base = n.expression;
      if (ts.isIdentifier(base)) {
        const par = n.parent;
        if (
          par &&
          (ts.isReturnStatement(par) ||
            ts.isArrowFunction(par) ||
            (ts.isPropertyAssignment(par) && par.initializer === n))
        ) {
          exportName = n.name.text;
        }
      }
    }
    n.forEachChild(walk);
  }
  walk(callback);
  if (exportName) return { specifier, exportName };
  return null;
}

/**
 * For each file, the set of export names that are used by some importer.
 */
export function computeUsedExports(
  files: string[],
  importGraph: ImportGraph,
  rootDir: string,
  cache: SourceFileCache,
): Map<string, Set<string>> {
  const usedExports = new Map<string, Set<string>>();
  for (const filePath of files) {
    usedExports.set(filePath, new Set<string>());
  }

  for (const importerPath of files) {
    const usedBindings = getUsedImportBindingsInFile(importerPath, rootDir, cache);
    for (const [resolvedPath, exportNames] of usedBindings) {
      if (!usedExports.has(resolvedPath)) continue;
      const set = usedExports.get(resolvedPath)!;
      for (const name of exportNames) {
        if (name === "*") {
          set.add("default");
          set.add("*");
        } else {
          set.add(name);
        }
      }
    }
  }

  traverseUsedExportValues(files, usedExports, rootDir, cache);
  return usedExports;
}

/**
 * For a file and export name, return the initializer node of that export (array/object literal or variable ref).
 */
function getExportInitializer(
  filePath: string,
  exportName: string,
  rootDir: string,
  cache: SourceFileCache,
): { node: ts.Node; sf: ts.SourceFile } | null {
  const sf = getOrParse(filePath, cache);
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!isExported) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === exportName && decl.initializer) {
          return { node: decl.initializer, sf };
        }
      }
    }
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) {
        const name = el.propertyName ? el.propertyName.text : el.name.text;
        if (name !== exportName) continue;
        const localName = el.name.text;
        for (const s of sf.statements) {
          if (ts.isVariableStatement(s)) {
            for (const d of s.declarationList.declarations) {
              if (ts.isIdentifier(d.name) && d.name.text === localName && d.initializer) {
                return { node: d.initializer, sf };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * For a local (same-file) variable name, return its initializer node if it's an array or object literal.
 */
function getLocalVariableInitializer(
  filePath: string,
  localName: string,
  cache: SourceFileCache,
): { node: ts.Node; sf: ts.SourceFile } | null {
  const sf = getOrParse(filePath, cache);
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== localName || !decl.initializer) continue;
      const init = decl.initializer;
      if (ts.isArrayLiteralExpression(init) || ts.isObjectLiteralExpression(init)) {
        return { node: init, sf };
      }
      return null;
    }
  }
  return null;
}

/**
 * Resolve identifier to (resolvedFilePath, exportName) if it's an imported binding.
 */
function resolveLocalToImport(
  filePath: string,
  localName: string,
  rootDir: string,
  cache: SourceFileCache,
): { resolvedPath: string; exportName: string } | null {
  const sf = getOrParse(filePath, cache);
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause || !stmt.moduleSpecifier) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const specifier = stmt.moduleSpecifier.text;
    const resolved = resolveModule(filePath, specifier, { rootDir, extensions: DEFAULT_EXTENSIONS });
    if (!resolved) continue;
    if (stmt.importClause.name && stmt.importClause.name.text === localName) {
      return { resolvedPath: resolved, exportName: "default" };
    }
    if (stmt.importClause.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
      for (const el of stmt.importClause.namedBindings.elements) {
        if (el.name.text === localName) {
          const exportName = el.propertyName ? el.propertyName.text : el.name.text;
          return { resolvedPath: resolved, exportName };
        }
      }
    }
  }
  return null;
}

/**
 * Traverse an array/object value and collect any property whose value is a callback containing import(),
 * and any property whose value is an identifier resolving to another module's export (then traverse that).
 */
function traverseValueAndCollectLazy(
  node: ts.Node,
  filePath: string,
  rootDir: string,
  result: Map<string, Set<string>>,
  visited: Set<string>,
  cache: SourceFileCache,
): void {
  const key = `${filePath}:${node.getStart()}`;
  if (visited.has(key)) return;
  visited.add(key);

  function resolveSpec(spec: string): string | null {
    const resolved = resolveModule(filePath, spec, { rootDir, extensions: DEFAULT_EXTENSIONS });
    return resolved && !resolved.includes("node_modules") ? resolved : null;
  }

  if (ts.isArrayLiteralExpression(node)) {
    for (const elem of node.elements) {
      if (elem) traverseValueAndCollectLazy(elem, filePath, rootDir, result, visited, cache);
    }
    return;
  }

  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const value = prop.initializer;
      if (!value) continue;

      const spec = getImportSpecifierFromCallback(value);
      if (spec) {
        const resolved = resolveSpec(spec);
        if (resolved) {
          const set = result.get(resolved) ?? new Set<string>();
          set.add("*");
          result.set(resolved, set);
        }
        continue;
      }

      if (ts.isIdentifier(value)) {
        const resolved = resolveLocalToImport(filePath, value.text, rootDir, cache);
        if (resolved) {
          const init = getExportInitializer(resolved.resolvedPath, resolved.exportName, rootDir, cache);
          if (init) {
            traverseValueAndCollectLazy(init.node, resolved.resolvedPath, rootDir, result, visited, cache);
          }
        } else {
          const localInit = getLocalVariableInitializer(filePath, value.text, cache);
          if (localInit) {
            traverseValueAndCollectLazy(localInit.node, filePath, rootDir, result, visited, cache);
          }
        }
        continue;
      }

      if (ts.isObjectLiteralExpression(value) || ts.isArrayLiteralExpression(value)) {
        traverseValueAndCollectLazy(value, filePath, rootDir, result, visited, cache);
      }
    }
  }
}

/**
 * When an export is used as a value, traverse its initializer to find callbacks containing import()
 * and identifiers that resolve to other exports (nested structures).
 */
function traverseUsedExportValues(
  files: string[],
  usedExports: Map<string, Set<string>>,
  rootDir: string,
  cache: SourceFileCache,
): void {
  const visited = new Set<string>();
  for (const filePath of files) {
    const exportNames = usedExports.get(filePath);
    if (!exportNames) continue;
    for (const exportName of exportNames) {
      if (exportName === "*" || exportName === "default") continue;
      const init = getExportInitializer(filePath, exportName, rootDir, cache);
      if (!init) continue;
      const { node } = init;
      if (ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node)) {
        traverseValueAndCollectLazy(node, filePath, rootDir, usedExports, visited, cache);
      }
    }
  }
}

/**
 * List top-level declarations in a file with their line ranges and export names.
 */
export function getDeclarationsInFile(filePath: string, cache: SourceFileCache): DeclarationInfo[] {
  const sf = getOrParse(filePath, cache);
  const declarations: DeclarationInfo[] = [];

  function getLineRange(node: ts.Node): { lineStart: number; lineEnd: number } {
    const start = node.getStart();
    const end = node.getEnd();
    const { line: lineStart } = sf.getLineAndCharacterOfPosition(start);
    const { line: lineEnd } = sf.getLineAndCharacterOfPosition(end);
    return { lineStart: lineStart + 1, lineEnd: lineEnd + 1 };
  }

  function addDecl(node: ts.Node, name?: string) {
    const { lineStart, lineEnd } = getLineRange(node);
    declarations.push({ name, lineStart, lineEnd });
  }

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt)) {
      const name = stmt.name && ts.isIdentifier(stmt.name) ? stmt.name.text : undefined;
      addDecl(stmt, name);
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const name = ts.isIdentifier(decl.name) ? decl.name.text : undefined;
        addDecl(decl, name);
      }
    } else if (ts.isClassDeclaration(stmt)) {
      const name = stmt.name && ts.isIdentifier(stmt.name) ? stmt.name.text : undefined;
      addDecl(stmt, name);
    } else if (ts.isExportDeclaration(stmt)) {
      continue;
    }
  }

  return declarations;
}

/**
 * Export names for a declaration (the name under which it is exported; "default" for default export).
 */
function getExportNamesOfDeclaration(_filePath: string, decl: DeclarationInfo): Set<string> {
  const names = new Set<string>();
  if (decl.name) names.add(decl.name);
  return names;
}

/**
 * True if this identifier node is a declaration site (name being declared), not a reference.
 */
function isDeclarationSite(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isClassDeclaration(parent) && parent.name === node) return true;
  if (ts.isParameter(parent) && parent.name === node) return true;
  if (ts.isImportSpecifier(parent) && parent.name === node) return true;
  if (ts.isImportClause(parent) && parent.name === node) return true;
  if (ts.isNamespaceImport(parent) && parent.name === node) return true;
  return false;
}

/**
 * Which local declaration names does this declaration reference (call or JSX)?
 */
function getReferencedLocalNames(
  filePath: string,
  decl: DeclarationInfo,
  allDeclNames: Set<string>,
  cache: SourceFileCache,
): Set<string> {
  const sf = getOrParse(filePath, cache);
  const refs = new Set<string>();

  function visit(node: ts.Node) {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    const line1Based = line + 1;
    if (line1Based < decl.lineStart || line1Based > decl.lineEnd) {
      ts.forEachChild(node, visit);
      return;
    }
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && allDeclNames.has(expr.text)) {
        refs.add(expr.text);
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName;
      if (ts.isIdentifier(tagName) && allDeclNames.has(tagName.text)) {
        refs.add(tagName.text);
      }
    }
    // Any identifier used as a value (e.g. argument to a function like withLoaderSuspense(InternalModalContent))
    if (ts.isIdentifier(node) && allDeclNames.has(node.text) && !isDeclarationSite(node)) {
      refs.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return refs;
}

/**
 * For each file, the set of declarations (by name or by line range) that are used.
 * Entry files: all declarations used.
 * Non-entry: used exports + fixpoint of referenced declarations.
 */
export function computeUsedDeclarations(
  files: string[],
  entryPaths: Set<string>,
  usedExports: Map<string, Set<string>>,
  cache: SourceFileCache,
): Map<string, Set<{ lineStart: number; lineEnd: number }>> {
  const result = new Map<string, Set<{ lineStart: number; lineEnd: number }>>();

  for (const filePath of files) {
    const declarations = getDeclarationsInFile(filePath, cache);
    const usedRanges = new Set<{ lineStart: number; lineEnd: number }>();
    const allDeclNames = new Set(declarations.map((d) => d.name).filter(Boolean) as string[]);

    if (entryPaths.has(filePath)) {
      for (const d of declarations) {
        usedRanges.add({ lineStart: d.lineStart, lineEnd: d.lineEnd });
      }
      result.set(filePath, usedRanges);
      continue;
    }

    const usedExportNames = usedExports.get(filePath) ?? new Set<string>();
    let usedNames = new Set<string>();
    if (usedExportNames.has("*")) {
      for (const d of declarations) {
        if (d.name) usedNames.add(d.name);
        usedRanges.add({ lineStart: d.lineStart, lineEnd: d.lineEnd });
      }
    } else {
      for (const d of declarations) {
        const exportNames = getExportNamesOfDeclaration(filePath, d);
        for (const en of exportNames) {
          if (usedExportNames.has(en) || usedExportNames.has("default")) {
            if (d.name) usedNames.add(d.name);
            usedRanges.add({ lineStart: d.lineStart, lineEnd: d.lineEnd });
            break;
          }
        }
      }
    }

    const nameToDecl = new Map<string, DeclarationInfo>();
    for (const d of declarations) {
      if (d.name) nameToDecl.set(d.name, d);
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const d of declarations) {
        if (!d.name) continue;
        if (usedNames.has(d.name)) {
          const refs = getReferencedLocalNames(filePath, d, allDeclNames, cache);
          for (const ref of refs) {
            if (!usedNames.has(ref)) {
              const refDecl = nameToDecl.get(ref);
              if (refDecl) {
                usedNames.add(ref);
                usedRanges.add({ lineStart: refDecl.lineStart, lineEnd: refDecl.lineEnd });
                changed = true;
              }
            }
          }
          continue;
        }
        const refs = getReferencedLocalNames(filePath, d, allDeclNames, cache);
        for (const ref of refs) {
          if (usedNames.has(ref)) {
            usedNames.add(d.name);
            usedRanges.add({ lineStart: d.lineStart, lineEnd: d.lineEnd });
            changed = true;
            break;
          }
        }
      }
    }

    result.set(filePath, usedRanges);
  }

  return result;
}

/**
 * Whether a usage's enclosing declaration is in the used set (or module scope in a reached file).
 */
export function isUsageReachable(
  usage: Usage,
  usedDeclarations: Map<string, Set<{ lineStart: number; lineEnd: number }>>,
  entryPaths: Set<string>,
  files: Set<string>,
): boolean {
  const enc = usage.enclosingDeclaration;
  if (!enc) return true;
  const filePath = enc.filePath;
  if (entryPaths.has(filePath)) return true;
  if (enc.isModule) return files.has(filePath);
  const usedRanges = usedDeclarations.get(filePath);
  if (!usedRanges) return false;
  const line = usage.location.line;
  for (const range of usedRanges) {
    if (line >= range.lineStart && line <= range.lineEnd) return true;
  }
  return false;
}

/**
 * Filter usages to only those in reachable (used) code.
 * If initialCache is provided (e.g. from the source walk), it is reused to avoid re-parsing.
 */
export function filterReachableUsages(
  usages: Usage[],
  files: string[],
  entryPaths: string[],
  importGraph: ImportGraph,
  rootDir: string,
  initialCache?: SourceFileCache,
): Usage[] {
  const entrySet = new Set(entryPaths);
  const filesSet = new Set(files);
  const cache: SourceFileCache = initialCache ?? new Map();
  if (!initialCache) {
    for (const file of files) {
      cache.set(file, parseModule(file));
    }
  }
  const usedExports = computeUsedExports(files, importGraph, rootDir, cache);
  const usedDeclarations = computeUsedDeclarations(files, entrySet, usedExports, cache);
  return usages.filter((u) =>
    isUsageReachable(u, usedDeclarations, entrySet, filesSet),
  );
}
