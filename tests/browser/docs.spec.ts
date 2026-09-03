import { expect, test } from "@playwright/test";

const docsUrl = "http://127.0.0.1:4192/ko/docs/introduction";
const landingUrl = "http://127.0.0.1:4192/";

test("moves the document without letting sidebar centering override the anchor", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(docsUrl);

  const initialTop = await page.locator("#diagnostics").evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  await page.locator('.docs-sidebar a[href$="#diagnostics"]').click();
  await expect(page).toHaveURL(`${docsUrl}#diagnostics`);
  expect(initialTop).toBeGreaterThan(720);
  await expect.poll(async () =>
    page.locator("#diagnostics").evaluate((element) => element.getBoundingClientRect().top),
  ).toBeLessThan(240);
});

test("keeps maintainer release instructions out of the public docs", async ({ page }) => {
  await page.goto(docsUrl);

  await expect(page.locator('.docs-side-nav a[href$="#release"]')).toHaveCount(0);
  await expect(page.locator("#release")).toHaveCount(0);
});

test("shows an actual semantic before and after in the process", async ({ page }) => {
  await page.goto(landingUrl);
  await page.locator('.process-list [data-process-step="1"] button').click();

  const visualLineCounts = await page.locator(".process-layout-option p").evaluateAll(
    (paragraphs) => paragraphs.map((paragraph) => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(paragraph).lineHeight);
      return Math.round(paragraph.getBoundingClientRect().height / lineHeight);
    }),
  );
  expect(visualLineCounts.length).toBeGreaterThan(0);
  expect(visualLineCounts.every((lineCount) => lineCount === 2)).toBe(true);

  await page.locator('.process-list [data-process-step="2"] button').click();

  const comparison = page.locator(".process-selection-comparison");
  await expect(comparison).toHaveAttribute("data-result", "applied");
  await expect(comparison.locator(".is-native > span")).toHaveText("BEFORE");
  await expect(comparison.locator(".is-semantic > span")).toHaveText("AFTER");
  expect(await comparison.locator(".is-native p").innerText()).toBe(
    "효율적인 회의를 만들기\n위해 버려야 할 습관",
  );
  await expect(comparison.locator(".is-native p")).not.toHaveText(
    await comparison.locator(".is-semantic p").innerText(),
  );
  expect(await comparison.locator(".is-semantic p").innerText()).toBe(
    "효율적인 회의를\n만들기 위해 버려야 할 습관",
  );
  await expect(comparison.locator(".process-selection-reason")).toHaveCount(0);
  await expect(page.locator(".process-stage-status")).toContainText("목적을 분명하게");
});

test("keeps the desktop process panels at one shared height", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(landingUrl);

  const panelHeights = await page.locator(".process-list, .process-stage").evaluateAll(
    (panels) => panels.map((panel) => panel.getBoundingClientRect().height),
  );
  expect(panelHeights).toHaveLength(2);
  expect(Math.abs(panelHeights[0]! - panelHeights[1]!)).toBeLessThan(1);

  const rowHeights = await page.locator(".process-list > li").evaluateAll(
    (rows) => rows.map((row) => row.getBoundingClientRect().height),
  );
  expect(Math.max(...rowHeights) - Math.min(...rowHeights)).toBeLessThan(1);

  await page.locator('.process-list [data-process-step="1"] button').click();
  await expect(page.locator(".process-stage-scene")).toHaveCount(1);
  await expect(page.locator(".process-layout-options")).toBeVisible();
  const verticalCenters = await page.locator(
    ".process-stage-scene, .process-layout-options",
  ).evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.top + bounds.height / 2;
  }));
  expect(verticalCenters).toHaveLength(2);
  expect(Math.abs(verticalCenters[0]! - verticalCenters[1]!)).toBeLessThan(1);
});

