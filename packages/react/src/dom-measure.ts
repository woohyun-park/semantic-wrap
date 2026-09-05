import type { BaselineLayout } from "@semantic-wrap/core";

const MAX_CACHED_TEXT_WIDTHS = 128;

export interface TextMeasurementCache {
  element: HTMLElement | null;
  sourceText: string;
  metricSignature: string;
  readonly widths: Map<string, number>;
  probe: HTMLSpanElement | null;
}

export function createTextMeasurementCache(): TextMeasurementCache {
  return {
    element: null,
    sourceText: "",
    metricSignature: "",
    widths: new Map(),
    probe: null,
  };
}

export function invalidateTextMeasurementCache(cache: TextMeasurementCache): void {
  cache.probe?.remove();
  cache.element = null;
  cache.sourceText = "";
  cache.metricSignature = "";
  cache.widths.clear();
  cache.probe = null;
}

export interface NativeLayoutMeasurementCache {
  element: HTMLElement | null;
  sourceText: string;
  layoutSignature: string;
  probe: HTMLElement | null;
  characterOffsets: readonly number[];
}

export function createNativeLayoutMeasurementCache(): NativeLayoutMeasurementCache {
  return {
    element: null,
    sourceText: "",
    layoutSignature: "",
    probe: null,
    characterOffsets: [],
  };
}

export function invalidateNativeLayoutMeasurementCache(cache: NativeLayoutMeasurementCache): void {
  cache.probe?.remove();
  cache.element = null;
  cache.sourceText = "";
  cache.layoutSignature = "";
  cache.probe = null;
  cache.characterOffsets = [];
}

function copyComputedStyle(computed: CSSStyleDeclaration, target: HTMLElement): void {
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    target.style.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property),
    );
  }
}

function pixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function contentWidth(element: HTMLElement): number {
  const view = element.ownerDocument.defaultView;
  if (!view) return element.getBoundingClientRect().width;
  const computed = view.getComputedStyle(element);
  const padding = pixels(computed.paddingLeft) + pixels(computed.paddingRight);
  if (element.clientWidth > 0) return Math.max(0, element.clientWidth - padding);

  const computedWidth = pixels(computed.width);
  if (computedWidth > 0) {
    if (computed.boxSizing === "border-box") {
      const border = pixels(computed.borderLeftWidth) + pixels(computed.borderRightWidth);
      return Math.max(0, computedWidth - padding - border);
    }
    return computedWidth;
  }

  return Math.max(0, element.getBoundingClientRect().width - padding);
}

function normalizeMeasuredText(text: string, whiteSpace: string): string {
  if (["pre", "pre-wrap", "break-spaces"].includes(whiteSpace)) return text;
  const collapsed = text.replace(/[\t\f ]+/gu, " ");
  if (whiteSpace === "pre-line") {
    return collapsed
      .split(/\r\n?|\n/u)
      .map((line) => line.replace(/^ +| +$/gu, ""))
      .join("\n");
  }
  return collapsed
    .replace(/[\r\n]+/gu, " ")
    .replace(/^ +| +$/gu, "");
}

function textMetricSignature(
  computed: CSSStyleDeclaration,
  devicePixelRatio: number,
): string {
  return [
    computed.fontFamily,
    computed.fontFeatureSettings,
    computed.fontKerning,
    computed.fontOpticalSizing,
    computed.fontSize,
    computed.fontSizeAdjust,
    computed.fontStretch,
    computed.fontStyle,
    computed.fontSynthesis,
    computed.fontVariant,
    computed.fontVariationSettings,
    computed.fontWeight,
    computed.letterSpacing,
    computed.tabSize,
    computed.textTransform,
    computed.whiteSpace,
    computed.wordSpacing,
    String(devicePixelRatio),
  ].join("\u0000");
}

function nativeLayoutSignature(
  element: HTMLElement,
  computed: CSSStyleDeclaration,
  devicePixelRatio: number,
): string {
  return [
    textMetricSignature(computed, devicePixelRatio),
    computed.direction,
    computed.getPropertyValue("hyphenate-character"),
    computed.getPropertyValue("hyphenate-limit-chars"),
    computed.hyphens,
    computed.getPropertyValue("line-break"),
    computed.overflowWrap,
    computed.textIndent,
    computed.getPropertyValue("text-orientation"),
    computed.getPropertyValue("text-wrap-mode"),
    computed.getPropertyValue("text-wrap-style"),
    computed.wordBreak,
    computed.writingMode,
    element.closest("[lang]")?.getAttribute("lang") ?? "",
  ].join("\u0000");
}

