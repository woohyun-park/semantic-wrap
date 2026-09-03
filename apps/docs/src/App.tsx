import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap, useSemanticWrap } from "@semantic-wrap/react";
import type {
  BreakCandidate,
  LineBreakDiagnostics,
  LineBreakLayout,
  LineBreakSelection,
} from "@semantic-wrap/core";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion as usePrefersReducedMotion,
  useScroll,
} from "motion/react";
import { DocsApp } from "./Docs";
import { IntroStory } from "./IntroStory";
import { KoreanSemanticWrap } from "./KoreanSemanticWrap";
import { demoHeadlines, lineBreakExamples } from "./landing-content";
import { easeOutExpo, revealMotion } from "./motion-values";
import { SiteFooter, SiteHeader } from "./site";

function useMeasureWidth(paneBodyRef: RefObject<HTMLDivElement | null>) {
  const previousMaxWidth = useRef(640);
  const [maxWidth, setMaxWidth] = useState(640);
  const [width, setWidth] = useState(480);

  useEffect(() => {
    const paneBody = paneBodyRef.current;
    if (!paneBody) return undefined;

    const syncAvailableWidth = () => {
      const styles = window.getComputedStyle(paneBody);
      const inlinePadding =
        Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const availableWidth = paneBody.clientWidth - inlinePadding;
      const nextMaxWidth = Math.max(
        240,
        Math.min(640, Math.floor(availableWidth / 2) * 2),
      );
      const previousMax = previousMaxWidth.current;

      setMaxWidth(nextMaxWidth);
      setWidth((current) => {
        if (current >= previousMax - 2 && nextMaxWidth > previousMax) {
          return Math.min(nextMaxWidth, Math.max(current, 480));
        }
        return Math.min(current, nextMaxWidth);
      });
      previousMaxWidth.current = nextMaxWidth;
    };

    syncAvailableWidth();
    const observer = new ResizeObserver(syncAvailableWidth);
    observer.observe(paneBody);
    return () => observer.disconnect();
  }, [paneBodyRef]);

  return { maxWidth, setWidth, width };
}

function renderWithBreaks(text: string, breaks: readonly number[]): ReactNode {
  if (breaks.length === 0) return text;

  const content: ReactNode[] = [];
  let start = 0;

  for (const offset of breaks) {
    content.push(text.slice(start, offset).trimEnd());
    content.push(<br key={`break-${offset}`} />);
    start = offset;
    while (start < text.length && /\s/u.test(text[start] ?? "")) start += 1;
  }

  content.push(text.slice(start));
  return <Fragment>{content}</Fragment>;
}

function lineIndexAt(offset: number, breaks: readonly number[]): number {
  let lineIndex = 0;
  for (const breakOffset of breaks) {
    if (offset < breakOffset) break;
    lineIndex += 1;
  }
  return lineIndex;
}

function renderSemanticDiff(
  text: string,
  semanticBreaks: readonly number[],
  nativeBreaks: readonly number[],
): ReactNode {
  if (semanticBreaks.length === 0) return text;

  const content: ReactNode[] = [];
  let lineStart = 0;

  for (const [semanticLineIndex, lineEnd] of [...semanticBreaks, text.length].entries()) {
    const rawLine = text.slice(lineStart, lineEnd);
    const leadingSpace = rawLine.match(/^\s*/u)?.[0].length ?? 0;
    const trailingSpace = rawLine.match(/\s*$/u)?.[0].length ?? 0;
    const visibleLine = rawLine.slice(leadingSpace, rawLine.length - trailingSpace);
    let cursor = lineStart + leadingSpace;

    for (const part of visibleLine.match(/\s+|\S+/gu) ?? []) {
      const partStart = cursor;
      cursor += part.length;
      const isWord = /\S/u.test(part);
      const changed = isWord && lineIndexAt(partStart, nativeBreaks) !== semanticLineIndex;
      content.push(
        changed ? (
          <span className="semantic-diff-changed" key={`changed-${partStart}`}>{part}</span>
        ) : (
          <Fragment key={`text-${partStart}`}>{part}</Fragment>
        ),
      );
    }

    if (lineEnd < text.length) content.push(<br key={`break-${lineEnd}`} />);
    lineStart = lineEnd;
  }

  return <Fragment>{content}</Fragment>;
}