test("renders labelled before and after scenes without motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(landingUrl);

  await expect(page.locator(".line-break-scene-context")).toHaveCount(6);
  await expect(page.locator(".intro-message-copy")).toContainText("줄바꿈을자연스럽게");
  await expect(page.getByText("BEFORE", { exact: true })).toHaveCount(6);
  await expect(page.getByText("AFTER", { exact: true })).toHaveCount(6);
  await expect(page.locator(".text-shimmer")).toHaveCount(4);
  await expect(page.locator(".text-shimmer").first()).toBeHidden();
});

test("reveals the intro message in four distinct scroll stages", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(landingUrl);

  const scrollToStoryPosition = async (position: number) => {
    await page.evaluate((nextPosition) => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, window.innerHeight * nextPosition);
      return new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      });
    }, position);
  };
  const story = page.locator(".intro-story");
  const source = page.locator(".intro-message-source");
  const highlight = page.locator(".intro-message-highlight");
  const storyHeightInViewports = await story.evaluate((element) =>
    element.getBoundingClientRect().height / window.innerHeight);
  expect(storyHeightInViewports).toBeCloseTo(12.6, 1);

  await scrollToStoryPosition(1.2);
  await expect(story).toHaveAttribute("data-intro-message-phase", "blank");
  await expect(source).toHaveCSS("opacity", "0");
  await expect(highlight).toHaveCSS("opacity", "0");

  await scrollToStoryPosition(1.6);
  await expect(story).toHaveAttribute("data-intro-message-phase", "source");
  await expect(source).toHaveCSS("opacity", "1");
  await expect(highlight).toHaveCSS("opacity", "0");

  await scrollToStoryPosition(2.2);
  await expect(story).toHaveAttribute("data-intro-message-phase", "complete");
  await expect(highlight).toHaveCSS("opacity", "1");
  await expect(story).not.toHaveAttribute("data-shimmer-active", "true");

  await scrollToStoryPosition(2.69);
  await expect(story).toHaveAttribute("data-shimmer-active", "true");
});

