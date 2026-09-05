import { describe, expect, test } from "bun:test";
import {
  createBudouxPredictor,
  createLineBreakPlan,
  createLineBreakStrategy,
  lowestPenalty,
  type PhraseModel,
} from "../src/index.js";

const model: PhraseModel = {
  boundaryMode: "spaces",
  levels: [{ name: "semantic", predictor: createBudouxPredictor({}), penalty: 0 }],
  fallbackPenalty: 1,
};

const measurement = {
  maxWidth: 4,
  measureText: (text: string) => text.length,
};

describe("LineBreakPlan", () => {
  test("runs prerequisites lazily and caches only prediction and aggregation", () => {
    const calls = { aggregate: 0, calculate: 0, select: 0 };
    const aggregate = lowestPenalty();
    const strategy = createLineBreakStrategy({
      aggregate: (context) => {
        calls.aggregate += 1;
        return aggregate(context);
      },
      calculate: () => {
        calls.calculate += 1;
        return [{ breaks: [3] }];
      },
      select: () => {
        calls.select += 1;
        return { selected: "calculated", index: 0 };
      },
    });
    const plan = createLineBreakPlan({ text: "one two", model, strategy });

    const first = plan.select({ ...measurement, diagnostics: true });
    expect(first.breaks).toEqual([3]);
    expect(calls).toEqual({ aggregate: 1, calculate: 1, select: 1 });

    expect(plan.predict()).toBe(plan.predict());
    expect(plan.aggregate()).toBe(plan.aggregate());
    expect(calls.aggregate).toBe(1);

    plan.calculate(measurement);
    plan.select(measurement);
    expect(calls).toEqual({ aggregate: 1, calculate: 3, select: 2 });
  });

  test("returns frozen cached snapshots", () => {
    const plan = createLineBreakPlan({ text: "one two", model });
    const prediction = plan.predict();
    const candidates = plan.aggregate();
    const layouts = plan.calculate(measurement);
    const selection = plan.select({ ...measurement, diagnostics: true });

    expect(Object.isFrozen(prediction)).toBe(true);
    expect(Object.isFrozen(prediction.predictions)).toBe(true);
    expect(Object.isFrozen(candidates)).toBe(true);
    expect(Object.isFrozen(candidates[0])).toBe(true);
    expect(Object.isFrozen(layouts)).toBe(true);
    expect(Object.isFrozen(layouts[0])).toBe(true);
    expect(Object.isFrozen(layouts[0]?.breaks)).toBe(true);
    expect(Object.isFrozen(selection)).toBe(true);
    expect(Object.isFrozen(selection.diagnostics)).toBe(true);
  });
});
