import { layoutAtBreaks, splitAtOffsets } from "./line-layout.js";
import type {
  BreakCandidate,
  LineBreakSelection,
  SelectLineBreaksOptions,
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

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** Runs a built-in or user-defined selector and normalizes its result. */
export function selectLineBreaks(options: SelectLineBreaksOptions): LineBreakSelection {
  if (!Number.isFinite(options.maxWidth) || options.maxWidth <= 0) {
    throw new Error("Line width must be a positive finite number");
  }
  validateOffsets(options.text, options.candidates.map(({ offset }) => offset), "Candidates");
  if (options.candidates.some(({ penalty }) => !Number.isFinite(penalty) || penalty < 0)) {
    throw new Error("Candidate penalties must be non-negative finite numbers");
  }
  const context = { ...options, context: options.context ?? ("unknown" as const) };
  const decision = options.selector(context);
  const breaks = [...decision.breaks];
  validateOffsets(options.text, breaks, "Selected breaks");
  const layout = layoutAtBreaks(context, breaks);
  const candidates = new Map(options.candidates.map((candidate) => [candidate.offset, candidate]));
  const applied = decision.applied ?? true;
  const nativeBreaks = options.nativeLayout?.breaks ?? [];
  return {
    text: options.text,
    lines: splitAtOffsets(options.text, breaks),
    widths: layout.widths,
    breaks,
    selectedCandidates: breaks.flatMap((offset): BreakCandidate[] => {
      const candidate = candidates.get(offset);
      return candidate ? [candidate] : [];
    }),
    applied,
    reason:
      decision.reason ??
      (!applied ? "native" : sameNumbers(breaks, nativeBreaks) ? "same-layout" : "selected"),
    overflow: layout.overflow,
  };
}
