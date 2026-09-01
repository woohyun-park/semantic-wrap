export type BudouxModel = Record<string, Record<string, number>>;

export interface PhraseModelLevel {
  /** Optional diagnostic label, such as `coarse` or `fine`. */
  name?: string;
  model: BudouxModel;
  /** Relative cost of breaking at a boundary predicted by this level. */
  penalty: number;
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
  offset: number;
  /** Winning model level, or `null` when this is a fallback boundary. */
  level: number | null;
  name?: string;
  penalty: number;
}

export interface BreakPrediction {
  /** UTF-16 source offset predicted by one model level. */
  offset: number;
  level: number;
  name?: string;
  penalty: number;
}

export interface LineBreakLayoutCandidate {
  /** UTF-16 source offsets at which each line except the last one ends. */
  breaks: readonly number[];
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
}

export type LineBreakCalculator = (
  context: LayoutCalculationContext,
) => readonly LineBreakLayoutCandidate[];

export interface LineBreakLayout {
  breaks: number[];
  lines: string[];
  widths: number[];
  selectedCandidates: BreakCandidate[];
  /** Number of rendered lines, including the final line. */
  lineCount: number;
  /** Normalized RMS distance from the ideal line width. Lower is more balanced. */
  balanceScore: number;
  /** Sum of the aggregated penalties at the selected boundaries. */
  modelCost: number;
  overflow: boolean;
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

export interface ResolveLineBreaksInput {
  text: string;
  model: PhraseModel;
  maxWidth: number;
  measureText(text: string): number;
}

export interface ResolveLineBreaksOptions {
  nativeLayout?: BaselineLayout;
  strategy?: LineBreakStrategy;
  diagnostics?: boolean;
}

export interface LineBreakSelection {
  text: string;
  lines: string[];
  widths: number[];
  breaks: number[];
  selectedCandidates: BreakCandidate[];
  applied: boolean;
  reason: string;
  overflow: boolean;
}

export interface LineBreakDiagnostics {
  predictions: BreakPrediction[];
  candidates: BreakCandidate[];
  calculatedLayouts: LineBreakLayout[];
  nativeLayout?: LineBreakLayout;
  selection: LayoutSelectionDecision;
}

export interface LineBreakSelectionWithDiagnostics extends LineBreakSelection {
  diagnostics: LineBreakDiagnostics;
}

export interface BalanceOptions {
  /** Allowed normalized RMS imbalance above the most balanced layout. */
  tolerance?: number;
}

export interface ConsensusOptions {
  /** Number of model levels that must predict a boundary before it receives model priority. */
  minimumModels: number;
}
