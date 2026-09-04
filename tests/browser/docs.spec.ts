import { expect, test, type Locator } from "@playwright/test";
import { exampleCases } from "../../apps/docs/src/example-cases";

const docsUrl = "http://127.0.0.1:4192/ko/docs/introduction";
const landingUrl = "http://127.0.0.1:4192/ko";
const englishDocsUrl = "http://127.0.0.1:4192/docs/introduction";
const englishLandingUrl = "http://127.0.0.1:4192/";

test("serves AI-readable documentation entrypoints", async ({ request }) => {
  const summary = await request.get("http://127.0.0.1:4192/llms.txt");
  const full = await request.get("http://127.0.0.1:4192/llms-full.txt");

  expect(summary.ok()).toBe(true);
  expect(summary.headers()["content-type"]).toContain("text/plain");
  expect(await summary.text()).toContain("# semantic-wrap");
  expect(await summary.text()).toContain("/llms-full.txt");
  expect(full.ok()).toBe(true);
  expect(full.headers()["content-type"]).toContain("text/plain");
  expect(await full.text()).toContain("## Core API");
  expect(await full.text()).toContain("## React API");
});

async function semanticPhraseLineCount(
  headline: Locator,
): Promise<number> {
  return headline.evaluate((element) => {
    const source = element.getAttribute("data-source-text") ?? "";
    const phrase = element.getAttribute("data-semantic-phrase") ?? "";
    const phraseStart = source.indexOf(phrase);
    const phraseEnd = phraseStart + phrase.length;
    const pieces = [...element.querySelectorAll<HTMLElement>(".line-break-piece")].filter(
      (piece) => {
        const start = Number(piece.dataset.pieceStart);
        const end = Number(piece.dataset.pieceEnd);
        return start >= phraseStart && end <= phraseEnd;
      },
    );
    return new Set(pieces.map((piece) => Math.round(piece.getBoundingClientRect().top))).size;
  });
}

async function renderedLines(locator: Locator): Promise<string[]> {
  return (await locator.innerText()).split("\n").map((line) => line.trim()).filter(Boolean);
}

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

test("honors direct landing section hashes after React mounts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  for (const url of [
    `${englishLandingUrl}#playground`,
    `${landingUrl}#playground`,
  ]) {
    await page.goto(url);

    await expect.poll(async () => page.locator("#playground-title").evaluate((element) => {
      const headerBottom = document.querySelector(".site-header")
        ?.getBoundingClientRect().bottom ?? 0;
      const headingGap = Number.parseFloat(
        window.getComputedStyle(element).scrollMarginTop,
      );
      return Math.abs(element.getBoundingClientRect().top - headerBottom - headingGap);
    })).toBeLessThan(2);
  }
});

test("aligns the documentation header with the sidebar label and article edge", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(docsUrl);

  const alignment = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".site-header-content")!;
    const sidebarHeading = document.querySelector<HTMLElement>(
      ".docs-sidebar .docs-nav-group h2",
    )!;
    const article = document.querySelector<HTMLElement>(".docs-article")!;
    const headingText = document.createRange();
    headingText.selectNodeContents(sidebarHeading);

    return {
      articleRight: article.getBoundingClientRect().right,
      headerLeft: header.getBoundingClientRect().left,
      headerRight: header.getBoundingClientRect().right,
      headingLeft: headingText.getBoundingClientRect().left,
    };
  });

  expect(Math.abs(alignment.headerLeft - alignment.headingLeft)).toBeLessThan(1);
  expect(Math.abs(alignment.headerRight - alignment.articleRight)).toBeLessThan(1);
});

