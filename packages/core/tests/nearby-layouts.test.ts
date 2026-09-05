import { describe, expect, test } from "bun:test";
import { createLineBreakPlan, createLineBreakStrategy, nearbyLayouts } from "../src/index.js";
import { calculateNearbyLayouts } from "../src/core/nearby-layouts.js";
import { calculateOptimalLayouts, layoutAtBreaks } from "../src/core/line-layout.js";
import type { LayoutCalculationContext, PhraseModel } from "../src/index.js";

// Independent exhaustive oracle: enumerate all combinations first, then restrict by
// native line ordinal, fit, and pairwise Pareto dominance. No DP or merge helper.
function oracle(context: LayoutCalculationContext, radius: number): number[][] {
  const anchors = context.nativeLayout!.breaks;
  const rows: Array<{ breaks: number[]; model: number; balance: number }> = [];
  for (let mask = 0; mask < 2 ** context.candidates.length; mask += 1) {
    const chosen = context.candidates.filter((_, index) => mask & (1 << index));
    if (chosen.length !== anchors.length) continue;
    if (
      chosen.some((candidate, ordinal) => {
        const anchor = anchors[ordinal]!;
        const predecessors = context.candidates
          .filter(({ offset }) => offset < anchor)
          .slice(-radius);
        const successors = context.candidates
          .filter(({ offset }) => offset > anchor)
          .slice(0, radius);
        return candidate.offset !== anchor && ![...predecessors, ...successors].includes(candidate);
      })
    )
      continue;
    const breaks = chosen.map(({ offset }) => offset);
    const layout = layoutAtBreaks(context, breaks);
    if (layout.overflow || layout.lines.some((line) => line.length === 0)) continue;
    rows.push({
      breaks,
      model: layout.modelCost,
      balance: layout.balanceScore ** 2 * layout.lineCount,
    });
  }
  rows.sort((a, b) =>
    Math.abs(a.balance - b.balance) > 1e-9
      ? a.balance - b.balance
      : Math.abs(a.model - b.model) > 1e-9
        ? a.model - b.model
        : a.breaks.join(",").localeCompare(b.breaks.join(",")),
  );
  return rows
    .filter(
      (row, index) =>
        !rows.some(
          (other, otherIndex) =>
            otherIndex !== index &&
            other.balance <= row.balance + 1e-9 &&
            other.model <= row.model + 1e-9 &&
            (other.balance < row.balance - 1e-9 ||
              other.model < row.model - 1e-9 ||
              otherIndex < index),
        ),
    )
    .map(({ breaks }) => breaks);
}

const model: PhraseModel = {
  levels: [{ predictor: { predict: () => [] }, penalty: 0 }],
  boundaryMode: "spaces",
  fallbackPenalty: 1,
};

