import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

interface Row {
  id: string;
  algorithm: string;
  repetition: number;
  step: number;
  width: number;
  totalMs: number;
  textReadMs: number;
  textReads: number;
  nativeMs: number;
  predictionMs: number;
  otherMs: number;
  retainedWidths: number;
  retainedKeyCodeUnits: number;
  breaks: number[];
  lines: string[];
  applied: boolean;
  overflow: boolean;
  lineCount: number;
  modelCost: number;
  balanceScore: number;
  nativeModelCost: number;
  nativeLineCount: number;
  nativeOverflow: boolean;
  nativeBreaks: number[];
  allowedOffsets: number[];
  sourceText: string;
}

function verifySafety(rows: Row[]) {
  for (const row of rows) {
    expect(row.retainedWidths).toBeLessThanOrEqual(128);
    if (!row.nativeOverflow) {
      expect(row.overflow, `${row.id} ${row.algorithm} overflow`).toBe(false);
      expect(row.lineCount).toBeLessThanOrEqual(row.nativeLineCount);
    }
    if (row.applied) {
      expect(row.breaks.every((offset) => row.allowedOffsets.includes(offset))).toBe(true);
      if (!row.nativeOverflow) {
        expect(row.lineCount).toBe(row.nativeLineCount);
        expect(row.modelCost).toBeLessThan(row.nativeModelCost - 1e-9);
      }
    } else {
      expect(row.breaks).toEqual(row.nativeBreaks);
    }
    expect(row.breaks.every((value, index) => index === 0 || row.breaks[index - 1]! < value)).toBe(
      true,
    );
    if (row.sourceText !== undefined) {
      let start = 0;
      const expectedLines: string[] = [];
      for (const offset of row.breaks) {
        expectedLines.push(row.sourceText.slice(start, offset));
        start = offset;
        while (start < row.sourceText.length && /\s/u.test(row.sourceText[start]!)) start += 1;
      }
      if (row.sourceText !== "") expectedLines.push(row.sourceText.slice(start));
      expect(row.lines).toEqual(expectedLines);
    }
  }
}

test("nearby React rendering survives resize, input/font changes, font loading and cleanup", async ({
  page,
}) => {
  await page.goto("/?nearby-react=true");
  const status = page.locator("#nearby-react-status");
  const calculationCalls = () =>
    page.evaluate(() => Number(Reflect.get(window, "__nearbyIntegrationCalls")));
  const verify = async () => {
    await expect(status).toHaveAttribute("data-ready", "true");
    await expect
      .poll(async () => {
        const lines = JSON.parse((await status.getAttribute("data-lines"))!);
        const expected =
          (await status.getAttribute("data-applied")) === "true"
            ? lines.join("\n")
            : await status.getAttribute("data-source");
        return (await page.locator("#nearby-rendered").innerText()) === expected;
      })
      .toBe(true);
    await expect(page.locator("#nearby-container > #nearby-rendered")).toHaveCount(1);
  };
  await verify();
  await expect(page.locator("#nearby-rendered br")).toHaveCount(1);
  for (const width of [240, 460, 320]) {
    const calls = await calculationCalls();
    await page.locator("#nearby-container").evaluate((element, width) => {
      element.style.width = `${width}px`;
    }, width);
    await expect.poll(calculationCalls).toBeGreaterThan(calls);
    await verify();
  }
  for (const id of ["nearby-text", "nearby-font"]) {
    const calls = await calculationCalls();
    await page.locator(`#${id}`).click();
    await expect.poll(calculationCalls).toBeGreaterThan(calls);
    await verify();
  }
  const calls = await calculationCalls();
  await page.evaluate(() => document.fonts.dispatchEvent(new Event("loadingdone")));
  await expect.poll(calculationCalls).toBeGreaterThan(calls);
  await verify();
  await page.locator("#nearby-visible").click();
  await expect(page.locator('[aria-hidden="true"]')).toHaveCount(0);
  await page.locator("#nearby-visible").click();
  await verify();
});

test("nearby search preserves native safety across text and wrapping modes", async ({ page }) => {
  await page.goto("/?native-parity=true");
  const rows = (await page.evaluate(async () => {
    const run = Reflect.get(window, "__nearbyBenchmark");
    return run({
      caseIds: [
        "docs-ko-before",
        "docs-en-readers",
        "emoji",
        "whitespace",
        "break-all",
        "characters",
        "overlong",
        "empty",
        "single",
      ],
      widths: [140, 240, 360],
    });
  })) as Row[];
  expect(rows.length).toBeGreaterThan(50);
  verifySafety(rows);
});