test("aligns and sticks the compact documentation index with the article", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 900, height: 720 });
  await page.goto(docsUrl);

  const alignment = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".site-header-inner")!;
    const index = document.querySelector<HTMLElement>(".docs-mobile-index")!;
    const article = document.querySelector<HTMLElement>(".docs-article")!;
    const headerBounds = header.getBoundingClientRect();
    const indexBounds = index.getBoundingClientRect();
    const articleBounds = article.getBoundingClientRect();

    return {
      articleLeft: articleBounds.left,
      articleRight: articleBounds.right,
      headerLeft: headerBounds.left,
      headerRight: headerBounds.right,
      indexLeft: indexBounds.left,
      indexRight: indexBounds.right,
    };
  });

  expect(Math.abs(alignment.indexLeft - alignment.headerLeft)).toBeLessThan(1);
  expect(Math.abs(alignment.indexRight - alignment.headerRight)).toBeLessThan(1);
  expect(Math.abs(alignment.indexLeft - alignment.articleLeft)).toBeLessThan(1);
  expect(Math.abs(alignment.indexRight - alignment.articleRight)).toBeLessThan(1);

  const compactIndex = page.locator(".docs-mobile-index");
  await compactIndex.locator("summary").click();
  await expect(compactIndex.locator("details")).toHaveCSS("overflow-y", "auto");

  await page.evaluate(() => window.scrollTo({ top: 1_200 }));
  await expect.poll(async () => page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".site-header")!;
    const index = document.querySelector<HTMLElement>(".docs-mobile-index")!;
    return Math.abs(
      index.getBoundingClientRect().top - header.getBoundingClientRect().bottom,
    );
  })).toBeLessThanOrEqual(1);

  const compactIndexBounds = await compactIndex.boundingBox();
  expect(compactIndexBounds?.y ?? 0).toBeGreaterThanOrEqual(0);
  expect(
    (compactIndexBounds?.y ?? 0) + (compactIndexBounds?.height ?? 0),
  ).toBeLessThanOrEqual(720);
});

test("aligns a section after navigating from the expanded compact index", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 900, height: 720 });
  await page.goto(docsUrl);

  const compactIndex = page.locator(".docs-mobile-index");
  const details = compactIndex.locator("details");
  await compactIndex.locator("summary").click();
  await compactIndex.locator('a[href$="#diagnostics"]').click();

  await expect(details).not.toHaveAttribute("open", "");
  await expect(page).toHaveURL(`${docsUrl}#diagnostics`);
  await expect.poll(async () => page.locator("#diagnostics").evaluate((element) => {
    const expectedTop = Number.parseFloat(window.getComputedStyle(element).scrollMarginTop);
    return Math.abs(element.getBoundingClientRect().top - expectedTop);
  })).toBeLessThan(2);
  await expect(compactIndex.locator("summary strong")).toHaveText("Diagnostics");
});

test("animates the hero scroll cue without making it interactive", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(landingUrl);

  const cue = page.locator(".hero-scroll-cue");
  await expect(cue).toHaveCount(1);
  await expect(cue).toHaveText("↓");
  await expect(cue.locator("button")).toHaveCount(0);
  await expect(page.locator("button.hero-scroll-cue")).toHaveCount(0);
  await expect.poll(() => cue.locator("span").evaluate((element) =>
    new DOMMatrix(window.getComputedStyle(element).transform).m42,
  )).toBeGreaterThan(1);
});

