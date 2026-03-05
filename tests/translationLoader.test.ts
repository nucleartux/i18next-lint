import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";
import { parseTranslationKey, loadTranslationFiles, loadTranslationFile } from "../src/translationLoader";

const fixturesDir = join(import.meta.dir, "fixtures");

describe("parseTranslationKey", () => {
  it("parses simple base key without plural/context", () => {
    const meta = parseTranslationKey("image_upload", "/fake/ru.json", "_", "simple");
    expect(meta.base).toBe("image");
    expect(meta.isPlural).toBe(false);
  });

  it("parses plural with _plural suffix", () => {
    const meta = parseTranslationKey("item_plural", "/fake/ru.json", "_", "simple");
    expect(meta.base).toBe("item");
    expect(meta.isPlural).toBe(true);
  });

  it("parses numeric plural forms", () => {
    const meta = parseTranslationKey("item_0", "/fake/ru.json", "_", "numeric");
    expect(meta.base).toBe("item");
    expect(meta.isPlural).toBe(true);
  });

  it("parses context keys", () => {
    const meta = parseTranslationKey("gender_male", "/fake/ru.json", "_", "simple");
    expect(meta.base).toBe("gender");
    expect(meta.isPlural).toBe(false);
  });

  it("parses numeric plural with multi-part base (e.g. ratings_count_0)", () => {
    const meta = parseTranslationKey("ratings_count_0", "/fake/ru.json", "_", "numeric");
    expect(meta.base).toBe("ratings_count");
    expect(meta.isPlural).toBe(true);
  });
});

describe("loadTranslationFiles", () => {
  it("loads flat translations and aggregates base info", () => {
    const file = join(fixturesDir, "ru.simple.json");
    const { baseMap, meta } = loadTranslationFiles([{ filePath: file, pluralStyle: "simple" }], "_");

    expect(meta.map((m) => m.fullKey).sort()).toEqual(
      ["simple", "item", "item_plural", "gender_male", "gender_female"].sort(),
    );

    const item = baseMap.get("item");
    expect(item).toBeTruthy();
    expect(item?.hasSingular).toBe(true);
    expect(Array.from(item!.pluralKeys).sort()).toEqual(["item_plural"]);

    const gender = baseMap.get("gender");
    expect(gender).toBeTruthy();
    expect(gender?.hasSingular).toBe(false);
    expect(Array.from(gender!.allKeys).sort()).toEqual(["gender_female", "gender_male"]);
  });

  it("returns keyToFilePaths and translationFilePaths for by-language reporting", () => {
    const file = join(fixturesDir, "ru.simple.json");
    const { keyToFilePaths, translationFilePaths } = loadTranslationFiles(
      [{ filePath: file, pluralStyle: "simple" }],
      "_",
    );
    expect(translationFilePaths).toEqual([file]);
    for (const key of ["simple", "item", "item_plural", "gender_male", "gender_female"]) {
      const paths = keyToFilePaths.get(key);
      expect(paths).toBeTruthy();
      expect(paths?.size).toBe(1);
      expect(paths?.has(file)).toBe(true);
    }
  });

  it("skips non-string values in translation JSON", () => {
    const tmpFile = join(fixturesDir, "tmp-non-strings.json");
    writeFileSync(
      tmpFile,
      JSON.stringify({
        valid_key: "Hello",
        number_val: 42,
        nested: { a: 1 },
        array_val: ["x"],
      }),
    );
    try {
      const { meta, baseMap } = loadTranslationFile(tmpFile, "_", "simple");
      expect(meta).toHaveLength(1);
      expect(meta[0].fullKey).toBe("valid_key");
      expect(meta[0].base).toBe("valid");
      expect(baseMap.get("valid")?.allKeys.has("valid_key")).toBe(true);
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {
        /* ignore */
      }
    }
  });
});

