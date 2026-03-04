import ts from "typescript";
import { readFileSync } from "node:fs";
import { Usage, UsageKind } from "./types";

export interface UsageExtractionOptions {
  contextSeparator: string;
}

function getScriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function createSourceFile(filePath: string, code: string): ts.SourceFile {
  return ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
}

interface ImportInfo {
  useTranslationNames: Set<string>;
  transComponentNames: Set<string>;
  i18nextTFunctionNames: Set<string>;
  i18nextTFunctionTypeNames: Set<string>;
  i18nextDefaultNames: Set<string>;
  reactI18nextDefaultNames: Set<string>;
}

function collectImports(sourceFile: ts.SourceFile): ImportInfo {
  const useTranslationNames = new Set<string>();
  const transComponentNames = new Set<string>();
  const i18nextTFunctionNames = new Set<string>();
  const i18nextTFunctionTypeNames = new Set<string>();
  const i18nextDefaultNames = new Set<string>();
  const reactI18nextDefaultNames = new Set<string>();

  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause || !stmt.moduleSpecifier) continue;
    const moduleName = (stmt.moduleSpecifier as ts.StringLiteral).text;

    if (moduleName === "react-i18next") {
      if (stmt.importClause.name) {
        reactI18nextDefaultNames.add(stmt.importClause.name.text);
      }
      if (stmt.importClause.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
        const named = stmt.importClause.namedBindings;
        for (const el of named.elements) {
          const importedName = el.propertyName ? el.propertyName.text : el.name.text;
          const localName = el.name.text;
          if (importedName === "useTranslation") {
            useTranslationNames.add(localName);
          }
          if (importedName === "Trans") {
            transComponentNames.add(localName);
          }
        }
      }
    } else if (moduleName === "i18next") {
      if (stmt.importClause.name) {
        i18nextDefaultNames.add(stmt.importClause.name.text);
      }
      if (stmt.importClause.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
        const named = stmt.importClause.namedBindings;
        for (const el of named.elements) {
          const importedName = el.propertyName ? el.propertyName.text : el.name.text;
          const localName = el.name.text;
          if (importedName === "t") {
            i18nextTFunctionNames.add(localName);
          }
          if (importedName === "TFunction") {
            i18nextTFunctionTypeNames.add(localName);
          }
        }
      }
    }
  }

  return { useTranslationNames, transComponentNames, i18nextTFunctionNames, i18nextTFunctionTypeNames, i18nextDefaultNames, reactI18nextDefaultNames };
}

function collectTFunctionNamesFromUseTranslation(
  sourceFile: ts.SourceFile,
  useTranslationNames: Set<string>,
): Set<string> {
  const tNames = new Set<string>();

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
      const call = node.initializer;
      if (ts.isIdentifier(call.expression) && useTranslationNames.has(call.expression.text)) {
        if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            const propName = element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text : undefined;
            const localName = ts.isIdentifier(element.name) ? element.name.text : undefined;
            if (propName === "t") {
              if (localName) {
                tNames.add(localName);
              }
            } else if (!propName && localName === "t") {
              tNames.add(localName);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return tNames;
}

/** Returns the function node (arrow or function expr/decl) if the node is a declaration of a callable. */
function getFunctionFromDeclaration(node: ts.Node): ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | undefined {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) {
    return node as ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;
  }
  if (ts.isVariableDeclaration(node) && node.initializer) {
    return getFunctionFromDeclaration(node.initializer);
  }
  return undefined;
}

/** Resolve a callee identifier to the function definition (variable initializer or function decl). */
function resolveCalleeToFunction(
  sourceFile: ts.SourceFile,
  calleeName: string,
): ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | undefined {
  let found: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | undefined;
  function walk(n: ts.Node) {
    if (found) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === calleeName && n.initializer) {
      const fn = getFunctionFromDeclaration(n.initializer);
      if (fn) {
        found = fn;
        return;
      }
    }
    if (ts.isFunctionDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.name.text === calleeName) {
      found = n;
      return;
    }
    ts.forEachChild(n, walk);
  }
  walk(sourceFile);
  return found;
}

/** Get the first parameter name if it's a simple identifier. */
function getFirstParamName(
  fn: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration,
): string | undefined {
  const params = fn.parameters;
  if (params.length === 0) return undefined;
  const first = params[0].name;
  if (ts.isIdentifier(first)) return first.text;
  return undefined;
}

