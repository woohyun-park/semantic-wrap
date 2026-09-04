import { describe, expect, test } from "bun:test";
import {
  calculateOptimalLayouts,
  layoutAtBreaks,
  type OptimalLayoutCalculationStats,
} from "../src/core/line-layout.js";
import type {
  BreakCandidate,
  LayoutCalculationContext,
  LineBreakLayoutCandidate,
} from "../src/core/types.js";

const EPSILON = 1e-9;

function candidatesFor(text: string, penalties: readonly number[]): BreakCandidate[] {
  const offsets = Array.from(text.matchAll(/\s/gu), ({ index }) => index);
  return offsets.map((offset, index) => ({
    offset,
    level: null,
    penalty: penalties[index % penalties.length]!,
  }));
}

function signature(layout: LineBreakLayoutCandidate): string {
  return layout.breaks.join(",");
}

function bruteForce(context: LayoutCalculationContext): LineBreakLayoutCandidate[] {
  if (context.text === "") return [{ breaks: [] }];
  const layouts = Array.from({ length: 2 ** context.candidates.length }, (_, mask) => {
    const breaks = context.candidates.flatMap(({ offset }, index) =>
      mask & (1 << index) ? [offset] : [],
    );
    const layout = layoutAtBreaks(context, breaks);
    return {
      ...layout,
      rawBalanceCost: layout.balanceScore ** 2 * layout.lineCount,
    };
  }).filter(({ overflow }) => !overflow);
  if (layouts.length === 0) return [{ breaks: [] }];

  const minimumLineCount = Math.min(...layouts.map(({ lineCount }) => lineCount));
  const ordered = layouts
    .filter(({ lineCount }) => lineCount === minimumLineCount)
    .sort((left, right) => {
      const balance = left.rawBalanceCost - right.rawBalanceCost;
      if (Math.abs(balance) > EPSILON) return balance;
      const model = left.modelCost - right.modelCost;
      if (Math.abs(model) > EPSILON) return model;
      return left.breaks.map(({ offset }) => offset).join(",")
        .localeCompare(right.breaks.map(({ offset }) => offset).join(","));
    });

  const frontier: typeof ordered = [];
  for (const layout of ordered) {
    if (frontier.some((existing) =>
      existing.rawBalanceCost <= layout.rawBalanceCost + EPSILON &&
      existing.modelCost <= layout.modelCost + EPSILON
    )) {
      continue;
    }
    for (let index = frontier.length - 1; index >= 0; index -= 1) {
      const existing = frontier[index]!;
      if (
        layout.rawBalanceCost <= existing.rawBalanceCost + EPSILON &&
        layout.modelCost <= existing.modelCost + EPSILON
      ) {
        frontier.splice(index, 1);
      }
    }
    frontier.push(layout);
  }
  return frontier.map(({ breaks }) => ({
    breaks: breaks.map(({ offset }) => offset),
  }));
}

describe("optimalLayouts", () => {
  test("matches exhaustive enumeration across small deterministic inputs", () => {
    const text = "a bb ccc d ee fff g";
    const penaltySets = [
      [0, 0.35, 0.7, 1],
      [1, 0.7, 0.35, 0],
      [0.4, 0.1, 0.9, 0.2],
      [0, EPSILON * 0.4, EPSILON * 0.8, EPSILON * 1.2],
    ];

    for (const penalties of penaltySets) {
      for (let maxWidth = 4; maxWidth <= 12; maxWidth += 1) {
        const context: LayoutCalculationContext = {
          text,
          candidates: candidatesFor(text, penalties),
          maxWidth,
          measureText: (value) => value.length,
        };
        expect(calculateOptimalLayouts(context).map(signature)).toEqual(
          bruteForce(context).map(signature),
        );
      }
    }
  });

  test("keeps deterministic trade-offs and removes layouts worse on both costs", () => {
    const text = "aa bb cc dd";
    const context: LayoutCalculationContext = {
      text,
      candidates: candidatesFor(text, [0.7, 0, 1]),
      maxWidth: 8,
      measureText: (value) => value.length,
    };

    expect(calculateOptimalLayouts(context)).toEqual(bruteForce(context));
  });

  test("matches exhaustive enumeration across seeded randomized costs", () => {
    let seed = 0x12345678;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let sample = 0; sample < 100; sample += 1) {
      const wordCount = 5 + Math.floor(random() * 4);
      const words = Array.from({ length: wordCount }, (_, index) =>
        String.fromCharCode(97 + index).repeat(1 + Math.floor(random() * 4)),
      );
      const text = words.join(" ");
      const penalties = Array.from({ length: wordCount - 1 }, () =>
        Math.round(random() * 100) / 100,
      );
      const context: LayoutCalculationContext = {
        text,
        candidates: candidatesFor(text, penalties),
        maxWidth: 3 + Math.floor(random() * Math.max(1, text.length - 3)),
        measureText: (value) => value.length,
      };

      expect(calculateOptimalLayouts(context).map(signature)).toEqual(
        bruteForce(context).map(signature),
      );
    }
  });

  test("stops measuring longer segments and prunes impossible suffixes", () => {
    const text = "aa bb cc dd ee";
    const stats: OptimalLayoutCalculationStats = {
      measuredSegments: 0,
      visitedStates: 0,
      memoHits: 0,
      prunedTransitions: 0,
      generatedLayouts: 0,
      paretoComparisons: 0,
      peakBufferedLayouts: 0,
      maxFrontierSize: 0,
    };
    const candidates = candidatesFor(text, [0, 0.35, 0.7, 1]);

    calculateOptimalLayouts({
      text,
      candidates,
      maxWidth: 5,
      measureText: (value) => value.length,
    }, stats);

    const positionCount = candidates.length + 1;
    const allSegments = positionCount * (positionCount + 1) / 2;
    expect(stats.measuredSegments).toBeLessThan(allSegments);
    expect(stats.prunedTransitions).toBeGreaterThan(0);
  });

  test("returns the unbroken fallback when no candidate layout fits", () => {
    const text = "unbreakable word";
    const context: LayoutCalculationContext = {
      text,
      candidates: candidatesFor(text, [0]),
      maxWidth: 3,
      measureText: (value) => value.length,
    };

    expect(calculateOptimalLayouts(context)).toEqual([{ breaks: [] }]);
  });
});
