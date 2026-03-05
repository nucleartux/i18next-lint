import ts from "typescript";
import { readFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import type { ImportGraph } from "./sourceWalker";
import { resolveModule } from "./sourceWalker";
import type { Usage } from "./types";

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

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
): Map<string, Set<string>> {
  const sf = parseModule(filePath);
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

  return result;
}

/**
 * For each file, the set of export names that are used by some importer.
 */
export function computeUsedExports(
  files: string[],
  importGraph: ImportGraph,
  rootDir: string,
): Map<string, Set<string>> {
  const usedExports = new Map<string, Set<string>>();
  for (const filePath of files) {
    usedExports.set(filePath, new Set<string>());
  }

  for (const importerPath of files) {
    const usedBindings = getUsedImportBindingsInFile(importerPath, rootDir);
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

  return usedExports;
}

/**
 * List top-level declarations in a file with their line ranges and export names.
 */
export function getDeclarationsInFile(filePath: string): DeclarationInfo[] {
  const sf = parseModule(filePath);
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
 * Which local declaration names does this declaration reference (call or JSX)?
 */
function getReferencedLocalNames(
  filePath: string,
  decl: DeclarationInfo,
  allDeclNames: Set<string>,
): Set<string> {
  const sf = parseModule(filePath);
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
): Map<string, Set<{ lineStart: number; lineEnd: number }>> {
  const result = new Map<string, Set<{ lineStart: number; lineEnd: number }>>();

  for (const filePath of files) {
    const declarations = getDeclarationsInFile(filePath);
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
          const refs = getReferencedLocalNames(filePath, d, allDeclNames);
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
        const refs = getReferencedLocalNames(filePath, d, allDeclNames);
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
 */
export function filterReachableUsages(
  usages: Usage[],
  files: string[],
  entryPaths: string[],
  importGraph: ImportGraph,
  rootDir: string,
): Usage[] {
  const entrySet = new Set(entryPaths);
  const filesSet = new Set(files);
  const usedExports = computeUsedExports(files, importGraph, rootDir);
  const usedDeclarations = computeUsedDeclarations(files, entrySet, usedExports);
  return usages.filter((u) =>
    isUsageReachable(u, usedDeclarations, entrySet, filesSet),
  );
}
