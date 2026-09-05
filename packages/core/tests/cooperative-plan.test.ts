import { expect, test } from "bun:test";
import { createLineBreakPlan } from "../src/index.js";
import { finishSteps } from "../src/core/steps.js";
import type { SegmentMeasurementContext } from "../src/core/line-layout.js";

const text = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
const model = { levels: [{ predictor: { predict: () => [] }, penalty: 0 }], fallbackPenalty: 1 };

test("resumable selection equals synchronous diagnostics and reuses exact widths across resizes", () => {
  const plan = createLineBreakPlan({ text, model });
  let calls = 0;
  const measureText = (value: string) => {
    calls += 1;
    return value.length;
  };
  const input = {
    maxWidth: 32,
    measureText,
    measureTexts: (values: readonly string[]) => values.map(measureText),
    cacheKey: {},
    diagnostics: true as const,
  };
  const expected = createLineBreakPlan({ text, model }).select(input);
  calls = 0;
  const steps = plan.selectSteps(input);
  let count = 0;
  let next = steps.next();
  while (!next.done) {
    count += 1;
    next = steps.next();
  }
  const coldCalls = calls;
  expect(count).toBeGreaterThan(100);
  expect(next.value).toEqual(expected);
  calls = 0;
  expect(finishSteps(plan.selectSteps(input))).toEqual(expected);
  expect(calls).toBeLessThan(coldCalls / 2);
  for (const maxWidth of [20, 48, 32]) {
    expect(finishSteps(plan.selectSteps({ ...input, maxWidth }))).toEqual(
      createLineBreakPlan({ text, model }).select({ ...input, maxWidth }),
    );
  }
});

test("interleaved jobs with different metric keys cannot pollute each other's widths", () => {
  const plan = createLineBreakPlan({ text, model });
  const oldInput = {
    maxWidth: 30,
    measureText: (value: string) => value.length,
    cacheKey: {},
    diagnostics: true as const,
  };
  const newInput = { ...oldInput, cacheKey: {}, measureText: (value: string) => value.length * 2 };
  const old = plan.selectSteps(oldInput);
  for (let i = 0; i < 5; i += 1) old.next();
  const fresh = plan.selectSteps(newInput);
  for (let i = 0; i < 5; i += 1) fresh.next();
  expect(finishSteps(old)).toEqual(createLineBreakPlan({ text, model }).select(oldInput));
  expect(finishSteps(fresh)).toEqual(createLineBreakPlan({ text, model }).select(newInput));
  expect(plan.select(newInput)).toEqual(createLineBreakPlan({ text, model }).select(newInput));
});

test("return cancels resumable custom calculators and runs their cleanup", () => {
  let cleaned = false;
  const calculate = Object.assign(() => [{ breaks: [] }], {
    *steps() {
      try {
        yield;
        return [{ breaks: [] }];
      } finally {
        cleaned = true;
      }
    },
  });
  const plan = createLineBreakPlan({
    text,
    model,
    strategy: {
      aggregate: () => [],
      calculate,
      select: () => ({ selected: "calculated", index: 0 }),
    },
  });
  const steps = plan.selectSteps({ maxWidth: 100, measureText: (value) => value.length });
  steps.next();
  steps.return(undefined as never);
  expect(cleaned).toBe(true);
});

test("segment cache evicts after its bounded capacity without changing measured widths", () => {
  let measureSegments: NonNullable<SegmentMeasurementContext["measureSegments"]>;
  let calls = 0;
  const plan = createLineBreakPlan({ text: "a".repeat(400), model, strategy: {
    aggregate: () => [],
    calculate: (context) => { measureSegments = (context as SegmentMeasurementContext).measureSegments!; return [{ breaks: [] }]; },
    select: () => ({ selected: "calculated", index: 0 }),
  } });
  plan.select({ maxWidth: 500, cacheKey: {}, measureText: (value) => { calls += 1; return value.length; } });
  const ranges: [number, number][] = [];
  for (let start = 0; start < 400 && ranges.length < 65_537; start += 1) {
    for (let end = start + 1; end <= 400 && ranges.length < 65_537; end += 1) ranges.push([start, end]);
  }
  measureSegments!(ranges);
  const before = calls;
  expect(measureSegments!([ranges[ranges.length - 1]!])).toEqual([ranges[ranges.length - 1]![1] - ranges[ranges.length - 1]![0]]);
  expect(calls).toBe(before);
  expect(measureSegments!([ranges[0]!])).toEqual([1]);
  expect(calls).toBe(before + 1);
});