describe("nearbyLayouts", () => {
  test("documents a real quality regression when the better boundary is outside the neighborhood", () => {
    const input = {
      text: "a b c d e f g",
      model: {
        ...model,
        levels: [{ predictor: { predict: () => [7] }, penalty: 0 }],
      },
    };
    const measurement = {
      maxWidth: 11,
      measureText: (s: string) => s.length,
      nativeLayout: { breaks: [1] },
    };
    const original = createLineBreakPlan(input).select(measurement);
    const nearby = createLineBreakPlan({
      ...input,
      strategy: createLineBreakStrategy({ calculate: nearbyLayouts() }),
    }).select(measurement);
    expect(original.applied).toBe(true);
    expect(original.breaks).toEqual([7]);
    expect(nearby.applied).toBe(false);
    expect(nearby.breaks).toEqual([1]);
  });
  test("matches exhaustive restricted search with overlapping neighborhoods", () => {
    let seed = 37;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    for (let run = 0; run < 80; run += 1) {
      const text = Array.from({ length: 8 }, (_, index) =>
        String.fromCharCode(97 + index).repeat(1 + Math.floor(random() * 4)),
      ).join(" ");
      const candidates = [...text.matchAll(/ /g)].map(({ index }) => ({
        offset: index,
        level: null,
        penalty: Math.floor(random() * 5) / 4,
      }));
      const context: LayoutCalculationContext = {
        text,
        candidates,
        maxWidth: 5 + Math.floor(random() * 10),
        measureText: (s) => s.length,
        nativeLayout: {
          breaks: candidates.filter((_, i) => i % 2 === 1).map(({ offset }) => offset),
        },
      };
      for (const radius of [1, 2, 4] as const) {
        expect(calculateNearbyLayouts(context, radius).map(({ breaks }) => breaks)).toEqual(
          oracle(context, radius),
        );
      }
    }
  });

  test("handles anchors not present among semantic candidates without inventing boundaries", () => {
    const context: LayoutCalculationContext = {
      text: "ab cd ef gh",
      maxWidth: 8,
      measureText: (s) => s.length,
      candidates: [
        { offset: 2, level: null, penalty: 0 },
        { offset: 8, level: null, penalty: 1 },
      ],
      nativeLayout: { breaks: [5] },
    };
    expect(calculateNearbyLayouts(context).map(({ breaks }) => breaks)).toEqual(oracle(context, 2));
  });

  test("does not assume longer substrings have greater widths", () => {
    const context: LayoutCalculationContext = {
      text: "a b c d",
      maxWidth: 3,
      candidates: [1, 3, 5].map((offset) => ({
        offset,
        level: null,
        penalty: 0,
      })),
      nativeLayout: { breaks: [3] },
      measureText: (s) => (s === "a b" ? 10 : s === "a b c" ? 2 : s.length),
    };
    expect(calculateNearbyLayouts(context).map(({ breaks }) => breaks)).toEqual(oracle(context, 2));
  });

  test("falls back to optimal without native input and rejects unsupported radii", () => {
    const context = {
      text: "aa bb",
      maxWidth: 3,
      measureText: (s: string) => s.length,
      candidates: [{ offset: 2, level: null, penalty: 0 }],
    };
    expect(nearbyLayouts()(context)).toEqual(calculateOptimalLayouts(context));
    expect(() => nearbyLayouts({ radius: 0 as 2 })).toThrow("radius");
  });

  test("keeps the native result when neighborhoods have no fitting path", () => {
    const plan = createLineBreakPlan({
      text: "unbreakable token",
      model,
      strategy: createLineBreakStrategy({ calculate: nearbyLayouts() }),
    });
    const result = plan.select({
      maxWidth: 2,
      measureText: (s) => s.length,
      nativeLayout: { breaks: [11] },
    });
    expect(result.applied).toBe(false);
    expect(result.breaks).toEqual([11]);
    expect(result.overflow).toBe(true);
  });

  test("passes a validated frozen native snapshot to calculators before they run", () => {
    let calls = 0;
    const plan = createLineBreakPlan({
      text: "aa bb",
      model,
      strategy: createLineBreakStrategy({
        calculate: (context) => {
          calls += 1;
          expect(Object.isFrozen(context.nativeLayout?.breaks)).toBe(true);
          expect(context.nativeLayout?.breaks).toEqual([2]);
          return [{ breaks: [2] }];
        },
      }),
    });
    expect(() =>
      plan.select({ maxWidth: 3, measureText: (s) => s.length, nativeLayout: { breaks: [99] } }),
    ).toThrow("Native breaks");
    expect(calls).toBe(0);
    plan.calculate({ maxWidth: 3, measureText: (s) => s.length, nativeLayout: { breaks: [2] } });
    expect(calls).toBe(1);
  });

  test("preserves whitespace, surrogate pairs, and combining characters", () => {
    for (const text of ["🙂🙂   e\u0301e\u0301   가나다", "", "one"]) {
      const plan = createLineBreakPlan({
        text,
        model,
        strategy: createLineBreakStrategy({ calculate: nearbyLayouts() }),
      });
      const native = { breaks: [...text.matchAll(/ +/g)].map(({ index }) => index) };
      const selection = plan.select({
        maxWidth: 30,
        measureText: (s) => s.length,
        nativeLayout: native,
      });
      expect(selection.text).toBe(text);
      expect(selection.breaks.every((offset) => text[offset] === " ")).toBe(true);
      expect(selection.overflow).toBe(false);
    }
  });
});
