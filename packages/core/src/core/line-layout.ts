import type { BreakCandidate, SelectorContext } from "./types.js";

export interface InternalLayout {
  lines: string[];
  widths: number[];
  breaks: BreakCandidate[];
  lineCount: number;
  balanceCost: number;
  bestBalanceCost: number;
  semanticCost: number;
  balanceTradeoff: number;
  overflow: boolean;
}

interface CandidateLayout extends InternalLayout {
  rawBalanceCost: number;
  rawSemanticCost: number;
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
    lines.push(text.slice(start, offset).trimEnd());
    start = nextTextOffset(text, offset);
  }
  lines.push(text.slice(start).trimEnd());
  return lines;
}

function signature(layout: Pick<InternalLayout, "breaks">): string {
  return layout.breaks.map(({ offset }) => offset).join(",");
}

function dominates(left: CandidateLayout, right: CandidateLayout): boolean {
  return (
    left.rawBalanceCost <= right.rawBalanceCost + EPSILON &&
    left.rawSemanticCost <= right.rawSemanticCost + EPSILON
  );
}

function pareto(layouts: CandidateLayout[]): CandidateLayout[] {
  const ordered = layouts.sort((left, right) => {
    const balance = left.rawBalanceCost - right.rawBalanceCost;
    if (Math.abs(balance) > EPSILON) return balance;
    const semantic = left.rawSemanticCost - right.rawSemanticCost;
    if (Math.abs(semantic) > EPSILON) return semantic;
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

function overflowLayout(text: string, width: number): InternalLayout {
  return {
    lines: text === "" ? [] : [text],
    widths: text === "" ? [] : [width],
    breaks: [],
    lineCount: text === "" ? 0 : 1,
    balanceCost: 0,
    bestBalanceCost: 0,
    semanticCost: 0,
    balanceTradeoff: 0,
    overflow: text !== "" && width > 0,
  };
}

export function layoutAtBreaks(
  context: SelectorContext,
  breakOffsets: readonly number[],
): InternalLayout {
  const lines = splitAtOffsets(context.text, breakOffsets);
  const widths = lines.map(context.measureText);
  const candidates = new Map(context.candidates.map((candidate) => [candidate.offset, candidate]));
  const fallbackPenalty = Math.max(0, ...context.candidates.map(({ penalty }) => penalty));
  const breaks = breakOffsets.map(
    (offset): BreakCandidate =>
      candidates.get(offset) ?? { offset, level: null, penalty: fallbackPenalty },
  );
  return {
    lines,
    widths,
    breaks,
    lineCount: lines.length,
    balanceCost: 0,
    bestBalanceCost: 0,
    semanticCost:
      breaks.length === 0
        ? 0
        : breaks.reduce((sum, item) => sum + item.penalty, 0) / breaks.length,
    balanceTradeoff: 0,
    overflow: widths.some((width) => !Number.isFinite(width) || width > context.maxWidth + EPSILON),
  };
}

/** Finds the semantically cheapest layout within a visual-balance budget. */
export function semanticBalancedLayout(
  context: SelectorContext,
  tolerance: number,
  ignorePenalties = false,
): InternalLayout {
  if (context.text === "") return overflowLayout("", 0);
  const boundaries = context.candidates;
  const positions = [0, ...boundaries.map(({ offset }) => nextTextOffset(context.text, offset))];
  const segmentText = (start: number, end: number) =>
    context.text.slice(positions[start]!, end < boundaries.length ? boundaries[end]!.offset : undefined).trimEnd();
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
    return overflowLayout(context.text, context.measureText(context.text));
  }

  const spacesRemovedAtBreaks = context.candidates.every(({ offset }) =>
    /\s/u.test(context.text[offset] ?? ""),
  );
  const removedWhitespaceWidth = spacesRemovedAtBreaks
    ? Math.max(0, context.measureText(" ")) * Math.max(0, lineCount - 1)
    : 0;
  const idealWidth = Math.min(
    context.maxWidth,
    Math.max(0, (context.measureText(context.text) - removedWhitespaceWidth) / lineCount),
  );
  const memo = new Map<string, CandidateLayout[]>();

  function solve(start: number, remainingLines: number): CandidateLayout[] {
    const key = `${start}:${remainingLines}`;
    const cached = memo.get(key);
    if (cached) return cached;
    if (start === positions.length) {
      const result: CandidateLayout[] =
        remainingLines === 0
          ? [{
              lines: [], widths: [], breaks: [], lineCount: 0,
              balanceCost: 0, bestBalanceCost: 0, semanticCost: 0,
              balanceTradeoff: 0, overflow: false,
              rawBalanceCost: 0, rawSemanticCost: 0,
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
      const normalizedDeviation = (width - idealWidth) / context.maxWidth;
      for (const suffix of rest) {
        layouts.push({
          lines: [segmentText(start, end), ...suffix.lines],
          widths: [width, ...suffix.widths],
          breaks: selectedBreak ? [selectedBreak, ...suffix.breaks] : suffix.breaks,
          lineCount,
          balanceCost: 0,
          bestBalanceCost: 0,
          semanticCost: 0,
          balanceTradeoff: 0,
          overflow: false,
          rawBalanceCost: normalizedDeviation ** 2 + suffix.rawBalanceCost,
          rawSemanticCost:
            (ignorePenalties ? 0 : (selectedBreak?.penalty ?? 0)) + suffix.rawSemanticCost,
        });
      }
    }
    const result = pareto(layouts);
    memo.set(key, result);
    return result;
  }

  const layouts = solve(0, lineCount);
  if (layouts.length === 0) return overflowLayout(context.text, context.measureText(context.text));
  const balanceCost = (layout: CandidateLayout) => Math.sqrt(layout.rawBalanceCost / lineCount);
  const bestBalanceCost = Math.min(...layouts.map(balanceCost));
  const eligible = layouts.filter(
    (layout) => balanceCost(layout) <= bestBalanceCost + tolerance + EPSILON,
  );
  const winner = eligible.sort((left, right) => {
    const semantic = left.rawSemanticCost - right.rawSemanticCost;
    if (Math.abs(semantic) > EPSILON) return semantic;
    const balance = balanceCost(left) - balanceCost(right);
    if (Math.abs(balance) > EPSILON) return balance;
    return signature(left).localeCompare(signature(right));
  })[0]!;
  const winnerBalanceCost = balanceCost(winner);
  return {
    lines: winner.lines,
    widths: winner.widths,
    breaks: winner.breaks,
    lineCount,
    balanceCost: winnerBalanceCost,
    bestBalanceCost,
    semanticCost:
      winner.breaks.length === 0 ? 0 : winner.rawSemanticCost / winner.breaks.length,
    balanceTradeoff: Math.max(0, winnerBalanceCost - bestBalanceCost),
    overflow: false,
  };
}
