import {
  calculateOptimalLayouts,
  calculateOptimalLayoutSteps,
  nextTextOffset,
} from "./line-layout.js";
import type {
  LineBreakCalculator,
  LayoutCalculationContext,
  NearbyLayoutsOptions,
} from "./types.js";
import { calculateNearbyLayouts } from "./nearby-layouts.js";

/** Opt-in local search; may miss improvements outside the native break neighborhoods. */
export function nearbyLayouts(options: NearbyLayoutsOptions = {}): LineBreakCalculator {
  const radius = options.radius ?? 2;
  if (![1, 2, 4].includes(radius)) throw new Error("Nearby layout radius must be 1, 2, or 4");
  return (context) => {
    const layouts = calculateNearbyLayouts(context, radius);
    return layouts.length > 0 ? layouts : [{ breaks: [] }];
  };
}

/** Calculates the non-dominated, minimum-line layout candidates. */
export function optimalLayouts(): LineBreakCalculator {
  return Object.assign(calculateOptimalLayouts, { steps: calculateOptimalLayoutSteps });
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
      let selected: typeof context.candidates[number] | undefined;
      for (let scan = candidateIndex; scan < context.candidates.length; scan += 1) {
        const candidate = context.candidates[scan]!;
        if (candidate.offset <= start) continue;
        const line = context.text.slice(start, candidate.offset);
        if (!(context.measureText(line) <= context.maxWidth)) break;
        if (!selected || candidate.penalty <= selected.penalty) {
          selected = candidate;
          candidateIndex = scan + 1;
        }
      }
      if (!selected) break;
      breaks.push(selected.offset);
      start = nextTextOffset(context.text, selected.offset);
      if (candidateIndex === context.candidates.length) break;
    }

    return [{ breaks }];
  };
}
