import { expect, test } from "@playwright/test";

test("cancels pending long-text work on text, font and unmount changes", async ({ page }) => {
  await page.goto("/?resize-demo=1");
  const title = page.locator("#resize-text");
  await expect(title).not.toHaveCSS("opacity", "0");
  await expect(title.locator("br")).not.toHaveCount(0);
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
  await expect
    .poll(() => title.innerText())
    .toBe("더 나은 제품을\n만들기 위해\n팀이 버려야 할 습관");
  await page.evaluate(() => document.fonts.dispatchEvent(new Event("loadingdone")));
  await expect
    .poll(() => title.innerText())
    .toBe("더 나은 제품을\n만들기 위해\n팀이 버려야 할 습관");
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
