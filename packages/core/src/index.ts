export { consensus, lowestPenalty } from "./core/aggregators.js";
export { greedy, optimalLayouts } from "./core/calculators.js";
export { balance } from "./core/selectors.js";
export { resolveLineBreaks } from "./core/resolve-line-breaks.js";
export { createLineBreakStrategy } from "./core/strategy.js";
export type {
  BaselineLayout,
  BalanceOptions,
  BreakCandidate,
  BreakPrediction,
  BudouxModel,
  CandidateAggregationContext,
  CandidateAggregator,
  ConsensusOptions,
  LayoutCalculationContext,
  LayoutSelectionContext,
  LayoutSelectionDecision,
  LineBreakCalculator,
  LineBreakDiagnostics,
  LineBreakLayout,
  LineBreakLayoutCandidate,
  LineBreakSelector,
  LineBreakSelection,
  LineBreakSelectionWithDiagnostics,
  LineBreakStrategy,
  LineBreakStrategyOptions,
  PhraseModel,
  PhraseModelLevel,
  ResolveLineBreaksInput,
  ResolveLineBreaksOptions,
} from "./core/types.js";
