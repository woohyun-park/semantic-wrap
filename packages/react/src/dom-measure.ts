import type { BaselineLayout } from "@semantic-wrap/core";

function copyComputedStyle(source: HTMLElement, target: HTMLElement): void {
  const computed = source.ownerDocument.defaultView!.getComputedStyle(source);
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

export function createTextMeasurer(element: HTMLElement): {
  measureText(text: string): number;
  dispose(): void;
} {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) throw new Error("SemanticWrap requires an element attached to a window");
  const computed = view.getComputedStyle(element);
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
  document.body.append(probe);
  const cache = new Map<string, number>();
  return {
    measureText(text) {
      const measuredText = normalizeMeasuredText(text, computed.whiteSpace);
      const cached = cache.get(measuredText);
      if (cached !== undefined) return cached;
      probe.textContent = measuredText;
      const width = probe.getBoundingClientRect().width;
      cache.set(measuredText, width);
      return width;
    },
    dispose() {
      probe.remove();
      cache.clear();
    },
  };
}

function whitespaceRunStart(text: string, offset: number): number {
  let runStart = offset;
  while (runStart > 0 && /\s/u.test(text[runStart - 1] ?? "")) runStart -= 1;
  return runStart;
}

function readBreaks(element: HTMLElement, text: string): number[] {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) return [];
  const walker = document.createTreeWalker(element, view.NodeFilter.SHOW_TEXT);
  const lineStarts: number[] = [];
  let sourceOffset = 0;
  let previousTop: number | null = null;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const data = node.nodeValue ?? "";
    let nodeOffset = 0;
    for (const character of data) {
      const nextOffset = nodeOffset + character.length;
      const range = document.createRange();
      range.setStart(node, nodeOffset);
      range.setEnd(node, nextOffset);
      const top = Math.round(range.getBoundingClientRect().top * 100) / 100;
      if (previousTop !== null && top !== previousTop) lineStarts.push(sourceOffset);
      previousTop = top;
      sourceOffset += character.length;
      nodeOffset = nextOffset;
    }
  }
  if (sourceOffset !== text.length) {
    throw new Error("Could not map the rendered title back to its source text");
  }
  return [...new Set(lineStarts.map((lineStart) => whitespaceRunStart(text, lineStart)))]
    .filter((offset) => offset > 0 && offset < text.length);
}

/** Measures native wrapping in an invisible copy, without mutating the visible element. */
export function readNativeLayout(element: HTMLElement, text: string): BaselineLayout {
  const document = element.ownerDocument;
  const probe = document.createElement(element.tagName.toLowerCase());
  copyComputedStyle(element, probe);
  const width = contentWidth(element);
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
    width: `${width}px`,
  });
  probe.setAttribute("aria-hidden", "true");
  probe.textContent = text;
  document.body.append(probe);
  try {
    return { breaks: readBreaks(probe, text) };
  } finally {
    probe.remove();
  }
}
