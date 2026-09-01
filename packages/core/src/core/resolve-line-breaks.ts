import { layoutAtBreaks } from "./line-layout.js";
import { predictBreaks } from "./predict-breaks.js";
import { createLineBreakStrategy } from "./strategy.js";
import type {
  BreakCandidate,
  LayoutCalculationContext,
  LayoutSelectionDecision,
  LineBreakLayout,
  LineBreakSelection,
  LineBreakSelectionWithDiagnostics,
  ResolveLineBreaksInput,
  ResolveLineBreaksOptions,
} from "./types.js";

function validateOffsets(text: string, offsets: readonly number[], label: string): void {
  if (
    offsets.some(
      (offset, index) =>
        !Number.isInteger(offset) ||
        offset <= 0 ||
        offset >= text.length ||
        (index > 0 && offsets[index - 1]! >= offset),
    )
  ) {
    throw new Error(`${label} must be ascending UTF-16 source offsets`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateAggregatedCandidates(value: unknown, levelCount: number): BreakCandidate[] {
  if (!Array.isArray(value)) {
    throw new Error("An aggregator must return an array of break candidates");
  }
  for (const candidate of value) {
    const level = isRecord(candidate) ? candidate.level : undefined;
    if (
      !isRecord(candidate) ||
      !Number.isInteger(candidate.offset) ||
      typeof candidate.penalty !== "number" ||
      (level !== null &&
        (typeof level !== "number" ||
          !Number.isInteger(level) ||
          level < 0 ||
          level >= levelCount)) ||
      (candidate.name !== undefined && typeof candidate.name !== "string")
    ) {
      throw new Error("An aggregator returned an invalid break candidate");
    }
  }
  return value as BreakCandidate[];
}

function validateCalculatedCandidates(value: unknown): { breaks: readonly number[] }[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("A calculator must return at least one layout candidate");
  }
  for (const layout of value) {
    if (!isRecord(layout) || !Array.isArray(layout.breaks)) {
      throw new Error("A calculator must return layout candidates with a breaks array");
    }
  }
  return value as { breaks: readonly number[] }[];
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function materializeLayout(
  context: LayoutCalculationContext,
  breakOffsets: readonly number[],
  unmatchedPenalty?: number,
): LineBreakLayout {
  const layout = layoutAtBreaks(context, breakOffsets, unmatchedPenalty);
  const candidates = new Map(context.candidates.map((candidate) => [candidate.offset, candidate]));
  return {
    breaks: [...breakOffsets],
    lines: layout.lines,
    widths: layout.widths,
    selectedCandidates: breakOffsets.flatMap((offset): BreakCandidate[] => {
      const candidate = candidates.get(offset);
      return candidate ? [candidate] : [];
    }),
    lineCount: layout.lineCount,
    balanceScore: layout.balanceScore,
    modelCost: layout.modelCost,
    overflow: layout.overflow,
  };
}

export function resolveLineBreaks(
  input: ResolveLineBreaksInput,
  options: ResolveLineBreaksOptions & { diagnostics: true },
): LineBreakSelectionWithDiagnostics;
export function resolveLineBreaks(
  input: ResolveLineBreaksInput,
  options?: ResolveLineBreaksOptions,
): LineBreakSelection;

/** Predicts, aggregates, calculates, and selects a line-break layout. */
export function resolveLineBreaks(
  input: ResolveLineBreaksInput,
  options: ResolveLineBreaksOptions = {},
): LineBreakSelection | LineBreakSelectionWithDiagnostics {
  if (!isRecord(input)) {
    throw new Error("resolveLineBreaks input must be an object");
  }
  if (typeof input.text !== "string") {
    throw new Error("Line-break text must be a string");
  }
  if (!Number.isFinite(input.maxWidth) || input.maxWidth <= 0) {
    throw new Error("Line width must be a positive finite number");
  }
  if (typeof input.measureText !== "function") {
    throw new Error("measureText must be a function");
  }
  if (!isRecord(options)) {
    throw new Error("resolveLineBreaks options must be an object");
  }
  if (options.diagnostics !== undefined && typeof options.diagnostics !== "boolean") {
    throw new Error("diagnostics must be a boolean");
  }

  const strategy = options.strategy === undefined ? createLineBreakStrategy() : options.strategy;
  if (
    !isRecord(strategy) ||
    typeof strategy.aggregate !== "function" ||
    typeof strategy.calculate !== "function" ||
    typeof strategy.select !== "function"
  ) {
    throw new Error("A strategy must provide aggregate, calculate, and select functions");
  }
  const prediction = predictBreaks(input.text, input.model);
  const candidates = validateAggregatedCandidates(
    strategy.aggregate({
      text: input.text,
      predictions: prediction.predictions,
      allowedOffsets: prediction.allowedOffsets,
      fallbackPenalty: prediction.fallbackPenalty,
    }),
    input.model.levels.length,
  );
  validateOffsets(input.text, candidates.map(({ offset }) => offset), "Candidates");
  if (candidates.some(({ penalty }) => !Number.isFinite(penalty) || penalty < 0)) {
    throw new Error("Candidate penalties must be non-negative finite numbers");
  }
  const allowedOffsets = new Set(prediction.allowedOffsets);
  if (candidates.some(({ offset }) => !allowedOffsets.has(offset))) {
    throw new Error("Aggregated candidates must reference allowed offsets");
  }

  const measureText = (text: string): number => {
    const width = input.measureText(text);
    if (!Number.isFinite(width) || width < 0) {
      throw new Error("Measured text width must be a non-negative finite number");
    }
    return width;
  };
  const calculationContext: LayoutCalculationContext = {
    text: input.text,
    candidates,
    maxWidth: input.maxWidth,
    measureText,
  };
  const calculated = validateCalculatedCandidates(strategy.calculate(calculationContext));
  const candidateOffsets = new Set(candidates.map(({ offset }) => offset));
  const signatures = new Set<string>();
  const calculatedLayouts = calculated.map((layout, index) => {
    validateOffsets(input.text, layout.breaks, `Calculated layout ${index} breaks`);
    if (layout.breaks.some((offset) => !candidateOffsets.has(offset))) {
      throw new Error("Calculated breaks must reference aggregated candidates");
    }
    const signature = layout.breaks.join(",");
    if (signatures.has(signature)) {
      throw new Error("Calculated layouts must not contain duplicate break sets");
    }
    signatures.add(signature);
    return materializeLayout(calculationContext, layout.breaks);
  });

  let nativeLayout: LineBreakLayout | undefined;
  if (options.nativeLayout !== undefined) {
    if (!isRecord(options.nativeLayout) || !Array.isArray(options.nativeLayout.breaks)) {
      throw new Error("Native layout must contain a breaks array");
    }
    validateOffsets(input.text, options.nativeLayout.breaks, "Native breaks");
    nativeLayout = materializeLayout(
      calculationContext,
      options.nativeLayout.breaks,
      prediction.fallbackPenalty,
    );
  }

  const rawSelection: unknown = strategy.select({ nativeLayout, calculatedLayouts });
  if (
    !isRecord(rawSelection) ||
    !["native", "calculated"].includes(String(rawSelection.selected))
  ) {
    throw new Error("A selector must select a native or calculated layout");
  }
  if (rawSelection.reason !== undefined && typeof rawSelection.reason !== "string") {
    throw new Error("A selector reason must be a string when provided");
  }
  let selectionDecision: LayoutSelectionDecision;
  if (rawSelection.selected === "native") {
    if (!nativeLayout) throw new Error("A selector cannot select a missing native layout");
    selectionDecision = {
      selected: "native",
      reason: rawSelection.reason ?? "native-selected",
    };
  } else {
    const index = rawSelection.index;
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= calculatedLayouts.length
    ) {
      throw new Error("A selector must select an existing calculated layout index");
    }
    selectionDecision = {
      selected: "calculated",
      index,
      reason: rawSelection.reason ?? "calculated-selected",
    };
  }
  const selectedLayout =
    selectionDecision.selected === "native"
      ? nativeLayout!
      : calculatedLayouts[selectionDecision.index]!;
  const applied =
    selectionDecision.selected === "calculated" &&
    !selectedLayout.overflow &&
    selectedLayout.breaks.length > 0 &&
    (!nativeLayout || !sameNumbers(selectedLayout.breaks, nativeLayout.breaks));
  const selection: LineBreakSelection = {
    text: input.text,
    lines: selectedLayout.lines,
    widths: selectedLayout.widths,
    breaks: selectedLayout.breaks,
    selectedCandidates: selectedLayout.selectedCandidates,
    applied,
    reason: selectionDecision.reason!,
    overflow: selectedLayout.overflow,
  };

  if (!options.diagnostics) return selection;
  return {
    ...selection,
    diagnostics: {
      predictions: prediction.predictions,
      candidates,
      calculatedLayouts,
      nativeLayout,
      selection: selectionDecision,
    },
  };
}
