import { readFileSync } from "node:fs";
import { TranslationKeyMeta, BaseKeyInfo, PluralStyle } from "./types";

export interface LoadedTranslations {
  baseMap: Map<string, BaseKeyInfo>;
  meta: TranslationKeyMeta[];
  /** For each fullKey, the set of translation file paths that contain it */
  keyToFilePaths: Map<string, Set<string>>;
  /** All loaded translation file paths (one per language/locale) */
  translationFilePaths: string[];
}

export function parseTranslationKey(
  fullKey: string,
  filePath: string,
  contextSeparator: string,
  pluralStyle: PluralStyle,
): TranslationKeyMeta {
  const sep = contextSeparator;
  const parts = fullKey.split(sep);
  let base = parts[0];
  const rest = parts.slice(1);
  const last = rest[rest.length - 1];

  let isPlural = false;
  if (last) {
    if (pluralStyle === "simple") {
      isPlural = last === "plural";
    } else if (pluralStyle === "numeric") {
      if (/^[0-9]+$/.test(last)) {
        isPlural = true;
        // For numeric plural styles, treat everything before the numeric
        // suffix as the base, so keys like "ratings_count_0" are grouped
        // under the "ratings_count" base.
        base = parts.slice(0, -1).join(sep);
      }
    }
  }

  return {
    fullKey,
    base,
    isPlural,
    filePath,
  };
}

export function loadTranslationFile(
  filePath: string,
  contextSeparator: string,
  pluralStyle: PluralStyle,
): { meta: TranslationKeyMeta[]; baseMap: Map<string, BaseKeyInfo> } {
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const meta: TranslationKeyMeta[] = [];
  const baseMap = new Map<string, BaseKeyInfo>();

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      continue;
    }
    const kMeta = parseTranslationKey(key, filePath, contextSeparator, pluralStyle);
    meta.push(kMeta);

    const existing =
      baseMap.get(kMeta.base) ??
      ({
        base: kMeta.base,
        hasSingular: false,
        pluralKeys: new Set<string>(),
        allKeys: new Set<string>(),
      } as BaseKeyInfo);

    existing.allKeys.add(kMeta.fullKey);
    if (kMeta.fullKey === kMeta.base && !kMeta.isPlural) {
      existing.hasSingular = true;
    }

    if (kMeta.isPlural) {
      existing.pluralKeys.add(kMeta.fullKey);
    }

    baseMap.set(existing.base, existing);
  }

  return { meta, baseMap };
}

export function loadTranslationFiles(
  files: { filePath: string; pluralStyle: PluralStyle }[],
  contextSeparator: string,
): LoadedTranslations {
  const globalMeta: TranslationKeyMeta[] = [];
  const globalBaseMap = new Map<string, BaseKeyInfo>();
  const keyToFilePaths = new Map<string, Set<string>>();

  for (const { filePath, pluralStyle } of files) {
    const { meta, baseMap } = loadTranslationFile(filePath, contextSeparator, pluralStyle);
    for (const m of meta) {
      let paths = keyToFilePaths.get(m.fullKey);
      if (!paths) {
        paths = new Set<string>();
        keyToFilePaths.set(m.fullKey, paths);
      }
      paths.add(m.filePath);
    }
    globalMeta.push(...meta);

    for (const [base, info] of baseMap.entries()) {
      const existing = globalBaseMap.get(base);
      if (!existing) {
        globalBaseMap.set(base, {
          base: info.base,
          hasSingular: info.hasSingular,
          pluralKeys: new Set(info.pluralKeys),
          allKeys: new Set(info.allKeys),
        });
        continue;
      }

      existing.hasSingular = existing.hasSingular || info.hasSingular;
      for (const key of info.pluralKeys) {
        existing.pluralKeys.add(key);
      }
      for (const key of info.allKeys) {
        existing.allKeys.add(key);
      }
    }
  }

  return {
    baseMap: globalBaseMap,
    meta: globalMeta,
    keyToFilePaths,
    translationFilePaths: files.map((f) => f.filePath),
  };
}

