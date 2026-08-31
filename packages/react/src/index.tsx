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
} from "react";
import {
  getBreakCandidates,
  selectLineBreaks,
  type LineBreakSelection,
  type LineBreakSelector,
  type PhraseModel,
  type WrapContext,
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
  selector: LineBreakSelector;
  /** Defaults to the rendered element's content width. */
  maxWidth?: number;
  context?: WrapContext;
}

export interface UseSemanticWrapResult {
  ref: (element: HTMLElement | null) => void;
  selection: LineBreakSelection | null;
}

function equalSelection(
  left: LineBreakSelection | null,
  right: LineBreakSelection,
): boolean {
  return (
    left !== null &&
    left.text === right.text &&
    left.applied === right.applied &&
    left.reason === right.reason &&
    left.overflow === right.overflow &&
    left.breaks.length === right.breaks.length &&
    left.breaks.every((offset, index) => offset === right.breaks[index]) &&
    left.widths.length === right.widths.length &&
    left.widths.every((width, index) => width === right.widths[index])
  );
}

/** Measures a plain-text element and returns a headless line-break decision. */
export function useSemanticWrap(options: UseSemanticWrapOptions): UseSemanticWrapResult {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [selection, setSelection] = useState<LineBreakSelection | null>(null);
  const [measurementRevision, setMeasurementRevision] = useState(0);

  useBrowserLayoutEffect(() => {
    if (!element) {
      setSelection(null);
      return;
    }
    const width = options.maxWidth ?? contentWidth(element);
    if (!Number.isFinite(width) || width <= 0) return;
    const measurer = createTextMeasurer(element);
    try {
      const next = selectLineBreaks({
        text: options.text,
        candidates: getBreakCandidates(options.text, options.model),
        selector: options.selector,
        maxWidth: width,
        measureText: measurer.measureText,
        nativeLayout: readNativeLayout(element, options.text),
        context: options.context,
      });
      setSelection((current) => (equalSelection(current, next) ? current : next));
    } finally {
      measurer.dispose();
    }
  }, [element, measurementRevision, options.context, options.maxWidth, options.model, options.selector, options.text]);

  useEffect(() => {
    if (!element) return;
    const view = element.ownerDocument.defaultView;
    if (!view) return;
    const observer = new view.ResizeObserver(() => setMeasurementRevision((value) => value + 1));
    observer.observe(element);
    let active = true;
    void element.ownerDocument.fonts.ready.then(() => {
      if (active) setMeasurementRevision((value) => value + 1);
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [element]);

  return { ref: setElement, selection };
}

interface SemanticChildProps {
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

export interface SemanticWrapProps extends Omit<UseSemanticWrapOptions, "text"> {
  children: ReactElement<SemanticChildProps>;
  /** Receives the same HTMLElement ref as the child. React 19 only. */
  ref?: Ref<HTMLElement>;
}

function assignRef(ref: Ref<HTMLElement> | undefined, element: HTMLElement | null): void {
  if (typeof ref === "function") ref(element);
  else if (ref) ref.current = element;
}

function renderWithBreaks(text: string, breaks: readonly number[]): ReactNode {
  if (breaks.length === 0) return text;
  const nodes: ReactNode[] = [];
  let start = 0;
  for (const offset of breaks) {
    nodes.push(text.slice(start, offset), <br key={`semantic-wrap-${offset}`} />);
    start = offset;
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
    () => (element: HTMLElement | null) => {
      assignRef(childRef, element);
      assignRef(ref, element);
      result.ref(element);
    },
    [childRef, ref, result.ref],
  );
  const rendered =
    result.selection?.applied === true
      ? renderWithBreaks(text, result.selection.breaks)
      : text;
  return cloneElement(child, { ref: mergedRef, children: rendered });
}