test("preloads the optimized hero brand image", async ({ page }) => {
  await page.goto(englishLandingUrl);

  const preload = page.locator('link[rel="preload"][as="image"]');
  const heroMark = page.locator(".hero-brand-lockup .brand-mark");

  await expect(preload).toHaveAttribute("type", "image/webp");
  await expect(preload).toHaveAttribute("fetchpriority", "high");
  await expect(preload).toHaveAttribute("href", /brand-mark-.*\.webp$/u);
  await expect(heroMark).toHaveAttribute("src", /brand-mark-.*\.webp$/u);
  await expect(heroMark).toHaveAttribute("fetchpriority", "high");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg");
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

test("stacks the process title and description on the same left edge", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(englishLandingUrl);

  const layout = await page.locator(".section-intro").evaluate((intro) => {
    const title = intro.querySelector<HTMLElement>("h2")!;
    const description = intro.querySelector<HTMLElement>("p")!;
    const titleBounds = title.getBoundingClientRect();
    const descriptionBounds = description.getBoundingClientRect();

    return {
      descriptionLeft: descriptionBounds.left,
      descriptionTop: descriptionBounds.top,
      titleBottom: titleBounds.bottom,
      titleLeft: titleBounds.left,
    };
  });

  expect(Math.abs(layout.titleLeft - layout.descriptionLeft)).toBeLessThan(1);
  expect(layout.descriptionTop).toBeGreaterThan(layout.titleBottom);
});

test("centers the clicked navigation item while aligning its section below the header", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(docsUrl);

  const initialTop = await page.locator("#diagnostics").evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  await page.locator('.docs-sidebar a[href$="#diagnostics"]').click();
  await expect(page).toHaveURL(`${docsUrl}#diagnostics`);
  expect(initialTop).toBeGreaterThan(720);
  await expect.poll(async () => page.locator("#diagnostics").evaluate((element) => {
    const expectedTop = Number.parseFloat(window.getComputedStyle(element).scrollMarginTop);
    return Math.abs(element.getBoundingClientRect().top - expectedTop);
  })).toBeLessThan(2);
  await expect.poll(async () => page.locator('.docs-sidebar a[href$="#diagnostics"]')
    .evaluate((link) => {
      const sidebar = link.closest<HTMLElement>(".docs-sidebar")!;
      const sidebarBounds = sidebar.getBoundingClientRect();
      const linkBounds = link.getBoundingClientRect();
      const sidebarCenter = sidebarBounds.top + sidebarBounds.height / 2;
      const linkCenter = linkBounds.top + linkBounds.height / 2;
      return Math.abs(sidebarCenter - linkCenter);
    })).toBeLessThan(2);
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

  const interruptedScroll = await page.evaluate(async () => {
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }));
    const start = window.scrollY;

    for (let frame = 0; frame < 12; frame += 1) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }

    const readingLine = Math.min(240, window.innerHeight * 0.28);
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".docs-anchor[id]"));
    let expectedHref = "/ko/docs/introduction";
    for (const section of sections) {
      if (section.getBoundingClientRect().top > readingLine) break;
      expectedHref = `/ko/docs/introduction#${section.id}`;
    }

    return {
      distance: Math.abs(window.scrollY - start),
      expectedHref,
    };
  });

  expect(interruptedScroll.distance).toBeLessThanOrEqual(2);
  const currentLink = page.locator(
    `.docs-sidebar a[href="${interruptedScroll.expectedHref}"]`,
  );
  await expect(currentLink).toHaveAttribute("aria-current", "location");
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
  expect(await renderedLines(comparison.locator(".is-native p"))).toEqual(
    exampleCases.ko.process.reference.nativeLines,
  );
  await expect(comparison.locator(".is-native p")).not.toHaveText(
    await comparison.locator(".is-semantic p").innerText(),
  );
  expect(await renderedLines(comparison.locator(".is-semantic p"))).toEqual(
    exampleCases.ko.process.reference.semanticLines,
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
  expect(await renderedLines(comparison.locator(".is-native p"))).toEqual(
    exampleCases.en.process.reference.nativeLines,
  );
  expect(await renderedLines(comparison.locator(".is-semantic p"))).toEqual(
    exampleCases.en.process.reference.semanticLines,
  );
});