function cachedWidth(cache: TextMeasurementCache, text: string): number | undefined {
  const width = cache.widths.get(text);
  if (width === undefined) return undefined;
  cache.widths.delete(text);
  cache.widths.set(text, width);
  return width;
}

function rememberWidth(cache: TextMeasurementCache, text: string, width: number): void {
  cache.widths.delete(text);
  cache.widths.set(text, width);
  if (cache.widths.size <= MAX_CACHED_TEXT_WIDTHS) return;
  const oldest = cache.widths.keys().next().value;
  if (oldest !== undefined) cache.widths.delete(oldest);
}

export function createTextMeasurer(
  element: HTMLElement,
  cache?: TextMeasurementCache,
  sourceText = element.textContent ?? "",
): {
  measureText(text: string): number;
  dispose(): void;
} {
  const ownsCache = cache === undefined;
  const measurementCache = cache ?? createTextMeasurementCache();
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) throw new Error("SemanticWrap requires an element attached to a window");
  const computed = view.getComputedStyle(element);
  const signature = textMetricSignature(computed, view.devicePixelRatio);
  if (
    measurementCache.element !== element ||
    measurementCache.sourceText !== sourceText ||
    measurementCache.metricSignature !== signature
  ) {
    invalidateTextMeasurementCache(measurementCache);
    measurementCache.element = element;
    measurementCache.sourceText = sourceText;
    measurementCache.metricSignature = signature;
  }

  const activeProbe = (): HTMLSpanElement => {
    if (measurementCache.probe) return measurementCache.probe;
    const probe = document.createElement("span");
    Object.assign(probe.style, {
      all: "initial",
      contain: "layout style paint",
      fontFamily: computed.fontFamily,
      fontFeatureSettings: computed.fontFeatureSettings,
      fontKerning: computed.fontKerning,
      fontOpticalSizing: computed.fontOpticalSizing,
      fontSize: computed.fontSize,
      fontSizeAdjust: computed.fontSizeAdjust,
      fontStretch: computed.fontStretch,
      fontStyle: computed.fontStyle,
      fontSynthesis: computed.fontSynthesis,
      fontVariant: computed.fontVariant,
      fontVariationSettings: computed.fontVariationSettings,
      fontWeight: computed.fontWeight,
      letterSpacing: computed.letterSpacing,
      position: "fixed",
      tabSize: computed.tabSize,
      textTransform: computed.textTransform,
      visibility: "hidden",
      whiteSpace: "pre",
      wordSpacing: computed.wordSpacing,
    });
    probe.setAttribute("aria-hidden", "true");
    document.body.append(probe);
    measurementCache.probe = probe;
    return probe;
  };

  return {
    measureText(text) {
      const measuredText = normalizeMeasuredText(text, computed.whiteSpace);
      const cached = cachedWidth(measurementCache, measuredText);
      if (cached !== undefined) return cached;
      const currentProbe = activeProbe();
      currentProbe.textContent = measuredText;
      const width = currentProbe.getBoundingClientRect().width;
      rememberWidth(measurementCache, measuredText, width);
      return width;
    },
    dispose() {
      if (ownsCache) invalidateTextMeasurementCache(measurementCache);
    },
  };
}

function whitespaceRunStart(text: string, offset: number): number {
  let runStart = offset;
  while (runStart > 0 && /\s/u.test(text[runStart - 1] ?? "")) runStart -= 1;
  return runStart;
}

function characterOffsets(text: string): number[] {
  const offsets = [0];
  let offset = 0;
  for (const character of text) {
    offset += character.length;
    offsets.push(offset);
  }
  return offsets;
}

