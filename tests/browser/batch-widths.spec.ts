import { expect, test } from "@playwright/test";

test("batch widths match scalar widths across typography, whitespace and probe lifecycle", async ({
  page,
}) => {
  await page.goto("/?native-parity=true");
  const result = await page.evaluate(() => Reflect.get(window, "__batchWidthChecks")());
  expect(result.rows).toHaveLength(10);
  for (const row of result.rows) {
    expect(row.actual, `${row.whiteSpace} / ${row.fontSize}`).toEqual(row.expected);
    expect(row.again).toEqual(row.expected);
    expect(row.probes).toBeLessThanOrEqual(64);
    expect(row.probes).toBeGreaterThan(1);
    expect(row.widths).toBeLessThanOrEqual(128);
    expect(row.reused).toBe(true);
    expect(row.oldConnected).toBe(0);
  }
  expect(result.remaining).toBe(0);
});
