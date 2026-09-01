import { lowestPenalty } from "./aggregators.js";
import { optimalLayouts } from "./calculators.js";
import { balance } from "./selectors.js";
import type { LineBreakStrategy, LineBreakStrategyOptions } from "./types.js";

/** Creates a complete strategy while filling omitted stages with library defaults. */
export function createLineBreakStrategy(
  options: LineBreakStrategyOptions = {},
): LineBreakStrategy {
  return {
    aggregate: options.aggregate ?? lowestPenalty(),
    calculate: options.calculate ?? optimalLayouts(),
    select: options.select ?? balance(),
  };
}
