import type { BaselineLayout } from "@semantic-wrap/core";

function copyComputedStyle(source: HTMLElement, target: HTMLElement): void {
  const computed = source.ownerDocument.defaultView!.getComputedStyle(source);
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    target.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  }
}

export function contentWidth(element: HTMLElement): number {
  const view = element.ownerDocument.defaultView;
  if (!view) return element.getBoundingClientRect().width;
  const computed = view.getComputedStyle(element);
  const padding = Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight);
  const clientWidth = element.clientWidth || element.getBoundingClientRect().width;
  return Math.max(0, clientWidth - padding);
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
    font: computed.font,
    fontFeatureSettings: computed.fontFeatureSettings,
    fontKerning: computed.fontKerning,
    fontOpticalSizing: computed.fontOpticalSizing,
    fontVariationSettings: computed.fontVariationSettings,
    letterSpacing: computed.letterSpacing,
    position: "fixed",
    textTransform: computed.textTransform,
    visibility: "hidden",
    whiteSpace: "pre",
  });
  document.body.append(probe);
  const cache = new Map<string, number>();
  return {
    measureText(text) {
      const cached = cache.get(text);
      if (cached !== undefined) return cached;
      probe.textContent = text;
      const width = probe.getBoundingClientRect().width;
      cache.set(text, width);
      return width;
    },
    dispose() {
      probe.remove();
      cache.clear();
    },
  };
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
  return [
    ...new Set(
      lineStarts.map((lineStart) =>
        /\s/u.test(text[lineStart - 1] ?? "")
          ? lineStart - 1
          : /\s/u.test(text[lineStart] ?? "")
            ? lineStart
            : lineStart,
      ),
    ),
  ];
}

/** Measures native wrapping in an invisible copy, without mutating the visible element. */
export function readNativeLayout(element: HTMLElement, text: string): BaselineLayout {
  const document = element.ownerDocument;
  const probe = document.createElement(element.tagName.toLowerCase());
  copyComputedStyle(element, probe);
  const rect = element.getBoundingClientRect();
  Object.assign(probe.style, {
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
    width: `${rect.width}px`,
  });
  probe.removeAttribute("id");
  probe.setAttribute("aria-hidden", "true");
  probe.textContent = text;
  document.body.append(probe);
  try {
    return { breaks: readBreaks(probe, text) };
  } finally {
    probe.remove();
  }
}
