import { StrictMode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import {
  createBudouxPredictor,
  createLineBreakStrategy,
  nearbyLayouts,
  selectLineBreaks,
  type LineBreakCalculator,
  type LineBreakStrategy,
  type PhraseModel,
} from "../../packages/core/src/index.js";
import { SemanticWrap } from "../../packages/react/src/index.js";
import { useSemanticWrap } from "../../packages/react/src/index.js";
import { contentWidth, createTextMeasurer, readNativeLayout } from "../../packages/react/src/dom-measure.js";
import { koTitleModel } from "../../packages/ko/src/index.js";
import { installNearbyBenchmark } from "./nearby-benchmark.js";
import { installBatchWidthChecks } from "./batch-widths.js";
import { ResizeFixture } from "./resize-fixture.js";
import { SchedulingFixture, schedulingConfig } from "./scheduling-fixture.js";

installBatchWidthChecks();

// Fresh synchronous oracle for resize tests, using this browser's actual font metrics.
Reflect.set(window, "__resizeReference", (text: string) => {
  const element = document.querySelector<HTMLElement>("#resize-text")!;
  const measurer = createTextMeasurer(element, undefined, text);
  try {
    const selection = selectLineBreaks({
      text,
      model: koTitleModel,
      maxWidth: contentWidth(element),
      measureText: measurer.measureText,
    }, { nativeLayout: readNativeLayout(element, text) });
    return selection.applied ? selection.lines.join("\n") : text;
  } finally {
    measurer.dispose();
  }
});

const model: PhraseModel = {
  boundaryMode: "spaces",
  levels: [{ name: "test", predictor: createBudouxPredictor({}), penalty: 0 }],
  fallbackPenalty: 1,
};
const candidatePredictor = createBudouxPredictor({ UW3: { 나: 100 } });

const responsiveCalculator: LineBreakCalculator = ({ maxWidth }) =>
  [{ breaks: maxWidth < 260 ? [2] : [] }];
const responsiveStrategy = createLineBreakStrategy({
  calculate: responsiveCalculator,
  select: () => ({ selected: "calculated", index: 0, reason: "responsive-test" }),
});

const switchingStrategy = createLineBreakStrategy({
  calculate: ({ maxWidth }) => [{ breaks: maxWidth < 260 ? [2] : [4] }],
  select: () => ({ selected: "calculated", index: 0, reason: "switching-test" }),
});

const alternateProgressiveStrategy = createLineBreakStrategy({
  calculate: () => [{ breaks: [4] }],
  select: () => ({ selected: "calculated", index: 0, reason: "progressive-update-test" }),
});

const whitespaceStrategy = createLineBreakStrategy({
  calculate: () => [{ breaks: [2] }],
  select: () => ({ selected: "calculated", index: 0, reason: "whitespace-test" }),
});

const candidateStrategy = createLineBreakStrategy({
  calculate: () => [{ breaks: [2] }],
  select: () => ({ selected: "calculated", index: 0, reason: "candidate-test" }),
});

interface BrowserBenchmarkStats {
  calculateCalls: number;
  calculateMs: number;
  pendingStartedAt: number | null;
  selectionDurations: number[];
  pendingCommitStartedAt?: number | null;
  commitDurations?: number[];
}

function browserBenchmarkStats(): BrowserBenchmarkStats | undefined {
  return Reflect.get(window, "__semanticWrapBenchmarkStats") as BrowserBenchmarkStats | undefined;
}

const benchmarkRadius = new URLSearchParams(window.location.search).get("radius");
const benchmarkDefaultStrategy = createLineBreakStrategy(benchmarkRadius ? {
  calculate: nearbyLayouts({ radius: Number(benchmarkRadius) as 1 | 2 | 4 }),
} : {});
const benchmarkStrategy: LineBreakStrategy = createLineBreakStrategy({
  calculate: (context) => {
    const stats = browserBenchmarkStats();
    const startedAt = performance.now();
    const result = benchmarkDefaultStrategy.calculate(context);
    if (stats) {
      stats.calculateCalls += 1;
      stats.calculateMs += performance.now() - startedAt;
    }
    return result;
  },
  select: (context) => {
    const result = benchmarkDefaultStrategy.select(context);
    const stats = browserBenchmarkStats();
    if (stats?.pendingStartedAt !== null && stats?.pendingStartedAt !== undefined) {
      stats.selectionDurations.push(performance.now() - stats.pendingStartedAt);
      stats.pendingStartedAt = null;
    }
    return result;
  },
});

const LONG_BENCHMARK_TEXT = `${[
  "복잡한 제품을 설계하고 운영하는 팀이 사용자에게 정말 필요한 경험을 제공하려면 눈앞의 기능을 빠르게 추가하는 것만으로는 충분하지 않으며 문제를 정의한 배경과 선택하지 않은 대안 그리고 실제 사용 과정에서 발견된 제약을 함께 기록하고 공유해야 합니다.",
  "새로운 기능을 제안할 때는 기대하는 변화와 성공을 판단할 기준을 먼저 정하고 작은 범위에서 실험한 다음 관찰된 결과가 처음의 가정을 지지하는지 아니면 전혀 다른 문제를 드러내는지 차분하게 확인해야 합니다.",
  "디자인과 개발 과정에서 빠르게 내린 결정도 시간이 지나면 당연한 규칙처럼 굳어지므로 당시의 맥락과 트레이드오프를 문서에 남겨 다음 사람이 같은 논의를 처음부터 반복하지 않게 만드는 일이 중요합니다.",
  "사용자의 행동은 정리된 요구사항보다 복잡하고 예외도 많기 때문에 정상적인 흐름만 확인해서는 부족하며 느린 네트워크와 좁은 화면과 긴 번역문과 예상하지 못한 입력까지 포함해 제품이 어떻게 반응하는지 살펴봐야 합니다.",
  "측정 결과를 해석할 때는 하나의 평균값만 보는 대신 입력 크기별 변화와 가장 느린 구간과 메모리 사용량과 반복 실행의 편차를 함께 확인해야 실제 병목이 어디에서 발생하는지 더 정확하게 이해할 수 있습니다.",
  "알고리즘을 최적화할 때도 가장 복잡한 기법을 먼저 도입하기보다 불필요한 계산을 멈추고 실패가 확실한 경로를 일찍 제거하고 이미 계산한 결과를 재사용하는 기본적인 개선부터 검증하는 편이 안전합니다.",
  "서로 다른 장점을 가진 후보를 모두 보존해야 하는 상황에서는 하나의 점수로 성급하게 합치지 말고 어떤 후보가 다른 후보보다 모든 기준에서 나쁜지를 판단해 의미 있는 선택지만 다음 단계로 전달해야 합니다.",
  "마지막으로 실제 화면에서 폭을 계속 바꾸고 글꼴이 로드되는 순간과 브라우저가 다시 레이아웃을 계산하는 순간을 관찰하면서 계산 결과뿐 아니라 인터페이스가 멈추거나 흔들리지 않는지도 함께 확인해야 합니다.",
].join(" ")} `
  .repeat(6)
  .trim();

installNearbyBenchmark(LONG_BENCHMARK_TEXT);

let nearbyIntegrationCalls = 0;
const nearbyCalculator = nearbyLayouts();
const nearbyIntegrationStrategy = createLineBreakStrategy({ calculate: (context) => {
  nearbyIntegrationCalls += 1;
  Reflect.set(window, "__nearbyIntegrationCalls", nearbyIntegrationCalls);
  return nearbyCalculator(context);
} });

function NearbyReactFixture() {
  const [alternate, setAlternate] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const text = alternate ? "사용자에게 필요한 경험을 설계하는 팀의 기준을 함께 살펴봅니다."
    : "디자인 시스템을 도입하기 전에 반드시 확인해야 할 기준";
  return <section>
    <button id="nearby-text" type="button" onClick={() => setAlternate(!alternate)}>Text</button>
    <button id="nearby-font" type="button" onClick={() => setFontSize(fontSize === 16 ? 23 : 16)}>Font</button>
    <button id="nearby-visible" type="button" onClick={() => setVisible(!visible)}>Mount</button>
    {visible && <NearbyReactTitles text={text} fontSize={fontSize} />}
  </section>;
}

function NearbyReactTitles({ text, fontSize }: { text: string; fontSize: number }) {
  const { ref, selection } = useSemanticWrap({ text, model: koTitleModel,
    strategy: nearbyIntegrationStrategy });
  const style = { fontSize, fontFamily: "system-ui", fontWeight: 600,
    letterSpacing: "-0.035em", lineHeight: 1.45, width: "100%", margin: 0, wordBreak: "keep-all" as const };
  return <div id="nearby-container" style={{ width: 320 }}>
    <p ref={ref} style={style}>{text}</p>
    <SemanticWrap model={koTitleModel} strategy={nearbyIntegrationStrategy}>
      <p id="nearby-rendered" style={style}>{text}</p>
    </SemanticWrap>
    <output id="nearby-react-status" data-ready={String(selection !== null)}
      data-applied={String(selection?.applied)}
      data-lines={JSON.stringify(selection?.lines)} data-source={text} data-calls={nearbyIntegrationCalls} />
  </div>;
}

function LongBenchmarkFixture({ diagnostics }: { diagnostics: boolean }) {
  const { ref, selection } = useSemanticWrap({
    text: LONG_BENCHMARK_TEXT,
    model: koTitleModel,
    strategy: benchmarkStrategy,
    diagnostics,
  });
  useLayoutEffect(() => {
    const stats = browserBenchmarkStats();
    if (selection && stats?.pendingCommitStartedAt != null) {
      stats.commitDurations?.push(performance.now() - stats.pendingCommitStartedAt);
      stats.pendingCommitStartedAt = null;
    }
  }, [selection]);

  return (
    <section>
      <div id="benchmark-container" style={{ width: 320 }}>
        <p
          id="benchmark-title"
          ref={ref}
          style={{
            fontFamily: "system-ui",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "-0.035em",
            lineHeight: 1.45,
            margin: 0,
            width: "100%",
            wordBreak: "keep-all",
          }}
        >
          {LONG_BENCHMARK_TEXT}
        </p>
      </div>
      <output
        id="benchmark-status"
        data-breaks={selection?.breaks.join(",")}
        data-ready={String(selection !== null)}
        data-text-length={LONG_BENCHMARK_TEXT.length}
      />
    </section>
  );
}

const NATIVE_PARITY_CASES = [
  {
    id: "ko-keep-all",
    text: "복잡한 제품을 설계하고 운영하는 팀이 사용자에게 정말 필요한 경험을 제공하려면 충분한 검증이 필요합니다.",
    style: { width: 240, wordBreak: "keep-all" },
  },
  {
    id: "latin-normal",
    text: "Measure the exact native wrapping result across several widths without changing the visible source text.",
    style: { width: 210, wordBreak: "normal" },
  },
  {
    id: "break-all-emoji",
    text: "긴문장🙂withEmoji🚀andMixedScripts줄바꿈경계를정확히찾습니다",
    style: { width: 135, wordBreak: "break-all" },
  },
  {
    id: "pre-wrap",
    text: "multiple   spaces and\na preserved newline should map to the same source offsets",
    style: { width: 185, whiteSpace: "pre-wrap" },
  },
] as const;

function linearNativeBreaks(element: HTMLElement, text: string): number[] {
  const node = element.firstChild;
  if (!(node instanceof Text)) throw new Error("Parity fixture requires one text node");
  const offsets = [0];
  for (const character of text) offsets.push(offsets.at(-1)! + character.length);
  const range = document.createRange();
  const lineStarts: number[] = [];
  let previousTop: number | null = null;
  for (let index = 0; index < offsets.length - 1; index += 1) {
    range.setStart(node, offsets[index]!);
    range.setEnd(node, offsets[index + 1]!);
    const top = Math.round(range.getBoundingClientRect().top * 100) / 100;
    if (previousTop !== null && top !== previousTop) {
      let start = offsets[index]!;
      while (start > 0 && /\s/u.test(text[start - 1] ?? "")) start -= 1;
      if (start > 0 && start < text.length) lineStarts.push(start);
    }
    previousTop = top;
  }
  return [...new Set(lineStarts)];
}

function NativeLayoutParityFixture() {
  const containerRef = useRef<HTMLElement | null>(null);
  const [result, setResult] = useState<string>("");

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cases = NATIVE_PARITY_CASES.map(({ id, text }) => {
      const element = container.querySelector<HTMLElement>(`[data-case="${id}"]`)!;
      return {
        id,
        optimized: readNativeLayout(element, text).breaks,
        linear: linearNativeBreaks(element, text),
      };
    });
    setResult(JSON.stringify(cases));
  }, []);

  return (
    <section ref={containerRef}>
      {NATIVE_PARITY_CASES.map(({ id, text, style }) => (
        <p
          data-case={id}
          key={id}
          style={{
            fontFamily: "system-ui",
            fontSize: 17,
            lineHeight: 1.4,
            margin: 0,
            ...style,
          }}
        >
          {text}
        </p>
      ))}
      <output id="native-layout-parity">{result}</output>
    </section>
  );
}

