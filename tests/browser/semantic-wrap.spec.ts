import { expect, test } from "@playwright/test";

test("finds the same native line starts as a per-character scan", async ({ page }) => {
  await page.goto("/?native-parity=true");

  const output = page.locator("#native-layout-parity");
  await expect(output).not.toHaveText("");
  const cases = JSON.parse((await output.textContent()) ?? "[]") as Array<{
    id: string;
    optimized: number[];
    linear: number[];
  }>;
  expect(cases.length).toBeGreaterThan(0);
  for (const result of cases) expect(result.optimized, result.id).toEqual(result.linear);
});

test("renders a selected hard break without adding a wrapper", async ({ page }) => {
  await page.goto("/");

  const title = page.locator("#title");
  await expect(page.locator("#root > #title")).toHaveCount(1);
  await expect(title).toHaveClass("title");
  await expect(title.locator("br")).toHaveCount(1);
  await expect(title).not.toHaveCSS("opacity", "0");
  expect(await title.innerText()).toBe("하나\n둘 셋");
});

test("activates progressive on viewport resize without an element width change", async ({
  page,
}) => {
  await page.goto("/");

  const title = page.locator("#progressive-title");
  await expect(title.locator("br")).toHaveCount(0);
  await expect(title).not.toHaveCSS("opacity", "0");

  const widthBeforeResize = await title.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  await page.setViewportSize({ width: 900, height: 720 });

  await expect(title.locator("br")).toHaveCount(1);
  expect(await title.evaluate((element) => element.getBoundingClientRect().width)).toBe(
    widthBeforeResize,
  );
  expect(await title.innerText()).toBe("하나\n둘 셋");

  await page.locator("#change-progressive-strategy").click();
  await expect(title.locator("br")).toHaveCount(1);
  expect(await title.innerText()).toBe("하나 둘\n셋");
});

test("commits each resize without exposing a break-free intermediate frame", async ({ page }) => {
  await page.goto("/");

  const title = page.locator("#atomic-title");
  await expect(title.locator("br")).toHaveCount(1);
  const snapshots = await title.evaluate(async (element) => {
    const container = element.parentElement!;
    const observed: string[] = [];
    const observer = new MutationObserver(() => observed.push(element.innerHTML));
    observer.observe(element, { childList: true, subtree: true });

    for (const width of [320, 200, 320, 200]) {
      container.style.width = `${width}px`;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      observed.push(element.innerHTML);
    }

    observer.disconnect();
    return observed;
  });

  expect(snapshots.length).toBeGreaterThan(0);
  expect(snapshots.every((html) => html.includes("<br>"))).toBe(true);
});

test("reuses text widths across resizes and invalidates them for typography changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const stats = { probeAppends: 0, probeReads: 0, probeRemoves: 0 };
    Object.defineProperty(window, "__semanticWrapMeasurementStats", { value: stats });
    const isProbe = (value: unknown) =>
      value instanceof HTMLElement && value.getAttribute("aria-hidden") === "true";
    const append = Element.prototype.append;
    Element.prototype.append = function (...nodes) {
      stats.probeAppends += nodes.filter(isProbe).length;
      return append.apply(this, nodes);
    };
    const remove = Element.prototype.remove;
    Element.prototype.remove = function () {
      if (isProbe(this)) stats.probeRemoves += 1;
      return remove.call(this);
    };
    const getBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (
        this instanceof HTMLSpanElement &&
        this.style.position === "fixed" &&
        this.style.visibility === "hidden"
      ) {
        stats.probeReads += 1;
      }
      return getBoundingClientRect.call(this);
    };
  });
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const stats = Reflect.get(window, "__semanticWrapMeasurementStats") as Record<
      "probeAppends" | "probeReads" | "probeRemoves",
      number
    >;
    Object.assign(stats, { probeAppends: 0, probeReads: 0, probeRemoves: 0 });
  });

  const resizeAtomicTitle = async (width: number) => {
    await page.locator("#atomic-container").evaluate((element, nextWidth) => {
      element.style.width = `${nextWidth}px`;
    }, width);
    await page.evaluate(() =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
    );
  };
  const probeReads = () => page.evaluate(() => (
    Reflect.get(window, "__semanticWrapMeasurementStats") as { probeReads: number }
  ).probeReads);
  const probeLifecycle = () => page.evaluate(() => {
    const stats = Reflect.get(window, "__semanticWrapMeasurementStats") as {
      probeAppends: number;
      probeRemoves: number;
    };
    return [stats.probeAppends, stats.probeRemoves];
  });

  await resizeAtomicTitle(320);
  const readsAfterNewLayout = await probeReads();
  expect(readsAfterNewLayout).toBeGreaterThan(0);

  await resizeAtomicTitle(200);
  await resizeAtomicTitle(320);
  expect(await probeReads()).toBe(readsAfterNewLayout);
  expect(await probeLifecycle()).toEqual([0, 0]);

  await page.locator("#atomic-title").evaluate((element) => {
    element.style.fontSize = "31px";
  });
  await page.evaluate(() =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );
  expect(await probeReads()).toBeGreaterThan(readsAfterNewLayout);
  const [appendsAfterTypographyChange, removesAfterTypographyChange] = await probeLifecycle();
  expect(appendsAfterTypographyChange).toBeGreaterThan(0);
  expect(removesAfterTypographyChange).toBeGreaterThan(0);
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

test("applies the Korean process example at the documented measure", async ({ page }) => {
  await page.goto("/");

  const status = page.locator("#ko-applied-status");
  await expect(status).toHaveAttribute("data-applied", "true");
  await expect(status).toHaveText(
    "디자인 시스템을 도입하기 전에\n반드시 확인해야 할 기준",
  );
});
