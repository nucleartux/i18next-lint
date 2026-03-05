/**
 * Performance tests compare current run against baseline in tests/perf-baseline.json.
 * On a PR, tests fail if mean time exceeds baseline (strict: 3% tolerance for CI variance only).
 * To update the baseline (e.g. after intentional perf improvements on main):
 *   UPDATE_PERF_BASELINE=1 bun test tests/worker.perf.test.ts
 * then commit the updated tests/perf-baseline.json.
 */
import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { loadConfig } from "../src/config";
import { analyzeProject } from "../src/analyzeProject";
import type { ResolvedConfig } from "../src/config";
import type { SerializedAnalyzeProjectResult } from "../src/worker";

/** Heavy fixture: multi-entry, deep import tree, lazy modules, large locale files. */
const fixturesPerf = join(import.meta.dir, "fixtures", "project-perf");
/** Glob-entry fixture: many entry points via src/**\/*.tsx, nested feature modules. */
const fixturesPerfGlob = join(import.meta.dir, "fixtures", "project-perf-glob");

const PERF_BASELINE_PATH = join(import.meta.dir, "perf-baseline.json");
const UPDATE_PERF_BASELINE = process.env.UPDATE_PERF_BASELINE === "1";

/** Max allowed regression: 1.03 = 3% (CI variance only). */
const REGRESSION_TOLERANCE = 1.03;

const WARMUP_RUNS = 2;
const BENCH_RUNS = 15;
const WORKER_BENCH_RUNS = 10;

export type PerfBaseline = Record<string, number>;

function readBaseline(): PerfBaseline {
  if (!existsSync(PERF_BASELINE_PATH)) {
    throw new Error(
      `Perf baseline not found at ${PERF_BASELINE_PATH}. Run with UPDATE_PERF_BASELINE=1 to create it (e.g. on main after establishing baseline).`,
    );
  }
  const raw = readFileSync(PERF_BASELINE_PATH, "utf-8");
  return JSON.parse(raw) as PerfBaseline;
}

function writeBaseline(baseline: PerfBaseline): void {
  writeFileSync(PERF_BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n", "utf-8");
}

/** Assert current mean is within baseline (or update baseline when UPDATE_PERF_BASELINE=1). */
function assertPerf(key: string, mean: number): void {
  if (UPDATE_PERF_BASELINE) {
    const baseline = existsSync(PERF_BASELINE_PATH)
      ? (JSON.parse(readFileSync(PERF_BASELINE_PATH, "utf-8")) as PerfBaseline)
      : {};
    baseline[key] = mean;
    writeBaseline(baseline);
    return;
  }
  const baseline = readBaseline();
  const base = baseline[key] ?? Infinity;
  const limit = base * REGRESSION_TOLERANCE;
  expect(
    mean,
    `Perf regression: ${key} mean ${mean.toFixed(1)}ms exceeds baseline ${base.toFixed(1)}ms (max ${(REGRESSION_TOLERANCE * 100 - 100).toFixed(0)}% tolerance). Run UPDATE_PERF_BASELINE=1 on main to update baseline.`,
  ).toBeLessThanOrEqual(limit);
}

/** Resolve worker script path (src/worker.ts when running from source). */
function getWorkerPath(): string {
  return join(import.meta.dir, "..", "src", "worker.ts");
}

/** Run one project analysis in a worker and return elapsed ms. */
function runWorkerOnce(config: ResolvedConfig, workerPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const worker = new Worker(workerPath, {
      workerData: { config },
      execArgv: process.execArgv?.filter((a) => !a.startsWith("--cpu-prof")) ?? [],
    });
    worker.on("message", (_payload: SerializedAnalyzeProjectResult | { error: string }) => {
      const elapsed = performance.now() - start;
      worker.terminate();
      if ("error" in _payload) {
        reject(new Error(_payload.error));
      } else {
        resolve(elapsed);
      }
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

function stats(times: number[]): { min: number; max: number; mean: number } {
  const min = Math.min(...times);
  const max = Math.max(...times);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return { min, max, mean };
}

describe("worker performance (single worker)", () => {
  it("analyzeProject (core work) — project-perf fixture", () => {
    const configPath = join(fixturesPerf, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);

    for (let i = 0; i < WARMUP_RUNS; i++) {
      analyzeProject(resolved);
    }

    const times: number[] = [];
    for (let i = 0; i < BENCH_RUNS; i++) {
      const start = performance.now();
      analyzeProject(resolved);
      times.push(performance.now() - start);
    }

    const { min, max, mean } = stats(times);
    const key = "analyzeProject-project-perf";
    console.log(
      `[perf] ${key}: min=${min.toFixed(1)}ms mean=${mean.toFixed(1)}ms max=${max.toFixed(1)}ms`,
    );
    assertPerf(key, mean);
  });

  it("analyzeProject (core work) — project-perf-glob fixture", () => {
    const configPath = join(fixturesPerfGlob, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);

    for (let i = 0; i < WARMUP_RUNS; i++) {
      analyzeProject(resolved);
    }

    const times: number[] = [];
    for (let i = 0; i < BENCH_RUNS; i++) {
      const start = performance.now();
      analyzeProject(resolved);
      times.push(performance.now() - start);
    }

    const { min, max, mean } = stats(times);
    const key = "analyzeProject-project-perf-glob";
    console.log(
      `[perf] ${key}: min=${min.toFixed(1)}ms mean=${mean.toFixed(1)}ms max=${max.toFixed(1)}ms`,
    );
    assertPerf(key, mean);
  });

  it("worker thread run — project-perf fixture", async () => {
    const configPath = join(fixturesPerf, "i18next-lint.config.json");
    const [resolved] = loadConfig(configPath);
    const workerPath = getWorkerPath();

    const times: number[] = [];
    for (let i = 0; i < WORKER_BENCH_RUNS; i++) {
      const elapsed = await runWorkerOnce(resolved, workerPath);
      times.push(elapsed);
    }

    const { min, max, mean } = stats(times);
    const key = "worker-thread-project-perf";
    console.log(
      `[perf] ${key}: min=${min.toFixed(1)}ms mean=${mean.toFixed(1)}ms max=${max.toFixed(1)}ms`,
    );
    assertPerf(key, mean);
  });
});