function CandidateFixture() {
  const [alternate, setAlternate] = useState(false);
  const candidateModel: PhraseModel = {
    boundaryMode: "spaces",
    levels: [
      {
        name: alternate ? "alternate" : "initial",
        predictor: candidatePredictor,
        penalty: alternate ? 0.5 : 0,
      },
    ],
    fallbackPenalty: 1,
  };
  const { ref, selection } = useSemanticWrap({
    text: "하나 둘",
    model: candidateModel,
    strategy: candidateStrategy,
  });

  return (
    <section>
      <button id="change-candidate" onClick={() => setAlternate(true)} type="button">
        Change model
      </button>
      <output id="candidate-name">{selection?.selectedCandidates[0]?.name}</output>
      <h2 ref={ref} style={{ width: 200 }}>
        하나 둘
      </h2>
    </section>
  );
}

function ProgressiveFixture() {
  const [alternate, setAlternate] = useState(false);

  return (
    <section>
      <button id="change-progressive-strategy" onClick={() => setAlternate(true)} type="button">
        Change progressive strategy
      </button>
      <SemanticWrap
        mode="progressive"
        model={model}
        strategy={alternate ? alternateProgressiveStrategy : responsiveStrategy}
      >
        <h2 id="progressive-title" className="title" style={{ width: 200 }}>
          하나 둘 셋
        </h2>
      </SemanticWrap>
    </section>
  );
}

