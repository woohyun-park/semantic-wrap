import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { runResizeScenario } from "./resize-scenario.js";

const referenceBenchmark = process.env.SEMANTIC_WRAP_REFERENCE_BENCHMARK === "1";
const options = ["resolved", "native"].flatMap((initial) => ["immediate", "settled"].map((resize) => ({
  name: `${initial}-${resize}`, query: `initial=${initial}&resize=${resize}`,
})));
const variants = referenceBenchmark ? options.flatMap((option) => [
  { name: `before-${option.name}`, query: `current=1&${option.query}` },
  { name: `fixed-${option.name}`, query: option.query },
]) : [
  { name: "old-sync", query: "before=1" },
  { name: "57f73fd", query: "current=1" },
  ...options,
];

async function startupProbe(page: Page, input: string) {
  await page.addInitScript((short) => {
    const stats = { firstMeasure: 0, exactMutation: 0, firstVisibleFrame: 0, exactFrame: 0 };
    Reflect.set(window, "__startupStats", stats);
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (!stats.firstMeasure && this instanceof HTMLSpanElement && this.style.visibility === "hidden") {
        stats.firstMeasure = performance.now();
      }
      return rect.call(this);
    };
    const inspect = () => {
      const title = document.querySelector<HTMLElement>("#resize-text");
      if (title && title.querySelector("br") && getComputedStyle(title).opacity !== "0") {
        if (!stats.exactMutation) stats.exactMutation = performance.now();
      }
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document, { subtree: true, childList: true, attributes: true });
    const frame = () => {
      const title = document.querySelector<HTMLElement>("#resize-text");
      if (title && getComputedStyle(title).opacity !== "0") {
        if (!stats.firstVisibleFrame) stats.firstVisibleFrame = performance.now();
        if (title.querySelector("br")) {
          stats.exactFrame = performance.now();
          observer.disconnect();
          Element.prototype.getBoundingClientRect = rect;
          return;
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    if (short) {
      // The frozen fixture starts at 660px. Equal CSS forces one exact, nontrivial
      // cold title selection in every version before any resize measurement begins.
      const style = document.createElement("style");
      style.id = "startup-width";
      style.textContent = "#resize-container{width:240px!important}#resize-text{font-size:28px!important}";
      const attach = () => document.documentElement.append(style);
      if (document.documentElement) attach();
      else new MutationObserver((_, observer) => { if (document.documentElement) { attach(); observer.disconnect(); } }).observe(document, { childList: true });
    }
  }, input === "short");
}

async function ready(page: Page, input: string) {
  await page.waitForFunction(() => Reflect.get(window, "__startupStats")?.exactFrame > 0);
  const startup = await page.evaluate(() => Reflect.get(window, "__startupStats") as {
    firstMeasure: number; exactMutation: number; firstVisibleFrame: number; exactFrame: number;
  });
  if (input === "short") {
    await page.evaluate(() => {
      document.querySelector("#startup-width")!.remove();
      document.querySelector<HTMLElement>("#resize-text")!.style.fontSize = "28px";
    });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { ...startup, measuredSelectionSpanMs: startup.exactMutation - startup.firstMeasure };
}

test("compares cold display and resize for both baselines and all four options", async ({ browser }, testInfo) => {
  test.skip(!referenceBenchmark && process.env.SEMANTIC_WRAP_OPTIONS_BENCHMARK !== "1", "opt-in matched performance run");
  test.setTimeout(900_000);
  const rows = [];
  for (const input of referenceBenchmark ? ["short", "long"] : ["short", "medium", "long", "unique", "double"]) {
    for (let repetition = 0; repetition < 3; repetition++) {
      const order = repetition % 2 ? [...variants].reverse() : variants;
      const html: string[] = [];
      for (const variant of order) {
        const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
        try {
          await startupProbe(page, input);
          await page.goto(`http://127.0.0.1:4191/?resize-demo=1&input=${input}&${variant.query}`);
          const startup = await ready(page, input);
          const result = await runResizeScenario(page);
          html.push(result.finalHTML);
          rows.push({ input, repetition, variant: variant.name, startup, ...result });
          console.log(JSON.stringify({ input, repetition, variant: variant.name, startupSpan: startup.measuredSelectionSpanMs,
            frameP95: result.frameP95Ms, commit: result.finalCommitDelayMs, longTasks: result.longTasks }));
          // Persist completed rows so a failed later assertion never erases samples.
          await writeFile(testInfo.outputPath("scheduling-comparison.json"), JSON.stringify(rows, null, 2));
        } finally { await page.close(); }
      }
      expect(new Set(html).size, `${input}/${repetition}: identical final HTML in all variants`).toBe(1);
    }
  }
});

test("measures short-title single-change latency without a constant trajectory tail", async ({ browser }, testInfo) => {
  test.skip(!referenceBenchmark && process.env.SEMANTIC_WRAP_OPTIONS_BENCHMARK !== "1", "opt-in matched latency run");
  test.setTimeout(120_000);
  const rows = [];
  for (const variant of variants) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
    try {
      await startupProbe(page, "short");
      await page.goto(`http://127.0.0.1:4191/?resize-demo=1&input=short&${variant.query}`);
      await ready(page, "short");
      const samples = await page.evaluate(async () => {
        const container = document.querySelector<HTMLElement>("#resize-container")!;
        const title = document.querySelector<HTMLElement>("#resize-text")!;
        const results = [];
        for (let i = 0; i < 32; i++) {
          const width = i % 2 ? 240 : 420;
          const before = title.innerHTML;
          const started = performance.now();
          let final = 0;
          const observer = new MutationObserver(() => {
            if (title.innerHTML !== before && title.querySelector("br")) final = performance.now();
          });
          observer.observe(title, { subtree: true, childList: true });
          container.style.width = `${width}px`;
          const deadline = performance.now() + 2000;
          while (!final && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
          observer.disconnect();
          if (!final) throw new Error(`No final short-title mutation at ${width}px`);
          if (i >= 2) results.push({ width, delayMs: final - started, html: title.innerHTML });
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return results;
      });
      rows.push({ variant: variant.name, samples });
    } finally { await page.close(); }
  }
  for (const width of [240, 420]) {
    expect(new Set(rows.flatMap((row) => row.samples.filter((s) => s.width === width).map((s) => s.html))).size).toBe(1);
  }
  await writeFile(testInfo.outputPath("scheduling-short-latency.json"), JSON.stringify(rows, null, 2));
});

test("records short and long resize with old sync, immediate and settled options", async ({ browser }, testInfo) => {
  test.skip(process.env.SEMANTIC_WRAP_OPTIONS_VIDEO !== "1", "separate video run");
  test.setTimeout(180_000);
  for (const input of ["short", "long"]) {
    for (const variant of variants.filter((v) => ["old-sync", "resolved-immediate", "native-settled"].includes(v.name))) {
      const name = `${input}-${variant.name}`;
      const context = await browser.newContext({ viewport: { width: 1000, height: 720 },
        recordVideo: { dir: testInfo.outputPath(name), size: { width: 1000, height: 720 } } });
      const page = await context.newPage();
      await startupProbe(page, input);
      await page.goto(`http://127.0.0.1:4191/?resize-demo=1&input=${input}&${variant.query}`);
      const startup = await ready(page, input);
      await page.locator("h1").evaluate((el, label) => { el.textContent = label; }, variant.name);
      await page.waitForTimeout(400);
      const videoOrigin = await page.evaluate(() => performance.now());
      const result = await runResizeScenario(page);
      await page.waitForTimeout(800);
      await context.close();
      await page.video()!.saveAs(testInfo.outputPath(`${name}.webm`));
      await writeFile(testInfo.outputPath(`${name}.json`), JSON.stringify({ videoOrigin, startup, ...result }, null, 2));
    }
  }
});