/** Build a set of function nodes whose first parameter is passed a t-function at some call site. */
function collectTParamFunctions(
  sourceFile: ts.SourceFile,
  allTFunctionNames: Set<string>,
  i18nextDefaultNames: Set<string>,
): Map<ts.Node, Set<string>> {
  const fnToTParams = new Map<ts.Node, Set<string>>();

  function isTReference(node: ts.Expression): boolean {
    if (ts.isIdentifier(node)) return allTFunctionNames.has(node.text);
    if (ts.isPropertyAccessExpression(node) && node.name.text === "t") {
      return ts.isIdentifier(node.expression) && i18nextDefaultNames.has(node.expression.text);
    }
    return false;
  }

  function walk(n: ts.Node) {
    if (ts.isCallExpression(n)) {
      const arg0 = n.arguments[0];
      if (arg0 && isTReference(arg0)) {
        const callee = n.expression;
        if (ts.isIdentifier(callee)) {
          const fn = resolveCalleeToFunction(sourceFile, callee.text);
          if (fn) {
            const paramName = getFirstParamName(fn);
            if (paramName) {
              let set = fnToTParams.get(fn);
              if (!set) {
                set = new Set<string>();
                fnToTParams.set(fn, set);
              }
              set.add(paramName);
            }
          }
        }
      }
    }
    ts.forEachChild(n, walk);
  }
  walk(sourceFile);
  return fnToTParams;
}

