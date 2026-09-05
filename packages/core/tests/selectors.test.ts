import { describe, expect, test } from "bun:test";
import {
  balance,
  createBudouxPredictor,
  createLineBreakStrategy,
  greedy,
  selectLineBreaks,
  type BreakCandidate,
  type LineBreakLayout,
  type PhraseModel,
} from "../src/index.js";

const measureText = (text: string) => text.length;
const model: PhraseModel = {
  boundaryMode: "spaces",
  levels: [
    { predictor: createBudouxPredictor({}), penalty: 0 },
    { predictor: createBudouxPredictor({}), penalty: 0.5 },
  ],
  fallbackPenalty: 1,
};
const candidates: BreakCandidate[] = [
  { offset: 2, level: 0, name: "coarse", penalty: 0 },
  { offset: 4, level: 1, name: "fine", penalty: 1 },
];

function layout({
  balanceScore,
  breaks,
  modelCost,
  overflow = false,
  lineCount = breaks.length + 1,
}: {
  balanceScore: number;
  breaks: number[];
  modelCost: number;
  overflow?: boolean;
  lineCount?: number;
}): LineBreakLayout {
  return {
    breaks,
    lines: Array.from({ length: lineCount }, () => "line"),
    widths: Array.from({ length: lineCount }, () => 1),
    selectedCandidates: [],
    lineCount,
    balanceScore,
    modelCost,
    overflow,
  };
}