function readBreaksLinear(node: Text, offsets: readonly number[], range: Range): number[] {
  const lineStarts: number[] = [];
  let previousTop: number | null = null;
  for (let index = 0; index < offsets.length - 1; index += 1) {
    const start = offsets[index]!;
    range.setStart(node, start);
    range.setEnd(node, offsets[index + 1]!);
    const top = Math.round(range.getBoundingClientRect().top * 100) / 100;
    if (previousTop !== null && top !== previousTop) lineStarts.push(start);
    previousTop = top;
  }
  return lineStarts;
}

function normalizeLineStarts(text: string, lineStarts: readonly number[]): number[] {
  return [...new Set(lineStarts.map((lineStart) => whitespaceRunStart(text, lineStart)))].filter(
    (offset) => offset > 0 && offset < text.length,
  );
}

function readBreaks(
  element: HTMLElement,
  text: string,
  offsets: readonly number[],
  forceLinear: boolean,
): number[] {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) return [];
  const node = element.firstChild;
  if (!(node instanceof view.Text) || node.data.length !== text.length) {
    throw new Error("Could not map the rendered title back to its source text");
  }
  if (offsets.length <= 1) return [];

  const range = document.createRange();
  if (forceLinear) return normalizeLineStarts(text, readBreaksLinear(node, offsets, range));

  const topByCharacter = new Map<number, number>();
  const topAt = (index: number): number => {
    const cached = topByCharacter.get(index);
    if (cached !== undefined) return cached;
    range.setStart(node, offsets[index]!);
    range.setEnd(node, offsets[index + 1]!);
    const top = Math.round(range.getBoundingClientRect().top * 100) / 100;
    topByCharacter.set(index, top);
    return top;
  };
  const lineStarts: number[] = [];
  let monotonic = true;
  const findTransitions = (start: number, end: number): void => {
    const startTop = topAt(start);
    const endTop = topAt(end);
    if (endTop < startTop) {
      monotonic = false;
      return;
    }
    if (startTop === endTop) return;
    if (end - start === 1) {
      lineStarts.push(offsets[end]!);
      return;
    }
    const middle = Math.floor((start + end) / 2);
    const middleTop = topAt(middle);
    if (middleTop < startTop || middleTop > endTop) {
      monotonic = false;
      return;
    }
    findTransitions(start, middle);
    findTransitions(middle, end);
  };

  findTransitions(0, offsets.length - 2);
  const exactLineStarts = monotonic ? lineStarts : readBreaksLinear(node, offsets, range);
  return normalizeLineStarts(text, exactLineStarts);
}

/** Measures native wrapping in an invisible copy, without mutating the visible element. */
export function readNativeLayout(
  element: HTMLElement,
  text: string,
  cache?: NativeLayoutMeasurementCache,
): BaselineLayout {
  const ownsCache = cache === undefined;
  const measurementCache = cache ?? createNativeLayoutMeasurementCache();
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) return { breaks: [] };
  const computed = view.getComputedStyle(element);
  const signature = nativeLayoutSignature(element, computed, view.devicePixelRatio);
  if (
    measurementCache.element !== element ||
    measurementCache.sourceText !== text ||
    measurementCache.layoutSignature !== signature
  ) {
    invalidateNativeLayoutMeasurementCache(measurementCache);
    measurementCache.element = element;
    measurementCache.sourceText = text;
    measurementCache.layoutSignature = signature;
    measurementCache.characterOffsets = characterOffsets(text);
  }

  let probe = measurementCache.probe;
  if (!probe) {
    probe = document.createElement(element.tagName.toLowerCase());
    copyComputedStyle(computed, probe);
    Object.assign(probe.style, {
      boxSizing: "content-box",
      height: "auto",
      left: "-100000px",
      margin: "0",
      maxHeight: "none",
      maxWidth: "none",
      minHeight: "0",
      minWidth: "0",
      pointerEvents: "none",
      position: "fixed",
      top: "0",
      transform: "none",
      visibility: "hidden",
    });
    probe.setAttribute("aria-hidden", "true");
    probe.textContent = text;
    document.body.append(probe);
    measurementCache.probe = probe;
  }
  const width = contentWidth(element);
  probe.style.width = `${width}px`;
  try {
    return {
      breaks: readBreaks(
        probe,
        text,
        measurementCache.characterOffsets,
        computed.writingMode !== "horizontal-tb",
      ),
    };
  } finally {
    if (ownsCache) invalidateNativeLayoutMeasurementCache(measurementCache);
  }
}
