import { expect, test } from "@playwright/test";

for (const fresh of ["predictor", "strategy", "both"]) {
  for (const initial of ["resolved", "native"]) {
    for (const resize of ["immediate", "settled"]) {
      test(`fresh ${fresh} ${initial}/${resize}: converges and applies changed closures`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
        await page.goto(`/?scheduling=1&hook=1&strict=1&fresh=${fresh}&initial=${initial}&resize=${resize}`);
        const text = page.locator("#scheduling-text");
        await expect.poll(() => text.innerText(), { timeout: 2000 }).toBe("하나\n둘 셋");
        await page.locator("#scheduling-strategy").click();
        await expect.poll(() => text.innerText()).toBe("하나 둘\n셋");
        await page.locator("#scheduling-text-change").click();
        await expect.poll(() => text.innerText()).toBe("새로 바꾼\n글");
        await page.locator("#scheduling-container").evaluate((el) => { el.style.width = "320px"; });
        await expect.poll(() => text.innerText()).toBe("새로 바꾼\n글");
        // Observe beyond the settling window: a temporarily correct frame is not convergence.
        await page.waitForTimeout(250);
        const count = () => page.evaluate(() => (Reflect.get(window, "__schedulingEvents") ?? [])
          .filter((event: { kind: string }) => event.kind === "render").length);
        const renders = await count();
        await page.waitForTimeout(200);
        expect(await count()).toBe(renders);
        expect(renders).toBeLessThan(50);
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const initial of ["resolved", "native"] as const) {
  for (const resize of ["immediate", "settled"] as const) {
    test(`${initial}/${resize}: simultaneous geometry and reference changes keep the resize policy`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/?scheduling=1&hook=1&strict=1&fresh=both&initial=${initial}&resize=${resize}`);
      const text = page.locator("#scheduling-text");
      await expect.poll(() => text.innerText()).toBe("하나\n둘 셋");
      const mutations = await text.evaluate(async (element) => {
        const changes: { html: string; delay: number }[] = [];
        const started = performance.now();
        const observer = new MutationObserver(() => changes.push({ html: element.innerHTML, delay: performance.now() - started }));
        observer.observe(element, { childList: true, subtree: true, characterData: true });
        document.querySelector<HTMLButtonElement>("#scheduling-geometry")!.click();
        const deadline = performance.now() + 2000;
        while (element.innerHTML !== "하나 둘<br>셋" && performance.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        observer.disconnect();
        return changes;
      });
      expect(await text.innerText()).toBe("하나 둘\n셋");
      if (resize === "immediate") expect(mutations.every((change) => change.html.includes("<br>"))).toBe(true);
      else {
        expect(mutations.some((change) => !change.html.includes("<br>"))).toBe(true);
        expect(mutations.at(-1)!.delay).toBeGreaterThanOrEqual(95);
      }
      expect(errors).toEqual([]);
    });

    test(`${initial}/${resize}: changed predictor closures and metadata are not deduplicated away`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/?scheduling=1&hook=1&strict=1&fresh=model&initial=${initial}&resize=${resize}`);
      const text = page.locator("#scheduling-text");
      const result = () => page.locator("#scheduling-result").textContent().then((value) => JSON.parse(value!));
      await expect.poll(() => text.innerText()).toBe("하나\n둘 셋");
      await page.locator("#scheduling-strategy").click();
      await expect.poll(() => text.innerText()).toBe("하나 둘\n셋");
      await page.locator("#scheduling-metadata").click();
      await expect.poll(async () => (await result()).selection?.reason).toBe("scheduling-test-1");
      expect((await result()).selection.selectedCandidates[0]).toMatchObject({ name: "test-1", penalty: 1 });
      await page.locator("#scheduling-diagnostics").click();
      await expect.poll(async () => (await result()).diagnostics?.selection.reason).toBe("scheduling-test-1");
      const widths = (await result()).selection.widths;
      await text.evaluate((el) => { el.style.fontSize = "32px"; });
      await expect.poll(async () => {
        const next = (await result()).selection?.widths;
        return next != null && JSON.stringify(next) !== JSON.stringify(widths);
      }).toBe(true);
      await page.locator("#scheduling-diagnostics").click();
      await expect.poll(async () => (await result()).diagnostics).toBeNull();
      await expect.poll(() => text.innerText()).toBe("하나 둘\n셋");
      expect(errors).toEqual([]);
    });

    test(`${initial}/${resize}: headless scheduling resolves automatically`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/?scheduling=1&hook=1&initial=${initial}&resize=${resize}`);
      const text = page.locator("#scheduling-text");
      await expect.poll(() => text.innerText()).toBe("하나\n둘 셋");
      await page.locator("#scheduling-container").evaluate((el) => { el.style.width = "320px"; });
      await expect.poll(() => text.innerText()).toBe("하나 둘\n셋");
      expect(errors).toEqual([]);
    });
    test(`${initial}/${resize}: paints, hydrates, updates and keeps exact output`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      await page.addInitScript(() => {
        const frames: { native: boolean; started: boolean }[] = [];
        Reflect.set(window, "__firstFrames", frames);
        const tick = () => {
          const text = document.querySelector<HTMLElement>("#scheduling-text");
          if (text) frames.push({ native: !text.querySelector("br") && getComputedStyle(text).opacity !== "0",
            started: (Reflect.get(window, "__schedulingEvents") ?? []).some((e: {kind: string}) => e.kind === "start") });
          if (frames.length < 30) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.goto(`/?scheduling=1&hydrate=1&strict=1&initial=${initial}&resize=${resize}`);
      const text = page.locator("#scheduling-text");
      await expect(text.locator("br")).toHaveCount(1);
      expect(await text.innerText()).toBe("하나\n둘 셋");
      await expect(text).not.toHaveCSS("opacity", "0");
      const frames = await page.evaluate(() => Reflect.get(window, "__firstFrames") as {native: boolean; started: boolean}[]);
      if (initial === "native") expect(frames.some((frame) => frame.native && !frame.started)).toBe(true);
      // A later font-load update may legitimately enter settled native rendering.
      else expect(frames.some((frame) => frame.native && !frame.started)).toBe(false);

      const update = await text.evaluate(async (element) => {
        const mutations: { at: number; html: string }[] = [];
        const started = performance.now();
        const observer = new MutationObserver(() => mutations.push({ at: performance.now() - started, html: element.innerHTML }));
        observer.observe(element, { subtree: true, childList: true, characterData: true });
        element.parentElement!.style.width = "320px";
        const deadline = performance.now() + 2000;
        while (!element.innerHTML.startsWith("하나 둘<br>") && performance.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        observer.disconnect();
        return mutations;
      });
      expect(await text.innerText()).toBe("하나 둘\n셋");
      expect(update.length).toBeGreaterThan(0);
      if (resize === "settled") {
        expect(update.some(({ html }) => !html.includes("<br>"))).toBe(true);
        expect(update.at(-1)!.at).toBeGreaterThanOrEqual(95);
      } else {
        expect(update.every(({ html }) => html.includes("<br>"))).toBe(true);
        // Functional atomicity above is the cross-browser gate; precise latency is benchmarked separately.
      }
      expect(errors).toEqual([]);
    });
  }
}

test("default and legacy precise remain immediate; legacy progressive waits for resize", async ({ page }) => {
  for (const legacy of ["", "precise", "progressive"]) {
    await page.goto(`/?scheduling=1${legacy ? `&legacy=${legacy}` : ""}`);
    const text = page.locator("#scheduling-text");
    if (legacy === "progressive") {
      await expect(text).not.toHaveCSS("opacity", "0");
      expect(await page.evaluate(() => Reflect.get(window, "__schedulingEvents") ?? [])).toEqual([]);
      await expect(text.locator("br")).toHaveCount(0);
      await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    }
    await expect(text.locator("br")).toHaveCount(1);
    await page.locator("#scheduling-strategy").click();
    await expect(text).toHaveText("하나 둘셋");
    expect(await text.innerText()).toBe("하나 둘\n셋");
  }
});

test("native hook starts automatically and discards same-text strategy results during work", async ({ page }) => {
  await page.goto("/?scheduling=1&initial=native&resize=settled&hook=1&slow=1&strict=1");
  const text = page.locator("#scheduling-text");
  await expect(text).not.toHaveCSS("opacity", "0");
  await expect(text.locator("br")).toHaveCount(1);
  await page.evaluate(() => Reflect.set(window, "__holdScheduling", true));
  await page.locator("#scheduling-container").evaluate((el) => { el.style.width = "240px"; });
  await page.waitForFunction(() => (Reflect.get(window, "__schedulingEvents") ?? []).some((e: {kind: string; width: number}) => e.kind === "start" && e.width === 240));
  await page.locator("#scheduling-strategy").click();
  await page.evaluate(() => Reflect.set(window, "__holdScheduling", false));
  await expect.poll(() => text.innerText()).toBe("하나 둘\n셋");
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, "__schedulingEvents") ?? []).filter((e: {kind: string}) => e.kind === "cancel").length)).toBeGreaterThan(0);
  await page.locator("#scheduling-text-change").click();
  await expect.poll(() => text.innerText()).toBe("새로 바꾼\n글");
});

test("pending native startup and settled updates survive policy/font changes and clean up on unmount", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?scheduling=1&initial=native&resize=settled&slow=1&strict=1");
  await page.waitForFunction(() => (Reflect.get(window, "__schedulingEvents") ?? []).some((e: {kind: string}) => e.kind === "start"));
  await page.locator("#scheduling-toggle").click();
  await expect(page.locator("#scheduling-text")).toHaveCount(0);
  await expect(page.locator('span[aria-hidden="true"]')).toHaveCount(0);
  await page.locator("#scheduling-toggle").click();
  await expect(page.locator("#scheduling-text br")).toHaveCount(1);
  await page.locator("#scheduling-container").evaluate((el) => { el.style.width = "320px"; });
  await page.locator("#scheduling-policy").click();
  await page.locator("#scheduling-text").evaluate((el) => {
    el.style.fontSize = "30px";
    document.fonts.dispatchEvent(new Event("loadingdone"));
  });
  await expect.poll(() => page.locator("#scheduling-text").innerText()).toBe("하나 둘\n셋");
  await expect(page.locator("#scheduling-text")).not.toHaveCSS("opacity", "0");
  expect(errors).toEqual([]);
});

test("native startup cancels an obsolete first-width job before applying a resized result", async ({ page }) => {
  await page.addInitScript(() => Reflect.set(window, "__holdScheduling", true));
  await page.goto("/?scheduling=1&initial=native&resize=settled");
  await page.waitForFunction(() => (Reflect.get(window, "__schedulingEvents") ?? []).some((e: {kind: string}) => e.kind === "start"));
  const text = page.locator("#scheduling-text");
  await expect(text.locator("br")).toHaveCount(0);
  await expect(text).not.toHaveCSS("opacity", "0");
  await page.locator("#scheduling-container").evaluate((el) => { el.style.width = "320px"; });
  await page.waitForFunction(() => (Reflect.get(window, "__schedulingEvents") ?? []).some((e: {kind: string}) => e.kind === "cancel"));
  await page.evaluate(() => Reflect.set(window, "__holdScheduling", false));
  await expect.poll(() => text.innerText()).toBe("하나 둘\n셋");
  const widths = await page.evaluate(() => (Reflect.get(window, "__schedulingEvents") ?? [])
    .filter((e: {kind: string}) => e.kind === "calculate").map((e: {width: number}) => e.width));
  expect(widths).not.toContain(200);
});

test("reference-only revalidation retains the result and cancels obsolete inline jobs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?scheduling=1&hook=1&strict=1&fresh=both&initial=native&resize=settled&slow=1");
  const text = page.locator("#scheduling-text");
  await expect.poll(() => text.innerText()).toBe("하나\n둘 셋");
  await page.evaluate(() => {
    Reflect.set(window, "__holdScheduling", true);
    Reflect.set(window, "__schedulingEvents", []);
  });
  await page.locator("#scheduling-strategy").click();
  await page.waitForFunction(() => (Reflect.get(window, "__schedulingEvents") ?? [])
    .some((event: { kind: string }) => event.kind === "start"));
  expect(await text.innerText()).toBe("하나\n둘 셋");
  await page.locator("#scheduling-metadata").click();
  await page.waitForFunction(() => (Reflect.get(window, "__schedulingEvents") ?? [])
    .some((event: { kind: string }) => event.kind === "cancel"));
  expect(await text.innerText()).toBe("하나\n둘 셋");
  await page.evaluate(() => Reflect.set(window, "__holdScheduling", false));
  await expect.poll(() => text.innerText()).toBe("하나 둘\n셋");
  await expect(page.locator("#scheduling-result")).toContainText('"reason":"scheduling-test-1"');
  const events = await page.evaluate(() => Reflect.get(window, "__schedulingEvents") as { kind: string; selected: boolean }[]);
  expect(events.filter((event) => event.kind === "hook").every((event) => event.selected)).toBe(true);
  expect(errors).toEqual([]);
});
