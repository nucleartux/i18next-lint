import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "../src/config";
import { analyzeProject } from "../src/analyzeProject";

const fixturesRoot = join(import.meta.dir, "fixtures", "suffix");

describe("CLDR suffix plural integration", () => {
  it("handles i18next v4 suffix plurals (_one/_few/_many/_other) and reports missing/extra correctly", () => {
    const configPath = join(fixturesRoot, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    expect(result.missingKeys.sort()).toEqual(["missingPlural"]);
    expect(result.extraKeys.sort()).toEqual(["gender_female", "unused_suffix_key"]);
  });

  it("does not report suffix plural keys as extra when used via t() with count", () => {
    const configPath = join(fixturesRoot, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    const suffixKeys = [
      "days_one", "days_few", "days_many",
      "label_points_formatted_one", "label_points_formatted_few",
      "label_points_formatted_many", "label_points_formatted_other",
    ];
    for (const key of suffixKeys) {
      expect(result.extraKeys).not.toContain(key);
    }
  });

  it("does not report context+suffix plural keys as extra", () => {
    const configPath = join(fixturesRoot, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    const contextSuffixKeys = [
      "notification_period_day_one", "notification_period_day_few", "notification_period_day_many",
      "notification_period_week_one", "notification_period_week_few", "notification_period_week_many",
    ];
    for (const key of contextSuffixKeys) {
      expect(result.extraKeys).not.toContain(key);
    }
  });

  it("reports missingPlural with 'plural' usage type (bare key exists but no suffix forms)", () => {
    const configPath = join(fixturesRoot, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    expect(result.missingKeys).toContain("missingPlural");
    expect(result.missingKeyUsageTypes["missingPlural"]).toBe("plural");
  });
});
