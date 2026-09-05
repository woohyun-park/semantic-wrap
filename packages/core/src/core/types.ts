export type BudouxModel = Record<string, Record<string, number>>;

/** Synchronously predicts UTF-16 offsets that may be considered semantic boundaries. */
export interface BoundaryPredictor {
  readonly predict: (text: string) => readonly number[];
}

/** One semantic boundary source and its relative selection cost. */
export interface PhraseModelLevel {
  /** Optional diagnostic label, such as `coarse` or `fine`. */
  readonly name?: string;
  /** Implementation that proposes semantic boundary offsets. */
  readonly predictor: BoundaryPredictor;
  /** Relative cost of breaking at a boundary predicted by this level. */
  readonly penalty: number;
}

export interface PhraseModel {
  /** Ordered only for diagnostics. Selection is driven by each level's penalty. */
  levels: readonly PhraseModelLevel[];
  /** Korean uses spaces; future CJK presets can opt into character boundaries. */
  boundaryMode?: "spaces" | "characters";
  /** Cost assigned to allowed boundaries that no level predicted. */
  fallbackPenalty: number;
}

export interface BreakCandidate {
  /** UTF-16 source offset at which the preceding line ends. */
  readonly offset: number;
  /** Winning model level, or `null` when this is a fallback boundary. */
  readonly level: number | null;
  readonly name?: string;
  readonly penalty: number;
}

export interface BreakPrediction {
  /** UTF-16 source offset predicted by one model level. */
  readonly offset: number;
  readonly level: number;
  readonly name?: string;
  readonly penalty: number;
}

export interface LineBreakLayoutCandidate {
  /** UTF-16 source offsets at which each line except the last one ends. */
  readonly breaks: readonly number[];
}

export type BaselineLayout = LineBreakLayoutCandidate;

export interface CandidateAggregationContext {
  text: string;
  predictions: readonly BreakPrediction[];
  allowedOffsets: readonly number[];
  fallbackPenalty: number;
}

export type CandidateAggregator = (
  context: CandidateAggregationContext,
) => readonly BreakCandidate[];

export interface LayoutCalculationContext {
  text: string;
  candidates: readonly BreakCandidate[];
  maxWidth: number;
  measureText(text: string): number;
  /** Optional synchronous batch measurement, in input order; must match measureText. */
  measureTexts?(texts: readonly string[]): readonly number[];
  /** Validated native breaks, when provided for this measurement. */
  nativeLayout?: BaselineLayout;
}

export interface LineBreakCalculator {
  (context: LayoutCalculationContext): readonly LineBreakLayoutCandidate[];
  /** Optional cooperative implementation, returning the same candidates. */
  steps?(context: LayoutCalculationContext): Generator<void, readonly LineBreakLayoutCandidate[], void>;
}

export interface LineBreakLayout {
  readonly breaks: readonly number[];
  readonly lines: readonly string[];
  readonly widths: readonly number[];
  readonly selectedCandidates: readonly BreakCandidate[];
  /** Number of rendered lines, including the final line. */
  readonly lineCount: number;
  /** Normalized RMS distance from the ideal line width. Lower is more balanced. */
  readonly balanceScore: number;
  /** Sum of the aggregated penalties at the selected boundaries. */
  readonly modelCost: number;
  readonly overflow: boolean;
}

export interface LayoutSelectionContext {
  /** The measured browser layout, when supplied by the caller. */
  nativeLayout?: LineBreakLayout;
  /** Every layout candidate returned by the calculation stage, after measurement. */
  calculatedLayouts: readonly LineBreakLayout[];
}

export type LayoutSelectionDecision =
  | {
      selected: "native";
      reason?: string;
    }
  | {
      selected: "calculated";
      index: number;
      reason?: string;
    };

export type LineBreakSelector = (
  context: LayoutSelectionContext,
) => LayoutSelectionDecision;

export interface LineBreakStrategy {
  aggregate: CandidateAggregator;
  calculate: LineBreakCalculator;
  select: LineBreakSelector;
}

export interface LineBreakStrategyOptions {
  aggregate?: CandidateAggregator;
  calculate?: LineBreakCalculator;
  select?: LineBreakSelector;
}

export interface SelectLineBreaksInput {
  text: string;
  model: PhraseModel;
  maxWidth: number;
  measureText(text: string): number;
  /** Optional synchronous batch measurement, equivalent to texts.map(measureText). */
  measureTexts?(texts: readonly string[]): readonly number[];
}

export interface SelectLineBreaksOptions {
  nativeLayout?: BaselineLayout;
  strategy?: LineBreakStrategy;
  diagnostics?: boolean;
}

export interface LineBreakPlanInput {
  text: string;
  model: PhraseModel;
  strategy?: LineBreakStrategy;
}

export interface LineBreakMeasurement {
  /** Stable identity for exact text metrics. Change it whenever measured widths can change. */
  cacheKey?: object;
  maxWidth: number;
  measureText(text: string): number;
  /** Optional synchronous batch measurement, equivalent to texts.map(measureText). */
  measureTexts?(texts: readonly string[]): readonly number[];
  nativeLayout?: BaselineLayout;
}

export interface LineBreakSelectionInput extends LineBreakMeasurement {
  diagnostics?: boolean;
}

export interface NearbyLayoutsOptions {
  /** Candidate boundaries on either side of each native break. Default: 2. */
  radius?: 1 | 2 | 4;
}

export interface LineBreakPrediction {
  readonly predictions: readonly BreakPrediction[];
  readonly allowedOffsets: readonly number[];
  readonly fallbackPenalty: number;
}

export interface LineBreakPlan {
  /** Synchronous iterator; callers decide when to resume or cancel it. */
  selectSteps(input: LineBreakSelectionInput & { diagnostics: true }): Generator<void, LineBreakSelectionWithDiagnostics, void>;
  selectSteps(input: LineBreakSelectionInput): Generator<void, LineBreakSelection, void>;
  predict(): LineBreakPrediction;
  aggregate(): readonly BreakCandidate[];
  calculate(measurement: LineBreakMeasurement): readonly LineBreakLayout[];
  select(
    input: LineBreakSelectionInput & { diagnostics: true },
  ): LineBreakSelectionWithDiagnostics;
  select(input: LineBreakSelectionInput): LineBreakSelection;
}

export interface LineBreakSelection {
  readonly text: string;
  readonly lines: readonly string[];
  readonly widths: readonly number[];
  readonly breaks: readonly number[];
  readonly selectedCandidates: readonly BreakCandidate[];
  readonly applied: boolean;
  readonly reason: string;
  readonly overflow: boolean;
}

export interface LineBreakDiagnostics {
  readonly predictions: readonly BreakPrediction[];
  readonly candidates: readonly BreakCandidate[];
  readonly calculatedLayouts: readonly LineBreakLayout[];
  readonly nativeLayout?: LineBreakLayout;
  readonly selection: LayoutSelectionDecision;
}

export interface LineBreakSelectionWithDiagnostics extends LineBreakSelection {
  readonly diagnostics: LineBreakDiagnostics;
}

export interface BalanceOptions {
  /** Allowed normalized RMS imbalance above the most balanced layout. */
  tolerance?: number;
}

export interface ConsensusOptions {
  /** Number of model levels that must predict a boundary before it receives model priority. */
  minimumModels: number;
}
