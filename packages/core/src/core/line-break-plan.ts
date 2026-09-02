import { layoutAtBreaks } from "./line-layout.js";
import { predictBreaks } from "./predict-breaks.js";
import { createLineBreakStrategy } from "./strategy.js";
import type {
  BreakCandidate,
  BreakPrediction,
  LayoutCalculationContext,
  LayoutSelectionDecision,
  LineBreakLayout,
  LineBreakMeasurement,
  LineBreakPlan,
  LineBreakPlanInput,
  LineBreakPrediction,
  LineBreakSelection,
  LineBreakSelectionInput,
  LineBreakSelectionWithDiagnostics,
  LineBreakStrategy,
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

function validateStrategy(value: unknown): asserts value is LineBreakStrategy {
  if (
    !isRecord(value) ||
    typeof value.aggregate !== "function" ||
    typeof value.calculate !== "function" ||
    typeof value.select !== "function"
  ) {
    throw new Error("A strategy must provide aggregate, calculate, and select functions");
  }
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

function immutablePredictions(values: readonly BreakPrediction[]): readonly BreakPrediction[] {
  return Object.freeze(values.map((value) => Object.freeze({ ...value })));
}

function immutableCandidates(values: readonly BreakCandidate[]): readonly BreakCandidate[] {
  return Object.freeze(values.map((value) => Object.freeze({ ...value })));
}

function immutableNumbers(values: readonly number[]): readonly number[] {
  return Object.freeze([...values]);
}

function immutableStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
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
  const selectedCandidates = breakOffsets.flatMap((offset): BreakCandidate[] => {
    const candidate = candidates.get(offset);
    return candidate ? [candidate] : [];
  });
  return Object.freeze({
    breaks: immutableNumbers(breakOffsets),
    lines: immutableStrings(layout.lines),
    widths: immutableNumbers(layout.widths),
    selectedCandidates: Object.freeze([...selectedCandidates]),
    lineCount: layout.lineCount,
    balanceScore: layout.balanceScore,
    modelCost: layout.modelCost,
    overflow: layout.overflow,
  });
}

class LazyLineBreakPlan implements LineBreakPlan {
  readonly #text: string;
  readonly #model: LineBreakPlanInput["model"];
  readonly #strategy: LineBreakStrategy;
  #prediction: LineBreakPrediction | undefined;
  #candidates: readonly BreakCandidate[] | undefined;

  constructor(input: LineBreakPlanInput) {
    if (!isRecord(input)) {
      throw new Error("LineBreakPlan input must be an object");
    }
    if (typeof input.text !== "string") {
      throw new Error("Line-break text must be a string");
    }
    this.#text = input.text;
    this.#model = input.model;
    this.#strategy = input.strategy === undefined ? createLineBreakStrategy() : input.strategy;
    validateStrategy(this.#strategy);
  }

  predict(): LineBreakPrediction {
    if (this.#prediction) return this.#prediction;
    const result = predictBreaks(this.#text, this.#model);
    this.#prediction = Object.freeze({
      predictions: immutablePredictions(result.predictions),
      allowedOffsets: immutableNumbers(result.allowedOffsets),
      fallbackPenalty: result.fallbackPenalty,
    });
    return this.#prediction;
  }

  aggregate(): readonly BreakCandidate[] {
    if (this.#candidates) return this.#candidates;
    const prediction = this.predict();
    const candidates = validateAggregatedCandidates(
      this.#strategy.aggregate({
        text: this.#text,
        predictions: prediction.predictions,
        allowedOffsets: prediction.allowedOffsets,
        fallbackPenalty: prediction.fallbackPenalty,
      }),
      this.#model.levels.length,
    );
    validateOffsets(this.#text, candidates.map(({ offset }) => offset), "Candidates");
    if (candidates.some(({ penalty }) => !Number.isFinite(penalty) || penalty < 0)) {
      throw new Error("Candidate penalties must be non-negative finite numbers");
    }
    const allowedOffsets = new Set(prediction.allowedOffsets);
    if (candidates.some(({ offset }) => !allowedOffsets.has(offset))) {
      throw new Error("Aggregated candidates must reference allowed offsets");
    }
    this.#candidates = immutableCandidates(candidates);
    return this.#candidates;
  }

  #calculation(
    measurement: LineBreakMeasurement,
  ): { context: LayoutCalculationContext; layouts: readonly LineBreakLayout[] } {
    if (!isRecord(measurement)) {
      throw new Error("Line-break measurement must be an object");
    }
    if (!Number.isFinite(measurement.maxWidth) || measurement.maxWidth <= 0) {
      throw new Error("Line width must be a positive finite number");
    }
    if (typeof measurement.measureText !== "function") {
      throw new Error("measureText must be a function");
    }
    const measureText = (text: string): number => {
      const width = measurement.measureText(text);
      if (!Number.isFinite(width) || width < 0) {
        throw new Error("Measured text width must be a non-negative finite number");
      }
      return width;
    };
    const context: LayoutCalculationContext = {
      text: this.#text,
      candidates: this.aggregate(),
      maxWidth: measurement.maxWidth,
      measureText,
    };
    const calculated = validateCalculatedCandidates(this.#strategy.calculate(context));
    const candidateOffsets = new Set(context.candidates.map(({ offset }) => offset));
    const signatures = new Set<string>();
    const layouts = calculated.map((layout, index) => {
      validateOffsets(this.#text, layout.breaks, `Calculated layout ${index} breaks`);
      if (layout.breaks.some((offset) => !candidateOffsets.has(offset))) {
        throw new Error("Calculated breaks must reference aggregated candidates");
      }
      const signature = layout.breaks.join(",");
      if (signatures.has(signature)) {
        throw new Error("Calculated layouts must not contain duplicate break sets");
      }
      signatures.add(signature);
      return materializeLayout(context, layout.breaks);
    });
    return { context, layouts: Object.freeze(layouts) };
  }

  calculate(measurement: LineBreakMeasurement): readonly LineBreakLayout[] {
    return this.#calculation(measurement).layouts;
  }

  select(
    input: LineBreakSelectionInput & { diagnostics: true },
  ): LineBreakSelectionWithDiagnostics;
  select(input: LineBreakSelectionInput): LineBreakSelection;
  select(
    input: LineBreakSelectionInput,
  ): LineBreakSelection | LineBreakSelectionWithDiagnostics {
    if (!isRecord(input)) {
      throw new Error("Line-break selection input must be an object");
    }
    if (input.diagnostics !== undefined && typeof input.diagnostics !== "boolean") {
      throw new Error("diagnostics must be a boolean");
    }
    const prediction = this.predict();
    const { context, layouts: calculatedLayouts } = this.#calculation(input);

    let nativeLayout: LineBreakLayout | undefined;
    if (input.nativeLayout !== undefined) {
      if (!isRecord(input.nativeLayout) || !Array.isArray(input.nativeLayout.breaks)) {
        throw new Error("Native layout must contain a breaks array");
      }
      validateOffsets(this.#text, input.nativeLayout.breaks, "Native breaks");
      nativeLayout = materializeLayout(
        context,
        input.nativeLayout.breaks,
        prediction.fallbackPenalty,
      );
    }

    const rawSelection: unknown = this.#strategy.select({ nativeLayout, calculatedLayouts });
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
      selectionDecision = Object.freeze({
        selected: "native",
        reason: rawSelection.reason ?? "native-selected",
      });
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
      selectionDecision = Object.freeze({
        selected: "calculated",
        index,
        reason: rawSelection.reason ?? "calculated-selected",
      });
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
    const selection: LineBreakSelection = Object.freeze({
      text: this.#text,
      lines: selectedLayout.lines,
      widths: selectedLayout.widths,
      breaks: selectedLayout.breaks,
      selectedCandidates: selectedLayout.selectedCandidates,
      applied,
      reason: selectionDecision.reason!,
      overflow: selectedLayout.overflow,
    });

    if (!input.diagnostics) return selection;
    return Object.freeze({
      ...selection,
      diagnostics: Object.freeze({
        predictions: prediction.predictions,
        candidates: this.aggregate(),
        calculatedLayouts,
        nativeLayout,
        selection: selectionDecision,
      }),
    });
  }
}

/** Creates a lazy, immutable prediction-to-selection pipeline. */
export function createLineBreakPlan(input: LineBreakPlanInput): LineBreakPlan {
  return Object.freeze(new LazyLineBreakPlan(input));
}
