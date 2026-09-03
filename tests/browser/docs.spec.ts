import { expect, test } from "@playwright/test";

const docsUrl = "http://127.0.0.1:4192/ko/docs/introduction";
const landingUrl = "http://127.0.0.1:4192/ko";
const englishDocsUrl = "http://127.0.0.1:4192/docs/introduction";
const englishLandingUrl = "http://127.0.0.1:4192/";

test("serves English first and preserves the current documentation hash when switching languages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(englishLandingUrl);

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".intro-message-copy")).toContainText("Line breaks,naturally");
  await expect(page.locator('.main-nav a[href="/docs/introduction"]')).toHaveText("Docs");
  await expect(page.locator('.main-nav a[href="/ko"]')).toHaveText("한국어");

  await page.locator('.process-list [data-process-step="2"] button').click();
  const comparison = page.locator(".process-selection-comparison");
  await expect(comparison).toHaveAttribute("data-result", "applied");
  await expect(comparison.locator(".is-native p")).not.toHaveText(
    await comparison.locator(".is-semantic p").innerText(),
  );

  await page.goto(`${englishDocsUrl}#strategies`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#strategies")).toContainText("The default strategy");
  await expect(page.locator('.main-nav a[href="/ko/docs/introduction#strategies"]')).toHaveText("한국어");
});

test("keeps the Korean landing and docs available under the ko prefix", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(landingUrl);

  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.locator(".intro-message-copy")).toContainText("줄바꿈을자연스럽게");
  await expect(page.locator('.main-nav a[href="/ko/docs/introduction"]')).toHaveText("문서");
  await expect(page.locator('.main-nav a[href="/"]')).toHaveText("EN");
});

test("keeps the process section white while the surrounding page surfaces stay black", async ({ page }) => {
  await page.goto(englishLandingUrl);

  await expect(page.locator(".process-section")).toHaveCSS("background-color", "rgb(251, 251, 251)");
  await expect(page.locator(".playground-section")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(page.locator(".site-footer")).toHaveCSS("background-color", "rgb(0, 0, 0)");

  await page.goto(englishDocsUrl);
  await expect(page.locator(".docs-page")).toHaveCSS("background-color", "rgb(0, 0, 0)");

  await page.goto(docsUrl);
  await expect(page.locator(".docs-page")).toHaveCSS("background-color", "rgb(0, 0, 0)");
});

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

test("keeps the clicked document section selected during smooth scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(docsUrl);

  const targetHref = `${docsUrl}#diagnostics`;
  const targetLink = page.locator('.docs-sidebar a[href$="#diagnostics"]');
  await targetLink.click();
  await expect(targetLink).toHaveAttribute("aria-current", "location");

  const selectedHrefs = await page.evaluate(async (href) => {
    const samples: Array<string | null> = [];
    const target = document.getElementById("diagnostics")!;

    for (let frame = 0; frame < 120; frame += 1) {
      samples.push(document.querySelector<HTMLAnchorElement>(
        '.docs-sidebar a[aria-current="location"]',
      )?.href ?? null);

      const scrollMarginTop = Number.parseFloat(
        window.getComputedStyle(target).scrollMarginTop,
      ) || 0;
      const targetScrollY = Math.min(
        window.scrollY + target.getBoundingClientRect().top - scrollMarginTop,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      if (Math.abs(window.scrollY - targetScrollY) <= 2) break;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }

    return { href, samples };
  }, targetHref);

  expect(new Set(selectedHrefs.samples)).toEqual(new Set([selectedHrefs.href]));
  await expect.poll(async () =>
    page.locator("#diagnostics").evaluate((element) => element.getBoundingClientRect().top),
  ).toBeLessThan(240);
  await expect(targetLink).toHaveAttribute("aria-current", "location");
});

test("returns document selection to the scroll spy when navigation is interrupted", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(docsUrl);

  const targetLink = page.locator('.docs-sidebar a[href$="#diagnostics"]');
  await targetLink.click();
  await expect(targetLink).toHaveAttribute("aria-current", "location");

  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }));
    window.scrollTo({ behavior: "instant", top: 0 });
  });

  const overviewLink = page.locator('.docs-sidebar a[href="/ko/docs/introduction"]');
  await expect(overviewLink).toHaveAttribute("aria-current", "location");
  await expect(targetLink).not.toHaveAttribute("aria-current", "location");
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
  expect(visualLineCounts).toHaveLength(3);
  expect(visualLineCounts.every((lineCount) => lineCount === 2)).toBe(true);
  expect(new Set(await page.locator(".process-layout-option p").allInnerTexts()).size).toBe(3);

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

