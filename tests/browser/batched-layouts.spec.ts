import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

interface Row {
  id: string;
  algorithm: string;
  repetition: number;
  step: number;
  width: number;
  totalMs: number;
  textReads: number;
  retainedProbes: number;
  layoutFingerprint: string;
  [key: string]: unknown;
}

function verifyParity(rows: Row[]) {
  let pairs = 0;
  for (const row of rows.filter(({ algorithm }) => algorithm === "optimal-batched")) {
    const before = rows.find(
      (old) =>
        old.algorithm === "optimal" &&
        old.id === row.id &&
        old.step === row.step &&
        old.repetition === row.repetition,
    )!;
    expect(row.layoutFingerprint, `${row.id} / ${row.width}px / repetition ${row.repetition}`).toBe(
      before.layoutFingerprint,
    );
    expect(row.retainedProbes).toBeLessThanOrEqual(64);
    pairs += 1;
  }
  expect(pairs).toBeGreaterThan(0);
  return pairs;
}

test("batched global search preserves full layouts on titles and text edge cases", async ({
  page,
}) => {
  await page.goto("/?native-parity=true");
  const rows: Row[] = await page.evaluate(() =>
    Reflect.get(
      window,
      "__nearbyBenchmark",
    )({
      algorithms: ["optimal", "optimal-batched"],
      caseIds: [
        "docs-en-readers",
        "docs-en-trust",
        "docs-en-audience",
        "docs-ko-before",
        "docs-ko-readable",
        "docs-ko-purpose",
        "medium",
        "emoji",
        "whitespace",
        "characters",
        "break-all",
        "overlong",
        "empty",
        "single",
      ],
      widths: [140, 240, 360, 240],
      compareLayouts: true,
    }),
  );
  expect(verifyParity(rows)).toBe(56);
});

test("compares scalar and batched measurement with identical global search", async ({
  page,
}, testInfo) => {
  test.skip(process.env.SEMANTIC_WRAP_BATCH_BENCHMARK !== "1", "run bun run bench:batch");
  test.setTimeout(240_000);
  await page.goto("/?native-parity=true");
  const rows: Row[] = await page.evaluate(() =>
    Reflect.get(
      window,
      "__nearbyBenchmark",
    )({
      algorithms: ["optimal", "optimal-batched"],
      repeats: 3,
      compareLayouts: true,
    }),
  );
  const identicalPairs = verifyParity(rows);
  const timings = [...new Set(rows.map((row) => `${row.id}:${row.step}`))].map((key) => {
    const group = rows.filter((row) => `${row.id}:${row.step}` === key);
    const metrics = (algorithm: string) => {
      const values = group
        .filter((row) => row.algorithm === algorithm)
        .sort((a, b) => a.totalMs - b.totalMs);
      return {
        medianMs: values[1]!.totalMs,
        maxMs: values[2]!.totalMs,
        textReads: values[1]!.textReads,
        retainedProbes: values[1]!.retainedProbes,
      };
    };
    return {
      id: group[0]!.id,
      width: group[0]!.width,
      step: group[0]!.step,
      scalar: metrics("optimal"),
      batched: metrics("optimal-batched"),
    };
  });
  await writeFile(
    testInfo.outputPath("batch-comparison.json"),
    JSON.stringify(
      {
        identicalPairs,
        timings,
        rows: rows.map(({ layoutFingerprint, ...row }) => row),
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        identicalPairs,
        timings: timings.filter((row) => row.id.startsWith("long") || row.id === "docs-ko-purpose"),
      },
      null,
      2,
    ),
  );
});
