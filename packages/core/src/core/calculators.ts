import {
  calculateOptimalLayouts,
  nextTextOffset,
} from "./line-layout.js";
import type {
  LineBreakCalculator,
  LayoutCalculationContext,
} from "./types.js";

/** Calculates the non-dominated, minimum-line layout candidates. */
export function optimalLayouts(): LineBreakCalculator {
  return calculateOptimalLayouts;
}

/** Greedily fills each line while preferring the least costly boundary that fits. */
export function greedy(): LineBreakCalculator {
  return (context: LayoutCalculationContext) => {
    if (context.text === "") return [{ breaks: [] }];
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
        const line = context.text.slice(start, candidate.offset);
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

    return [{ breaks }];
  };
}
