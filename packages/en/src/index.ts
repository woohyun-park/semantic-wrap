import { createBudouxPredictor, definePhraseModel } from "@semantic-wrap/core";
import {
  englishTitleCoarseModel,
  englishTitleFineModel,
  englishTitleMediumModel,
} from "./models.js";

/** Three-level English title model trained from cumulative phrase-boundary pseudo-labels. */
export const enTitleModel = definePhraseModel({
  boundaryMode: "spaces",
  levels: [
    {
      name: "coarse",
      predictor: createBudouxPredictor(englishTitleCoarseModel),
      penalty: 0,
    },
    {
      name: "medium",
      predictor: createBudouxPredictor(englishTitleMediumModel),
      penalty: 0.35,
    },
    {
      name: "fine",
      predictor: createBudouxPredictor(englishTitleFineModel),
      penalty: 0.7,
    },
  ],
  fallbackPenalty: 1,
});