test("keeps the English process candidates and result on the same two-line premise", async ({ page }) => {
  await page.goto(englishLandingUrl);
  await expect(page.locator(".demo-headline-measure-source")).toHaveCSS("text-wrap", "balance");
  await expect(page.locator(".process-measure-source")).toHaveCSS("text-wrap", "balance");
  await page.locator('.process-list [data-process-step="1"] button').click();

  const visualLineCounts = await page.locator(".process-layout-option p").evaluateAll(
    (paragraphs) => paragraphs.map((paragraph) => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(paragraph).lineHeight);
      return Math.round(paragraph.getBoundingClientRect().height / lineHeight);
    }),
  );
  expect(visualLineCounts).toHaveLength(3);
  expect(visualLineCounts.every((lineCount) => lineCount === 2)).toBe(true);
  expect(new Set(await page.locator(".process-layout-option p").allInnerTexts()).size).toBe(3);

  await page.locator('.process-list [data-process-step="2"] button').click();

  const comparison = page.locator(".process-selection-comparison");
  await expect(comparison).toHaveAttribute("data-result", "applied");
  expect(await comparison.locator(".is-native p").innerText()).toBe(
    "Write clear headlines for\nreaders, not for reviewers",
  );
  expect(await comparison.locator(".is-semantic p").innerText()).toBe(
    "Write clear headlines\nfor readers, not for reviewers",
  );
});

test("uses an actual CSS balance selection for every landing example", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });

    for (const url of [englishLandingUrl, landingUrl]) {
      await page.goto(url);

      const measureSources = page.locator(".line-break-headline-measure-source");
      await expect(measureSources).toHaveCount(6);
      expect(await measureSources.evaluateAll((elements) => elements.every(
        (element) => window.getComputedStyle(element).textWrap === "balance",
      ))).toBe(true);
      await expect(page.locator(".process-measure-source")).toHaveCSS(
        "text-wrap",
        "balance",
      );
      await expect(page.locator(".demo-headline-measure-source")).toHaveCSS(
        "text-wrap",
        "balance",
      );

      const nativeHeadlines = page.locator(
        '.line-break-composition[data-semantic="false"] .line-break-headline',
      );
      const semanticHeadlines = page.locator(
        '.line-break-composition[data-semantic="true"] .line-break-headline',
      );
      await expect(nativeHeadlines).toHaveCount(3);
      await expect(semanticHeadlines).toHaveCount(3);

      await expect.poll(() => semanticHeadlines.evaluateAll((elements) => elements.map(
        (element) => element.getAttribute("data-selection-applied"),
      ))).toEqual(["true", "true", "true"]);

      for (let index = 0; index < 3; index += 1) {
        const nativeBreaks = await nativeHeadlines.nth(index).getAttribute("data-breaks");
        const semanticBreaks = await semanticHeadlines.nth(index).getAttribute("data-breaks");
        expect(nativeBreaks).not.toBe(semanticBreaks);
        expect(nativeBreaks?.split(",").length).toBe(semanticBreaks?.split(",").length);
      }

      const lineCountMatchesBreaks = await page.locator(".line-break-headline").evaluateAll(
        (headlines) => headlines.every((headline) => {
          const tokenTops = new Set(
            [...headline.querySelectorAll(".line-break-piece")].map(
              (piece) => Math.round(piece.getBoundingClientRect().top),
            ),
          );
          const breaks = headline.getAttribute("data-breaks");
          const expectedLines = breaks ? breaks.split(",").length + 1 : 1;
          return tokenTops.size === expectedLines;
        }),
      );
      expect(lineCountMatchesBreaks).toBe(true);

      await page.locator('.process-list [data-process-step="2"] button').click();
      await expect(page.locator(".process-selection-comparison")).toHaveAttribute(
        "data-result",
        "applied",
      );

      const presets = page.locator(".headline-presets button");
      for (let index = 0; index < 3; index += 1) {
        await presets.nth(index).click();
        await expect(page.locator(".measure-instrument")).toHaveAttribute(
          "data-result",
          "applied",
        );
        const browserText = await page.locator(
          ".measure-pane.is-browser .demo-headline:not(.demo-headline-measure-source)",
        ).innerText();
        await expect(page.locator(".measure-pane.is-semantic .demo-headline")).not.toHaveText(
          browserText,
        );
      }
    }
  }
});

test("leaves room for the English shimmer overlay at display size", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 3928, height: 1823 });
  await page.goto(englishLandingUrl);

  const target = page.locator(".intro-message-highlight .text-shimmer-target");
  const overlay = target.locator(".text-shimmer");
  await expect(overlay).toHaveCSS("overflow", "visible");
  const spacing = await target.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      paddingBlockStart: Number.parseFloat(styles.paddingBlockStart),
      paddingInlineEnd: Number.parseFloat(styles.paddingInlineEnd),
    };
  });
  expect(spacing.paddingBlockStart).toBeGreaterThan(0);
  expect(spacing.paddingInlineEnd).toBeGreaterThan(0);
});

