export type PluralStyle = "simple" | "numeric";

export interface TranslationConfigEntry {
  /**
   * Path to the translation JSON file, relative to the project root.
   *
   * When a bare string is used in the top-level config, it is treated as
   * if this object was provided with `plurals: "simple"`.
   */
  file: string;

  /**
   * Plural style used by this translation file.
   *
   * - "simple": keys like "item" and "item_plural"
   * - "numeric": keys like "item_0", "item_1", "item_2", ...
   *
   * Default: "simple"
   */
  plurals?: PluralStyle;
}

export interface LintConfig {
  /**
   * Entry point(s) of the project, relative to the project root.
   * Can be:
   * - A single path: "src/index.tsx"
   * - An array of paths: ["src/index.tsx", "src/legacy.tsx"]
   * - A glob pattern: "src/pages/*.tsx"
   * - An array mixing paths and globs: ["src/index.tsx", "src/pages/*.tsx"]
   */
  entry: string | string[];

  /**
   * List of translation JSON files.
   *
   * Backwards compatible:
   * - An array of strings: ["src/locales/ru.json"]
   * - Or objects with per-file plural style:
   *   [{ "file": "src/locales/ru.json", "plurals": "simple" }]
   */
  translations: (string | TranslationConfigEntry)[];

  /**
   * Separator between base key and context.
   * Default: "_"
   */
  contextSeparator?: string;

  /**
   * Separator between base key and plural markers.
   * Default: "_"
   */
  pluralSeparator?: string;

}

/**
 * Config file content: either a single project or an array of projects.
 */
export type LintConfigFile = LintConfig | LintConfig[];

export interface TranslationKeyMeta {
  fullKey: string;
  base: string;
  isPlural: boolean;
  filePath: string;
}

export interface BaseKeyInfo {
  base: string;
  hasSingular: boolean;
  pluralKeys: Set<string>;
  allKeys: Set<string>;
}

export type UsageKind =
  | "simple"
  | "staticContext"
  | "dynamicContext"
  | "staticPlural"
  | "dynamicPlural";

export interface UsageLocation {
  filePath: string;
  line: number;
  column: number;
}

/** Enclosing function or module for a usage; used for dead-code reachability. */
export interface EnclosingDeclaration {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  name?: string;
  /** True when usage is at top level (no enclosing function). */
  isModule?: boolean;
}

export interface Usage {
  base: string;
  kind: UsageKind;
  contextLiteral?: string;
  hasContext: boolean;
  hasPlural: boolean;
  location: UsageLocation;
  /** Set when extracting for dead-code detection; which declaration contains this usage. */
  enclosingDeclaration?: EnclosingDeclaration;
}

export interface MissingKeyLocation {
  filePath: string;
  line: number;
}

export interface AnalysisResult {
  missingKeys: string[];
  missingKeyLocations: Record<string, MissingKeyLocation[]>;
  /** For each missing key, how it is used: "singular", "plural", or "singular, plural" */
  missingKeyUsageTypes: Record<string, string>;
  extraKeys: string[];
  /** For each missing key, language ids (e.g. "en", "ru") where the key is missing */
  missingKeysByLanguage: Record<string, string[]>;
  /** For each extra key, language ids where the key exists */
  extraKeysByLanguage: Record<string, string[]>;
}

export interface ProjectAnalysisResult extends AnalysisResult {
  usedKeys: Set<string>;
  translationKeys: Set<string>;
}

