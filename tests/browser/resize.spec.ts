import { expect, test } from "@playwright/test";

test("cancels pending long-text work on text, font and unmount changes", async ({ page }) => {
  await page.goto("/?resize-demo=1");
  await page.evaluate(() => document.fonts.ready);
  const title = page.locator("#resize-text");
  await expect(title).not.toHaveCSS("opacity", "0");
  // Preparing the large fixture under parallel browser load is not a latency check.
  // Resize latency has separate opt-in benchmarks; cancellation assertions stay below.
  await expect(title.locator("br")).not.toHaveCount(0, { timeout: 15_000 });
  await page.locator("#resize-container").evaluate((element) => {
    element.style.width = "360px";
  });
  await expect(title.locator("br")).toHaveCount(0);
  await expect(title).not.toHaveCSS("opacity", "0");
  await page.locator("#resize-change-text").click();
  await expect(title).toContainText("더 나은 제품을");
  await title.evaluate((element) => {
    element.style.fontSize = "28px";
  });
  await page.locator("#resize-container").evaluate((element) => {
    element.style.width = "240px";
  });
  // Native wrapping can already be optimal on Linux's system font. Compare against
  // a fresh selection at the same metrics instead of hard-coding macOS line breaks.
  const expected = await page.evaluate(() => Reflect.get(window, "__resizeReference")(
    "더 나은 제품을 만들기 위해 팀이 버려야 할 습관",
  ) as string);
  await expect.poll(() => title.innerText()).toBe(expected);
  await page.evaluate(() => document.fonts.dispatchEvent(new Event("loadingdone")));
  // Observe beyond the settling window so a transient native frame cannot pass.
  await page.waitForTimeout(200);
  await expect.poll(() => title.innerText()).toBe(expected);
  await page.locator("#resize-container").evaluate((element) => {
    element.style.width = "320px";
  });
  await page.locator("#resize-toggle").click();
  await expect(title).toHaveCount(0);
  await expect(page.locator('[aria-hidden="true"]')).toHaveCount(0);
  // Let any incorrectly retained timers fire before checking for leaked probes.
  await page.waitForTimeout(200);
  await expect(page.locator('[aria-hidden="true"]')).toHaveCount(0);
  await page.locator("#resize-toggle").click();
  await expect(title).not.toHaveCSS("opacity", "0");
  await expect(page.locator("#resize-container > #resize-text")).toHaveCount(1);
});
