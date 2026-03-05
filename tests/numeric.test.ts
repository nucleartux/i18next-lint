import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "../src/config";
import { analyzeProject } from "../src/analyzeProject";

const fixturesRoot = join(import.meta.dir, "fixtures", "numeric");

describe("numeric plural locale integration", () => {
  it("handles numeric plural keys (key_0, key_1, key_2) and reports missing/extra correctly", () => {
    const configPath = join(fixturesRoot, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const { result } = analyzeProject(resolved);

    expect(result.missingKeys.sort()).toEqual(
      ["missingPlural", "ratings_count"].sort(),
    );
    expect(result.extraKeys.sort()).toEqual(["gender_female"]);
  });
});