function Playground() {
  const paneBodyRef = useRef<HTMLDivElement>(null);
  const dragPointerRef = useRef<number | null>(null);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [measureDragging, setMeasureDragging] = useState(false);
  const { maxWidth, setWidth, width } = useMeasureWidth(paneBodyRef);
  const text = demoHeadlines[headlineIndex] ?? demoHeadlines[0] ?? "";
  const { ref, selection, diagnostics } = useSemanticWrap({
    text,
    model: koTitleModel,
    diagnostics: true,
  });
  const currentSelection = selection?.text === text ? selection : null;
  const currentDiagnostics = currentSelection ? diagnostics : null;
  const semanticBreaks = currentSelection?.breaks ?? [];
  const nativeBreaks = currentDiagnostics?.nativeLayout?.breaks ?? [];
  const nativeLineCount = currentDiagnostics?.nativeLayout?.lineCount ?? 1;
  const semanticLineCount = currentSelection?.lines.length ?? nativeLineCount;

  function setWidthFromPointer(event: ReactPointerEvent<HTMLSpanElement>) {
    const paneBody = event.currentTarget.closest<HTMLElement>(".measure-pane-body");
    if (!paneBody) return;

    const bounds = paneBody.getBoundingClientRect();
    const styles = window.getComputedStyle(paneBody);
    const contentLeft = bounds.left + Number.parseFloat(styles.paddingLeft);
    const nextWidth = Math.round((event.clientX - contentLeft) / 2) * 2;
    setWidth(Math.max(240, Math.min(maxWidth, nextWidth)));
  }

  function startMeasureDrag(event: ReactPointerEvent<HTMLSpanElement>) {
    dragPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setMeasureDragging(true);
    setWidthFromPointer(event);
    event.preventDefault();
  }

  function moveMeasureDrag(event: ReactPointerEvent<HTMLSpanElement>) {
    if (dragPointerRef.current !== event.pointerId) return;
    setWidthFromPointer(event);
  }

  function finishMeasureDrag(event: ReactPointerEvent<HTMLSpanElement>) {
    if (dragPointerRef.current !== event.pointerId) return;
    dragPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setMeasureDragging(false);
  }

  return (
    <section
      className="playground-section"
      id="playground"
      aria-labelledby="playground-title"
    >
      <div className="page-width">
        <motion.div className="playground-intro" {...revealMotion}>
          <h2 id="playground-title">Playground</h2>
        </motion.div>

        <div className={`measure-instrument${measureDragging ? " is-dragging" : ""}`}>
          <div className="headline-presets" role="group" aria-label="예시 제목 선택">
            {demoHeadlines.map((headline, index) => (
              <button
                type="button"
                key={headline}
                className={index === headlineIndex ? "is-current" : undefined}
                aria-pressed={index === headlineIndex}
                onClick={() => setHeadlineIndex(index)}
              >
                <span>예시 0{index + 1}</span>
                <SemanticWrap model={koTitleModel}>
                  <strong>{headline}</strong>
                </SemanticWrap>
              </button>
            ))}
          </div>

          <div className="measure-comparison">
            <article className="measure-pane is-browser" aria-labelledby="browser-measure-label">
              <div className="measure-pane-head">
                <span id="browser-measure-label"><b>01</b> 브라우저 기본</span>
                <span>{nativeLineCount}줄</span>
              </div>
              <div className="measure-pane-body" ref={paneBodyRef}>
                <div className="headline-measure" style={{ width: `${width}px` }}>
                  <span className="measure-edge measure-edge-left" aria-hidden="true" />
                  <h3 ref={ref} className="demo-headline demo-headline-measure-source" lang="ko" aria-hidden="true">
                    {text}
                  </h3>
                  <h3 className="demo-headline" lang="ko">
                    {renderWithBreaks(text, nativeBreaks)}
                  </h3>
                  <span className="measure-edge measure-edge-right" aria-hidden="true" />
                  <span
                    className="measure-drag-handle"
                    aria-hidden="true"
                    onPointerDown={startMeasureDrag}
                    onPointerMove={moveMeasureDrag}
                    onPointerUp={finishMeasureDrag}
                    onPointerCancel={finishMeasureDrag}
                  />
                </div>
              </div>
            </article>

            <article className="measure-pane is-semantic" aria-labelledby="semantic-measure-label">
              <div className="measure-pane-head">
                <span id="semantic-measure-label"><b>02</b> semantic-wrap</span>
                <span>{semanticLineCount}줄</span>
              </div>
              <div className="measure-pane-body">
                <div className="headline-measure" style={{ width: `${width}px` }}>
                  <span className="measure-edge measure-edge-left" aria-hidden="true" />
                  <h3 className="demo-headline" lang="ko">
                    {renderSemanticDiff(text, semanticBreaks, nativeBreaks)}
                  </h3>
                  <span className="measure-edge measure-edge-right" aria-hidden="true" />
                  <span
                    className="measure-drag-handle"
                    aria-hidden="true"
                    onPointerDown={startMeasureDrag}
                    onPointerMove={moveMeasureDrag}
                    onPointerUp={finishMeasureDrag}
                    onPointerCancel={finishMeasureDrag}
                  />
                </div>
              </div>
            </article>
          </div>

          <div className="instrument-controls">
            <div className="range-control">
              <input
                id="measure-width"
                type="range"
                aria-label="제목 컨테이너 너비"
                min="240"
                max={maxWidth}
                step="2"
                value={width}
                aria-valuetext={`${width}픽셀`}
                onChange={(event) => setWidth(Number(event.currentTarget.value))}
              />
              <div className="range-scale" aria-hidden="true">
                <span>240px</span>
                <span>{maxWidth}px</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <main id="main-content">
      <IntroStory />

      <ProcessSection />
      <Playground />
    </main>
  );
}

