import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
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
  measurementStyleSignature,
  type NativeLayoutMeasurementCache,
  type TextMeasurementCache,
} from "./dom-measure.js";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type SemanticWrapInitial = "resolved" | "native";
export type SemanticWrapResize = "immediate" | "settled";

export interface UseSemanticWrapOptions {
  /** Show the first exact result (default), or show native text before cooperative calculation. */
  initial?: SemanticWrapInitial;
  /** Update synchronously (default), or cooperate and wait for a stable width. */
  resize?: SemanticWrapResize;
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
/** @deprecated Use initial and resize. Progressive retains its legacy resize-triggered activation. */
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
    left.lines.length === right.lines.length &&
    left.lines.every((line, index) => line === right.lines[index]) &&
    left.widths.length === right.widths.length &&
    left.widths.every((width, index) => width === right.widths[index]) &&
    equalSelectedCandidates(left, right) &&
    JSON.stringify("diagnostics" in left ? left.diagnostics : null) ===
      JSON.stringify("diagnostics" in right ? right.diagnostics : null)
  );
}

interface PublishedResult {
  text: string;
  element: HTMLElement;
  selection: Resolution | null;
  ready: boolean;
}

interface CalculationContext {
  text: string;
  element: HTMLElement;
  initial: SemanticWrapInitial;
  resize: SemanticWrapResize;
  legacyProgressive: boolean;
  width: number;
  style: string;
  update: boolean;
  lastChange: number;
  painted: boolean;
}

