import {
  layoutAtBreaks,
  nextTextOffset,
  semanticBalancedLayout,
} from "./line-layout.js";
import type {
  BalanceSelectorOptions,
  LineBreakSelector,
  SelectorContext,
} from "./types.js";

function sameBreaks(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** Balances line lengths, then spends a bounded amount of balance on cheaper boundaries. */
export function balanceSelector(options: BalanceSelectorOptions = {}): LineBreakSelector {
  const tolerance = options.tolerance ?? 0.12;
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) {
    throw new Error("Balance tolerance must be between zero and one");
  }
  return (context) => {
    const semantic = semanticBalancedLayout(context, tolerance);
    const native = context.nativeLayout
      ? layoutAtBreaks(context, context.nativeLayout.breaks)
      : semanticBalancedLayout(context, 0, true);
    const nativeBreaks = native.breaks.map(({ offset }) => offset);
    const semanticBreaks = semantic.breaks.map(({ offset }) => offset);
    if (semantic.overflow) {
      return { breaks: nativeBreaks, applied: false, reason: "semantic-overflow" };
    }
    if (sameBreaks(nativeBreaks, semanticBreaks)) {
      return { breaks: nativeBreaks, applied: false, reason: "same-layout" };
    }
    return { breaks: semanticBreaks, applied: true, reason: "semantic-selected" };
  };
}

/** Greedily fills each line while preferring the least costly boundary that fits. */
export function greedySelector(): LineBreakSelector {
  return (context: SelectorContext) => {
    if (context.text === "") return { breaks: [], applied: false, reason: "empty" };
    const breaks: number[] = [];
    let start = 0;
    let candidateIndex = 0;

    while (start < context.text.length) {
      if (context.measureText(context.text.slice(start)) <= context.maxWidth) break;
      const fitting = [] as typeof context.candidates[number][];
      let scan = candidateIndex;
      for (; scan < context.candidates.length; scan += 1) {
        const candidate = context.candidates[scan]!;
        if (candidate.offset <= start) continue;
        const line = context.text.slice(start, candidate.offset).trimEnd();
        if (context.measureText(line) <= context.maxWidth) fitting.push(candidate);
        else break;
      }
      const selected = fitting.sort((left, right) =>
        left.penalty === right.penalty ? right.offset - left.offset : left.penalty - right.penalty,
      )[0];
      if (!selected) break;
      breaks.push(selected.offset);
      start = nextTextOffset(context.text, selected.offset);
      candidateIndex = context.candidates.findIndex(({ offset }) => offset > selected.offset);
      if (candidateIndex < 0) break;
    }

    return {
      breaks,
      applied: breaks.length > 0,
      reason: breaks.length > 0 ? "greedy-selected" : "same-layout",
    };
  };
}