const processSteps = [
  {
    number: "01",
    title: "경계를 찾고",
    description: "언어 모델이 문장 안에서 자연스럽게 끊을 수 있는 후보를 예측합니다.",
  },
  {
    number: "02",
    title: "실제로 재고",
    description: "현재 글꼴과 컨테이너 너비로 가능한 레이아웃을 브라우저에서 측정합니다.",
  },
  {
    number: "03",
    title: "더 나은 쪽을 고릅니다",
    description: "의미 비용이 낮고 줄 균형도 허용 범위 안인 결과만 실제 화면에 적용합니다.",
  },
];

const processExampleText = demoHeadlines[2] ?? "";
const processSemanticReason = lineBreakExamples[2]?.semanticDescription
  ?? "의미가 이어지는 표현을 같은 줄에 유지했습니다.";
const processMeasureWidth = 220;

type ProcessLayoutEntry = {
  id: string;
  layout: LineBreakLayout;
  source: "browser" | "calculated";
};

function getProcessLayoutEntries(
  diagnostics: LineBreakDiagnostics | null,
): readonly ProcessLayoutEntry[] {
  if (!diagnostics) return [];

  const nativeEntry = diagnostics.nativeLayout
    ? [{
        id: "N",
        layout: diagnostics.nativeLayout,
        source: "browser" as const,
      }]
    : [];
  const calculatedEntries = diagnostics.calculatedLayouts.map((layout, index) => ({
    id: String.fromCharCode(65 + index),
    layout,
    source: "calculated" as const,
  }));

  return [...nativeEntry, ...calculatedEntries];
}

function ProcessCandidates({
  candidates,
}: {
  candidates: readonly BreakCandidate[];
}) {
  const segments: { candidate?: BreakCandidate; text: string }[] = [];
  let start = 0;

  for (const candidate of candidates) {
    segments.push({
      candidate,
      text: processExampleText.slice(start, candidate.offset).trim(),
    });
    start = candidate.offset;
  }
  segments.push({ text: processExampleText.slice(start).trim() });

  return (
    <p
      className="process-candidates"
      lang="ko"
      aria-label={`실제 모델이 찾은 줄바꿈 후보: ${processExampleText}`}
    >
      {segments.map((segment, index) => (
        <Fragment key={`${segment.candidate?.offset ?? "end"}-${segment.text}`}>
          <span>{segment.text}</span>
          {segment.candidate ? (
            <i
              className={segment.candidate.level === null ? "is-fallback" : "is-predicted"}
              title={
                segment.candidate.level === null
                  ? "공백 기반 보조 후보"
                  : `${segment.candidate.name ?? "모델"} 예측 후보`
              }
              aria-hidden="true"
            >
              ↵?
            </i>
          ) : null}
        </Fragment>
      ))}
    </p>
  );
}

