import { basename, extname } from "node:path";
import { BaseKeyInfo, ProjectAnalysisResult, TranslationKeyMeta, Usage } from "./types";

export interface AnalyzerInput {
  translations: {
    baseMap: Map<string, BaseKeyInfo>;
    meta: TranslationKeyMeta[];
    keyToFilePaths: Map<string, Set<string>>;
    translationFilePaths: string[];
  };
  usages: Usage[];
  contextSeparator: string;
  pluralSeparator: string;
}

function getLanguageName(filePath: string): string {
  return basename(filePath, extname(filePath)) || filePath;
}

export function analyze(input: AnalyzerInput): ProjectAnalysisResult {
  const { translations, usages, contextSeparator, pluralSeparator } = input;
  const { baseMap, meta, keyToFilePaths, translationFilePaths } = translations;

  const translationKeys = new Set<string>(meta.map((m) => m.fullKey));
  const usedTranslationKeys = new Set<string>();
  const missingKeyLocations = new Map<string, Array<{ filePath: string; line: number }>>();
  const missingKeyUsageTypes = new Map<string, Set<"singular" | "plural">>();

  function addMissingKey(
    key: string,
    location: { filePath: string; line: number },
    usageType: "singular" | "plural",
  ): void {
    let list = missingKeyLocations.get(key);
    if (!list) {
      list = [];
      missingKeyLocations.set(key, list);
    }
    list.push(location);
    let types = missingKeyUsageTypes.get(key);
    if (!types) {
      types = new Set();
      missingKeyUsageTypes.set(key, types);
    }
    types.add(usageType);
  }

  // Helper: lookup helpers
  function hasTranslationKey(key: string): boolean {
    return translationKeys.has(key);
  }

  function anyTranslationWithPrefix(prefix: string): boolean {
    for (const m of meta) {
      if (m.fullKey.startsWith(prefix)) return true;
    }
    return false;
  }

  // First pass: process usages for missing keys and mark used translation keys.
  for (const u of usages) {
    const baseLiteral = u.base;

    if (u.kind === "simple") {
      if (!hasTranslationKey(baseLiteral)) {
        addMissingKey(baseLiteral, { filePath: u.location.filePath, line: u.location.line }, "singular");
      } else {
        usedTranslationKeys.add(baseLiteral);
      }
      continue;
    }

    // Plural-related usage
    if (u.hasPlural) {
      let totalPluralForms = 0;
      let numericPluralForms = 0;

      const escapedBase = baseLiteral.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const numericSuffixPattern = new RegExp(
        // Matches both:
        // - "<base><pluralSeparator><digit>"
        // - "<base><contextSeparator><context><pluralSeparator><digit>"
        `^${escapedBase}(?:${contextSeparator}[^${pluralSeparator}]+)?${pluralSeparator}(\\d+)$`,
      );

      for (const m of meta) {
        if (!m.isPlural) continue;
        const key = m.fullKey;

        if (numericSuffixPattern.test(key)) {
          numericPluralForms++;
          totalPluralForms++;
        } else if (key.startsWith(`${baseLiteral}${pluralSeparator}`)) {
          // Simple plural styles such as "item_plural" still count as having
          // plural forms for this base.
          totalPluralForms++;
        }
      }

      const isNumericStyle = numericPluralForms > 0;
      const hasEnoughPluralForms = isNumericStyle
        ? numericPluralForms >= 2
        : totalPluralForms > 0;

      // Require plural forms: if none (for simple style) or an
      // insufficient set of numeric variants, report missing plural
      // forms for the literal key used in source.
      if (!hasEnoughPluralForms) {
        addMissingKey(baseLiteral, { filePath: u.location.filePath, line: u.location.line }, "plural");
      }

      // All plural forms corresponding to this literal base are considered
      // used. This is determined using the literal key from source and the
      // configured plural separator, so that keys like "ratings_count_0"
      // are treated as plural variants of "ratings_count".
      const pluralPrefix = `${baseLiteral}${pluralSeparator}`;
      for (const m of meta) {
        if (m.fullKey.startsWith(pluralPrefix)) {
          usedTranslationKeys.add(m.fullKey);
        }
      }

      const singularKey = baseLiteral;
      const hasSingular = hasTranslationKey(singularKey);
      const numericOnlyAndComplete = isNumericStyle && !hasSingular && hasEnoughPluralForms;

      // For numeric plural styles where we have a complete set of numeric
      // variants and no singular, do not require a singular key. This
      // matches real-world usage where keys like "every_n_days_0/1/2/3"
      // exist without a bare "every_n_days".
      if (!numericOnlyAndComplete) {
        if (!hasSingular) {
          addMissingKey(baseLiteral, { filePath: u.location.filePath, line: u.location.line }, "singular");
        } else {
          usedTranslationKeys.add(singularKey);
        }
      }
    }

    // Context-related usage
    if (u.hasContext) {
      if (u.kind === "staticContext" && u.contextLiteral) {
        const requiredKey = `${baseLiteral}${contextSeparator}${u.contextLiteral}`;
        if (!hasTranslationKey(requiredKey)) {
          addMissingKey(
            requiredKey,
            { filePath: u.location.filePath, line: u.location.line },
            u.hasPlural ? "plural" : "singular",
          );
        } else {
          usedTranslationKeys.add(requiredKey);
        }
      } else if (u.kind === "dynamicContext") {
        const prefix = `${baseLiteral}${contextSeparator}`;
        if (!anyTranslationWithPrefix(prefix)) {
          addMissingKey(
            `${baseLiteral} (context forms)`,
            { filePath: u.location.filePath, line: u.location.line },
            u.hasPlural ? "plural" : "singular",
          );
        } else {
          // All context-specific variants are considered used.
          for (const m of meta) {
            if (m.fullKey.startsWith(prefix)) {
              usedTranslationKeys.add(m.fullKey);
            }
          }
        }
      }
    }
  }

  // Second pass: simple extra key detection – any translation key not marked used.
  const extraKeys: string[] = [];
  for (const key of translationKeys) {
    if (!usedTranslationKeys.has(key)) {
      extraKeys.push(key);
    }
  }

  const sortedMissingKeys = Array.from(missingKeyLocations.keys()).sort();
  const locationsRecord: Record<string, Array<{ filePath: string; line: number }>> = {};
  const missingKeyUsageTypesRecord: Record<string, string> = {};
  for (const key of sortedMissingKeys) {
    locationsRecord[key] = missingKeyLocations.get(key)!;
    const types = missingKeyUsageTypes.get(key);
    if (types) {
      missingKeyUsageTypesRecord[key] =
        types.size === 2 ? "singular, plural" : types.has("plural") ? "plural" : "singular";
    }
  }

  const allLanguageNames = translationFilePaths.map(getLanguageName).sort();
  const missingKeysByLanguage: Record<string, string[]> = {};
  for (const key of sortedMissingKeys) {
    missingKeysByLanguage[key] = [...allLanguageNames];
  }
  const extraKeysByLanguage: Record<string, string[]> = {};
  for (const key of extraKeys) {
    const paths = keyToFilePaths.get(key);
    extraKeysByLanguage[key] = paths ? Array.from(paths).map(getLanguageName).sort() : [];
  }

  return {
    missingKeys: sortedMissingKeys,
    missingKeyLocations: locationsRecord,
    missingKeyUsageTypes: missingKeyUsageTypesRecord,
    extraKeys: extraKeys.sort(),
    missingKeysByLanguage,
    extraKeysByLanguage,
    usedKeys: usedTranslationKeys,
    translationKeys,
  };
}

