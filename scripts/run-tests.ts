/**
 * Runs all tests except performance tests (*.perf.test.ts).
 * Perf tests are run separately via: bun run test:perf
 */
import { readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const testsDir = join(fileURLToPath(import.meta.url), "..", "..", "tests");
const files = readdirSync(testsDir)
  .filter((f) => f.endsWith(".test.ts") && !f.includes(".perf.test."))
  .map((f) => join(testsDir, f));

const proc = Bun.spawn(["bun", "test", ...files], {
  stdio: ["inherit", "inherit", "inherit"],
  cwd: join(fileURLToPath(import.meta.url), "..", ".."),
});
process.exit(await proc.exited);