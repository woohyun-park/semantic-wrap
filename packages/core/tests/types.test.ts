import { expectTypeOf, test } from "bun:test";
import {
  definePhraseModel,
  type BoundaryPredictor,
  type PhraseModel,
  type PhraseModelLevel,
} from "../src/index.js";

test("uses one predictor contract for every phrase model level", () => {
  const predictor: BoundaryPredictor = { predict: () => [] };
  const level: PhraseModelLevel = { predictor, penalty: 0 };
  const defined = definePhraseModel({ levels: [level], fallbackPenalty: 1 });

  expectTypeOf(level).toMatchTypeOf<PhraseModelLevel>();
  expectTypeOf(defined).toMatchTypeOf<PhraseModel>();

  // @ts-expect-error BudouX weights must be adapted with createBudouxPredictor.
  const weightsOnly: PhraseModelLevel = { model: {}, penalty: 0 };
  void weightsOnly;
});