function RefFixture() {
  const [visible, setVisible] = useState(true);
  const [cleanupCount, setCleanupCount] = useState(0);
  const [objectAttached, setObjectAttached] = useState(false);
  const objectRef = useRef<HTMLHeadingElement | null>(null);
  const callbackRef = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    return () => setCleanupCount((count) => count + 1);
  }, []);

  useLayoutEffect(() => {
    setObjectAttached(objectRef.current !== null);
  }, [visible]);

  return (
    <section>
      <button id="unmount-ref-title" onClick={() => setVisible(false)} type="button">
        Unmount
      </button>
      <output
        id="ref-status"
        data-callback-cleanups={cleanupCount}
        data-object-attached={String(objectAttached)}
      />
      {visible ? (
        <SemanticWrap model={model} ref={callbackRef}>
          <h2 id="ref-title" ref={objectRef} style={{ width: 320 }}>
            하나 둘
          </h2>
        </SemanticWrap>
      ) : null}
    </section>
  );
}

function FontMeasurementFixture() {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [delta, setDelta] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measurer = createTextMeasurer(element);
    const range = document.createRange();
    range.selectNodeContents(element);
    setDelta(Math.abs(measurer.measureText(element.textContent ?? "") - range.getBoundingClientRect().width));
    measurer.dispose();
  }, []);

  return (
    <section>
      <span
        ref={textRef}
        style={{
          fontFamily: "system-ui",
          fontSize: 32,
          fontWeight: 720,
          letterSpacing: -1.8,
          whiteSpace: "pre",
        }}
      >
        당연해진 디자인시스템
      </span>
      <output id="font-measurement-delta">{delta}</output>
    </section>
  );
}