describe("selectLineBreaks", () => {
  test("selects a calculated layout inside the balance tolerance", () => {
    const strategy = createLineBreakStrategy({
      aggregate: () => candidates,
      select: balance(),
    });
    const result = selectLineBreaks(
      { text: "하나 둘 셋", model, maxWidth: 5, measureText },
      { nativeLayout: { breaks: [4] }, strategy },
    );

    expect(result).toMatchObject({
      applied: true,
      reason: "calculated-selected",
      lines: ["하나", "둘 셋"],
      breaks: [2],
      overflow: false,
    });
  });

  test("keeps native when the calculated layout has no model improvement", () => {
    const equalCostCandidates: BreakCandidate[] = [
      { offset: 2, level: null, penalty: 1 },
      { offset: 4, level: null, penalty: 1 },
    ];
    const strategy = createLineBreakStrategy({
      aggregate: () => equalCostCandidates,
      calculate: () => [{ breaks: [2] }, { breaks: [4] }],
      select: balance({ tolerance: 0.25 }),
    });
    const result = selectLineBreaks(
      { text: "하나 둘 셋", model, maxWidth: 5, measureText },
      { nativeLayout: { breaks: [4] }, strategy, diagnostics: true },
    );

    expect(result.applied).toBe(false);
    expect(result.breaks).toEqual([4]);
    expect(result.diagnostics.calculatedLayouts.map(({ breaks }) => breaks)).toEqual([
      [2],
      [4],
    ]);
    expect(result.diagnostics.selection).toEqual({
      selected: "native",
      reason: "native-no-model-improvement",
    });
  });

  test("keeps native when model improvement would exceed the balance tolerance", () => {
    const selection = balance()({
      nativeLayout: layout({ breaks: [4], balanceScore: 0.05, modelCost: 1 }),
      calculatedLayouts: [
        layout({ breaks: [2], balanceScore: 0.3, modelCost: 0 }),
      ],
    });

    expect(selection).toEqual({ selected: "native", reason: "native-selected" });
  });

  test("does not compare model costs across different line counts", () => {
    const selection = balance()({
      nativeLayout: layout({ breaks: [4], balanceScore: 0.1, modelCost: 1 }),
      calculatedLayouts: [
        layout({ breaks: [], balanceScore: 0, modelCost: 0, lineCount: 1 }),
      ],
    });

    expect(selection).toEqual({
      selected: "native",
      reason: "native-no-model-improvement",
    });
  });

  test("allows a fitting calculated layout to replace an overflowing native layout", () => {
    const selection = balance()({
      nativeLayout: layout({
        breaks: [4],
        balanceScore: 0.1,
        modelCost: 1,
        overflow: true,
      }),
      calculatedLayouts: [
        layout({ breaks: [2], balanceScore: 0.1, modelCost: 1 }),
      ],
    });

    expect(selection).toEqual({
      selected: "calculated",
      index: 0,
      reason: "calculated-selected",
    });
  });

  test("selects calculated layouts normally when native is absent", () => {
    const selection = balance()({
      calculatedLayouts: [
        layout({ breaks: [2], balanceScore: 0.1, modelCost: 1 }),
      ],
    });

    expect(selection).toEqual({
      selected: "calculated",
      index: 0,
      reason: "calculated-selected",
    });
  });

  test("compares the summed model cost when line counts match", () => {
    const selection = balance({ tolerance: 0.2 })({
      nativeLayout: layout({ breaks: [2, 6], balanceScore: 0.1, modelCost: 2 }),
      calculatedLayouts: [
        layout({ breaks: [4, 8], balanceScore: 0.15, modelCost: 1.7 }),
      ],
    });

    expect(selection).toEqual({
      selected: "calculated",
      index: 0,
      reason: "calculated-selected",
    });
  });

  test("uses the phrase model fallback penalty for unmatched native breaks", () => {
    const highFallbackModel: PhraseModel = {
      boundaryMode: "spaces",
      levels: [{ predictor: createBudouxPredictor({}), penalty: 0 }],
      fallbackPenalty: 5,
    };
    const strategy = createLineBreakStrategy({
      aggregate: () => [{ offset: 2, level: null, penalty: 0.2 }],
      calculate: () => [{ breaks: [2] }],
    });
    const result = selectLineBreaks(
      { text: "하나 둘 셋", model: highFallbackModel, maxWidth: 5, measureText },
      { nativeLayout: { breaks: [4] }, strategy, diagnostics: true },
    );

    expect(result.diagnostics.nativeLayout?.modelCost).toBe(5);
    expect(result.breaks).toEqual([2]);
    expect(result.applied).toBe(true);
  });

  test("preserves the native SLASH title layout when both boundaries are fallbacks", () => {
    const text = "토스ㅣSLASH 22 - UX와 DX, 그 모든 경험을 위한 디자인 시스템";
    const nativeBreak = text.indexOf(" 그");
    const calculatedBreak = text.indexOf(" 모든");
    const widths = new Map<string, number>([
      [text, 1_350],
      [" ", 28],
      [text.slice(0, nativeBreak), 632],
      [text.slice(nativeBreak + 1), 692],
      [text.slice(0, calculatedBreak), 684],
      [text.slice(calculatedBreak + 1), 638],
    ]);
    const strategy = createLineBreakStrategy({
      calculate: () => [{ breaks: [calculatedBreak] }],
    });
    const result = selectLineBreaks(
      {
        text,
        model,
        maxWidth: 700,
        measureText: (value) => widths.get(value) ?? value.length,
      },
      { nativeLayout: { breaks: [nativeBreak] }, strategy },
    );

    expect(result).toMatchObject({
      applied: false,
      breaks: [nativeBreak],
      reason: "native-no-model-improvement",
    });
  });

  test("supports a phrase-first greedy calculator", () => {
    const aggregated: BreakCandidate[] = [
      { offset: 2, level: null, penalty: 1 },
      { offset: 4, level: 0, penalty: 0 },
      { offset: 6, level: null, penalty: 1 },
    ];
    const strategy = createLineBreakStrategy({
      aggregate: () => aggregated,
      calculate: greedy(),
    });
    const result = selectLineBreaks(
      { text: "하나 둘 셋 넷", model, maxWidth: 5, measureText },
      { strategy },
    );

    expect(result.breaks).toEqual([4]);
    expect(result.lines).toEqual(["하나 둘", "셋 넷"]);
  });

  test.each([
    { penalties: [0, 0, 0, 0, 0], breaks: [5, 11] },
    { penalties: [0, 1, 1, 0, 1], breaks: [2, 8, 11] },
  ])("greedy keeps later fitting candidates available after choosing a boundary: %j", ({ penalties, breaks }) => {
    const result = greedy()({
      text: "aa bb cc dd ee ff",
      maxWidth: 5,
      measureText,
      candidates: penalties.map((penalty, index) => ({
        offset: 2 + index * 3, level: null, penalty,
      })),
    });
    expect(result).toEqual([{ breaks }]);
  });

  test("greedy stops measuring after selecting the last available boundary", () => {
    const measured: string[] = [];
    const result = greedy()({
      text: "aa bb",
      maxWidth: 2,
      candidates: [{ offset: 2, level: null, penalty: 0 }],
      measureText: (text) => {
        measured.push(text);
        return text.length;
      },
    });
    expect(result).toEqual([{ breaks: [2] }]);
    expect(measured).toEqual(["aa bb", "aa"]);
  });

  test("accepts custom calculation and selection stages", () => {
    const strategy = createLineBreakStrategy({
      aggregate: () => candidates,
      calculate: () => [{ breaks: [2] }, { breaks: [4] }],
      select: () => ({ selected: "calculated", index: 1, reason: "product-rule" }),
    });
    const result = selectLineBreaks(
      { text: "하나 둘 셋", model, maxWidth: 5, measureText },
      { strategy },
    );

    expect(result.lines).toEqual(["하나 둘", "셋"]);
    expect(result.reason).toBe("product-rule");
  });

  test("reports an overlong token without inventing character boundaries", () => {
    const strategy = createLineBreakStrategy({ calculate: greedy() });
    const result = selectLineBreaks(
      { text: "supercalifragilistic", model, maxWidth: 8, measureText },
      { strategy },
    );

    expect(result.breaks).toEqual([]);
    expect(result.overflow).toBe(true);
    expect(result.applied).toBe(false);

    const nativeFallback = selectLineBreaks(
      { text: "supercalifragilistic", model, maxWidth: 8, measureText },
      { nativeLayout: { breaks: [] }, strategy },
    );
    expect(nativeFallback.reason).toBe("native-selected");
  });

  test("handles empty text and a fitting single token", () => {
    const empty = selectLineBreaks({
      text: "",
      model,
      maxWidth: 8,
      measureText,
    });
    expect(empty).toMatchObject({ lines: [], breaks: [], overflow: false, applied: false });

    const single = selectLineBreaks({
      text: "제목",
      model,
      maxWidth: 8,
      measureText,
    });
    expect(single).toMatchObject({
      lines: ["제목"],
      breaks: [],
      overflow: false,
      applied: false,
    });
  });

  test("rejects invalid measured widths", () => {
    for (const width of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(() =>
        selectLineBreaks({
          text: "하나 둘",
          model,
          maxWidth: 8,
          measureText: () => width,
        }),
      ).toThrow("Measured text width");
    }
  });

  test("validates public inputs before running the pipeline", () => {
    expect(() =>
      selectLineBreaks({
        text: 1 as never,
        model,
        maxWidth: 8,
        measureText,
      }),
    ).toThrow("text must be a string");

    expect(() =>
      selectLineBreaks({
        text: "하나 둘",
        model,
        maxWidth: 8,
        measureText: null as never,
      }),
    ).toThrow("measureText must be a function");

    expect(() =>
      selectLineBreaks(
        { text: "하나 둘", model, maxWidth: 8, measureText },
        { nativeLayout: {} as never },
      ),
    ).toThrow("Native layout must contain a breaks array");
  });

  test("validates custom calculator and selector results", () => {
    const input = { text: "하나 둘 셋", model, maxWidth: 5, measureText };
    const emptyCalculator = createLineBreakStrategy({ calculate: () => [] });
    expect(() => selectLineBreaks(input, { strategy: emptyCalculator })).toThrow(
      "at least one layout candidate",
    );

    const invalidSelector = createLineBreakStrategy({
      select: (() => ({ selected: "other" })) as never,
    });
    expect(() => selectLineBreaks(input, { strategy: invalidSelector })).toThrow(
      "native or calculated",
    );

    const missingIndex = createLineBreakStrategy({
      select: (() => ({ selected: "calculated" })) as never,
    });
    expect(() => selectLineBreaks(input, { strategy: missingIndex })).toThrow(
      "calculated layout index",
    );

    const unknownBreak = createLineBreakStrategy({
      calculate: () => [{ breaks: [1] }],
    });
    expect(() => selectLineBreaks(input, { strategy: unknownBreak })).toThrow(
      "aggregated candidates",
    );

    const missingNative = createLineBreakStrategy({
      select: () => ({ selected: "native" }),
    });
    expect(() => selectLineBreaks(input, { strategy: missingNative })).toThrow(
      "missing native layout",
    );
  });
});