test("triggers one shared shimmer after crossing the scene threshold", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(landingUrl);

  const scrollToStoryPosition = async (position: number) => {
    await page.evaluate((nextPosition) => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, window.innerHeight * nextPosition);
      return new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      });
    }, position);
  };
  const readShimmer = async (selector: string) => page.locator(selector).evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      backgroundImage: styles.backgroundImage,
      backgroundSize: styles.backgroundSize,
      filter: styles.filter,
    };
  });
  const readScale = async (selector: string) => page.locator(selector).evaluate((element) => {
    const transform = window.getComputedStyle(element).transform;
    return transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a;
  });

  const story = page.locator(".intro-story");
  await scrollToStoryPosition(2.52);
  const message = page.locator('.intro-message-stage[data-intro-current="true"]');
  await expect(message).toBeVisible();
  const messageShimmerSelector =
    '.intro-message-stage[data-intro-current="true"] .text-shimmer';
  const messageTargetSelector =
    '.intro-message-stage[data-intro-current="true"] .text-shimmer-target';
  await expect(story).not.toHaveAttribute("data-shimmer-active", "true");
  await expect(page.locator(messageTargetSelector)).toHaveAttribute("data-motion-shimmer", "idle");

  await scrollToStoryPosition(2.56);
  await expect(story).toHaveAttribute("data-shimmer-active", "true");
  await expect(page.locator(messageTargetSelector)).toHaveAttribute("data-motion-shimmer", "active");
  await page.waitForTimeout(55);
  expect(await readScale(messageTargetSelector)).toBeLessThan(0.99);
  await expect.poll(async () => Number(
    await page.locator(messageShimmerSelector).evaluate((element) =>
      window.getComputedStyle(element).opacity),
  )).toBeGreaterThan(0.5);
  const messageShimmer = await readShimmer(messageShimmerSelector);
  await expect.poll(() => readScale(messageTargetSelector)).toBe(1);
  await page.waitForTimeout(300);
  await expect(page.locator(messageShimmerSelector)).toHaveCSS("opacity", "0");
  await expect(page.locator(messageShimmerSelector)).toHaveCSS("background-position", "-30% 50%");
  const messageTargetGradient = await page.locator(messageTargetSelector).evaluate((element) =>
    window.getComputedStyle(element).backgroundImage);
  expect(messageTargetGradient).toContain("linear-gradient");

  await scrollToStoryPosition(1.2);
  await expect(story).not.toHaveAttribute("data-shimmer-active", "true");

  await scrollToStoryPosition(3.7);
  await expect(
    page.locator('.line-break-composition[data-intro-current="true"][data-semantic="false"]'),
  ).toBeVisible();
  await page.waitForTimeout(700);
  await scrollToStoryPosition(4.72);
  await expect(story).not.toHaveAttribute("data-shimmer-active", "true");
  const semanticScene = page.locator(
    '.line-break-composition[data-intro-current="true"][data-semantic="true"]',
  );
  await expect(semanticScene).toBeVisible();
  const flipIsRunning = async () => semanticScene.locator("[data-motion-layout]").evaluateAll(
    (pieces) => pieces.some((piece) => window.getComputedStyle(piece).transform !== "none"),
  );
  expect(await flipIsRunning()).toBe(true);
  await expect(story).not.toHaveAttribute("data-shimmer-active", "true");
  await expect.poll(flipIsRunning).toBe(false);
  await expect(story).not.toHaveAttribute("data-shimmer-active", "true");

  await scrollToStoryPosition(5.42);
  await expect(story).toHaveAttribute("data-shimmer-active", "true");
  const exampleShimmerSelector =
    '.line-break-composition[data-intro-current="true"] .text-shimmer';
  const exampleTargetSelector =
    '.line-break-composition[data-intro-current="true"] .text-shimmer-target';
  const exampleShimmer = await readShimmer(
    exampleShimmerSelector,
  );
  expect(exampleShimmer.backgroundImage).toBe(messageShimmer.backgroundImage);
  expect(exampleShimmer.backgroundSize).toBe(messageShimmer.backgroundSize);
  expect(exampleShimmer.filter).toContain("rgba(83, 139, 246, 0.68)");
  expect(messageShimmer.filter).toContain("rgba(83, 139, 246, 0.68)");
  await expect(page.locator(exampleTargetSelector)).toHaveAttribute("data-motion-shimmer", "active");
  const exampleTargetGradient = await page.locator(exampleTargetSelector).evaluate((element) =>
    window.getComputedStyle(element).backgroundImage);
  expect(exampleTargetGradient).toBe(messageTargetGradient);

  await scrollToStoryPosition(6.6);
  await expect(story).not.toHaveAttribute("data-shimmer-active", "true");
  await scrollToStoryPosition(5);
  await expect(story).not.toHaveAttribute("data-shimmer-active", "true");
});

test("centers the main headline independently from its context", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 620 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(landingUrl);
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, window.innerHeight * 3.7);
    });

    const scene = page.locator('.line-break-composition[data-intro-current="true"]');
    await expect(scene).toBeVisible();
    await page.waitForTimeout(700);
    const headline = await scene.locator(".line-break-headline").boundingBox();
    const context = await scene.locator(".line-break-scene-context").boundingBox();
    expect(headline).not.toBeNull();
    expect(context).not.toBeNull();
    expect(Math.abs((headline?.y ?? 0) + (headline?.height ?? 0) / 2 - viewport.height / 2))
      .toBeLessThan(2);
    expect((context?.y ?? 0) + (context?.height ?? 0)).toBeLessThan(headline?.y ?? 0);
  }
});

test("applies semantic wrapping to the first playground preset", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(landingUrl);

  const preset = page.locator(".headline-presets button").first().locator("strong");
  await expect(preset.locator("br")).not.toHaveCount(0);
});