function useSemanticWrapEngine(
  options: UseSemanticWrapOptions,
  legacyProgressive = false,
): UseSemanticWrapResult & { ready: boolean } {
  const { initial = "resolved", resize = "immediate" } = options;
  if (!["resolved", "native"].includes(initial)) {
    throw new Error('SemanticWrap initial must be "resolved" or "native"');
  }
  if (!["immediate", "settled"].includes(resize)) {
    throw new Error('SemanticWrap resize must be "immediate" or "settled"');
  }
  const [element, setElement] = useState<HTMLElement | null>(null);
  const plan = useMemo(
    () => createLineBreakPlan({ text: options.text, model: options.model, strategy: options.strategy }),
    [options.model, options.strategy, options.text],
  );
  // Jobs belong to an effect lifetime; visible results survive reference-only
  // input changes. Memoization is an optimization, never a correctness requirement.
  const [state, setState] = useState<PublishedResult | null>(null);
  const publishedRef = useRef<PublishedResult | null>(null);
  const calculationRef = useRef<CalculationContext | null>(null);
  const observationPausedRef = useRef(false);
  const legacyRef = useRef({ enabled: legacyProgressive, activated: false });
  const nativeCacheRef = useRef<NativeLayoutMeasurementCache | null>(null);
  if (nativeCacheRef.current === null) nativeCacheRef.current = createNativeLayoutMeasurementCache();
  const textCacheRef = useRef<TextMeasurementCache | null>(null);
  if (textCacheRef.current === null) textCacheRef.current = createTextMeasurementCache();
  const nativeCache = nativeCacheRef.current;
  const textCache = textCacheRef.current;

  useBrowserLayoutEffect(() => {
    if (legacyRef.current.enabled !== legacyProgressive) {
      legacyRef.current = { enabled: legacyProgressive, activated: false };
    }
    if (!element) {
      publishedRef.current = null;
      calculationRef.current = null;
      setState(null);
      return;
    }
    const target = element;
    const view = target.ownerDocument.defaultView;
    if (!view) return;
    let active = true;
    let enabled = !legacyProgressive || legacyRef.current.activated;
    let workTimer: number | undefined;
    let settleTimer: number | undefined;
    let frameId: number | undefined;
    let job: Generator<void, Resolution | null, void> | undefined;
    let completed: Resolution | null = null;
    let measuredWidth = contentWidth(target);
    let measuredStyle = measurementStyleSignature(target);
    const previousCalculation = calculationRef.current;
    const sameLifecycle = previousCalculation?.element === target &&
      previousCalculation.text === options.text && previousCalculation.initial === initial &&
      previousCalculation.resize === resize && previousCalculation.legacyProgressive === legacyProgressive;
    const continuation = sameLifecycle &&
      Math.abs(previousCalculation.width - measuredWidth) < 0.01 && previousCalculation.style === measuredStyle
      ? previousCalculation : null;
    const previousResult = publishedRef.current;
    let current = previousResult?.element === target && previousResult.text === options.text
      ? previousResult.selection : null;
    let lastChange = 0;
    let waitForStability = false;
    // A layout effect (or fonts.ready) must not start native-first work before paint.
    let painted = sameLifecycle ? previousCalculation.painted : initial !== "native" || legacyProgressive;
    let pending = false;
    let pendingUpdate = false;
    let observer: ResizeObserver | undefined;
    let deliveringResize = false;
    let reobserveFrame: number | undefined;

    function observeNextFrame(): void {
      reobserveFrame = view!.requestAnimationFrame(() => {
        reobserveFrame = undefined;
        if (!active) return;
        observationPausedRef.current = false;
        observer!.observe(target);
      });
    }

    function clearPending(): void {
      if (workTimer !== undefined) view!.clearTimeout(workTimer);
      if (settleTimer !== undefined) view!.clearTimeout(settleTimer);
      if (frameId !== undefined) view!.cancelAnimationFrame(frameId);
      workTimer = settleTimer = frameId = undefined;
      job?.return(null);
      job = undefined;
      completed = null;
      pending = false;
    }

    function publish(selection: Resolution | null, synchronous: boolean): void {
      if (!active) return;
      const previous = publishedRef.current;
      const sameTarget = previous?.element === target && previous.text === options.text;
      current = selection;
      const ready = selection !== null || (sameTarget && previous.ready);
      if (sameTarget && previous.ready === ready && (selection === null
        ? previous.selection === null : equalResolution(previous.selection, selection))) return;
      const next: PublishedResult = { text: options.text, element: target, selection, ready };
      publishedRef.current = next;
      // Our <br> updates change height inside an observer delivery. Suppress only
      // that self-notification; width changes during the gap are checked on reobserve.
      if (deliveringResize && observer) {
        observationPausedRef.current = true;
        observer.unobserve(target);
        observeNextFrame();
      }
      const update = () => setState(next);
      if (synchronous) flushSync(update);
      else update();
    }

    function input() {
      const measurer = createTextMeasurer(target, textCache, options.text);
      return {
        measurer,
        selection: {
          maxWidth: measuredWidth,
          measureText: measurer.measureText,
          measureTexts: measurer.measureTexts,
          cacheKey: textCache.metricKey,
          nativeLayout: readNativeLayout(target, options.text, nativeCache),
          diagnostics: options.diagnostics,
        },
      };
    }

    function resolveSync(synchronous: boolean): void {
      if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) return;
      const { measurer, selection } = input();
      try { publish(plan.select(selection), synchronous); }
      finally { measurer.dispose(); }
    }

    function* resolveSteps(): Generator<void, Resolution, void> {
      const { measurer, selection } = input();
      try {
        yield;
        return yield* plan.selectSteps(selection);
      } finally { measurer.dispose(); }
    }

    function commitCompleted(): void {
      settleTimer = undefined;
      if (!active || !completed) return;
      const width = contentWidth(target);
      const style = measurementStyleSignature(target);
      if (Math.abs(width - measuredWidth) >= 0.01 || style !== measuredStyle) {
        requestCalculation(true, true);
        return;
      }
      const delay = waitForStability ? 100 - (performance.now() - lastChange) : 0;
      if (delay > 0) {
        settleTimer = view!.setTimeout(commitCompleted, delay);
        return;
      }
      const result = completed;
      completed = null;
      pending = false;
      publish(result, true);
    }

    function runSlice(): void {
      workTimer = undefined;
      if (!active || !job) return;
      const deadline = performance.now() + 4;
      do {
        const step = job.next();
        if (step.done) {
          job = undefined;
          completed = step.value;
          commitCompleted();
          return;
        }
      } while (performance.now() < deadline);
      workTimer = view!.setTimeout(runSlice, 0);
    }

    function startWork(): void {
      if (!active) return;
      if (pendingUpdate && resize === "immediate") {
        pending = false;
        resolveSync(true);
      } else {
        job = resolveSteps();
        workTimer = view!.setTimeout(runSlice, 0);
      }
    }

    function requestCalculation(
      update: boolean,
      synchronous: boolean,
      resume: CalculationContext | null = null,
    ): void {
      clearPending();
      measuredWidth = contentWidth(target);
      measuredStyle = measurementStyleSignature(target);
      if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) {
        publish(null, synchronous);
        return;
      }
      waitForStability = update && resize === "settled";
      lastChange = resume?.lastChange ?? performance.now();
      pendingUpdate = update;
      const context: CalculationContext = {
        text: options.text, element: target, initial, resize, legacyProgressive,
        width: measuredWidth, style: measuredStyle, update, lastChange, painted,
      };
      calculationRef.current = context;
      if (painted && ((update && resize === "immediate") ||
        (!update && (initial === "resolved" || legacyProgressive)))) {
        resolveSync(synchronous);
        return;
      }
      pending = true;
      // Revalidate changed callbacks without flashing back to native text. A real
      // geometry/text change still follows the requested first-display/update policy.
      if (!resume || current === null) publish(null, synchronous);
      if (!active) return; // Publishing may synchronously replace this effect.
      if (!painted) {
        // Two frames allow a native frame even when React flushes passive effects early.
        frameId = view!.requestAnimationFrame(() => {
          frameId = view!.requestAnimationFrame(() => {
            frameId = undefined;
            painted = true;
            context.painted = true;
            workTimer = view!.setTimeout(startWork, 0);
          });
        });
      } else startWork();
    }

    function activateLegacy(): void {
      if (!active || enabled) return;
      enabled = true;
      legacyRef.current.activated = true;
      view!.removeEventListener("resize", activateLegacy);
      requestCalculation(false, true);
    }
    if (enabled) requestCalculation(continuation?.update ?? sameLifecycle, false, continuation);
    else {
      publish(null, false);
      view.addEventListener("resize", activateLegacy);
    }

    observer = new view.ResizeObserver(() => {
      if (!active) return;
      const width = contentWidth(target);
      if (!Number.isFinite(width) || width <= 0) return;
      if (Math.abs(width - measuredWidth) < 0.01) return;
      deliveringResize = true;
      try {
        if (!enabled) activateLegacy();
        else requestCalculation(true, true);
      } finally { deliveringResize = false; }
    });
    // An inline input can restart this effect inside flushSync during an observer
    // delivery. Preserve the pause across that restart (not only the old observer).
    if (observationPausedRef.current) observeNextFrame();
    else observer.observe(target);

    const mutationObserver = new view.MutationObserver(() => {
      if (!active || !enabled) return;
      const width = contentWidth(target);
      const style = measurementStyleSignature(target);
      if (Math.abs(width - measuredWidth) < 0.01 && style === measuredStyle) return;
      requestCalculation(true, true);
    });
    mutationObserver.observe(target, { attributes: true, attributeFilter: ["class", "style"] });

    const fonts = target.ownerDocument.fonts;
    function fontsChanged(): void {
      if (!active || !enabled) return;
      // Dispose an iterator before invalidating the probes it owns.
      const wasUpdate = pending ? pendingUpdate : current !== null;
      clearPending();
      invalidateNativeLayoutMeasurementCache(nativeCache);
      invalidateTextMeasurementCache(textCache);
      requestCalculation(wasUpdate, true);
    }
    // No redundant resolved-font callback: it could turn native-first startup into an update.
    if (fonts.status === "loading") void fonts.ready.then(fontsChanged);
    fonts.addEventListener("loadingdone", fontsChanged);

    return () => {
      active = false;
      clearPending();
      view.removeEventListener("resize", activateLegacy);
      if (reobserveFrame !== undefined) view.cancelAnimationFrame(reobserveFrame);
      observer!.disconnect();
      mutationObserver.disconnect();
      fonts.removeEventListener("loadingdone", fontsChanged);
      invalidateNativeLayoutMeasurementCache(nativeCache);
      invalidateTextMeasurementCache(textCache);
    };
  }, [element, initial, resize, legacyProgressive, nativeCache, textCache, plan, options.text, options.diagnostics]);

  const valid = state?.text === options.text && state.element === element;
  const selection = valid ? state.selection : null;
  return {
    ref: setElement,
    selection,
    diagnostics: selection && hasDiagnostics(selection) ? selection.diagnostics : null,
    ready: valid && state.ready,
  };
}

