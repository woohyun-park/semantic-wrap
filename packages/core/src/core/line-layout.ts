import type {
  BreakCandidate,
  LayoutCalculationContext,
  LineBreakLayoutCandidate,
} from "./types.js";
import { finishSteps } from "./steps.js";

/** Internal offset-based measurement hook owned by a reusable plan. */
export interface SegmentMeasurementContext extends LayoutCalculationContext {
  measureSegments?(ranges: readonly (readonly [number, number])[]): readonly number[];
}

export interface InternalLayout {
  lines: string[];
  widths: number[];
  breaks: BreakCandidate[];
  lineCount: number;
  balanceScore: number;
  modelCost: number;
  overflow: boolean;
}

export interface CandidateLayout {
  breaks: BreakCandidate[];
  signature: string;
  rawBalanceCost: number;
  rawModelCost: number;
}

/** Internal counters used by the repository benchmark. Not part of the package API. */
export interface OptimalLayoutCalculationStats {
  allocatedSegmentWidthSlots: number;
  measuredSegments: number;
  visitedStates: number;
  memoHits: number;
  prunedTransitions: number;
  generatedLayouts: number;
  paretoComparisons: number;
  peakBufferedLayouts: number;
  maxFrontierSize: number;
}

const EPSILON = 1e-9;

export function nextTextOffset(text: string, breakOffset: number): number {
  let offset = breakOffset;
  while (offset < text.length && /\s/u.test(text[offset]!)) offset += 1;
  return offset;
}

export function splitAtOffsets(text: string, offsets: readonly number[]): string[] {
  if (text === "") return [];
  const lines: string[] = [];
  let start = 0;
  for (const offset of offsets) {
    lines.push(text.slice(start, offset));
    start = nextTextOffset(text, offset);
  }
  lines.push(text.slice(start));
  return lines;
}

function compareCandidateLayouts(
  left: CandidateLayout,
  right: CandidateLayout,
): number {
  const balance = left.rawBalanceCost - right.rawBalanceCost;
  if (Math.abs(balance) > EPSILON) return balance;
  const model = left.rawModelCost - right.rawModelCost;
  if (Math.abs(model) > EPSILON) return model;
  return left.signature.localeCompare(right.signature);
}

