import { exampleCases } from "../apps/docs/src/example-cases.js";
import {
  calculateOptimalLayouts,
  type OptimalLayoutCalculationStats,
} from "../packages/core/src/core/line-layout.js";
import type {
  BreakCandidate,
  LayoutCalculationContext,
} from "../packages/core/src/core/types.js";

interface BenchmarkCase {
  name: string;
  text: string;
  maxWidth: number;
  candidates: BreakCandidate[];
}

function weightedWidth(text: string): number {
  return Array.from(text).reduce((total, character) => {
    if (/\s/u.test(character)) return total + 0.5;
    return total + (/[^\u0000-\u00ff]/u.test(character) ? 2 : 1);
  }, 0);
}

function candidatesAtSpaces(text: string): BreakCandidate[] {
  const penalties = [0, 0.35, 0.7, 1] as const;
  const candidates: BreakCandidate[] = [];
  let offset = 0;
  while (offset < text.length) {
    if (!/\s/u.test(text[offset]!)) {
      offset += 1;
      continue;
    }
    const runStart = offset;
    while (offset < text.length && /\s/u.test(text[offset]!)) offset += 1;
    if (runStart > 0 && offset < text.length) {
      const index = candidates.length;
      candidates.push({
        offset: runStart,
        level: index % penalties.length,
        penalty: penalties[index % penalties.length]!,
      });
    }
  }
  return candidates;
}

function candidatesAtCharacters(text: string): BreakCandidate[] {
  const penalties = [0, 0.35, 0.7, 1] as const;
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)]
    .slice(1)
    .map(({ index }, candidateIndex) => ({
      offset: index,
      level: candidateIndex % penalties.length,
      penalty: penalties[candidateIndex % penalties.length]!,
    }));
}

const documentationCases: BenchmarkCase[] = (["ko", "en"] as const).flatMap((locale) =>
  exampleCases[locale].examples.map(({ id, text }) => ({
    name: `docs-${locale}-${id}`,
    text,
    maxWidth: Math.ceil(weightedWidth(text) * 0.56),
    candidates: candidatesAtSpaces(text),
  })),
);

const syntheticWords = Array.from(
  { length: 32 },
  (_, index) => `${String.fromCharCode(97 + (index % 26))}${index}`,
).join(" ");
const characterText = "의미있는문장을자연스럽고균형있게나누는알고리즘실험";

const benchmarkCases: BenchmarkCase[] = [
  ...documentationCases,
  {
    name: "synthetic-narrow-32",
    text: syntheticWords,
    maxWidth: 12,
    candidates: candidatesAtSpaces(syntheticWords),
  },
  {
    name: "synthetic-balanced-32",
    text: syntheticWords,
    maxWidth: Math.ceil(weightedWidth(syntheticWords) / 5),
    candidates: candidatesAtSpaces(syntheticWords),
  },
  {
    name: "synthetic-characters",
    text: characterText,
    maxWidth: 12,
    candidates: candidatesAtCharacters(characterText),
  },
];

function emptyStats(): OptimalLayoutCalculationStats {
  return {
    measuredSegments: 0,
    visitedStates: 0,
    memoHits: 0,
    prunedTransitions: 0,
    generatedLayouts: 0,
    paretoComparisons: 0,
    peakBufferedLayouts: 0,
    maxFrontierSize: 0,
  };
}

function contextFor(
  benchmarkCase: BenchmarkCase,
  measureText: (text: string) => number = weightedWidth,
): LayoutCalculationContext {
  return {
    text: benchmarkCase.text,
    candidates: benchmarkCase.candidates,
    maxWidth: benchmarkCase.maxWidth,
    measureText,
  };
}

function percentile(values: readonly number[], fraction: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))]!;
}

function measureTime(benchmarkCase: BenchmarkCase): { medianMs: number; p95Ms: number } {
  const context = contextFor(benchmarkCase);
  const iterations = benchmarkCase.candidates.length > 24 ? 25 : 200;
  for (let index = 0; index < Math.min(iterations, 25); index += 1) {
    calculateOptimalLayouts(context);
  }

  const samples: number[] = [];
  for (let sample = 0; sample < 9; sample += 1) {
    const startedAt = performance.now();
    for (let index = 0; index < iterations; index += 1) {
      calculateOptimalLayouts(context);
    }
    samples.push((performance.now() - startedAt) / iterations);
  }
  return {
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
  };
}

const results = benchmarkCases.map((benchmarkCase) => {
  let measureTextCalls = 0;
  const stats = emptyStats();
  const layouts = calculateOptimalLayouts(
    contextFor(benchmarkCase, (text) => {
      measureTextCalls += 1;
      return weightedWidth(text);
    }),
    stats,
  );
  const time = measureTime(benchmarkCase);
  return {
    name: benchmarkCase.name,
    candidateCount: benchmarkCase.candidates.length,
    layoutCount: layouts.length,
    signature: layouts.map(({ breaks }) => breaks.join(",")).join("|"),
    measureTextCalls,
    ...stats,
    medianMs: Number(time.medianMs.toFixed(4)),
    p95Ms: Number(time.p95Ms.toFixed(4)),
  };
});

console.log(JSON.stringify({
  runtime: `Bun ${Bun.version}`,
  platform: `${process.platform}-${process.arch}`,
  results,
}, null, 2));
