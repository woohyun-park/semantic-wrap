import type {
  BreakCandidate,
  LayoutCalculationContext,
  LineBreakLayoutCandidate,
} from "./types.js";

export interface InternalLayout {
  lines: string[];
  widths: number[];
  breaks: BreakCandidate[];
  lineCount: number;
  balanceScore: number;
  modelCost: number;
  overflow: boolean;
}

interface CandidateLayout {
  breaks: BreakCandidate[];
  rawBalanceCost: number;
  rawModelCost: number;
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

function signature(layout: Pick<InternalLayout, "breaks">): string {
  return layout.breaks.map(({ offset }) => offset).join(",");
}

function dominates(left: CandidateLayout, right: CandidateLayout): boolean {
  return (
    left.rawBalanceCost <= right.rawBalanceCost + EPSILON &&
    left.rawModelCost <= right.rawModelCost + EPSILON
  );
}

function pareto(layouts: CandidateLayout[]): CandidateLayout[] {
  const ordered = layouts.sort((left, right) => {
    const balance = left.rawBalanceCost - right.rawBalanceCost;
    if (Math.abs(balance) > EPSILON) return balance;
    const model = left.rawModelCost - right.rawModelCost;
    if (Math.abs(model) > EPSILON) return model;
    return signature(left).localeCompare(signature(right));
  });
  const frontier: CandidateLayout[] = [];
  for (const layout of ordered) {
    if (frontier.some((existing) => dominates(existing, layout))) continue;
    for (let index = frontier.length - 1; index >= 0; index -= 1) {
      if (dominates(layout, frontier[index]!)) frontier.splice(index, 1);
    }
    frontier.push(layout);
  }
  return frontier;
}

function idealWidth(context: LayoutCalculationContext, lineCount: number): number {
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
  const widths = lines.map(context.measureText);
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
): LineBreakLayoutCandidate[] {
  if (context.text === "") return [{ breaks: [] }];
  const boundaries = context.candidates;
  const positions = [0, ...boundaries.map(({ offset }) => nextTextOffset(context.text, offset))];
  const segmentText = (start: number, end: number) =>
    context.text.slice(
      positions[start]!,
      end < boundaries.length ? boundaries[end]!.offset : undefined,
    );
  const segmentWidths = Array.from({ length: positions.length }, () =>
    new Array<number>(positions.length).fill(Number.POSITIVE_INFINITY),
  );

  for (let start = 0; start < positions.length; start += 1) {
    for (let end = start; end < positions.length; end += 1) {
      segmentWidths[start]![end] = context.measureText(segmentText(start, end));
    }
  }

  const minimumLines = new Array<number>(positions.length + 1).fill(Number.POSITIVE_INFINITY);
  minimumLines[positions.length] = 0;
  for (let start = positions.length - 1; start >= 0; start -= 1) {
    for (let end = start; end < positions.length; end += 1) {
      if (segmentWidths[start]![end]! > context.maxWidth + EPSILON) break;
      minimumLines[start] = Math.min(minimumLines[start]!, 1 + minimumLines[end + 1]!);
    }
  }
  const lineCount = minimumLines[0]!;
  if (!Number.isFinite(lineCount)) {
    return [{ breaks: [] }];
  }

  const targetWidth = idealWidth(context, lineCount);
  const memo = new Map<string, CandidateLayout[]>();

  function solve(start: number, remainingLines: number): CandidateLayout[] {
    const key = `${start}:${remainingLines}`;
    const cached = memo.get(key);
    if (cached) return cached;
    if (start === positions.length) {
      const result: CandidateLayout[] =
        remainingLines === 0
          ? [{
              breaks: [],
              rawBalanceCost: 0,
              rawModelCost: 0,
            }]
          : [];
      memo.set(key, result);
      return result;
    }
    if (remainingLines <= 0 || positions.length - start < remainingLines) return [];

    const layouts: CandidateLayout[] = [];
    for (let end = start; end < positions.length; end += 1) {
      const width = segmentWidths[start]![end]!;
      if (width > context.maxWidth + EPSILON) break;
      const isLastLine = end === positions.length - 1;
      if (isLastLine !== (remainingLines === 1)) continue;
      const rest = solve(end + 1, remainingLines - 1);
      const selectedBreak = isLastLine ? undefined : boundaries[end];
      const normalizedDeviation = (width - targetWidth) / context.maxWidth;
      for (const suffix of rest) {
        layouts.push({
          breaks: selectedBreak ? [selectedBreak, ...suffix.breaks] : suffix.breaks,
          rawBalanceCost: normalizedDeviation ** 2 + suffix.rawBalanceCost,
          rawModelCost: (selectedBreak?.penalty ?? 0) + suffix.rawModelCost,
        });
      }
    }
    const result = pareto(layouts);
    memo.set(key, result);
    return result;
  }

  const layouts = solve(0, lineCount);
  if (layouts.length === 0) return [{ breaks: [] }];
  return layouts.map((layout) => ({
    breaks: layout.breaks.map(({ offset }) => offset),
  }));
}
