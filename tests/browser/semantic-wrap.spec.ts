import { expect, test } from "@playwright/test";

test("renders a selected hard break without adding a wrapper", async ({ page }) => {
  await page.goto("/");

  const title = page.locator("#title");
  await expect(page.locator("#root > #title")).toHaveCount(1);
  await expect(title).toHaveClass("title");
  await expect(title.locator("br")).toHaveCount(1);
  await expect(title).toHaveText("하나 둘 셋");
});

test("remeasures after a resize and returns to native wrapping", async ({ page }) => {
  await page.goto("/");

  const title = page.locator("#title");
  await expect(title.locator("br")).toHaveCount(1);

  await title.evaluate((element) => {
    element.style.width = "320px";
  });

  await expect(title.locator("br")).toHaveCount(0);
  await expect(title).toHaveText("하나 둘 셋");
});
