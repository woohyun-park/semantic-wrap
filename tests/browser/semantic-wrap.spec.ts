import { expect, test } from "@playwright/test";

test("renders a selected hard break without adding a wrapper", async ({ page }) => {
  await page.goto("/");

  const title = page.locator("#title");
  await expect(page.locator("#root > #title")).toHaveCount(1);
  await expect(title).toHaveClass("title");
  await expect(title.locator("br")).toHaveCount(1);
  expect(await title.innerText()).toBe("하나\n둘 셋");
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

test("replaces the selected whitespace run with one hard break", async ({ page }) => {
  await page.goto("/");

  const title = page.locator("#whitespace-title");
  await expect(title.locator("br")).toHaveCount(1);
  expect(
    await title.evaluate((element) =>
      [...element.childNodes].map((node) =>
        node instanceof HTMLBRElement ? "BR" : node.textContent,
      ),
    ),
  ).toEqual(["하나", "BR", "둘"]);
});

test("preserves callback and object ref cleanup semantics", async ({ page }) => {
  await page.goto("/");

  const status = page.locator("#ref-status");
  await expect(status).toHaveAttribute("data-object-attached", "true");
  await expect(status).toHaveAttribute("data-callback-cleanups", "0");
  await page.locator("#unmount-ref-title").click();
  await expect(page.locator("#ref-title")).toHaveCount(0);
  await expect(status).toHaveAttribute("data-object-attached", "false");
  await expect(status).toHaveAttribute("data-callback-cleanups", "1");
});

test("updates selected candidate metadata when the model changes", async ({ page }) => {
  await page.goto("/");

  const name = page.locator("#candidate-name");
  await expect(name).toHaveText("initial");
  await page.locator("#change-candidate").click();
  await expect(name).toHaveText("alternate");
});

test("measures fonts whose computed shorthand is empty", async ({ page }) => {
  await page.goto("/");

  const delta = page.locator("#font-measurement-delta");
  await expect(delta).not.toHaveText("");
  expect(Number(await delta.textContent())).toBeLessThan(0.5);
});
