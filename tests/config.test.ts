import { describe, it, expect } from "bun:test";
import { join, resolve } from "node:path";
import { unlinkSync } from "node:fs";
import { loadConfig } from "../src/config";

const fixturesSimpleExtra = join(import.meta.dir, "fixtures", "project-simple-extra");
const fixturesMultiEntry = join(import.meta.dir, "fixtures", "project-multi-entry");

describe("loadConfig - entry normalization", () => {
  it("resolves string entry to array with one absolute path", () => {
    const configPath = join(fixturesSimpleExtra, "i18next-lint.config.json");
    const configs = loadConfig(configPath);
    expect(configs).toHaveLength(1);
    const resolved = configs[0];

    expect(Array.isArray(resolved.entry)).toBe(true);
    expect(resolved.entry).toHaveLength(1);
    expect(resolved.entry[0]).toBe(resolve(fixturesSimpleExtra, "src/index.tsx"));
  });

  it("resolves array of paths to array of absolute paths", () => {
    const configPath = join(fixturesMultiEntry, "i18next-lint.config.entry-array.json");
    const configs = loadConfig(configPath);
    expect(configs).toHaveLength(1);
    const resolved = configs[0];

    expect(resolved.entry).toHaveLength(2);
    expect(resolved.entry).toContain(resolve(fixturesMultiEntry, "src/index.tsx"));
    expect(resolved.entry).toContain(resolve(fixturesMultiEntry, "src/OtherPage.tsx"));
  });

  it("expands glob pattern to matching absolute file paths", () => {
    const configPath = join(fixturesMultiEntry, "i18next-lint.config.entry-glob.json");
    const configs = loadConfig(configPath);
    expect(configs).toHaveLength(1);
    const resolved = configs[0];

    expect(resolved.entry.length).toBeGreaterThanOrEqual(1);
    expect(resolved.entry).toContain(resolve(fixturesMultiEntry, "src/index.tsx"));
    expect(resolved.entry).toContain(resolve(fixturesMultiEntry, "src/OtherPage.tsx"));
    expect(resolved.entry).toContain(resolve(fixturesMultiEntry, "src/LazyPage.tsx"));
    resolved.entry.forEach((p) => expect(p).toEndWith(".tsx"));
  });

  it("throws when entry is missing", async () => {
    const configPath = join(fixturesSimpleExtra, "i18next-lint.config.json");
    const raw = await Bun.file(configPath).text();
    const parsed = JSON.parse(raw);
    delete parsed.entry;
    const tmp = join(fixturesSimpleExtra, "i18next-lint.config.tmp.json");
    await Bun.write(tmp, JSON.stringify(parsed));
    try {
      expect(() => loadConfig(tmp)).toThrow("Config missing required field: entry");
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  });

  it("throws when glob matches no files", async () => {
    const configPath = join(fixturesSimpleExtra, "i18next-lint.config.json");
    const raw = await Bun.file(configPath).text();
    const parsed = JSON.parse(raw);
    parsed.entry = "no/such/path/*.tsx";
    const tmp = join(fixturesSimpleExtra, "i18next-lint.config.tmp.json");
    await Bun.write(tmp, JSON.stringify(parsed));
    try {
      expect(() => loadConfig(tmp)).toThrow("Config entry matched no files");
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  });

  it("throws when entry element is not a string", async () => {
    const configPath = join(fixturesSimpleExtra, "i18next-lint.config.json");
    const raw = await Bun.file(configPath).text();
    const parsed = JSON.parse(raw);
    parsed.entry = [123];
    const tmp = join(fixturesSimpleExtra, "i18next-lint.config.tmp.json");
    await Bun.write(tmp, JSON.stringify(parsed));
    try {
      expect(() => loadConfig(tmp)).toThrow("Config entry must be a string or array of strings");
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  });

  it("returns array of length 1 when config is single object (backward compatibility)", () => {
    const configPath = join(fixturesSimpleExtra, "i18next-lint.config.json");
    const configs = loadConfig(configPath);
    expect(configs).toHaveLength(1);
    expect(configs[0].entry).toHaveLength(1);
    expect(configs[0].rootDir).toBe(fixturesSimpleExtra);
  });

  it("returns array of project configs when config is array of two projects", () => {
    const fixturesMultiProject = join(import.meta.dir, "fixtures", "multi-project");
    const configPath = join(fixturesMultiProject, "i18next-lint.config.json");
    const configs = loadConfig(configPath);

    expect(configs).toHaveLength(2);

    const [first, second] = configs;
    expect(first.entry).toContain(resolve(fixturesMultiProject, "app1/src/index.tsx"));
    expect(first.translations).toHaveLength(1);
    expect(first.translations[0].filePath).toBe(resolve(fixturesMultiProject, "app1/src/locales/ru.json"));
    expect(first.contextSeparator).toBe("_");
    expect(first.pluralSeparator).toBe("_");
    expect(first.rootDir).toBe(fixturesMultiProject);

    expect(second.entry).toContain(resolve(fixturesMultiProject, "app2/src/index.tsx"));
    expect(second.translations).toHaveLength(1);
    expect(second.translations[0].filePath).toBe(resolve(fixturesMultiProject, "app2/src/locales/en.json"));
    expect(second.contextSeparator).toBe("|");
    expect(second.pluralSeparator).toBe(".");
    expect(second.rootDir).toBe(fixturesMultiProject);
  });
});