function ProcessLayoutOptions({
  diagnostics,
}: {
  diagnostics: LineBreakDiagnostics | null;
}) {
  const layouts = getProcessLayoutEntries(diagnostics);
  const shouldReduceMotion = Boolean(usePrefersReducedMotion());

  if (layouts.length === 0) {
    return <p className="process-diagnostics-loading">현재 글꼴과 너비를 측정하고 있습니다…</p>;
  }

  return (
    <div
      className="process-layout-options"
      aria-label="실제로 측정한 레이아웃 후보"
    >
      {layouts.map((entry, index) => {
        return (
          <motion.article
            className="process-layout-option"
            key={`${entry.source}-${entry.id}`}
            animate={shouldReduceMotion
              ? undefined
              : { borderColor: ["#3a4250", "rgb(144 189 249 / 72%)", "#3a4250"] }}
            transition={{
              delay: index * 0.18,
              duration: 1.8,
              ease: easeOutExpo,
              repeat: Infinity,
            }}
          >
            <span className="process-layout-id">{entry.id}</span>
            <p lang="ko">
              {entry.layout.lines.map((line, lineIndex) => (
                <Fragment key={`${entry.id}-${lineIndex}-${line}`}>
                  {line}
                  {lineIndex < entry.layout.lines.length - 1 ? <br /> : null}
                </Fragment>
              ))}
            </p>
            <span className="process-layout-state">
              <span>균형 비용 {entry.layout.balanceScore.toFixed(2)}</span>
              <span>의미 비용 {entry.layout.modelCost.toFixed(2)}</span>
            </span>
          </motion.article>
        );
      })}
    </div>
  );
}

function ProcessSelectionComparison({
  diagnostics,
  selection,
}: {
  diagnostics: LineBreakDiagnostics | null;
  selection: LineBreakSelection | null;
}) {
  const nativeLayout = diagnostics?.nativeLayout;
  if (!nativeLayout || !selection) {
    return <p className="process-diagnostics-loading">실제 선택 결과를 계산하고 있습니다…</p>;
  }

  return (
    <div
      className="process-selection-comparison"
      data-result={selection.applied ? "applied" : "native"}
      aria-label="실제로 측정한 현재 CSS 결과와 semantic-wrap 선택 결과"
    >
      <article className="process-selection-card is-native">
        <span aria-label="BEFORE · 현재 CSS">BEFORE</span>
        <p lang="ko">{renderWithBreaks(processExampleText, nativeLayout.breaks)}</p>
      </article>
      <span className="process-selection-arrow" aria-hidden="true">↓</span>
      <article className="process-selection-card is-semantic">
        <span aria-label="AFTER · semantic-wrap 적용 결과">AFTER</span>
        <p lang="ko">
          {renderSemanticDiff(processExampleText, selection.breaks, nativeLayout.breaks)}
        </p>
      </article>
    </div>
  );
}