test("uses an actual CSS balance selection for every landing example", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });

    for (const [locale, url] of [
      ["en", englishLandingUrl],
      ["ko", landingUrl],
    ] as const) {
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
        const nativeHeadline = nativeHeadlines.nth(index);
        const semanticHeadline = semanticHeadlines.nth(index);
        const nativeBreaks = await nativeHeadline.getAttribute("data-breaks");
        const semanticBreaks = await semanticHeadline.getAttribute("data-breaks");
        expect(nativeBreaks).not.toBe(semanticBreaks);
        expect(nativeBreaks?.split(",").length).toBe(semanticBreaks?.split(",").length);
        expect(await semanticPhraseLineCount(nativeHeadline)).toBeGreaterThan(1);
        expect(await semanticPhraseLineCount(semanticHeadline)).toBe(1);
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

      const processComparison = page.locator(".process-selection-comparison");
      const processPhrase = await processComparison.getAttribute("data-semantic-phrase");
      expect(processPhrase).toBeTruthy();
      const processNativeLines = await renderedLines(processComparison.locator(".is-native p"));
      const processSemanticLines = await renderedLines(processComparison.locator(".is-semantic p"));
      expect(processNativeLines.some((line) => line.includes(processPhrase!))).toBe(false);
      expect(processSemanticLines.some((line) => line.includes(processPhrase!))).toBe(true);

      const presets = page.locator(".headline-presets button");
      for (let index = 0; index < 3; index += 1) {
        const reference = exampleCases[locale].examples[index]?.reference;
        expect(reference).toBeDefined();
        await presets.nth(index).click();
        await expect(page.locator(".measure-instrument")).toHaveAttribute(
          "data-result",
          "applied",
        );
        const currentWidth = Number(await page.locator("#measure-width").inputValue());
        expect(exampleCases[locale].examples[index]?.playgroundMeasures).toContain(currentWidth);
        const browserText = await page.locator(
          ".measure-pane.is-browser .demo-headline:not(.demo-headline-measure-source)",
        ).innerText();
        if (currentWidth === reference!.width) {
          expect(await renderedLines(page.locator(
            ".measure-pane.is-browser .demo-headline:not(.demo-headline-measure-source)",
          ))).toEqual(reference!.nativeLines);
          expect(await renderedLines(page.locator(
            ".measure-pane.is-semantic .demo-headline",
          ))).toEqual(reference!.semanticLines);
        }
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
  await expect(page.locator(".line-break-marker")).toHaveCount(0);
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
  const messageTarget = page.locator(messageTargetSelector);
  await expect(messageTarget).toHaveAttribute("data-motion-shimmer", "active");
  await expect(messageTarget).toHaveAttribute("data-motion-shimmer-run", /\d+/u);
  await expect(messageTarget).toHaveAttribute("data-motion-shimmer-state", "complete");
  const messageRun = Number(await messageTarget.getAttribute("data-motion-shimmer-run"));
  const messageShimmer = await readShimmer(messageShimmerSelector);
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
  const exampleTarget = page.locator(exampleTargetSelector);
  await expect(exampleTarget).toHaveAttribute("data-motion-shimmer", "active");
  await expect(exampleTarget).toHaveAttribute("data-motion-shimmer-state", "complete");
  const exampleRun = Number(await exampleTarget.getAttribute("data-motion-shimmer-run"));
  expect(exampleRun).toBeGreaterThan(messageRun);
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

  const presets = page.locator(".headline-presets button");
  for (let index = 0; index < 3; index += 1) {
    await presets.nth(index).click();
    const instrument = page.locator(".measure-instrument");
    const browserHeadline = page.locator(".measure-pane.is-browser .demo-headline:not(.demo-headline-measure-source)");
    const semanticHeadline = page.locator(".measure-pane.is-semantic .demo-headline");
    await expect(instrument).toHaveAttribute("data-result", "applied");
    const phrase = await instrument.getAttribute("data-semantic-phrase");
    expect(phrase).toBeTruthy();
    const browserLines = await renderedLines(browserHeadline);
    const semanticLines = await renderedLines(semanticHeadline);
    expect(browserLines).toHaveLength(semanticLines.length);
    expect(browserLines.some((line) => line.includes(phrase!))).toBe(false);
    expect(semanticLines.some((line) => line.includes(phrase!))).toBe(true);
    await expect(semanticHeadline.locator(".semantic-diff-changed")).not.toHaveCount(0);
  }
});

test("keeps both playground results within one mobile viewport", async ({ page }) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await page.goto(englishLandingUrl);

  const panes = page.locator(".measure-pane");
  await expect(panes).toHaveCount(2);
  const comparisonHeight = await page.locator(".measure-comparison").evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  const paneHeights = await panes.evaluateAll(
    (elements) => elements.map((element) => element.getBoundingClientRect().height),
  );

  expect(comparisonHeight).toBeLessThanOrEqual(viewport.height * 0.65);
  expect(paneHeights.every((height) => height <= viewport.height * 0.325)).toBe(true);
  expect(Math.abs(paneHeights[0]! - paneHeights[1]!)).toBeLessThan(1);
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
