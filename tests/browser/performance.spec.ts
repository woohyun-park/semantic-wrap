import { expect, test } from "@playwright/test";

interface BrowserBenchmarkStats {
  calculateCalls: number;
  calculateMs: number;
  nativeProbeAppends: number;
  nativeProbeRemoves: number;
  pendingStartedAt: number | null;
  rangeMs: number;
  rangeReads: number;
  selectionDurations: number[];
  textProbeAppends: number;
  textProbeMs: number;
  textProbeReads: number;
  textProbeRemoves: number;
}

const benchmarkEnabled = process.env.SEMANTIC_WRAP_BENCHMARK === "1";

test.skip(!benchmarkEnabled, "run with bun run bench:react");

test("benchmarks long-text measurement across new widths", async ({ page }) => {
  await page.addInitScript(() => {
    const stats: BrowserBenchmarkStats = {
      calculateCalls: 0,
      calculateMs: 0,
      nativeProbeAppends: 0,
      nativeProbeRemoves: 0,
      pendingStartedAt: null,
      rangeMs: 0,
      rangeReads: 0,
      selectionDurations: [],
      textProbeAppends: 0,
      textProbeMs: 0,
      textProbeReads: 0,
      textProbeRemoves: 0,
    };
    Object.defineProperty(window, "__semanticWrapBenchmarkStats", {
      value: stats,
    });

    const rangeRect = Range.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = function () {
      const startedAt = performance.now();
      const result = rangeRect.call(this);
      stats.rangeReads += 1;
      stats.rangeMs += performance.now() - startedAt;
      return result;
    };

    const elementRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      const isTextProbe =
        this instanceof HTMLSpanElement &&
        this.style.position === "fixed" &&
        this.style.visibility === "hidden";
      const startedAt = isTextProbe ? performance.now() : 0;
      const result = elementRect.call(this);
      if (isTextProbe) {
        stats.textProbeReads += 1;
        stats.textProbeMs += performance.now() - startedAt;
      }
      return result;
    };

    const append = Element.prototype.append;
    Element.prototype.append = function (...nodes) {
      for (const node of nodes) {
        if (!(node instanceof HTMLElement) || node.getAttribute("aria-hidden") !== "true") {
          continue;
        }
        if (node instanceof HTMLSpanElement) stats.textProbeAppends += 1;
        else stats.nativeProbeAppends += 1;
      }
      return append.apply(this, nodes);
    };

    const remove = Element.prototype.remove;
    Element.prototype.remove = function () {
      if (this instanceof HTMLElement && this.getAttribute("aria-hidden") === "true") {
        if (this instanceof HTMLSpanElement) stats.textProbeRemoves += 1;
        else stats.nativeProbeRemoves += 1;
      }
      return remove.call(this);
    };
  });

  await page.goto("/?benchmark=long");
  await expect(page.locator("#benchmark-status")).toHaveAttribute("data-ready", "true", {
    timeout: 120_000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const stats = Reflect.get(window, "__semanticWrapBenchmarkStats") as BrowserBenchmarkStats;
    Object.assign(stats, {
      calculateCalls: 0,
      calculateMs: 0,
      nativeProbeAppends: 0,
      nativeProbeRemoves: 0,
      pendingStartedAt: null,
      rangeMs: 0,
      rangeReads: 0,
      selectionDurations: [],
      textProbeAppends: 0,
      textProbeMs: 0,
      textProbeReads: 0,
      textProbeRemoves: 0,
    });
  });

  const widths = [360, 420, 480, 540, 600, 660, 720, 780, 840, 900];
  for (let index = 0; index < widths.length; index += 1) {
    await page.locator("#benchmark-container").evaluate((element, width) => {
      const stats = Reflect.get(window, "__semanticWrapBenchmarkStats") as BrowserBenchmarkStats;
      stats.pendingStartedAt = performance.now();
      element.style.width = `${width}px`;
    }, widths[index]!);
    await page.waitForFunction(
      (expectedCalls) =>
        (Reflect.get(window, "__semanticWrapBenchmarkStats") as BrowserBenchmarkStats)
          .calculateCalls >= expectedCalls,
      index + 1,
      { timeout: 120_000 },
    );
  }

  const result = await page.evaluate(() => {
    const stats = Reflect.get(window, "__semanticWrapBenchmarkStats") as BrowserBenchmarkStats;
    const durations = stats.selectionDurations;
    return {
      ...stats,
      selectionMedianMs: percentileInBrowser(durations, 0.5),
      selectionP95Ms: percentileInBrowser(durations, 0.95),
      textLength: Number(
        document.querySelector("#benchmark-status")?.getAttribute("data-text-length"),
      ),
    };

    function percentileInBrowser(values: readonly number[], fraction: number): number {
      const ordered = [...values].sort((left, right) => left - right);
      return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))]!;
    }
  });

  expect(result.calculateCalls).toBe(widths.length);
  expect(result.selectionDurations).toHaveLength(widths.length);
  console.log(JSON.stringify(result, null, 2));
});
