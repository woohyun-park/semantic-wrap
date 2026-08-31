export type BudouxModel = Record<string, Record<string, number>>;

export interface PhraseModelLevel {
  /** Optional diagnostic label, such as `coarse` or `fine`. */
  name?: string;
  model: BudouxModel;
  /** Relative cost of breaking at a boundary predicted by this level. */
  penalty: number;
}

export interface PhraseModel {
  schemaVersion: 1;
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

export interface BaselineLayout {
  /** UTF-16 source offsets at which each line except the last one ends. */
  breaks: readonly number[];
}

export type WrapContext = "mobile" | "desktop" | "unknown";

export interface SelectorContext {
  text: string;
  candidates: readonly BreakCandidate[];
  maxWidth: number;
  measureText(text: string): number;
  /** Actual browser layout when available. */
  nativeLayout?: BaselineLayout;
  context: WrapContext;
}

export interface LineBreakDecision {
  /** UTF-16 source offsets selected as hard line breaks. */
  breaks: readonly number[];
  /** False means the renderer should leave native wrapping untouched. */
  applied?: boolean;
  reason?: string;
}

export type LineBreakSelector = (context: SelectorContext) => LineBreakDecision;

export interface SelectLineBreaksOptions extends Omit<SelectorContext, "context"> {
  selector: LineBreakSelector;
  context?: WrapContext;
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

export interface BalanceSelectorOptions {
  /** Allowed normalized RMS imbalance above the most balanced layout. */
  tolerance?: number;
}