/** Headless exact selection; initial/resize control scheduling, not element visibility. */
export function useSemanticWrap(options: UseSemanticWrapOptions): UseSemanticWrapResult {
  return useSemanticWrapEngine(options);
}

interface SemanticChildProps {
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
  style?: CSSProperties;
}

interface SemanticWrapBaseProps
  extends Omit<UseSemanticWrapOptions, "text" | "diagnostics" | "initial" | "resize"> {
  children: ReactElement<SemanticChildProps>;
  /** Receives the same HTMLElement ref as the child. React 19 only. */
  ref?: Ref<HTMLElement>;
}

export type SemanticWrapProps = SemanticWrapBaseProps & (
  | {
    initial?: SemanticWrapInitial;
    resize?: SemanticWrapResize;
    mode?: never;
  }
  | {
    /** @deprecated Use initial/resize. Progressive preserves legacy first-resize activation. */
    mode: SemanticWrapMode;
    initial?: never;
    resize?: never;
  }
);

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
 * Resolved-first keeps SSR text transparent until the first exact selection is ready.
 */
export function SemanticWrap({
  children,
  mode,
  initial,
  resize,
  ref,
  ...options
}: SemanticWrapProps): ReactElement {
  if (mode !== undefined && !["precise", "progressive"].includes(mode)) {
    throw new Error('SemanticWrap mode must be "precise" or "progressive"');
  }
  if (mode !== undefined && (initial !== undefined || resize !== undefined)) {
    throw new Error("SemanticWrap mode cannot be combined with initial or resize");
  }
  const resolvedInitial = mode === "progressive" ? "native" : initial ?? "resolved";
  const child = Children.only(children);
  if (!isValidElement<SemanticChildProps>(child) || child.type === Fragment) {
    throw new Error("SemanticWrap requires exactly one non-Fragment React element");
  }
  const source = child.props.children;
  if (typeof source !== "string" && typeof source !== "number") {
    throw new Error("SemanticWrap supports plain text children only; use useSemanticWrap for markup");
  }
  const text = String(source);
  const result = useSemanticWrapEngine(
    { text, ...options, initial: resolvedInitial, resize }, mode === "progressive",
  );
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
  const pendingPreciseSelection = resolvedInitial === "resolved" && !result.ready;
  const style = pendingPreciseSelection
    ? { ...child.props.style, opacity: 0 }
    : child.props.style;
  return cloneElement(child, { ref: mergedRef, children: rendered, style });
}