test("compares nearby search speed and quality against optimal search", async ({
  page,
}, testInfo) => {
  test.skip(process.env.SEMANTIC_WRAP_NEARBY_BENCHMARK !== "1", "run bun run bench:nearby");
  test.setTimeout(240_000);
  await page.goto("/?native-parity=true");
  const rows = (await page.evaluate(async () => {
    return Reflect.get(window, "__nearbyBenchmark")({ repeats: 3 });
  })) as Row[];
  verifySafety(rows);
  const percentile = (values: number[], p: number) => {
    const sorted = [...values].sort((a, b) => a - b);
    if (p === 0.5 && sorted.length % 2 === 0) {
      return (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
    }
    return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]!;
  };
  const quality = ["nearby-1", "nearby-2", "nearby-4"].map((algorithm) => {
    const pairs = rows
      .filter((row) => row.algorithm === algorithm && row.repetition === 0 && row.step < 3)
      .map((row) => ({
        row,
        old: rows.find(
          (old) =>
            old.id === row.id &&
            old.step === row.step &&
            old.algorithm === "optimal" &&
            old.repetition === row.repetition,
        )!,
      }));
    return {
      algorithm,
      cases: pairs.length,
      identical: pairs.filter(({ row, old }) => row.breaks.join() === old.breaks.join()).length,
      missedImprovement: pairs.filter(({ row, old }) => old.applied && !row.applied).length,
      worseModel: pairs.filter(({ row, old }) => row.modelCost > old.modelCost + 1e-9).length,
      worseBalance: pairs.filter(({ row, old }) => row.balanceScore > old.balanceScore + 1e-9)
        .length,
      worst: pairs
        .map(({ row, old }) => ({
          id: row.id,
          width: row.width,
          modelDelta: row.modelCost - old.modelCost,
          balanceDelta: row.balanceScore - old.balanceScore,
          before: old.lines,
          after: row.lines,
        }))
        .sort((a, b) => b.modelDelta - a.modelDelta || b.balanceDelta - a.balanceDelta)
        .slice(0, 3),
    };
  });
  const timings = [...new Set(rows.map(({ id }) => id))].flatMap((id) =>
    ["optimal", "nearby-1", "nearby-2", "nearby-4"].flatMap((algorithm) =>
      [...new Set(rows.filter((row) => row.id === id).map(({ step }) => step))].map((step) => {
        const group = rows.filter(
          (row) => row.id === id && row.algorithm === algorithm && row.step === step,
        );
        return {
          id,
          algorithm,
          step,
          width: group[0]!.width,
          medianMs: percentile(
            group.map(({ totalMs }) => totalMs),
            0.5,
          ),
          p95Ms: percentile(
            group.map(({ totalMs }) => totalMs),
            0.95,
          ),
          maxMs: Math.max(...group.map(({ totalMs }) => totalMs)),
          medianTextReads: percentile(
            group.map(({ textReads }) => textReads),
            0.5,
          ),
        };
      }),
    ),
  );
  const report = { quality, timings, rows };
  await writeFile(testInfo.outputPath("nearby-comparison.json"), JSON.stringify(report, null, 2));
  const worst = quality.find(({ algorithm }) => algorithm === "nearby-2")!.worst[0]!;
  await page.setViewportSize({ width: 1900, height: 500 });
  await page.evaluate((worst) => {
    document.querySelector("#root")!.replaceChildren();
    const gallery = document.createElement("section");
    gallery.id = "quality-comparison";
    gallery.style.cssText = "display:flex;gap:32px;padding:20px;background:white;color:black";
    for (const [name, lines] of [
      ["Optimal", worst.before],
      ["Nearby (radius 2)", worst.after],
    ] as const) {
      const column = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = `${name}: ${worst.id}, ${worst.width}px (first 4 lines)`;
      const text = document.createElement("p");
      text.style.cssText = `width:${worst.width}px;font:600 16px/1.45 system-ui;letter-spacing:-0.035em;white-space:pre;word-break:keep-all`;
      text.textContent = lines.slice(0, 4).join("\n");
      column.append(title, text);
      gallery.append(column);
    }
    document.body.append(gallery);
  }, worst);
  await page
    .locator("#quality-comparison")
    .screenshot({ path: testInfo.outputPath("quality-comparison.png") });
  console.log(
    JSON.stringify(
      {
        quality: quality.map(({ worst, ...rest }) => rest),
        long: timings.filter(({ id, width }) => id === "long-repeated" && width === 900),
      },
      null,
      2,
    ),
  );
});