test("keeps every gradient text paint box inside its clipping ancestors", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 800, height: 900 },
    { width: 1280, height: 900 },
    { width: 3928, height: 1823 },
  ]) {
    await page.setViewportSize(viewport);

    for (const url of [englishLandingUrl, landingUrl]) {
      await page.goto(url);

      const violations = await page.locator(".gradient-text-safe").evaluateAll((elements) => {
        const tolerance = 1;
        const failures: string[] = [];

        for (const [index, element] of elements.entries()) {
          const styles = window.getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          if (styles.display === "none" || bounds.width === 0 || bounds.height === 0) continue;

          const hasPaintPadding = [
            styles.paddingBlockStart,
            styles.paddingBlockEnd,
            styles.paddingInlineStart,
            styles.paddingInlineEnd,
          ].every((value) => Number.parseFloat(value) > 0);
          if (!hasPaintPadding || !styles.backgroundClip.includes("text")) {
            failures.push(`${index}: missing paint-safe styles`);
          }

          let ancestor = element.parentElement;
          while (ancestor) {
            const ancestorStyles = window.getComputedStyle(ancestor);
            const ancestorBounds = ancestor.getBoundingClientRect();
            const clipsX = ["clip", "hidden"].includes(ancestorStyles.overflowX)
              || ancestorStyles.contain.includes("paint");
            const clipsY = ["clip", "hidden"].includes(ancestorStyles.overflowY)
              || ancestorStyles.contain.includes("paint");

            if (clipsX && (
              bounds.left < ancestorBounds.left - tolerance
              || bounds.right > ancestorBounds.right + tolerance
            )) {
              failures.push(`${index}: clipped inline by ${ancestor.className || ancestor.tagName}`);
              break;
            }
            if (clipsY && (
              bounds.top < ancestorBounds.top - tolerance
              || bounds.bottom > ancestorBounds.bottom + tolerance
            )) {
              failures.push(`${index}: clipped block by ${ancestor.className || ancestor.tagName}`);
              break;
            }

            ancestor = ancestor.parentElement;
          }
        }

        return failures;
      });

      expect(violations, `${url} at ${viewport.width}px`).toEqual([]);
    }
  }
});

test("keeps every English semantic intro example to two visual lines", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto(englishLandingUrl);

  const lineCounts = await page
    .locator('.line-break-composition[data-semantic="true"] .line-break-headline')
    .evaluateAll((headlines) => headlines.map((headline) => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(headline).lineHeight);
      return Math.round(headline.getBoundingClientRect().height / lineHeight);
    }));

  expect(lineCounts).toEqual([2, 2, 2]);
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
  await expect.poll(
    () => readScale(messageTargetSelector),
    { intervals: Array.from({ length: 30 }, () => 10), timeout: 500 },
  ).toBeLessThan(0.99);
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

test("places the main headline slightly below center independently from its context", async ({ page }) => {
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
    const centerOffset = (headline?.y ?? 0) + (headline?.height ?? 0) / 2 - viewport.height / 2;
    expect(centerOffset).toBeGreaterThan(8);
    expect(centerOffset).toBeLessThan(viewport.height * 0.06);
    expect((context?.y ?? 0) + (context?.height ?? 0)).toBeLessThan(headline?.y ?? 0);
  }
});

test("keeps every semantic playground preset wrapper-free", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(landingUrl);

  const presets = page.locator(".headline-presets button");
  await expect(presets).toHaveCount(3);
  await expect(presets.locator(":scope > strong")).toHaveCount(3);
  await expect(presets.first().locator(":scope > strong")).toContainText(
    "디자인 시스템을 도입하기 전에",
  );
});

test("shows a meaningful English change for every playground preset", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(englishLandingUrl);

  await expect(page.locator("#browser-measure-label")).toContainText("CSS balance");
  await expect(page.locator(".demo-headline-measure-source")).toHaveCSS("text-wrap", "balance");
  await page.locator("#measure-width").fill("414");

  const expected = [
    ["Write clear headlines for\nreaders, not for reviewers", "Write clear headlines\nfor readers, not for reviewers"],
    ["Earn customer trust before\nasking for more data", "Earn customer trust\nbefore asking for more data"],
    ["Design documentation for\npeople who need to act", "Design documentation\nfor people who need to act"],
  ] as const;

  const presets = page.locator(".headline-presets button");
  for (const [index, [browserText, semanticText]] of expected.entries()) {
    await presets.nth(index).click();
    const browserHeadline = page.locator(".measure-pane.is-browser .demo-headline:not(.demo-headline-measure-source)");
    const semanticHeadline = page.locator(".measure-pane.is-semantic .demo-headline");
    await expect.poll(() => browserHeadline.innerText()).toBe(browserText);
    await expect.poll(() => semanticHeadline.innerText()).toBe(semanticText);
    await expect(semanticHeadline.locator(".semantic-diff-changed")).not.toHaveCount(0);
  }
});

test("keeps both playground results close enough to compare on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(englishLandingUrl);

  const panes = page.locator(".measure-pane");
  await expect(panes).toHaveCount(2);
  const comparisonHeight = await page.locator(".measure-comparison").evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  const paneHeights = await panes.evaluateAll(
    (elements) => elements.map((element) => element.getBoundingClientRect().height),
  );

  expect(comparisonHeight).toBeLessThanOrEqual(500);
  expect(paneHeights.every((height) => height <= 250)).toBe(true);
});

test("keeps stacked playground results compact on tablet widths", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(englishLandingUrl);

  const paneHeights = await page.locator(".measure-pane").evaluateAll(
    (elements) => elements.map((element) => element.getBoundingClientRect().height),
  );
  expect(paneHeights).toHaveLength(2);
  expect(paneHeights.every((height) => height <= 300)).toBe(true);
});
