import type { Page } from "@playwright/test";

/** Identical wall-clock input trajectory in each separately running browser. */
export async function runResizeScenario(page: Page, duration = 2400) {
  return page.evaluate(async (duration) => {
    const title = document.querySelector<HTMLElement>("#resize-text")!;
    const container = document.querySelector<HTMLElement>("#resize-container")!;
    const status = document.querySelector<HTMLElement>("#resize-status")!;
    const started = performance.now();
    const short = title.textContent!.length < 100;
    const low = short ? 240 : 360;
    const high = short ? 420 : 900;
    const finalWidth = short ? 240 : 660;
    const frames: number[] = [];
    const taskDurations: number[] = [];
    const inputDelays: number[] = [];
    const changes: { at: number; breaks: number; width: number }[] = [];
    let previousFrame = started;
    let lastMutation = started;
    let frameId = 0;
    let inputTimer = 0;
    let plannedInput = performance.now() + 25;
    const measureInput = () => {
      inputDelays.push(Math.max(0, performance.now() - plannedInput));
      plannedInput = performance.now() + 25;
      inputTimer = window.setTimeout(measureInput, 25);
    };
    inputTimer = window.setTimeout(measureInput, 25);
    const frame = (now: number) => {
      frames.push(now - previousFrame);
      previousFrame = now;
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    const longTasks = PerformanceObserver.supportedEntryTypes.includes("longtask")
      ? new PerformanceObserver((entries) =>
          taskDurations.push(...entries.getEntries().map(({ duration }) => duration)),
        )
      : null;
    longTasks?.observe({ type: "longtask" });
    let textReads = 0;
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (this instanceof HTMLSpanElement && this.style.visibility === "hidden") textReads += 1;
      return rect.call(this);
    };
    const observer = new MutationObserver(() => {
      lastMutation = performance.now();
      changes.push({
        at: lastMutation - started,
        breaks: title.querySelectorAll("br").length,
        width: Number.parseFloat(container.style.width),
      });
    });
    observer.observe(title, { subtree: true, childList: true, characterData: true });
    let stopped = started;
    try {
      status.textContent = "Resizing · native text follows the container";
      await new Promise<void>((resolve) => {
        const drive = (now: number) => {
          const elapsed = now - started;
          const t = Math.min(1, elapsed / duration);
          // Widen, reverse, then stop at a previously visited 660px width.
          const width =
            t < 0.4
              ? low + (t / 0.4) * (high - low)
              : t < 0.75
                ? high - ((t - 0.4) / 0.35) * (high - low)
                : low + ((t - 0.75) / 0.25) * (finalWidth - low);
          container.style.width = `${Math.round(width)}px`;
          (document.querySelector("#resize-slider") as HTMLInputElement).value = String(
            Math.round(width),
          );
          if (t < 1) requestAnimationFrame(drive);
          else {
            stopped = performance.now();
            status.textContent = "Resize stopped · waiting for final wrapping";
            resolve();
          }
        };
        requestAnimationFrame(drive);
      });
      const deadline = performance.now() + 15_000;
      // Long inputs end with semantic breaks; short input may legitimately stay native.
      const long = title.textContent!.length > 100;
      while (performance.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, 25));
        if (
          performance.now() - stopped > 200 &&
          performance.now() - lastMutation > 150 &&
          (!long || title.querySelector("br"))
        )
          break;
      }
      status.textContent = "Final wrapping applied · one result at the settled width";
      const percentile = (values: number[], p: number) => {
        const sorted = [...values].sort((a, b) => a - b);
        if (!sorted.length) return 0;
        if (p === 0.5 && sorted.length % 2 === 0)
          return (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
        return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]!;
      };
      return {
        durationMs: performance.now() - started,
        resizeDurationMs: stopped - started,
        finalCommitDelayMs: Math.max(0, lastMutation - stopped),
        finalCommits: changes.filter(
          (change) => change.at >= stopped - started && change.breaks > 0,
        ).length,
        frameMedianMs: percentile(frames, 0.5),
        frameP95Ms: percentile(frames, 0.95),
        frameMaxMs: Math.max(...frames),
        taskMaxMs: Math.max(0, ...taskDurations),
        longTasks: taskDurations.length,
        inputDelayP95Ms: percentile(inputDelays, 0.95),
        inputDelayMaxMs: Math.max(...inputDelays),
        textReads,
        probeCount: document.querySelectorAll('span[aria-hidden="true"]').length,
        finalHTML: title.innerHTML,
        finalText: title.innerText,
        changes,
        taskDurations,
        frames,
      };
    } finally {
      observer.disconnect();
      longTasks?.disconnect();
      cancelAnimationFrame(frameId);
      clearTimeout(inputTimer);
      Element.prototype.getBoundingClientRect = rect;
    }
  }, duration);
}
