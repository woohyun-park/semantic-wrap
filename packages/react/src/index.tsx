import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
} from "react";
import { flushSync } from "react-dom";
import {
  createLineBreakPlan,
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
import {
  contentWidth,
  createNativeLayoutMeasurementCache,
  createTextMeasurementCache,
  createTextMeasurer,
  invalidateNativeLayoutMeasurementCache,
  invalidateTextMeasurementCache,
  readNativeLayout,
  type NativeLayoutMeasurementCache,
  type TextMeasurementCache,
} from "./dom-measure.js";

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
export type SemanticWrapMode = "precise" | "progressive";

function hasDiagnostics(
  resolution: Resolution,
): resolution is LineBreakSelectionWithDiagnostics {
  return "diagnostics" in resolution;
}

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

function useSemanticWrapEngine(
  options: UseSemanticWrapOptions,
  mode: SemanticWrapMode,
): UseSemanticWrapResult {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const plan = useMemo(
    () =>
      createLineBreakPlan({
        text: options.text,
        model: options.model,
        strategy: options.strategy,
      }),
    [options.model, options.strategy, options.text],
  );
  const [resolutionState, setResolutionState] = useState<Resolution | null>(null);
  const resolutionRef = useRef<Resolution | null>(null);
  const progressiveActiveRef = useRef(mode === "precise");
  const nativeLayoutMeasurementCacheRef = useRef<NativeLayoutMeasurementCache | null>(null);
  if (nativeLayoutMeasurementCacheRef.current === null) {
    nativeLayoutMeasurementCacheRef.current = createNativeLayoutMeasurementCache();
  }
  const nativeLayoutMeasurementCache = nativeLayoutMeasurementCacheRef.current;
  const textMeasurementCacheRef = useRef<TextMeasurementCache | null>(null);
  if (textMeasurementCacheRef.current === null) {
    textMeasurementCacheRef.current = createTextMeasurementCache();
  }
  const textMeasurementCache = textMeasurementCacheRef.current;

  const measure = useCallback(
    (target: HTMLElement): Resolution | null => {
      const width = contentWidth(target);
      if (!Number.isFinite(width) || width <= 0) return null;
      const measurer = createTextMeasurer(target, textMeasurementCache, options.text);
      try {
        const input = {
          maxWidth: width,
          measureText: measurer.measureText,
          nativeLayout: readNativeLayout(target, options.text, nativeLayoutMeasurementCache),
        };
        return options.diagnostics
          ? plan.select({ ...input, diagnostics: true })
          : plan.select(input);
      } finally {
        measurer.dispose();
      }
    },
    [nativeLayoutMeasurementCache, options.diagnostics, options.text, plan, textMeasurementCache],
  );

  const measureAndCommit = useCallback(
    (target: HTMLElement, synchronous: boolean): void => {
      const next = measure(target);
      if (!next) return;
      if (equalResolution(resolutionRef.current, next)) return;
      resolutionRef.current = next;
      if (synchronous) {
        flushSync(() => setResolutionState(next));
      } else {
        setResolutionState(next);
      }
    },
    [measure],
  );

  useBrowserLayoutEffect(() => {
    if (!element) {
      invalidateNativeLayoutMeasurementCache(nativeLayoutMeasurementCache);
      invalidateTextMeasurementCache(textMeasurementCache);
      resolutionRef.current = null;
      setResolutionState(null);
      return;
    }
    const target = element;
    const defaultView = target.ownerDocument.defaultView;
    if (!defaultView) return;
    const view = defaultView;

    let active = true;
    let measuredWidth = contentWidth(target);
    let preciseActive = mode === "precise" || progressiveActiveRef.current;
    progressiveActiveRef.current = preciseActive;
    if (!preciseActive && resolutionRef.current !== null) {
      resolutionRef.current = null;
      setResolutionState(null);
    }
    if (preciseActive) measureAndCommit(target, false);

    function activatePrecise(nextWidth: number): void {
      if (!active || preciseActive) return;
      if (Number.isFinite(nextWidth) && nextWidth > 0) measuredWidth = nextWidth;
      preciseActive = true;
      progressiveActiveRef.current = true;
      view.removeEventListener("resize", handleViewportResize);
      measureAndCommit(target, true);
    }

    function handleViewportResize(): void {
      activatePrecise(contentWidth(target));
    }

    if (!preciseActive) {
      view.addEventListener("resize", handleViewportResize, { once: true });
    }

    const observer = new view.ResizeObserver(() => {
      if (!active) return;
      const nextWidth = contentWidth(target);
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
      if (Math.abs(nextWidth - measuredWidth) < 0.01) return;
      measuredWidth = nextWidth;
      if (!preciseActive) {
        activatePrecise(nextWidth);
        return;
      }
      measureAndCommit(target, true);
    });
    observer.observe(target);

    const mutationObserver = new view.MutationObserver(() => {
      if (active && preciseActive) measureAndCommit(target, true);
    });
    mutationObserver.observe(target, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    const fonts = target.ownerDocument.fonts;
    const remeasureAfterFontLoad = () => {
      if (!active || !preciseActive) return;
      invalidateNativeLayoutMeasurementCache(nativeLayoutMeasurementCache);
      invalidateTextMeasurementCache(textMeasurementCache);
      measureAndCommit(target, true);
    };
    void fonts.ready.then(remeasureAfterFontLoad);
    fonts.addEventListener("loadingdone", remeasureAfterFontLoad);

    return () => {
      active = false;
      view.removeEventListener("resize", handleViewportResize);
      observer.disconnect();
      mutationObserver.disconnect();
      fonts.removeEventListener("loadingdone", remeasureAfterFontLoad);
      invalidateNativeLayoutMeasurementCache(nativeLayoutMeasurementCache);
      invalidateTextMeasurementCache(textMeasurementCache);
    };
  }, [element, measureAndCommit, mode, nativeLayoutMeasurementCache, plan, textMeasurementCache]);

  const resolution =
    element &&
    resolutionState?.text === options.text &&
    (mode === "precise" || progressiveActiveRef.current)
      ? resolutionState
      : null;

  return {
    ref: setElement,
    selection: resolution,
    diagnostics: resolution && hasDiagnostics(resolution) ? resolution.diagnostics : null,
  };
}

/** Measures a plain-text element and returns a headless precise line-break decision. */
export function useSemanticWrap(options: UseSemanticWrapOptions): UseSemanticWrapResult {
  return useSemanticWrapEngine(options, "precise");
}

interface SemanticChildProps {
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
  style?: CSSProperties;
}

export interface SemanticWrapProps
  extends Omit<UseSemanticWrapOptions, "text" | "diagnostics"> {
  children: ReactElement<SemanticChildProps>;
  /** Exact-first by default. Progressive keeps native SSR until a viewport or element resize. */
  mode?: SemanticWrapMode;
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
 * Applies selected breaks to exactly one plain-text child without adding a DOM wrapper.
 * Precise mode keeps the SSR text transparent until the first exact selection is ready.
 */
export function SemanticWrap({
  children,
  mode = "precise",
  ref,
  ...options
}: SemanticWrapProps): ReactElement {
  if (!["precise", "progressive"].includes(mode)) {
    throw new Error('SemanticWrap mode must be "precise" or "progressive"');
  }
  const child = Children.only(children);
  if (!isValidElement<SemanticChildProps>(child) || child.type === Fragment) {
    throw new Error("SemanticWrap requires exactly one non-Fragment React element");
  }
  const source = child.props.children;
  if (typeof source !== "string" && typeof source !== "number") {
    throw new Error("SemanticWrap supports plain text children only; use useSemanticWrap for markup");
  }
  const text = String(source);
  const result = useSemanticWrapEngine({ text, ...options }, mode);
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
  const pendingPreciseSelection = mode === "precise" && result.selection === null;
  const style = pendingPreciseSelection
    ? { ...child.props.style, opacity: 0 }
    : child.props.style;
  return cloneElement(child, { ref: mergedRef, children: rendered, style });
}
