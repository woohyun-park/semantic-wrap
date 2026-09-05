import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { runResizeScenario } from "./resize-scenario.js";

test("preserves all frozen global layout diagnostics including previous quality regressions", async ({ browser }, testInfo) => {
  test.skip(process.env.SEMANTIC_WRAP_RESIZE_QUALITY !== "1", "requires frozen baseline bundle");
  test.setTimeout(120_000);
  const pairs: { id: string; step: number; width: number; layoutFingerprint: string }[][] = [];
  for (const before of [true, false]) {
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:4191/?native-parity=true${before ? "&before=1" : ""}`);
      pairs.push(await page.evaluate(() => Reflect.get(window, "__nearbyBenchmark")({
        algorithms: ["optimal-batched"], compareLayouts: true,
      })));
    } finally { await page.close(); }
  }
  expect(pairs[0]).toHaveLength(68);
  expect(pairs[1]).toHaveLength(68);
  for (const row of pairs[0]!) {
    const after = pairs[1]!.find((value) => value.id === row.id && value.step === row.step)!;
    expect(after.layoutFingerprint, `${row.id} / ${row.width}px`).toBe(row.layoutFingerprint);
  }
  await writeFile(testInfo.outputPath("resize-quality.json"), JSON.stringify({ identical: 68, uniqueConditions: 51 }));
});

test("profiles cooperative resize long tasks", async ({ page }, testInfo) => {
  test.skip(process.env.SEMANTIC_WRAP_RESIZE_TRACE !== "1", "diagnostic profiling only");
  const session = await page.context().newCDPSession(page);
  await page.goto("/?resize-demo=1&input=double");
  await expect(page.locator("#resize-text")).not.toHaveCSS("opacity", "0");
  await page.waitForTimeout(300);
  const events: unknown[] = [];
  session.on("Tracing.dataCollected", ({ value }) => events.push(...value));
  await session.send("Tracing.start", {
    categories: "devtools.timeline,v8,disabled-by-default-v8.gc",
    transferMode: "ReportEvents",
  });
  const result = await runResizeScenario(page);
  const complete = new Promise<void>((resolve) =>
    session.once("Tracing.tracingComplete", () => resolve()),
  );
  await session.send("Tracing.end");
  await complete;
  await writeFile(
    testInfo.outputPath("resize-trace.json"),
    JSON.stringify({ traceEvents: events }),
  );
  console.log(JSON.stringify(result.taskDurations));
});

test("compares frozen synchronous resize with cooperative resize", async ({
  browser,
}, testInfo) => {
  test.skip(
    process.env.SEMANTIC_WRAP_RESIZE_BENCHMARK !== "1",
    "requires a frozen baseline bundle",
  );
  test.setTimeout(240_000);
  const rows = [];
  for (const input of ["short", "medium", "long", "unique", "double"]) {
    for (let repetition = 0; repetition < 3; repetition += 1) {
      const pair = [];
      for (const before of repetition % 2 ? [false, true] : [true, false]) {
        const context = await browser.newContext({ viewport: { width: 1000, height: 720 } });
        const page = await context.newPage();
        try {
          await page.goto(
            `http://127.0.0.1:4191/?resize-demo=1&input=${input}${before ? "&before=1" : ""}`,
          );
          await expect(page.locator("#resize-text")).not.toHaveCSS("opacity", "0");
          if (input === "short")
            await page.locator("#resize-text").evaluate((element) => {
              element.style.fontSize = "28px";
            });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(250);
          const result = await runResizeScenario(page);
          pair.push(result);
          rows.push({ input, repetition, before, ...result });
        } finally {
          await context.close();
        }
      }
      expect(pair[0]!.finalHTML, `${input} final wrapping`).toBe(pair[1]!.finalHTML);
    }
  }
  await writeFile(testInfo.outputPath("resize-comparison.json"), JSON.stringify(rows, null, 2));
  console.log(
    JSON.stringify(
      rows.map(({ frames, changes, taskDurations, finalHTML, finalText, ...row }) => row),
      null,
      2,
    ),
  );
});

test("records before and after resize separately at original speed", async ({
  browser,
}, testInfo) => {
  test.skip(process.env.SEMANTIC_WRAP_RESIZE_VIDEO !== "1", "run the separate recording pass");
  test.setTimeout(120_000);
  for (const input of ["short", "long"]) {
    for (const before of [true, false]) {
      const name = `${input}-${before ? "before" : "after"}`;
      const context = await browser.newContext({
        viewport: { width: 1000, height: 720 },
        recordVideo: { dir: testInfo.outputPath(name), size: { width: 1000, height: 720 } },
      });
      const page = await context.newPage();
      await page.goto(
        `http://127.0.0.1:4191/?resize-demo=1&input=${input}${before ? "&before=1" : ""}`,
      );
      await expect(page.locator("#resize-text")).not.toHaveCSS("opacity", "0");
      if (input === "short")
        await page.locator("#resize-text").evaluate((element) => {
          element.style.fontSize = "28px";
        });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const result = await runResizeScenario(page);
      await page.waitForTimeout(800);
      await context.close();
      await page.video()!.saveAs(testInfo.outputPath(`${name}.webm`));
      await writeFile(testInfo.outputPath(`${name}.json`), JSON.stringify(result, null, 2));
    }
  }
});
