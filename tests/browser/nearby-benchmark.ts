import {
  createLineBreakPlan,
  createLineBreakStrategy,
  type LineBreakSelectionWithDiagnostics,
  type PhraseModel,
} from "../../packages/core/src/index.js";
import { enTitleModel } from "../../packages/en/src/index.js";
import { koTitleModel } from "../../packages/ko/src/index.js";
import {
  contentWidth,
  createNativeLayoutMeasurementCache,
  createTextMeasurementCache,
  createTextMeasurer,
  invalidateNativeLayoutMeasurementCache,
  invalidateTextMeasurementCache,
  readNativeLayout,
} from "../../packages/react/src/dom-measure.js";
import { exampleCases } from "../../apps/docs/src/example-cases.js";
import { calculateOptimalLayouts } from "../../packages/core/src/core/line-layout.js";
import { calculateNearbyLayouts } from "../../packages/core/src/core/nearby-layouts.js";

type Algorithm = "optimal" | "optimal-batched" | "nearby-1" | "nearby-2" | "nearby-4";
interface Case {
  id: string;
  text: string;
  model: PhraseModel;
  style?: Partial<CSSStyleDeclaration>;
}

function selectedQuality(result: LineBreakSelectionWithDiagnostics) {
  const decision = result.diagnostics.selection;
  const layout =
    decision.selected === "native"
      ? result.diagnostics.nativeLayout!
      : result.diagnostics.calculatedLayouts[decision.index]!;
  return {
    breaks: result.breaks,
    lines: result.lines,
    applied: result.applied,
    overflow: result.overflow,
    lineCount: layout.lineCount,
    modelCost: layout.modelCost,
    balanceScore: layout.balanceScore,
    nativeModelCost: result.diagnostics.nativeLayout!.modelCost,
    nativeLineCount: result.diagnostics.nativeLayout!.lineCount,
    nativeOverflow: result.diagnostics.nativeLayout!.overflow,
    nativeBreaks: result.diagnostics.nativeLayout!.breaks,
    allowedOffsets: result.diagnostics.candidates.map(({ offset }) => offset),
  };
}

