import { layoutAtBreaks, splitAtOffsets, type SegmentMeasurementContext } from "./line-layout.js";
import { finishSteps } from "./steps.js";
import { predictBreaks } from "./predict-breaks.js";
import { createLineBreakStrategy } from "./strategy.js";
import type {
  BaselineLayout,
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
  #cacheKey: object | undefined;
  // Offset keys avoid retaining a copy of every measured substring. FIFO eviction
  // bounds entries; a miss only causes remeasurement, never changes the answer.
  #segmentWidths = new Map<string, number>();
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

  *#calculation(
    measurement: LineBreakMeasurement,
  ): Generator<void, { context: LayoutCalculationContext; layouts: readonly LineBreakLayout[] }, void> {
    if (!isRecord(measurement)) {
      throw new Error("Line-break measurement must be an object");
    }
    if (!Number.isFinite(measurement.maxWidth) || measurement.maxWidth <= 0) {
      throw new Error("Line width must be a positive finite number");
    }
    if (typeof measurement.measureText !== "function") {
      throw new Error("measureText must be a function");
    }
    if (measurement.measureTexts !== undefined && typeof measurement.measureTexts !== "function") {
      throw new Error("measureTexts must be a function");
    }
    const measureText = (text: string): number => {
      const width = measurement.measureText(text);
      if (!Number.isFinite(width) || width < 0) {
        throw new Error("Measured text width must be a non-negative finite number");
      }
      return width;
    };
    let nativeLayout: BaselineLayout | undefined;
    if (measurement.nativeLayout !== undefined) {
      if (!isRecord(measurement.nativeLayout) || !Array.isArray(measurement.nativeLayout.breaks)) {
        throw new Error("Native layout must contain a breaks array");
      }
      validateOffsets(this.#text, measurement.nativeLayout.breaks, "Native breaks");
      nativeLayout = Object.freeze({ breaks: immutableNumbers(measurement.nativeLayout.breaks) });
    }
    const context: SegmentMeasurementContext = {
      text: this.#text,
      candidates: this.aggregate(),
      maxWidth: measurement.maxWidth,
      measureText,
      measureTexts: measurement.measureTexts === undefined ? undefined : (texts) => {
        const widths = measurement.measureTexts!(texts);
        if (!Array.isArray(widths) || widths.length !== texts.length) {
          throw new Error("measureTexts must return one width per input text");
        }
        for (const width of widths) {
          if (!Number.isFinite(width) || width < 0) {
            throw new Error("Measured text width must be a non-negative finite number");
          }
        }
        return widths;
      },
      nativeLayout,
    };
    if (measurement.cacheKey !== this.#cacheKey) {
      this.#segmentWidths = new Map();
      this.#cacheKey = measurement.cacheKey;
    }
    if (measurement.cacheKey) {
      // Capture the cache so an iterator with an older metric key cannot contaminate
      // a newer job when external callers interleave their iterators.
      const cache = this.#segmentWidths;
      context.measureSegments = (ranges) => {
        const values = new Array<number>(ranges.length);
        const missing: { index: number; key: string; text: string }[] = [];
        ranges.forEach(([start, end], index) => {
          const key = `${start}:${end}`;
          const cached = cache.get(key);
          if (cached !== undefined) values[index] = cached;
          else missing.push({ index, key, text: this.#text.slice(start, end) });
        });
        const widths = context.measureTexts
          ? context.measureTexts(missing.map(({ text }) => text))
          : missing.map(({ text }) => context.measureText(text));
        missing.forEach(({ index, key }, offset) => {
          values[index] = widths[offset]!;
          cache.set(key, widths[offset]!);
          if (cache.size > 65_536) cache.delete(cache.keys().next().value!);
        });
        return values;
      };
    }
    const calculated = validateCalculatedCandidates(this.#strategy.calculate.steps
      ? yield* this.#strategy.calculate.steps(context)
      : this.#strategy.calculate(context));
    const candidateOffsets = new Set(context.candidates.map(({ offset }) => offset));
    const signatures = new Set<string>();
    const layouts: LineBreakLayout[] = [];
    for (const [index, layout] of calculated.entries()) {
      validateOffsets(this.#text, layout.breaks, `Calculated layout ${index} breaks`);
      if (layout.breaks.some((offset) => !candidateOffsets.has(offset))) {
        throw new Error("Calculated breaks must reference aggregated candidates");
      }
      const signature = layout.breaks.join(",");
      if (signatures.has(signature)) {
        throw new Error("Calculated layouts must not contain duplicate break sets");
      }
      signatures.add(signature);
      layouts.push(yield* this.#materialize(context, layout.breaks));
    }
    return { context, layouts: Object.freeze(layouts) };
  }

  calculate(measurement: LineBreakMeasurement): readonly LineBreakLayout[] {
    return finishSteps(this.#calculation(measurement)).layouts;
  }

  *#materialize(context: LayoutCalculationContext, breaks: readonly number[], penalty?: number): Generator<void, LineBreakLayout, void> {
    const lines = splitAtOffsets(context.text, breaks);
    const widths = new Map<string, number>();
    for (let index = 0; index < lines.length; index += 32) {
      const chunk = lines.slice(index, index + 32);
      const measured = context.measureTexts ? context.measureTexts(chunk) : chunk.map(context.measureText);
      chunk.forEach((line, offset) => widths.set(line, measured[offset]!));
      yield;
    }
    return materializeLayout({ ...context, measureTexts: undefined,
      measureText: (text) => widths.get(text) ?? context.measureText(text) }, breaks, penalty);
  }

  select(
    input: LineBreakSelectionInput & { diagnostics: true },
  ): LineBreakSelectionWithDiagnostics;
  select(input: LineBreakSelectionInput): LineBreakSelection;
  select(
    input: LineBreakSelectionInput,
  ): LineBreakSelection | LineBreakSelectionWithDiagnostics {
    return finishSteps(this.selectSteps(input));
  }

  selectSteps(input: LineBreakSelectionInput & { diagnostics: true }): Generator<void, LineBreakSelectionWithDiagnostics, void>;
  selectSteps(input: LineBreakSelectionInput): Generator<void, LineBreakSelection, void>;
  *selectSteps(input: LineBreakSelectionInput): Generator<void, LineBreakSelection | LineBreakSelectionWithDiagnostics, void> {
    if (!isRecord(input)) {
      throw new Error("Line-break selection input must be an object");
    }
    if (input.diagnostics !== undefined && typeof input.diagnostics !== "boolean") {
      throw new Error("diagnostics must be a boolean");
    }
    const prediction = this.predict();
    const { context, layouts: calculatedLayouts } = yield* this.#calculation(input);

    let nativeLayout: LineBreakLayout | undefined;
    if (context.nativeLayout !== undefined) {
      nativeLayout = yield* this.#materialize(
        context,
        context.nativeLayout.breaks,
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