export function mergeParetoFrontiers(
  left: readonly CandidateLayout[],
  right: readonly CandidateLayout[],
  stats?: OptimalLayoutCalculationStats,
): CandidateLayout[] {
  const frontier: CandidateLayout[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  let bestModelCost = Number.POSITIVE_INFINITY;

  while (leftIndex < left.length || rightIndex < right.length) {
    const takeLeft =
      rightIndex >= right.length ||
      (leftIndex < left.length &&
        compareCandidateLayouts(left[leftIndex]!, right[rightIndex]!) <= 0);
    const layout = takeLeft ? left[leftIndex++]! : right[rightIndex++]!;
    if (frontier.length > 0) {
      if (stats) stats.paretoComparisons += 1;
      if (bestModelCost <= layout.rawModelCost + EPSILON) continue;
    }

    frontier.push(layout);
    bestModelCost = layout.rawModelCost;
  }
  if (stats) stats.maxFrontierSize = Math.max(stats.maxFrontierSize, frontier.length);
  return frontier;
}

export function idealWidth(context: LayoutCalculationContext, lineCount: number): number {
  if (lineCount === 0) return 0;
  const breakCount = Math.max(0, lineCount - 1);
  const spacesRemovedAtBreaks = context.candidates.every(({ offset }) =>
    /\s/u.test(context.text[offset] ?? ""),
  );
  const removedWhitespaceWidth =
    spacesRemovedAtBreaks && breakCount > 0
      ? Math.max(0, context.measureText(" ")) * breakCount
      : 0;
  return Math.min(
    context.maxWidth,
    Math.max(0, (context.measureText(context.text) - removedWhitespaceWidth) / lineCount),
  );
}

export function layoutAtBreaks(
  context: LayoutCalculationContext,
  breakOffsets: readonly number[],
  unmatchedPenalty = Math.max(0, ...context.candidates.map(({ penalty }) => penalty)),
): InternalLayout {
  const lines = splitAtOffsets(context.text, breakOffsets);
  const widths = context.measureTexts
    ? [...context.measureTexts(lines)]
    : lines.map(context.measureText);
  const candidates = new Map(context.candidates.map((candidate) => [candidate.offset, candidate]));
  const breaks = breakOffsets.map(
    (offset): BreakCandidate =>
      candidates.get(offset) ?? { offset, level: null, penalty: unmatchedPenalty },
  );
  const lineCount = lines.length;
  const targetWidth = idealWidth(context, lineCount);
  const balanceScore =
    lineCount === 0
      ? 0
      : Math.sqrt(
          widths.reduce(
            (total, width) => total + ((width - targetWidth) / context.maxWidth) ** 2,
            0,
          ) / lineCount,
        );
  return {
    lines,
    widths,
    breaks,
    lineCount,
    balanceScore,
    modelCost: breaks.reduce((total, candidate) => total + candidate.penalty, 0),
    overflow: widths.some((width) => !Number.isFinite(width) || width > context.maxWidth + EPSILON),
  };
}

/** Finds the non-dominated, minimum-line layouts across balance and model cost. */
export function calculateOptimalLayouts(
  context: LayoutCalculationContext,
  stats?: OptimalLayoutCalculationStats,
): LineBreakLayoutCandidate[] {
  return finishSteps(calculateOptimalLayoutSteps(context, stats));
}

export function* calculateOptimalLayoutSteps(
  context: SegmentMeasurementContext,
  stats?: OptimalLayoutCalculationStats,
): Generator<void, LineBreakLayoutCandidate[], void> {
  if (context.text === "") return [{ breaks: [] }];
  const boundaries = context.candidates;
  const positions = [0, ...boundaries.map(({ offset }) => nextTextOffset(context.text, offset))];
  const segmentText = (start: number, end: number) =>
    context.text.slice(
      positions[start]!,
      end < boundaries.length ? boundaries[end]!.offset : undefined,
    );
  const segmentWidths: number[] = [];
  const segmentRowOffsets = new Uint32Array(positions.length + 1);
  const segmentRange = (start: number, end: number): readonly [number, number] =>
    [positions[start]!, boundaries[end]?.offset ?? context.text.length];

  if (context.measureTexts) {
    // Advance independent starts together, stopping each at exactly the same first
    // overflow as the scalar path. No speculative segments or candidate pruning.
    // Only this block's rows are buffered; flattened storage remains unchanged.
    const batchSize = 64;
    for (let block = 0; block < positions.length; block += batchSize) {
      const rows: number[][] = Array.from(
        { length: Math.min(batchSize, positions.length - block) },
        () => [],
      );
      let active = rows.map((_, index) => block + index);
      while (active.length > 0) {
        const widths = context.measureSegments
          ? context.measureSegments(active.map((start) => segmentRange(start, start + rows[start - block]!.length)))
          : context.measureTexts(active.map((start) => segmentText(start, start + rows[start - block]!.length)));
        const next: number[] = [];
        active.forEach((start, index) => {
          const row = rows[start - block]!;
          const width = widths[index]!;
          row.push(width);
          if (stats) {
            stats.measuredSegments += 1;
            stats.allocatedSegmentWidthSlots += 1;
          }
          if (width <= context.maxWidth + EPSILON && start + row.length < positions.length) {
            next.push(start);
          }
        });
        active = next;
        yield;
      }
      rows.forEach((row, index) => {
        segmentRowOffsets[block + index] = segmentWidths.length;
        for (const width of row) segmentWidths.push(width);
      });
    }
  } else {
    for (let start = 0; start < positions.length; start += 1) {
      segmentRowOffsets[start] = segmentWidths.length;
      for (let end = start; end < positions.length; end += 1) {
        if (stats) stats.measuredSegments += 1;
        const width = context.measureSegments
          ? context.measureSegments([segmentRange(start, end)])[0]!
          : context.measureText(segmentText(start, end));
        segmentWidths.push(width);
        if (stats) stats.allocatedSegmentWidthSlots += 1;
        yield;
        if (width > context.maxWidth + EPSILON) break;
      }
    }
  }
  segmentRowOffsets[positions.length] = segmentWidths.length;

  const minimumLines = new Array<number>(positions.length + 1).fill(Number.POSITIVE_INFINITY);
  minimumLines[positions.length] = 0;
  for (let start = positions.length - 1; start >= 0; start -= 1) {
    yield;
    const rowStart = segmentRowOffsets[start]!;
    const rowEnd = segmentRowOffsets[start + 1]!;
    for (let index = rowStart; index < rowEnd; index += 1) {
      const end = start + index - rowStart;
      const width = segmentWidths[index]!;
      if (width > context.maxWidth + EPSILON) break;
      minimumLines[start] = Math.min(minimumLines[start]!, 1 + minimumLines[end + 1]!);
    }
  }
  const lineCount = minimumLines[0]!;
  if (!Number.isFinite(lineCount)) {
    return [{ breaks: [] }];
  }

  const targetWidth = idealWidth(context, lineCount);
  const memo = new Map<string, CandidateLayout[]>();

  function* solve(start: number, remainingLines: number): Generator<void, CandidateLayout[], void> {
    const key = `${start}:${remainingLines}`;
    const cached = memo.get(key);
    if (cached) {
      if (stats) stats.memoHits += 1;
      return cached;
    }
    if (stats) stats.visitedStates += 1;
    if (start === positions.length) {
      const result: CandidateLayout[] =
        remainingLines === 0
          ? [{
              breaks: [],
              signature: "",
              rawBalanceCost: 0,
              rawModelCost: 0,
            }]
          : [];
      memo.set(key, result);
      return result;
    }
    if (remainingLines <= 0 || positions.length - start < remainingLines) return [];

    let frontier: CandidateLayout[] = [];
    const rowStart = segmentRowOffsets[start]!;
    const rowEnd = segmentRowOffsets[start + 1]!;
    for (let index = rowStart; index < rowEnd; index += 1) {
      yield;
      const end = start + index - rowStart;
      const width = segmentWidths[index]!;
      if (width > context.maxWidth + EPSILON) break;
      const isLastLine = end === positions.length - 1;
      if (isLastLine !== (remainingLines === 1)) continue;
      const nextStart = end + 1;
      const nextRemainingLines = remainingLines - 1;
      if (
        minimumLines[nextStart]! > nextRemainingLines ||
        positions.length - nextStart < nextRemainingLines
      ) {
        if (stats) stats.prunedTransitions += 1;
        continue;
      }
      const rest = yield* solve(nextStart, nextRemainingLines);
      const selectedBreak = isLastLine ? undefined : boundaries[end];
      const normalizedDeviation = (width - targetWidth) / context.maxWidth;
      const layouts: CandidateLayout[] = [];
      for (const suffix of rest) {
        if (layouts.length % 64 === 0) yield;
        const breaks = selectedBreak ? [selectedBreak, ...suffix.breaks] : suffix.breaks;
        layouts.push({
          breaks,
          signature: selectedBreak
            ? `${selectedBreak.offset}${suffix.signature === "" ? "" : `,${suffix.signature}`}`
            : suffix.signature,
          rawBalanceCost: normalizedDeviation ** 2 + suffix.rawBalanceCost,
          rawModelCost: (selectedBreak?.penalty ?? 0) + suffix.rawModelCost,
        });
        if (stats) {
          stats.generatedLayouts += 1;
          stats.peakBufferedLayouts = Math.max(
            stats.peakBufferedLayouts,
            frontier.length + layouts.length,
          );
        }
      }
      frontier = mergeParetoFrontiers(frontier, layouts, stats);
    }
    memo.set(key, frontier);
    return frontier;
  }

  const layouts = yield* solve(0, lineCount);
  if (layouts.length === 0) return [{ breaks: [] }];
  return layouts.map((layout) => ({
    breaks: layout.breaks.map(({ offset }) => offset),
  }));
}
