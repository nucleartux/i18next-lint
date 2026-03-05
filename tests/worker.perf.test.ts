import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { loadConfig } from "../src/config";
import { analyzeProject } from "../src/analyzeProject";
import type { ResolvedConfig } from "../src/config";
import type { SerializedAnalyzeProjectResult } from "../src/worker";

/** Heavy fixture: multi-entry, deep import tree, lazy modules, large locale files. */
const fixturesPerf = join(import.meta.dir, "fixtures", "project-perf");
/** Glob-entry fixture: many entry points via src/**\/*.tsx, nested feature modules. */
const fixturesPerfGlob = join(import.meta.dir, "fixtures", "project-perf-glob");

const WARMUP_RUNS = 2;
const BENCH_RUNS = 15;
const WORKER_BENCH_RUNS = 10;

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
    console.log(
      `[perf] analyzeProject project-perf: min=${min.toFixed(1)}ms mean=${mean.toFixed(1)}ms max=${max.toFixed(1)}ms`,
    );
    expect(mean).toBeLessThan(10_000);
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
    console.log(
      `[perf] analyzeProject project-perf-glob: min=${min.toFixed(1)}ms mean=${mean.toFixed(1)}ms max=${max.toFixed(1)}ms`,
    );
    expect(mean).toBeLessThan(10_000);
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
    console.log(
      `[perf] worker thread project-perf: min=${min.toFixed(1)}ms mean=${mean.toFixed(1)}ms max=${max.toFixed(1)}ms`,
    );
    expect(mean).toBeLessThan(15_000);
  });
});
