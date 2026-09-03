import { createBudouxPredictor, definePhraseModel } from "@semantic-wrap/core";
import {
  koreanTitleCoarseModel,
  koreanTitleFineModel,
  koreanTitleMediumModel,
} from "./models.js";

/** Three-level Korean title model trained from cumulative semantic pseudo-labels. */
export const koTitleModel = definePhraseModel({
  boundaryMode: "spaces",
  levels: [
    {
      name: "coarse",
      predictor: createBudouxPredictor(koreanTitleCoarseModel),
      penalty: 0,
    },
    {
      name: "medium",
      predictor: createBudouxPredictor(koreanTitleMediumModel),
      penalty: 0.35,
    },
    {
      name: "fine",
      predictor: createBudouxPredictor(koreanTitleFineModel),
      penalty: 0.7,
    },
  ],
  fallbackPenalty: 1,
});
