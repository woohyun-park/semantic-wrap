import type { PhraseModel } from "@semantic-wrap/core";
import {
  koreanTitleCoarseModel,
  koreanTitleFineModel,
  koreanTitleMediumModel,
} from "./models.js";

/** Three-level Korean title model trained from cumulative semantic pseudo-labels. */
export const koTitleModel = {
  boundaryMode: "spaces",
  levels: [
    { name: "coarse", model: koreanTitleCoarseModel, penalty: 0 },
    { name: "medium", model: koreanTitleMediumModel, penalty: 0.35 },
    { name: "fine", model: koreanTitleFineModel, penalty: 0.7 },
  ],
  fallbackPenalty: 1,
} as const satisfies PhraseModel;
