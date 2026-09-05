import { describe, expect, test } from "bun:test";
import {
  createLineBreakPlan,
  selectLineBreaks,
  type LayoutCalculationContext,
} from "../src/index.js";
import { calculateOptimalLayouts } from "../src/core/line-layout.js";

const model = { levels: [{ predictor: { predict: () => [] }, penalty: 0 }], fallbackPenalty: 1 };

describe("batched measurement", () => {
  test("keeps the complete global frontier and measured segment multiset across block boundaries", () => {
    for (const size of [1, 7, 63, 64, 65, 130]) {
      for (const maxWidth of [1, 12, 80]) {
        const text = Array.from({ length: size }, (_, i) => `w${i}`).join(" ");
        const candidates = [...text.matchAll(/ /g)].map((match, i) => ({
          offset: match.index!,
          level: null,
          penalty: ((i * 7) % 5) / 5,
        }));
        const scalarCalls: string[] = [];
        const batchCalls: string[] = [];
        // Deliberately includes non-monotonic width changes. Both paths must retain
        // the existing first-overflow behavior, not add new assumptions.
        const width = (value: string) => Math.max(0, value.length - (value.endsWith("3") ? 3 : 0));
        const context: LayoutCalculationContext = {
          text,
          candidates,
          maxWidth,
          measureText: (value) => {
            scalarCalls.push(value);
            return width(value);
          },
        };
        const expected = calculateOptimalLayouts(context);
        const actual = calculateOptimalLayouts({
          ...context,
          measureText: (value) => {
            batchCalls.push(value);
            return width(value);
          },
          measureTexts: (values) => {
            expect(values.length).toBeLessThanOrEqual(64);
            batchCalls.push(...values);
            return values.map(width);
          },
        });
        expect(actual).toEqual(expected);
        expect(batchCalls.sort()).toEqual(scalarCalls.sort());
      }
    }
  });

  test("preserves public selection, all diagnostics and native materialization", () => {
    for (const text of [
      "",
      "word",
      "더 나은 제품을 만들기 위해 팀이 버려야 할 습관",
      "a 👩‍💻 e\u0301   b\n c",
    ]) {
      const input = {
        text,
        model,
        maxWidth: 10,
        measureText: (value: string) => value.length,
      };
      const options = { diagnostics: true as const, nativeLayout: { breaks: [] } };
      expect(
        selectLineBreaks(
          { ...input, measureTexts: (values) => values.map(input.measureText) },
          options,
        ),
      ).toEqual(selectLineBreaks(input, options));
    }
  });

  test("rejects malformed batch results before using their widths", () => {
    const plan = createLineBreakPlan({ text: "a b c", model });
    const measurement = { maxWidth: 3, measureText: (text: string) => text.length };
    for (const result of [[], [1], [NaN, 1, 1], [Infinity, 1, 1], [-1, 1, 1], new Array(3)]) {
      expect(() => plan.select({ ...measurement, measureTexts: () => result })).toThrow();
    }
    expect(() => plan.select({ ...measurement, measureTexts: null as never })).toThrow(
      "measureTexts must be a function",
    );
  });
});
