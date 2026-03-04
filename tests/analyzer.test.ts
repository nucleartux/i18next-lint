import { describe, it, expect } from "bun:test";
import { analyze } from "../src/analyzer";
import { AnalyzerInput } from "../src/analyzer";
import { BaseKeyInfo, TranslationKeyMeta, Usage } from "../src/types";

const TEST_FILE_PATH = "/test.json";

function makeTranslations(entries: Array<{ key: string; isPlural?: boolean }>): {
  baseMap: Map<string, BaseKeyInfo>;
  meta: TranslationKeyMeta[];
  keyToFilePaths: Map<string, Set<string>>;
  translationFilePaths: string[];
} {
  const baseMap = new Map<string, BaseKeyInfo>();
  const meta: TranslationKeyMeta[] = [];
  const keyToFilePaths = new Map<string, Set<string>>();

  for (const e of entries) {
    const fullKey = e.key;
    const base = fullKey.split("_")[0];
    const isPlural = !!e.isPlural;
    meta.push({ fullKey, base, isPlural, filePath: TEST_FILE_PATH });

    let paths = keyToFilePaths.get(fullKey);
    if (!paths) {
      paths = new Set<string>();
      keyToFilePaths.set(fullKey, paths);
    }
    paths.add(TEST_FILE_PATH);

    const existing =
      baseMap.get(base) ??
      ({
        base,
        hasSingular: false,
        pluralKeys: new Set<string>(),
        allKeys: new Set<string>(),
      } as BaseKeyInfo);

    existing.allKeys.add(fullKey);
    if (!isPlural && fullKey === base) {
      existing.hasSingular = true;
    }
    if (isPlural) {
      existing.pluralKeys.add(fullKey);
    }
    baseMap.set(base, existing);
  }

  return { baseMap, meta, keyToFilePaths, translationFilePaths: [TEST_FILE_PATH] };
}

function analyzeCase(translations: ReturnType<typeof makeTranslations>, usages: Usage[]) {
  const input: AnalyzerInput = {
    translations,
    usages,
    contextSeparator: "_",
    pluralSeparator: "_",
  };
  return analyze(input);
}