function KoreanAppliedFixture() {
  const text = "디자인 시스템을 도입하기 전에 반드시 확인해야 할 기준";
  const { ref, selection } = useSemanticWrap({
    text,
    model: koTitleModel,
    diagnostics: true,
  });

  return (
    <section>
      <p
        ref={ref}
        style={{
          fontFamily: "system-ui",
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.45,
          margin: 0,
          width: 320,
          wordBreak: "keep-all",
        }}
      >
        {text}
      </p>
      <output
        id="ko-applied-status"
        data-applied={selection ? String(selection.applied) : undefined}
      >
        {selection?.lines.join("\n")}
      </output>
    </section>
  );
}

function App() {
  if (new URLSearchParams(location.search).has("scheduling")) {
    return <SchedulingFixture config={schedulingConfig(new URLSearchParams(location.search))} />;
  }
  if (new URLSearchParams(location.search).has("resize-demo")) return <ResizeFixture longText={LONG_BENCHMARK_TEXT} />;
  const search = new URLSearchParams(window.location.search);
  if (search.has("candidate")) return <CandidateFixture />;
  if (search.has("nearby-react")) return <NearbyReactFixture />;
  if (search.get("benchmark") === "long") {
    return <LongBenchmarkFixture diagnostics={search.get("diagnostics") === "true"} />;
  }
  if (search.get("native-parity") === "true") return <NativeLayoutParityFixture />;

  return (
    <>
      <SemanticWrap model={model} strategy={responsiveStrategy}>
        <h1 id="title" className="title" style={{ width: 200 }}>
          하나 둘 셋
        </h1>
      </SemanticWrap>

      <ProgressiveFixture />

      <div id="atomic-container" style={{ width: 200 }}>
        <SemanticWrap model={model} strategy={switchingStrategy} resize="settled">
          <h2 id="atomic-title" className="title" style={{ width: "100%" }}>
            하나 둘 셋
          </h2>
        </SemanticWrap>
      </div>

      <SemanticWrap model={model} strategy={whitespaceStrategy}>
        <h2 id="whitespace-title" style={{ whiteSpace: "pre", width: 200 }}>
          {"하나  둘"}
        </h2>
      </SemanticWrap>

      <RefFixture />
      <CandidateFixture />
      <FontMeasurementFixture />
      <KoreanAppliedFixture />
    </>
  );
}

const app = new URLSearchParams(location.search).has("strict") ? <StrictMode><App /></StrictMode> : <App />;
if (new URLSearchParams(location.search).has("hydrate")) hydrateRoot(document.querySelector("#root")!, app);
else createRoot(document.querySelector("#root")!).render(app);
