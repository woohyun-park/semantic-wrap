import { createLineBreakPlan } from "./line-break-plan.js";
import type {
  LineBreakSelection,
  LineBreakSelectionWithDiagnostics,
  SelectLineBreaksInput,
  SelectLineBreaksOptions,
} from "./types.js";

export function selectLineBreaks(
  input: SelectLineBreaksInput,
  options: SelectLineBreaksOptions & { diagnostics: true },
): LineBreakSelectionWithDiagnostics;
export function selectLineBreaks(
  input: SelectLineBreaksInput,
  options?: SelectLineBreaksOptions,
): LineBreakSelection;

/** Runs the complete prediction-to-selection pipeline in one call. */
export function selectLineBreaks(
  input: SelectLineBreaksInput,
  options: SelectLineBreaksOptions = {},
): LineBreakSelection | LineBreakSelectionWithDiagnostics {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("selectLineBreaks input must be an object");
  }
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new Error("selectLineBreaks options must be an object");
  }
  if (options.diagnostics !== undefined && typeof options.diagnostics !== "boolean") {
    throw new Error("diagnostics must be a boolean");
  }
  const plan = createLineBreakPlan({
    text: input?.text,
    model: input?.model,
    strategy: options.strategy,
  });
  const selectionInput = {
    maxWidth: input?.maxWidth,
    measureText: input?.measureText,
    measureTexts: input?.measureTexts,
    nativeLayout: options.nativeLayout,
  };
  return options.diagnostics
    ? plan.select({ ...selectionInput, diagnostics: true })
    : plan.select(selectionInput);
}
