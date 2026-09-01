import type { PhraseModel } from "@semantic-wrap/core";
import {
  englishTitleCoarseModel,
  englishTitleFineModel,
  englishTitleMediumModel,
} from "./models.js";

/** Three-level English title model trained from cumulative phrase-boundary pseudo-labels. */
export const enTitleModel = {
  boundaryMode: "spaces",
  levels: [
    { name: "coarse", model: englishTitleCoarseModel, penalty: 0 },
    { name: "medium", model: englishTitleMediumModel, penalty: 0.35 },
    { name: "fine", model: englishTitleFineModel, penalty: 0.7 },
  ],
  fallbackPenalty: 1,
} as const satisfies PhraseModel;
