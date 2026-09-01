import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
} from "react";
import {
  resolveLineBreaks,
  type LineBreakDiagnostics,
  type LineBreakSelection,
  type LineBreakSelectionWithDiagnostics,
  type LineBreakStrategy,
  type PhraseModel,
} from "@semantic-wrap/core";
/*
 * Core owns language-agnostic selection. This package only measures and renders
 * React elements.
 */
import { contentWidth, createTextMeasurer, readNativeLayout } from "./dom-measure.js";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface UseSemanticWrapOptions {
  text: string;
  model: PhraseModel;
  strategy?: LineBreakStrategy;
  diagnostics?: boolean;
}

export interface UseSemanticWrapResult {
  ref: (element: HTMLElement | null) => void;
  selection: LineBreakSelection | null;
  diagnostics: LineBreakDiagnostics | null;
}

type Resolution = LineBreakSelection | LineBreakSelectionWithDiagnostics;

function equalSelectedCandidates(left: Resolution, right: Resolution): boolean {
  return (
    left.selectedCandidates.length === right.selectedCandidates.length &&
    left.selectedCandidates.every((candidate, index) => {
      const next = right.selectedCandidates[index];
      return (
        next !== undefined &&
        candidate.offset === next.offset &&
        candidate.level === next.level &&
        candidate.name === next.name &&
        candidate.penalty === next.penalty
      );
    })
  );
}

function equalResolution(left: Resolution | null, right: Resolution): boolean {
  return (
    left !== null &&
    left.text === right.text &&
    left.applied === right.applied &&
    left.reason === right.reason &&
    left.overflow === right.overflow &&
    left.breaks.length === right.breaks.length &&
    left.breaks.every((offset, index) => offset === right.breaks[index]) &&
    left.widths.length === right.widths.length &&
    left.widths.every((width, index) => width === right.widths[index]) &&
    equalSelectedCandidates(left, right) &&
    JSON.stringify("diagnostics" in left ? left.diagnostics : null) ===
      JSON.stringify("diagnostics" in right ? right.diagnostics : null)
  );
}

/** Measures a plain-text element and returns a headless line-break decision. */
export function useSemanticWrap(options: UseSemanticWrapOptions): UseSemanticWrapResult {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [measurementRevision, setMeasurementRevision] = useState(0);

  useBrowserLayoutEffect(() => {
    if (!element) {
      setResolution(null);
      return;
    }
    const width = contentWidth(element);
    if (!Number.isFinite(width) || width <= 0) return;
    const measurer = createTextMeasurer(element);
    try {
      const input = {
        text: options.text,
        model: options.model,
        maxWidth: width,
        measureText: measurer.measureText,
      };
      const nativeLayout = readNativeLayout(element, options.text);
      const next = options.diagnostics
        ? resolveLineBreaks(input, {
            nativeLayout,
            strategy: options.strategy,
            diagnostics: true,
          })
        : resolveLineBreaks(input, { nativeLayout, strategy: options.strategy });
      setResolution((current) => (equalResolution(current, next) ? current : next));
    } finally {
      measurer.dispose();
    }
  }, [
    element,
    measurementRevision,
    options.diagnostics,
    options.model,
    options.strategy,
    options.text,
  ]);

  useEffect(() => {
    if (!element) return;
    const view = element.ownerDocument.defaultView;
    if (!view) return;
    const observer = new view.ResizeObserver(() => setMeasurementRevision((value) => value + 1));
    observer.observe(element);
    const mutationObserver = new view.MutationObserver(() =>
      setMeasurementRevision((value) => value + 1),
    );
    mutationObserver.observe(element, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    let active = true;
    const fonts = element.ownerDocument.fonts;
    const remeasureAfterFontLoad = () => {
      if (active) setMeasurementRevision((value) => value + 1);
    };
    void fonts.ready.then(remeasureAfterFontLoad);
    fonts.addEventListener("loadingdone", remeasureAfterFontLoad);
    return () => {
      active = false;
      observer.disconnect();
      mutationObserver.disconnect();
      fonts.removeEventListener("loadingdone", remeasureAfterFontLoad);
    };
  }, [element]);

  return {
    ref: setElement,
    selection: resolution,
    diagnostics:
      resolution && "diagnostics" in resolution ? resolution.diagnostics : null,
  };
}

interface SemanticChildProps {
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

export interface SemanticWrapProps
  extends Omit<UseSemanticWrapOptions, "text" | "diagnostics"> {
  children: ReactElement<SemanticChildProps>;
  /** Receives the same HTMLElement ref as the child. React 19 only. */
  ref?: Ref<HTMLElement>;
}

function attachRef(
  ref: Ref<HTMLElement> | undefined,
  element: HTMLElement,
): (() => void) | undefined {
  if (typeof ref === "function") {
    const cleanup = ref(element);
    return typeof cleanup === "function" ? cleanup : () => void ref(null);
  }
  if (!ref) return undefined;
  ref.current = element;
  return () => {
    ref.current = null;
  };
}

function mergeRefs(...refs: (Ref<HTMLElement> | undefined)[]): RefCallback<HTMLElement> {
  return (element) => {
    if (element === null) {
      for (const ref of refs) {
        if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
      }
      return;
    }
    const cleanups = refs.flatMap((ref) => {
      const cleanup = attachRef(ref, element);
      return cleanup ? [cleanup] : [];
    });
    return () => {
      for (let index = cleanups.length - 1; index >= 0; index -= 1) {
        cleanups[index]!();
      }
    };
  };
}

function nextRenderedOffset(text: string, breakOffset: number): number {
  let offset = breakOffset;
  while (offset < text.length && /\s/u.test(text[offset]!)) offset += 1;
  return offset;
}

function renderWithBreaks(text: string, breaks: readonly number[]): ReactNode {
  if (breaks.length === 0) return text;
  const nodes: ReactNode[] = [];
  let start = 0;
  for (const offset of breaks) {
    nodes.push(text.slice(start, offset), <br key={`semantic-wrap-${offset}`} />);
    start = nextRenderedOffset(text, offset);
  }
  nodes.push(text.slice(start));
  return <Fragment>{nodes}</Fragment>;
}

/**
 * Applies selected breaks to exactly one plain-text child without adding a DOM wrapper
 * or injecting CSS. Selected breaks are rendered as hard `<br>` elements.
 */
export function SemanticWrap({
  children,
  ref,
  ...options
}: SemanticWrapProps): ReactElement {
  const child = Children.only(children);
  if (!isValidElement<SemanticChildProps>(child) || child.type === Fragment) {
    throw new Error("SemanticWrap requires exactly one non-Fragment React element");
  }
  const source = child.props.children;
  if (typeof source !== "string" && typeof source !== "number") {
    throw new Error("SemanticWrap supports plain text children only; use useSemanticWrap for markup");
  }
  const text = String(source);
  const result = useSemanticWrap({ text, ...options });
  const childRef = child.props.ref;
  // Ref callback identity must stay stable so cloning does not detach the measured element.
  const mergedRef = useMemo(
    () => mergeRefs(childRef, ref, result.ref),
    [childRef, ref, result.ref],
  );
  const rendered =
    result.selection?.applied === true
      ? renderWithBreaks(text, result.selection.breaks)
      : text;
  return cloneElement(child, { ref: mergedRef, children: rendered });
}