describe("analyzer - simple extra and missing keys", () => {
  it("detects simple extra key", () => {
    const translations = makeTranslations([{ key: "unused_key" }]);
    const usages: Usage[] = [];

    const result = analyzeCase(translations, usages);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual(["unused_key"]);
  });

  it("detects simple missing key", () => {
    const translations = makeTranslations([]);
    const usages: Usage[] = [
      {
        base: "missing_key",
        kind: "simple",
        hasContext: false,
        hasPlural: false,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const result = analyzeCase(translations, usages);
    expect(result.missingKeys).toEqual(["missing_key"]);
    expect(result.extraKeys).toEqual([]);
  });
});

describe("analyzer - plural handling", () => {
  it('handles plural with "_plural" suffix', () => {
    const translations = makeTranslations([
      { key: "item" },
      { key: "item_plural", isPlural: true },
    ]);
    const usages: Usage[] = [
      {
        base: "item",
        kind: "staticPlural",
        hasContext: false,
        hasPlural: true,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const result = analyzeCase(translations, usages);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual([]);
  });

  it('handles plurals with "_0", "_1", "_2" suffixes', () => {
    const translations = makeTranslations([
      { key: "item" },
      { key: "item_0", isPlural: true },
      { key: "item_1", isPlural: true },
      { key: "item_2", isPlural: true },
    ]);
    const usages: Usage[] = [
      {
        base: "item",
        kind: "dynamicPlural",
        hasContext: false,
        hasPlural: true,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const result = analyzeCase(translations, usages);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual([]);
  });

  it("detects missing plural forms for static plural", () => {
    const translations = makeTranslations([{ key: "item" }]);
    const usages: Usage[] = [
      {
        base: "item",
        kind: "staticPlural",
        hasContext: false,
        hasPlural: true,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const result = analyzeCase(translations, usages);
    expect(result.missingKeys.sort()).toEqual(["item"]);
    expect(result.extraKeys).toEqual([]);
  });

  it("requires both singular and plural for dynamic plural", () => {
    const translations = makeTranslations([
      { key: "item" },
      { key: "item_plural", isPlural: true },
    ]);
    const usages: Usage[] = [
      {
        base: "item",
        kind: "dynamicPlural",
        hasContext: false,
        hasPlural: true,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const result = analyzeCase(translations, usages);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual([]);
  });

  describe("plural only t(\"key\", { count: 2 })", () => {
    it("simple: requires key and key_plural; reports missing singular when only key_plural exists", () => {
      const translations = makeTranslations([{ key: "key_plural", isPlural: true }]);
      const usages: Usage[] = [
        {
          base: "key",
          kind: "staticPlural",
          hasContext: false,
          hasPlural: true,
          location: { filePath: "src/App.tsx", line: 1, column: 1 },
        },
      ];

      const result = analyzeCase(translations, usages);
      expect(result.missingKeys.sort()).toEqual(["key"]);
      expect(result.extraKeys).toEqual([]);
    });

    it("simple: reports missing plural forms when only key exists", () => {
      const translations = makeTranslations([{ key: "key" }]);
      const usages: Usage[] = [
        {
          base: "key",
          kind: "staticPlural",
          hasContext: false,
          hasPlural: true,
          location: { filePath: "src/App.tsx", line: 1, column: 1 },
        },
      ];

      const result = analyzeCase(translations, usages);
      expect(result.missingKeys.sort()).toEqual(["key"]);
      expect(result.extraKeys).toEqual([]);
    });

    it("numeric: requires key_0, key_1, key_2; no singular required when all numeric forms present", () => {
      const translations = makeTranslations([
        { key: "key_0", isPlural: true },
        { key: "key_1", isPlural: true },
        { key: "key_2", isPlural: true },
      ]);
      const usages: Usage[] = [
        {
          base: "key",
          kind: "staticPlural",
          hasContext: false,
          hasPlural: true,
          location: { filePath: "src/App.tsx", line: 1, column: 1 },
        },
      ];

      const result = analyzeCase(translations, usages);
      expect(result.missingKeys).toEqual([]);
      expect(result.extraKeys).toEqual([]);
    });

    it("numeric: reports missing plural forms and key when only one numeric form exists", () => {
      const translations = makeTranslations([{ key: "key_0", isPlural: true }]);
      const usages: Usage[] = [
        {
          base: "key",
          kind: "staticPlural",
          hasContext: false,
          hasPlural: true,
          location: { filePath: "src/App.tsx", line: 1, column: 1 },
        },
      ];

      const result = analyzeCase(translations, usages);
      expect(result.missingKeys.sort()).toEqual(["key"]);
      expect(result.extraKeys).toEqual([]);
    });
  });

  describe("single and plural t(\"key\") and t(\"key\", { count: 2 })", () => {
    it("simple: requires key and key_plural", () => {
      const translations = makeTranslations([
        { key: "key" },
        { key: "key_plural", isPlural: true },
      ]);
      const usages: Usage[] = [
        {
          base: "key",
          kind: "simple",
          hasContext: false,
          hasPlural: false,
          location: { filePath: "src/App.tsx", line: 1, column: 1 },
        },
        {
          base: "key",
          kind: "staticPlural",
          hasContext: false,
          hasPlural: true,
          location: { filePath: "src/App.tsx", line: 2, column: 1 },
        },
      ];

      const result = analyzeCase(translations, usages);
      expect(result.missingKeys).toEqual([]);
      expect(result.extraKeys).toEqual([]);
    });

    it("simple: reports missing plural forms when only key exists", () => {
      const translations = makeTranslations([{ key: "key" }]);
      const usages: Usage[] = [
        {
          base: "key",
          kind: "simple",
          hasContext: false,
          hasPlural: false,
          location: { filePath: "src/App.tsx", line: 1, column: 1 },
        },
        {
          base: "key",
          kind: "staticPlural",
          hasContext: false,
          hasPlural: true,
          location: { filePath: "src/App.tsx", line: 2, column: 1 },
        },
      ];

      const result = analyzeCase(translations, usages);
      expect(result.missingKeys.sort()).toEqual(["key"]);
      expect(result.extraKeys).toEqual([]);
    });

    it("simple: reports missing key when only key_plural exists", () => {
      const translations = makeTranslations([{ key: "key_plural", isPlural: true }]);
      const usages: Usage[] = [
        {
          base: "key",
          kind: "simple",
          hasContext: false,
          hasPlural: false,
          location: { filePath: "src/App.tsx", line: 1, column: 1 },
        },
        {
          base: "key",
          kind: "staticPlural",
          hasContext: false,
          hasPlural: true,
          location: { filePath: "src/App.tsx", line: 2, column: 1 },
        },
      ];

      const result = analyzeCase(translations, usages);
      expect(result.missingKeys.sort()).toEqual(["key"]);
      expect(result.extraKeys).toEqual([]);
    });

    it("numeric: requires key, key_0, key_1, key_2", () => {
      const translations = makeTranslations([
        { key: "key" },
        { key: "key_0", isPlural: true },
        { key: "key_1", isPlural: true },
        { key: "key_2", isPlural: true },
      ]);
      const usages: Usage[] = [
        {
          base: "key",
          kind: "simple",
          hasContext: false,
          hasPlural: false,
          location: { filePath: "src/App.tsx", line: 1, column: 1 },
        },
        {
          base: "key",
          kind: "staticPlural",
          hasContext: false,
          hasPlural: true,
          location: { filePath: "src/App.tsx", line: 2, column: 1 },
        },
      ];

      const result = analyzeCase(translations, usages);
      expect(result.missingKeys).toEqual([]);
      expect(result.extraKeys).toEqual([]);
    });

    it("numeric: reports missing key when only key_0, key_1, key_2 exist (singular required for single usage)", () => {
      const translations = makeTranslations([
        { key: "key_0", isPlural: true },
        { key: "key_1", isPlural: true },
        { key: "key_2", isPlural: true },
      ]);
      const usages: Usage[] = [
        {
          base: "key",
          kind: "simple",
          hasContext: false,
          hasPlural: false,
          location: { filePath: "src/App.tsx", line: 1, column: 1 },
        },
        {
          base: "key",
          kind: "staticPlural",
          hasContext: false,
          hasPlural: true,
          location: { filePath: "src/App.tsx", line: 2, column: 1 },
        },
      ];

      const result = analyzeCase(translations, usages);
      expect(result.missingKeys.sort()).toEqual(["key"]);
      expect(result.extraKeys).toEqual([]);
    });
  });
});

describe("analyzer - context handling", () => {
  it("treats static context as using only the specific context key", () => {
    const translations = makeTranslations([{ key: "gender_male" }, { key: "gender_female" }]);
    const usages: Usage[] = [
      {
        base: "gender",
        kind: "staticContext",
        contextLiteral: "male",
        hasContext: true,
        hasPlural: false,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const result = analyzeCase(translations, usages);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual(["gender_female"]);
  });

  it("treats dynamic context as using all context variants", () => {
    const translations = makeTranslations([{ key: "gender_male" }, { key: "gender_female" }]);
    const usages: Usage[] = [
      {
        base: "gender",
        kind: "dynamicContext",
        hasContext: true,
        hasPlural: false,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const result = analyzeCase(translations, usages);
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual([]);
  });
});

describe("analyzer - combined plural and context", () => {
  it("prioritizes plural handling when both count and context are present", () => {
    const translations = makeTranslations([
      { key: "gender" },
      { key: "gender_0", isPlural: true },
      { key: "gender_1", isPlural: true },
      { key: "gender_2", isPlural: true },
    ]);

    const usages: Usage[] = [
      {
        base: "gender",
        kind: "staticPlural",
        contextLiteral: "male",
        hasContext: true,
        hasPlural: true,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const result = analyzeCase(translations, usages);
    // All plural forms and the singular are satisfied; context does not
    // introduce additional required keys under current semantics.
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual([]);
  });
});


describe("analyzer - custom separators", () => {
  it("respects a custom pluralSeparator when matching plural forms", () => {
    const keyToFilePaths = new Map<string, Set<string>>();
    for (const key of ["item", "item|0", "item|1"]) {
      keyToFilePaths.set(key, new Set([TEST_FILE_PATH]));
    }
    const translations = {
      baseMap: new Map<string, BaseKeyInfo>([
        [
          "item",
          {
            base: "item",
            hasSingular: true,
            pluralKeys: new Set(["item|0", "item|1"]),
            allKeys: new Set(["item", "item|0", "item|1"]),
          },
        ],
      ]),
      meta: [
        { fullKey: "item", base: "item", isPlural: false, filePath: TEST_FILE_PATH },
        { fullKey: "item|0", base: "item", isPlural: true, filePath: TEST_FILE_PATH },
        { fullKey: "item|1", base: "item", isPlural: true, filePath: TEST_FILE_PATH },
      ],
      keyToFilePaths,
      translationFilePaths: [TEST_FILE_PATH],
    };

    const usages: Usage[] = [
      {
        base: "item",
        kind: "dynamicPlural",
        hasContext: false,
        hasPlural: true,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const result = analyze({
      translations,
      usages,
      contextSeparator: "_",
      pluralSeparator: "|",
    });

    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys.sort()).toEqual([]);
  });

  it("respects a custom contextSeparator when matching context variants", () => {
    const keyToFilePaths = new Map<string, Set<string>>();
    keyToFilePaths.set("gender:male", new Set([TEST_FILE_PATH]));
    keyToFilePaths.set("gender:female", new Set([TEST_FILE_PATH]));
    const translations = {
      baseMap: new Map<string, BaseKeyInfo>([
        [
          "gender",
          {
            base: "gender",
            hasSingular: false,
            pluralKeys: new Set(),
            allKeys: new Set(["gender:male", "gender:female"]),
          },
        ],
      ]),
      meta: [
        { fullKey: "gender:male", base: "gender", isPlural: false, filePath: TEST_FILE_PATH },
        { fullKey: "gender:female", base: "gender", isPlural: false, filePath: TEST_FILE_PATH },
      ],
      keyToFilePaths,
      translationFilePaths: [TEST_FILE_PATH],
    };

    const usagesStatic: Usage[] = [
      {
        base: "gender",
        kind: "staticContext",
        contextLiteral: "male",
        hasContext: true,
        hasPlural: false,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const resultStatic = analyze({
      translations,
      usages: usagesStatic,
      contextSeparator: ":",
      pluralSeparator: "_",
    });

    expect(resultStatic.missingKeys).toEqual([]);
    expect(resultStatic.extraKeys.sort()).toEqual(["gender:female"]);

    const usagesDynamic: Usage[] = [
      {
        base: "gender",
        kind: "dynamicContext",
        hasContext: true,
        hasPlural: false,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];

    const resultDynamic = analyze({
      translations,
      usages: usagesDynamic,
      contextSeparator: ":",
      pluralSeparator: "_",
    });

    expect(resultDynamic.missingKeys).toEqual([]);
    expect(resultDynamic.extraKeys.sort()).toEqual([]);
  });
});

describe("analyzer - missingKeysByLanguage and extraKeysByLanguage", () => {
  function makeTranslationsMultiLocale(
    entries: Array<{ key: string; isPlural?: boolean; filePath: string }>,
  ): {
    baseMap: Map<string, BaseKeyInfo>;
    meta: TranslationKeyMeta[];
    keyToFilePaths: Map<string, Set<string>>;
    translationFilePaths: string[];
  } {
    const baseMap = new Map<string, BaseKeyInfo>();
    const meta: TranslationKeyMeta[] = [];
    const keyToFilePaths = new Map<string, Set<string>>();
    const pathSet = new Set<string>();

    for (const e of entries) {
      const fullKey = e.key;
      const base = fullKey.split("_")[0];
      const isPlural = !!e.isPlural;
      pathSet.add(e.filePath);
      meta.push({ fullKey, base, isPlural, filePath: e.filePath });

      let paths = keyToFilePaths.get(fullKey);
      if (!paths) {
        paths = new Set<string>();
        keyToFilePaths.set(fullKey, paths);
      }
      paths.add(e.filePath);

      const existing =
        baseMap.get(base) ??
        ({
          base,
          hasSingular: false,
          pluralKeys: new Set<string>(),
          allKeys: new Set<string>(),
        } as BaseKeyInfo);
      existing.allKeys.add(fullKey);
      if (!isPlural && fullKey === base) existing.hasSingular = true;
      if (isPlural) existing.pluralKeys.add(fullKey);
      baseMap.set(base, existing);
    }

    return {
      baseMap,
      meta,
      keyToFilePaths,
      translationFilePaths: Array.from(pathSet).sort(),
    };
  }

  it("reports all locales in missingKeysByLanguage for each missing key", () => {
    const translations = makeTranslationsMultiLocale([
      { key: "existing_key", filePath: "/locales/en.json" },
      { key: "existing_key", filePath: "/locales/ru.json" },
    ]);
    const usages: Usage[] = [
      {
        base: "missing_key",
        kind: "simple",
        hasContext: false,
        hasPlural: false,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];
    const result = analyze({
      translations,
      usages,
      contextSeparator: "_",
      pluralSeparator: "_",
    });
    expect(result.missingKeys).toEqual(["missing_key"]);
    expect(result.missingKeysByLanguage["missing_key"].sort()).toEqual(["en", "ru"]);
  });

  it("reports single locale in extraKeysByLanguage when key exists only in one file", () => {
    const translations = makeTranslationsMultiLocale([
      { key: "used_key", filePath: "/locales/en.json" },
      { key: "used_key", filePath: "/locales/ru.json" },
      { key: "only_in_ru", filePath: "/locales/ru.json" },
    ]);
    const usages: Usage[] = [
      {
        base: "used_key",
        kind: "simple",
        hasContext: false,
        hasPlural: false,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ];
    const result = analyze({
      translations,
      usages,
      contextSeparator: "_",
      pluralSeparator: "_",
    });
    expect(result.extraKeys).toEqual(["only_in_ru"]);
    expect(result.extraKeysByLanguage["only_in_ru"]).toEqual(["ru"]);
  });

  it("reports all locales in extraKeysByLanguage when key exists in multiple files", () => {
    const translations = makeTranslationsMultiLocale([
      { key: "unused_in_both", filePath: "/locales/en.json" },
      { key: "unused_in_both", filePath: "/locales/ru.json" },
    ]);
    const result = analyze({
      translations,
      usages: [],
      contextSeparator: "_",
      pluralSeparator: "_",
    });
    expect(result.extraKeys).toEqual(["unused_in_both"]);
    expect(result.extraKeysByLanguage["unused_in_both"].sort()).toEqual(["en", "ru"]);
  });

  it("single locale: missingKeysByLanguage and extraKeysByLanguage use basename as language id", () => {
    const translations = makeTranslations([{ key: "unused_key" }]);
    const result = analyzeCase(translations, []);
    expect(result.extraKeysByLanguage["unused_key"]).toEqual(["test"]);

    const translationsEmpty = makeTranslations([]);
    const resultMissing = analyzeCase(translationsEmpty, [
      {
        base: "missing_key",
        kind: "simple",
        hasContext: false,
        hasPlural: false,
        location: { filePath: "src/App.tsx", line: 1, column: 1 },
      },
    ]);
    expect(resultMissing.missingKeysByLanguage["missing_key"]).toEqual(["test"]);
  });
});