function ProcessStage({ activeStep }: { activeStep: number }) {
  const { ref, selection, diagnostics } = useSemanticWrap({
    text: processExampleText,
    model: koTitleModel,
    diagnostics: true,
  });
  const currentSelection = selection?.text === processExampleText ? selection : null;
  const currentDiagnostics = currentSelection ? diagnostics : null;
  const layoutEntries = getProcessLayoutEntries(currentDiagnostics);
  const predictedOffsets = new Set(
    currentDiagnostics?.predictions.map((prediction) => prediction.offset) ?? [],
  );
  const processStageStatus = currentDiagnostics
    ? [
        `실제 진단 · 후보 ${currentDiagnostics.candidates.length}개 · 모델 예측 ${predictedOffsets.size}개`,
        `${processMeasureWidth}px 실측 · 현재 CSS안 포함 ${layoutEntries.length}개 레이아웃`,
        currentSelection?.applied
          ? processSemanticReason
          : "브라우저 기본 줄바꿈이 이미 가장 적합해 변경하지 않았습니다.",
      ]
    : [
        "실제 모델 응답을 불러오고 있습니다",
        "현재 글꼴과 컨테이너 너비를 측정하고 있습니다",
        "실제 선택 결과를 계산하고 있습니다",
      ];

  return (
    <motion.aside
      className="process-stage"
      id="process-stage"
      aria-label="작동 방식 실시간 미리보기"
      {...revealMotion}
    >
      <div className="process-stage-head">
        <strong>0{activeStep + 1} / 03</strong>
      </div>
      <p
        className="process-measure-source"
        ref={ref}
        aria-hidden="true"
        lang="ko"
        style={{ "--process-measure-width": `${processMeasureWidth}px` } as CSSProperties}
      >
        {processExampleText}
      </p>
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          className={`process-stage-scene is-step-${activeStep + 1}`}
          key={activeStep}
          initial={{ opacity: 0, scale: 0.985, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.99, y: -10 }}
          transition={{ duration: 0.38, ease: easeOutExpo }}
        >
          {activeStep === 0 ? (
            currentDiagnostics
              ? <ProcessCandidates candidates={currentDiagnostics.candidates} />
              : <p className="process-diagnostics-loading">실제 후보를 계산하고 있습니다…</p>
          ) : null}
          {activeStep === 1 ? (
            <ProcessLayoutOptions diagnostics={currentDiagnostics} />
          ) : null}
          {activeStep === 2 ? (
            <ProcessSelectionComparison
              diagnostics={currentDiagnostics}
              selection={currentSelection}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
      <p className="process-stage-status" aria-live="polite">
        <span aria-hidden="true" />
        {processStageStatus[activeStep]}
      </p>
    </motion.aside>
  );
}

function ProcessSection() {
  const listRef = useRef<HTMLOListElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start center", "end center"],
  });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const nextStep = Math.min(
      processSteps.length - 1,
      Math.max(0, Math.round(progress * (processSteps.length - 1))),
    );
    setActiveStep((current) => current === nextStep ? current : nextStep);
  });

  return (
    <section className="process-section" id="process" aria-labelledby="process-title">
      <div className="page-width">
        <motion.div className="section-intro" {...revealMotion}>
          <KoreanSemanticWrap>
            <h2 id="process-title">모델이 제안하고, 브라우저가 검증합니다.</h2>
          </KoreanSemanticWrap>
          <KoreanSemanticWrap>
            <p>모델이 찾은 의미 경계와 실제 렌더링 너비를 함께 비교해, 바꿀 가치가 있는 줄바꿈만 적용합니다.</p>
          </KoreanSemanticWrap>
        </motion.div>

        <div className="process-workbench">
          <ProcessStage activeStep={activeStep} />
          <ol className="process-list" ref={listRef}>
            {processSteps.map((step, index) => (
              <li
                key={step.number}
                data-process-step={index}
                className={index === activeStep ? "is-current" : undefined}
                aria-current={index === activeStep ? "step" : undefined}
              >
                <button
                  type="button"
                  aria-controls="process-stage"
                  aria-pressed={index === activeStep}
                  onClick={() => setActiveStep(index)}
                  onFocus={() => setActiveStep(index)}
                  onPointerEnter={() => setActiveStep(index)}
                >
                  <span className="process-number">{step.number}</span>
                  <span className="process-step-copy">
                    <KoreanSemanticWrap>
                      <strong>{step.title}</strong>
                    </KoreanSemanticWrap>
                    <span>{step.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function App() {
  if (window.location.pathname.startsWith("/ko/docs")) {
    return <DocsApp />;
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">본문으로 바로가기</a>
      <SiteHeader hideBrandWhile=".hero-brand-visibility-sentinel" />
      <Hero />
      <SiteFooter />
    </div>
  );
}