/** Browser-only diagnostic harness, never included in package exports. */
export function installNearbyBenchmark(longText: string): void {
  const uniqueText = Array.from(
    { length: 450 },
    (_, i) =>
      `${i + 1}번째 실험에서는 ${["사용성", "접근성", "가독성", "성능", "정확성"][i % 5]}을 확인합니다.`,
  ).join(" ");
  const cases: Case[] = [
    ...(["en", "ko"] as const).flatMap((locale) =>
      exampleCases[locale].examples.map(({ id, text }) => ({
        id: `docs-${locale}-${id}`,
        text,
        model: locale === "ko" ? koTitleModel : enTitleModel,
        style: { fontSize: "28px" },
      })),
    ),
    {
      id: "medium",
      text: longText.slice(0, longText.indexOf("디자인과 개발")),
      model: koTitleModel,
    },
    { id: "long-repeated", text: longText, model: koTitleModel },
    { id: "long-unique", text: uniqueText, model: koTitleModel },
    { id: "long-double", text: `${longText} ${longText}`, model: koTitleModel },
    {
      id: "emoji",
      text: "좋은 👩‍💻 경험과 e\u0301 표현을 🙂 자연스럽게 연결하는 방법을 살펴봅니다.",
      model: koTitleModel,
    },
    {
      id: "whitespace",
      text: "좋은   제품을\n만드는   팀이\t새로운 경험을 설계합니다.",
      model: koTitleModel,
      style: { whiteSpace: "pre-wrap" },
    },
    {
      id: "break-all",
      text: "문자경계에서줄바꿈하는긴문장과EnglishTextWithoutSpaces를확인합니다",
      model: koTitleModel,
      style: { wordBreak: "break-all" },
    },
    {
      id: "characters",
      text: "의미있는문장을🙂자연스럽고균형있게나누는알고리즘실험",
      model: { ...koTitleModel, boundaryMode: "characters" },
      style: { wordBreak: "break-all" },
    },
    {
      id: "overlong",
      text: "AnUnbreakableTokenThatCannotFitInTheAvailableContainerWidth",
      model: enTitleModel,
    },
    { id: "empty", text: "", model: koTitleModel },
    { id: "single", text: "word", model: enTitleModel },
  ];
  Reflect.set(
    window,
    "__nearbyBenchmark",
    async (
      options: {
        caseIds?: string[];
        algorithms?: Algorithm[];
        repeats?: number;
        widths?: number[];
        compareLayouts?: boolean;
      } = {},
    ) => {
      await document.fonts.ready;
      const output = [];
      const algorithms = options.algorithms ?? ["optimal", "nearby-1", "nearby-2", "nearby-4"];
      for (const testCase of cases.filter(
        ({ id }) => !options.caseIds || options.caseIds.includes(id),
      )) {
        for (let repetition = 0; repetition < (options.repeats ?? 1); repetition += 1) {
          // Alternate order to reduce systematic warmup/order bias.
          for (const algorithm of repetition % 2 ? [...algorithms].reverse() : algorithms) {
            const element = document.createElement("p");
            Object.assign(element.style, {
              fontFamily: "system-ui",
              fontSize: "16px",
              fontWeight: "600",
              letterSpacing: "-0.035em",
              lineHeight: "1.45",
              margin: "0",
              wordBreak: "keep-all",
              ...testCase.style,
            });
            element.textContent = testCase.text;
            document.body.append(element);
            const textCache = createTextMeasurementCache();
            const nativeCache = createNativeLayoutMeasurementCache();
            let calculationStats = {
              allocatedSegmentWidthSlots: 0,
              measuredSegments: 0,
              visitedStates: 0,
              memoHits: 0,
              prunedTransitions: 0,
              generatedLayouts: 0,
              paretoComparisons: 0,
              peakBufferedLayouts: 0,
              maxFrontierSize: 0,
            };
            const plan = createLineBreakPlan({
              text: testCase.text,
              model: testCase.model,
              strategy: createLineBreakStrategy({
                calculate: (context) => {
                  calculationStats = {
                    allocatedSegmentWidthSlots: 0,
                    measuredSegments: 0,
                    visitedStates: 0,
                    memoHits: 0,
                    prunedTransitions: 0,
                    generatedLayouts: 0,
                    paretoComparisons: 0,
                    peakBufferedLayouts: 0,
                    maxFrontierSize: 0,
                  };
                  const layouts =
                    algorithm === "optimal" || algorithm === "optimal-batched"
                      ? calculateOptimalLayouts(context, calculationStats)
                      : calculateNearbyLayouts(
                          context,
                          Number(algorithm.slice(-1)) as 1 | 2 | 4,
                          calculationStats,
                        );
                  return layouts.length ? layouts : [{ breaks: [] }];
                },
              }),
            });
            try {
              const widths =
                options.widths ??
                (testCase.id.startsWith("docs") ? [240, 320, 420, 320] : [360, 660, 900, 660]);
              for (const [step, width] of widths.entries()) {
                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                let textReads = 0;
                let textReadMs = 0;
                const rect = Element.prototype.getBoundingClientRect;
                Element.prototype.getBoundingClientRect = function () {
                  const tracked =
                    this instanceof HTMLSpanElement && this.style.visibility === "hidden";
                  const start = tracked ? performance.now() : 0;
                  const result = rect.call(this);
                  if (tracked) {
                    textReads += 1;
                    textReadMs += performance.now() - start;
                  }
                  return result;
                };
                try {
                  const started = performance.now();
                  element.style.width = `${width}px`;
                  const predictionStart = performance.now();
                  plan.aggregate();
                  const predictionMs = performance.now() - predictionStart;
                  const nativeStart = performance.now();
                  const nativeLayout = readNativeLayout(element, testCase.text, nativeCache);
                  const nativeMs = performance.now() - nativeStart;
                  const measurer = createTextMeasurer(element, textCache, testCase.text);
                  const result = plan.select({
                    maxWidth: contentWidth(element),
                    measureText: measurer.measureText,
                    measureTexts: algorithm === "optimal-batched" ? measurer.measureTexts : undefined,
                    nativeLayout,
                    diagnostics: true,
                  });
                  measurer.dispose();
                  const totalMs = performance.now() - started;
                  output.push({
                    id: testCase.id,
                    algorithm,
                    repetition,
                    step,
                    width,
                    sourceText: testCase.text,
                    textLength: testCase.text.length,
                    totalMs,
                    predictionMs,
                    nativeMs,
                    textReadMs,
                    otherMs: totalMs - predictionMs - nativeMs - textReadMs,
                    textReads,
                    retainedWidths: textCache.widths.size,
                    retainedProbes: Number(textCache.probe !== null) + textCache.batchProbes.length,
                    layoutFingerprint: options.compareLayouts ? JSON.stringify({
                      calculated: result.diagnostics.calculatedLayouts,
                      native: result.diagnostics.nativeLayout,
                      decision: result.diagnostics.selection,
                      widths: result.widths,
                    }) : undefined,
                    retainedKeyCodeUnits: [...textCache.widths.keys()].reduce(
                      (sum, key) => sum + key.length,
                      0,
                    ),
                    calculationStats,
                    ...selectedQuality(result),
                  });
                } finally {
                  Element.prototype.getBoundingClientRect = rect;
                }
              }
            } finally {
              invalidateTextMeasurementCache(textCache);
              invalidateNativeLayoutMeasurementCache(nativeCache);
              element.remove();
            }
          }
        }
      }
      return output;
    },
  );
}
