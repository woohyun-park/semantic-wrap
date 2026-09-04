import { describe, expect, test } from "bun:test";
import {
  consensus,
  createBudouxPredictor,
  createLineBreakStrategy,
  definePhraseModel,
  selectLineBreaks,
} from "../src/index.js";

const measureText = (text: string) => text.length;

describe("candidate aggregation", () => {
  test("accepts a custom synchronous boundary predictor", () => {
    const calls: string[] = [];
    const predictor = {
      predict(text: string) {
        calls.push(text);
        return [3];
      },
    };
    const model = definePhraseModel({
      boundaryMode: "spaces",
      levels: [
        {
          name: "custom",
          predictor,
          penalty: 0,
        },
      ],
      fallbackPenalty: 1,
    });
    const result = selectLineBreaks(
      { text: "one two three", model, maxWidth: 100, measureText },
      { diagnostics: true },
    );

    expect(calls).toEqual(["one two three"]);
    expect(result.diagnostics.predictions).toEqual([
      { offset: 3, level: 0, name: "custom", penalty: 0 },
    ]);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.levels)).toBe(true);
    expect(Object.isFrozen(model.levels[0])).toBe(true);
    expect(Object.isFrozen(predictor)).toBe(false);
  });

  test("wraps existing BudouX weights in the predictor contract", () => {
    const predictor = createBudouxPredictor({ UW3: { e: 100 } });
    expect(predictor.predict("one two")).toContain(3);
  });

  test("validates custom predictor definitions and returned offsets", () => {
    expect(() => definePhraseModel({
      levels: [{ predictor: {} as never, penalty: 0 }],
      fallbackPenalty: 1,
    })).toThrow("predict function");

    expect(() => selectLineBreaks({
      text: "one two",
      model: {
        levels: [{ model: {}, penalty: 0 }],
        fallbackPenalty: 1,
      } as never,
      maxWidth: 100,
      measureText,
    })).toThrow("predict function");

    for (const offsets of [[0], [2, 2], [2.5], [100]]) {
      const model = {
        boundaryMode: "spaces",
        levels: [{ predictor: { predict: () => offsets }, penalty: 0 }],
        fallbackPenalty: 1,
      } as const;
      expect(() => selectLineBreaks({
        text: "one two",
        model,
        maxWidth: 100,
        measureText,
      })).toThrow("ascending UTF-16 source offsets");
    }
  });

  test("filters custom predictions through the model boundary mode", () => {
    const model = definePhraseModel({
      boundaryMode: "spaces",
      levels: [{ predictor: { predict: () => [1, 3] }, penalty: 0 }],
      fallbackPenalty: 1,
    });
    const result = selectLineBreaks(
      { text: "one two", model, maxWidth: 100, measureText },
      { diagnostics: true },
    );

    expect(result.diagnostics.predictions.map(({ offset }) => offset)).toEqual([3]);
  });

  test("keeps every raw prediction in diagnostics and the lowest penalty per boundary", () => {
    const model = {
      boundaryMode: "spaces",
      levels: [
        {
          name: "coarse",
          predictor: createBudouxPredictor({ UW3: { 나: 100 } }),
          penalty: 0,
        },
        {
          name: "fine",
          predictor: createBudouxPredictor({ UW3: { 둘: 100 } }),
          penalty: 0.4,
        },
      ],
      fallbackPenalty: 1,
    } as const;
    const result = selectLineBreaks(
      { text: "하나 둘 셋 넷", model, maxWidth: 100, measureText },
      { diagnostics: true },
    );

    expect(result.diagnostics.predictions).toEqual([
      { offset: 2, level: 0, name: "coarse", penalty: 0 },
      { offset: 4, level: 1, name: "fine", penalty: 0.4 },
    ]);
    expect(result.diagnostics.candidates).toEqual([
      { offset: 2, level: 0, name: "coarse", penalty: 0 },
      { offset: 4, level: 1, name: "fine", penalty: 0.4 },
      { offset: 6, level: null, penalty: 1 },
    ]);
  });

  test("can require agreement between model levels", () => {
    const model = {
      boundaryMode: "spaces",
      levels: [
        {
          name: "one",
          predictor: createBudouxPredictor({ UW3: { 나: 100 } }),
          penalty: 0,
        },
        {
          name: "two",
          predictor: createBudouxPredictor({ UW3: { 나: 100 } }),
          penalty: 0.2,
        },
      ],
      fallbackPenalty: 1,
    } as const;
    const strategy = createLineBreakStrategy({
      aggregate: consensus({ minimumModels: 2 }),
    });
    const result = selectLineBreaks(
      { text: "하나 둘 셋", model, maxWidth: 100, measureText },
      { strategy, diagnostics: true },
    );

    expect(result.diagnostics.candidates).toEqual([
      { offset: 2, level: 0, name: "one", penalty: 0 },
      { offset: 4, level: null, penalty: 1 },
    ]);
  });

  test("collapses internal whitespace runs and excludes leading and trailing whitespace", () => {
    const model = {
      boundaryMode: "spaces",
      levels: [{ predictor: createBudouxPredictor({}), penalty: 0 }],
      fallbackPenalty: 1,
    } as const;
    const cases = [
      [" 하나 둘", [3]],
      ["하나  둘", [2]],
      ["하나\u00a0 둘", [2]],
      ["하나 둘 ", [2]],
      ["   ", []],
      ["", []],
    ] as const;

    for (const [text, offsets] of cases) {
      const result = selectLineBreaks(
        { text, model, maxWidth: 100, measureText },
        { diagnostics: true },
      );
      expect(result.diagnostics.candidates.map(({ offset }) => offset)).toEqual([...offsets]);
    }
  });

  test("uses grapheme boundaries for character mode", () => {
    const model = {
      boundaryMode: "characters",
      levels: [{ predictor: createBudouxPredictor({}), penalty: 0 }],
      fallbackPenalty: 1,
    } as const;
    const result = selectLineBreaks(
      { text: "가😀나", model, maxWidth: 100, measureText },
      { diagnostics: true },
    );

    expect(result.diagnostics.candidates.map(({ offset }) => offset)).toEqual([1, 3]);

    const combining = selectLineBreaks(
      { text: "e\u0301x", model, maxWidth: 100, measureText },
      { diagnostics: true },
    );
    expect(combining.diagnostics.candidates.map(({ offset }) => offset)).toEqual([2]);

    const family = selectLineBreaks(
      { text: "👨‍👩‍👧‍👦가", model, maxWidth: 100, measureText },
      { diagnostics: true },
    );
    expect(family.diagnostics.candidates.map(({ offset }) => offset)).toEqual([11]);

    const whitespaceRun = selectLineBreaks(
      { text: "가  나", model, maxWidth: 100, measureText },
      { diagnostics: true },
    );
    expect(whitespaceRun.diagnostics.candidates.map(({ offset }) => offset)).toEqual([1]);

    const afterWhitespaceModel = {
      boundaryMode: "characters",
      levels: [{
        name: "after-space",
        predictor: createBudouxPredictor({ UW3: { " ": 100 } }),
        penalty: 0,
      }],
      fallbackPenalty: 1,
    } as const;
    const normalizedPrediction = selectLineBreaks(
      { text: "가 나", model: afterWhitespaceModel, maxWidth: 100, measureText },
      { diagnostics: true },
    );
    expect(normalizedPrediction.diagnostics.predictions).toEqual([
      { offset: 1, level: 0, name: "after-space", penalty: 0 },
    ]);
  });

  test("preserves whitespace that is not replaced by a selected break", () => {
    const model = {
      boundaryMode: "spaces",
      levels: [{ predictor: createBudouxPredictor({}), penalty: 0 }],
      fallbackPenalty: 1,
    } as const;
    const result = selectLineBreaks({
      text: " 하나 둘 ",
      model,
      maxWidth: 100,
      measureText,
    });

    expect(result.lines).toEqual([" 하나 둘 "]);
  });

  test("rejects non-finite BudouX model weights", () => {
    expect(() => createBudouxPredictor({ UW3: { 나: Number.NaN } })).toThrow(
      "must be finite",
    );
  });

  test("rejects malformed phrase models with clear errors", () => {
    expect(() =>
      selectLineBreaks({
        text: "하나 둘",
        model: null as never,
        maxWidth: 100,
        measureText,
      }),
    ).toThrow("Phrase model must be an object");

    const invalidName = {
      levels: [{ name: 1, predictor: createBudouxPredictor({}), penalty: 0 }],
      fallbackPenalty: 1,
    };
    expect(() =>
      selectLineBreaks({
        text: "하나 둘",
        model: invalidName as never,
        maxWidth: 100,
        measureText,
      }),
    ).toThrow("name must be a string");
  });

  test("rejects aggregated candidates outside the model's allowed offsets", () => {
    const model = {
      boundaryMode: "spaces",
      levels: [{ predictor: createBudouxPredictor({}), penalty: 0 }],
      fallbackPenalty: 1,
    } as const;
    const strategy = createLineBreakStrategy({
      aggregate: () => [{ offset: 1, level: null, penalty: 0 }],
    });

    expect(() =>
      selectLineBreaks(
        { text: "하나 둘", model, maxWidth: 100, measureText },
        { strategy },
      ),
    ).toThrow("allowed offsets");
  });
});
