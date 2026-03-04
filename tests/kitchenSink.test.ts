import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "../src/config";
import { analyzeProject } from "../src/analyzeProject";

const fixturesRoot = join(import.meta.dir, "fixtures", "kitchen-sink");

describe("kitchen sink integration", () => {
  it("handles mixed simple, plural, context, Trans, and multiple files", () => {
    const configPath = join(fixturesRoot, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    expect(result.missingKeys.sort()).toEqual(["missingPlural", "number_key", "ratings_count"]);
    expect(result.extraKeys.sort()).toEqual(["gender_female", "unused_key_in_kitchen"].sort());
  });
});

