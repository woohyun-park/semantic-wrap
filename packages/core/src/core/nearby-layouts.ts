import {
  calculateOptimalLayouts,
  idealWidth,
  mergeParetoFrontiers,
  nextTextOffset,
  type CandidateLayout,
} from "./line-layout.js";
import type {
  BreakCandidate,
  LayoutCalculationContext,
  LineBreakLayoutCandidate,
} from "./types.js";

/** Internal benchmark counters. Not part of the package's public API. */
export interface NearbyLayoutStats {
  measuredSegments: number;
  generatedLayouts: number;
  maxFrontierSize: number;
}

function neighborhood(
  candidates: readonly BreakCandidate[],
  offset: number,
  radius: number,
): readonly BreakCandidate[] {
  let low = 0;
  let high = candidates.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (candidates[middle]!.offset < offset) low = middle + 1;
    else high = middle;
  }
  const includesAnchor = candidates[low]?.offset === offset;
  return candidates.slice(Math.max(0, low - radius), low + radius + Number(includesAnchor));
}

/** Exact widths and Pareto costs within a restricted, native-line-count search space. */
export function calculateNearbyLayouts(
  context: LayoutCalculationContext,
  radius: 1 | 2 | 4 = 2,
  stats?: NearbyLayoutStats,
): LineBreakLayoutCandidate[] {
  if (!context.nativeLayout) return calculateOptimalLayouts(context);
  if (context.text === "" || context.nativeLayout.breaks.length === 0) return [{ breaks: [] }];

  const layers = context.nativeLayout.breaks.map((offset) =>
    neighborhood(context.candidates, offset, radius),
  );
  if (layers.some((layer) => layer.length === 0)) return [];
  const targetWidth = idealWidth(context, layers.length + 1);

  // Iterative suffix DP avoids recursion proportional to the number of rendered lines.
  let suffixes = new Map<number, CandidateLayout[]>([
    [
      context.text.length,
      [
        {
          breaks: [],
          signature: "",
          rawBalanceCost: 0,
          rawModelCost: 0,
        },
      ],
    ],
  ]);
  for (let layerIndex = layers.length; layerIndex >= 0; layerIndex -= 1) {
    const starts = layerIndex === 0 ? [0] : layers[layerIndex - 1]!.map(({ offset }) => offset);
    const ends =
      layerIndex === layers.length
        ? [{ offset: context.text.length, level: null, penalty: 0 }]
        : layers[layerIndex]!;
    const current = new Map<number, CandidateLayout[]>();
    for (const startOffset of starts) {
      const textStart = layerIndex === 0 ? 0 : nextTextOffset(context.text, startOffset);
      let frontier: CandidateLayout[] = [];
      for (const end of ends) {
        if (end.offset <= textStart) continue;
        const rest = suffixes.get(end.offset);
        if (!rest?.length) continue;
        const width = context.measureText(context.text.slice(textStart, end.offset));
        if (stats) stats.measuredSegments += 1;
        // Do not assume widths increase monotonically with the substring length.
        if (width > context.maxWidth + 1e-9) continue;
        const isLastLine = layerIndex === layers.length;
        const deviation = (width - targetWidth) / context.maxWidth;
        const extensions = rest.map((suffix): CandidateLayout => ({
          breaks: isLastLine ? suffix.breaks : [end, ...suffix.breaks],
          signature: isLastLine
            ? suffix.signature
            : `${end.offset}${suffix.signature === "" ? "" : `,${suffix.signature}`}`,
          rawBalanceCost: deviation ** 2 + suffix.rawBalanceCost,
          rawModelCost: (isLastLine ? 0 : end.penalty) + suffix.rawModelCost,
        }));
        frontier = mergeParetoFrontiers(frontier, extensions);
        if (stats) {
          stats.generatedLayouts += extensions.length;
          stats.maxFrontierSize = Math.max(stats.maxFrontierSize, frontier.length);
        }
      }
      current.set(startOffset, frontier);
    }
    suffixes = current;
  }
  return (suffixes.get(0) ?? []).map(({ breaks }) => ({
    breaks: breaks.map(({ offset }) => offset),
  }));
}
