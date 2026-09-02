import { describe, expect, test } from "bun:test";
import { consensus, createLineBreakStrategy, selectLineBreaks } from "../src/index.js";

const measureText = (text: string) => text.length;

describe("candidate aggregation", () => {
  test("keeps every raw prediction in diagnostics and the lowest penalty per boundary", () => {
    const model = {
      boundaryMode: "spaces",
      levels: [
        { name: "coarse", model: { UW3: { 나: 100 } }, penalty: 0 },
        { name: "fine", model: { UW3: { 둘: 100 } }, penalty: 0.4 },
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
        { name: "one", model: { UW3: { 나: 100 } }, penalty: 0 },
        { name: "two", model: { UW3: { 나: 100 } }, penalty: 0.2 },
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
      levels: [{ model: {}, penalty: 0 }],
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
      levels: [{ model: {}, penalty: 0 }],
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
      levels: [{ name: "after-space", model: { UW3: { " ": 100 } }, penalty: 0 }],
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
      levels: [{ model: {}, penalty: 0 }],
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
    const invalidModel = {
      boundaryMode: "spaces",
      levels: [{ model: { UW3: { 나: Number.NaN } }, penalty: 0 }],
      fallbackPenalty: 1,
    } as const;

    expect(() =>
      selectLineBreaks({
        text: "하나 둘",
        model: invalidModel,
        maxWidth: 100,
        measureText,
      }),
    ).toThrow("must be finite");
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
      levels: [{ name: 1, model: {}, penalty: 0 }],
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
      levels: [{ model: {}, penalty: 0 }],
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