/** Collect parameter names that are typed as TFunction (from i18next) in each function. */
function collectTParamsFromTFunctionType(
  sourceFile: ts.SourceFile,
  i18nextTFunctionTypeNames: Set<string>,
): Map<ts.Node, Set<string>> {
  const fnToTParams = new Map<ts.Node, Set<string>>();

  function visit(n: ts.Node) {
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n)) {
      const fn = n as ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;
      for (const param of fn.parameters) {
        if (!ts.isIdentifier(param.name)) continue;
        const typeNode = param.type;
        if (typeNode && ts.isTypeReferenceNode(typeNode)) {
          const typeName = typeNode.typeName;
          if (ts.isIdentifier(typeName) && i18nextTFunctionTypeNames.has(typeName.text)) {
            let set = fnToTParams.get(fn);
            if (!set) {
              set = new Set<string>();
              fnToTParams.set(fn, set);
            }
            set.add(param.name.text);
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(sourceFile);
  return fnToTParams;
}

function getStringLiteral(node: ts.Expression | ts.JsxExpression | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isJsxExpression(node) && node.expression && (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression))) {
    return node.expression.text;
  }
  return undefined;
}

function isNumericLiteralExpression(node: ts.Expression | ts.JsxExpression | undefined): boolean {
  if (!node) return false;
  if (ts.isNumericLiteral(node)) return true;
  if (ts.isJsxExpression(node) && node.expression && ts.isNumericLiteral(node.expression)) return true;
  return false;
}

function classifyUsage(
  hasPlural: boolean,
  isStaticPlural: boolean,
  hasContext: boolean,
  isStaticContext: boolean,
): UsageKind {
  if (hasPlural) {
    return isStaticPlural ? "staticPlural" : "dynamicPlural";
  }
  if (hasContext) {
    return isStaticContext ? "staticContext" : "dynamicContext";
  }
  return "simple";
}

export function extractUsagesFromSource(
  code: string,
  filePath: string,
  options: UsageExtractionOptions,
): Usage[] {
  const sourceFile = createSourceFile(filePath, code);
  const { contextSeparator } = options;

  const { useTranslationNames, transComponentNames, i18nextTFunctionNames, i18nextTFunctionTypeNames, i18nextDefaultNames, reactI18nextDefaultNames } = collectImports(sourceFile);
  const tFunctionNamesFromUseTranslation = collectTFunctionNamesFromUseTranslation(sourceFile, useTranslationNames);
  const allTFunctionNames = new Set<string>([...tFunctionNamesFromUseTranslation, ...i18nextTFunctionNames]);
  const fnToTParams = collectTParamFunctions(sourceFile, allTFunctionNames, i18nextDefaultNames);
  const fnToTParamsFromType = collectTParamsFromTFunctionType(sourceFile, i18nextTFunctionTypeNames);

  const usages: Usage[] = [];
  const tParamStack: Set<string>[] = [];

  function addUsage(
    node: ts.Node,
    keyLiteral: string,
    hasPlural: boolean,
    isStaticPlural: boolean,
    hasContext: boolean,
    contextLiteral?: string,
    isStaticContext: boolean = false,
  ) {
    // Do not attempt to infer context from the key string itself.
    // The base is the literal key used in source; context/plural are
    // determined solely from the options/arguments.
    const base = keyLiteral;
    const kind = classifyUsage(hasPlural, isStaticPlural, hasContext, isStaticContext);
    const sf = node.getSourceFile();
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart());
    usages.push({
      base,
      kind,
      contextLiteral,
      hasContext,
      hasPlural,
      location: {
        filePath,
        line: line + 1,
        column: character + 1,
      },
    });
  }

  function isTCall(call: ts.CallExpression): boolean {
    if (ts.isIdentifier(call.expression)) {
      if (allTFunctionNames.has(call.expression.text)) return true;
      for (let i = tParamStack.length - 1; i >= 0; i--) {
        if (tParamStack[i].has(call.expression.text)) return true;
      }
      return false;
    }
    if (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "t") {
      const obj = call.expression.expression;
      return ts.isIdentifier(obj) && (reactI18nextDefaultNames.has(obj.text) || i18nextDefaultNames.has(obj.text));
    }
    return false;
  }

  function getTParamsForFunction(fnNode: ts.Node): Set<string> | undefined {
    const fromCalls = fnToTParams.get(fnNode);
    const fromType = fnToTParamsFromType.get(fnNode);
    if (!fromCalls && !fromType) return undefined;
    const merged = new Set<string>();
    fromCalls?.forEach((name) => merged.add(name));
    fromType?.forEach((name) => merged.add(name));
    return merged.size > 0 ? merged : undefined;
  }

  function visit(node: ts.Node) {
    const fnNode =
      ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) ? node : undefined;
    const tParams = fnNode ? getTParamsForFunction(fnNode) : undefined;
    if (tParams && tParams.size > 0) {
      tParamStack.push(tParams);
    }
    // t(...) calls (including i18next.t(...) from default import)
    if (ts.isCallExpression(node) && isTCall(node)) {
      const [arg0, arg1] = node.arguments;
      if (arg0 && ts.isStringLiteral(arg0)) {
        const keyLiteral = arg0.text;
        let hasPlural = false;
        let isStaticPlural = false;
        let hasContext = false;
        let isStaticContext = false;
        let contextLiteral: string | undefined;

        if (arg1 && ts.isObjectLiteralExpression(arg1)) {
          for (const prop of arg1.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              const name = prop.name.text;
              if (name === "count") {
                hasPlural = true;
                // If count is not a numeric literal, treat it as dynamic plural.
                isStaticPlural = ts.isNumericLiteral(prop.initializer);
              } else if (name === "context") {
                hasContext = true;
                if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
                  isStaticContext = true;
                  contextLiteral = prop.initializer.text;
                }
              }
            } else if (ts.isShorthandPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              const name = prop.name.text;
              if (name === "count") {
                hasPlural = true;
                isStaticPlural = false;
              } else if (name === "context") {
                hasContext = true;
                isStaticContext = false;
              }
            }
          }
        }

        addUsage(node, keyLiteral, hasPlural, isStaticPlural, hasContext, contextLiteral, isStaticContext);
      }
    }

    // <Trans i18nKey="..." ... />
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName.getText();
      if (transComponentNames.has(tagName)) {
        const attrs = node.attributes.properties;
        const keyLiterals: string[] = [];
        let hasPlural = false;
        let isStaticPlural = false;
        let hasContext = false;
        let isStaticContext = false;
        let contextLiteral: string | undefined;

        for (const attr of attrs) {
          if (!ts.isJsxAttribute(attr)) continue;
          const name = attr.name.text;
          const initializer = attr.initializer ?? undefined;

          if (name === "i18nKey") {
            const lit = getStringLiteral(initializer as any);
            if (lit !== undefined) {
              keyLiterals.push(lit);
            } else if (ts.isJsxExpression(initializer) && initializer.expression && ts.isConditionalExpression(initializer.expression)) {
              const cond = initializer.expression;
              if (ts.isStringLiteral(cond.whenTrue) || ts.isNoSubstitutionTemplateLiteral(cond.whenTrue)) {
                keyLiterals.push(cond.whenTrue.text);
              }
              if (ts.isStringLiteral(cond.whenFalse) || ts.isNoSubstitutionTemplateLiteral(cond.whenFalse)) {
                keyLiterals.push(cond.whenFalse.text);
              }
            }
          } else if (name === "count") {
            hasPlural = true;
            isStaticPlural = isNumericLiteralExpression(initializer as any);
          } else if (name === "context") {
            hasContext = true;
            const lit = getStringLiteral(initializer as any);
            if (lit !== undefined) {
              isStaticContext = true;
              contextLiteral = lit;
            }
          }
        }

        if (keyLiterals.length > 0) {
          for (const keyLiteral of keyLiterals) {
            addUsage(node, keyLiteral, hasPlural, isStaticPlural, hasContext, contextLiteral, isStaticContext);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
    if (tParams && tParams.size > 0) {
      tParamStack.pop();
    }
  }

  ts.forEachChild(sourceFile, visit);

  return usages;
}

export function extractUsagesFromFile(filePath: string, options: UsageExtractionOptions): Usage[] {
  const code = readFileSync(filePath, "utf8");
  return extractUsagesFromSource(code, filePath, options);
}

