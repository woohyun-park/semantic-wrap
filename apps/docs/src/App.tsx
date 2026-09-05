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
import { landingContent, type LandingContent } from "./landing-content";
import { LocalizedSemanticWrap } from "./LocalizedSemanticWrap";
import { easeOutExpo, revealMotion } from "./motion-values";
import { SiteFooter, SiteHeader } from "./site";
import { titleModels } from "./site-models";
import {
  docsPath,
  landingPath,
  localeFromPath,
  productionUrl,
  type SiteLocale,
} from "./site-config";

function availableMeasureWidth(paneBody: HTMLElement): number {
  const styles = window.getComputedStyle(paneBody);
  const inlinePadding =
    Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
  return Math.max(
    240,
    Math.min(640, Math.floor((paneBody.clientWidth - inlinePadding) / 2) * 2),
  );
}

function useMeasureWidth(paneBodyRef: RefObject<HTMLDivElement | null>) {
  const previousMaxWidth = useRef(640);
  const [maxWidth, setMaxWidth] = useState(640);
  const [width, setWidth] = useState(414);

  useEffect(() => {
    const paneBody = paneBodyRef.current;
    if (!paneBody) return undefined;

    const syncAvailableWidth = () => {
      const nextMaxWidth = availableMeasureWidth(paneBody);
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

function useInitialLandingHash(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !window.location.hash) return undefined;

    let frame = 0;
    let cancelled = false;
    let attempts = 0;
    let stableFrames = 0;
    const root = document.documentElement;

    const cancelAlignment = () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };

    const alignHashTarget = () => {
      if (cancelled) return;
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = document.getElementById(id);
      if (!target) return;

      const header = document.querySelector<HTMLElement>(".site-header");
      const alignmentTarget = id === "playground"
        ? document.getElementById("playground-title") ?? target
        : target;
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      const alignmentMargin = Number.parseFloat(
        window.getComputedStyle(alignmentTarget).scrollMarginTop,
      );
      const alignmentGap = id === "playground" && Number.isFinite(alignmentMargin)
        ? alignmentMargin
        : 0;
      let targetTop = 0;
      let offsetNode: HTMLElement | null = alignmentTarget;
      while (offsetNode) {
        targetTop += offsetNode.offsetTop;
        offsetNode = offsetNode.offsetParent as HTMLElement | null;
      }
      const delta = targetTop - window.scrollY - headerBottom - alignmentGap;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo({
        behavior: "auto",
        top: Math.max(0, window.scrollY + delta),
      });
      root.style.scrollBehavior = previousScrollBehavior;

      attempts += 1;
      stableFrames = Math.abs(delta) < 0.5 ? stableFrames + 1 : 0;
      if (stableFrames < 2 && attempts < 60) {
        frame = window.requestAnimationFrame(alignHashTarget);
      }
    };

    const userEvents = ["keydown", "pointerdown", "touchstart", "wheel"] as const;
    for (const eventName of userEvents) {
      window.addEventListener(eventName, cancelAlignment, { passive: true, once: true });
    }

    void document.fonts.ready.then(() => {
      if (!cancelled) frame = window.requestAnimationFrame(alignHashTarget);
    });

    return () => {
      cancelAlignment();
      for (const eventName of userEvents) {
        window.removeEventListener(eventName, cancelAlignment);
      }
    };
  }, [enabled]);
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
          <span className="gradient-text-safe semantic-diff-changed" key={`changed-${partStart}`}>{part}</span>
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

function Playground({ locale }: { locale: SiteLocale }) {
  const content = landingContent[locale];
  const { examples, playground } = content;
  const model = titleModels[locale];
  const paneBodyRef = useRef<HTMLDivElement>(null);
  const dragPointerRef = useRef<number | null>(null);
  const dragContentLeftRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);
  const widthFrameRef = useRef<number | null>(null);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [measureDragging, setMeasureDragging] = useState(false);
  const { maxWidth, setWidth, width } = useMeasureWidth(paneBodyRef);
  const currentExample = examples[headlineIndex] ?? examples[0];
  const text = currentExample.text;
  const { ref, selection, diagnostics } = useSemanticWrap({
    text,
    model,
    diagnostics: true,
  });
  const currentSelection = selection?.text === text ? selection : null;
  const currentDiagnostics = currentSelection ? diagnostics : null;
  const semanticBreaks = currentSelection?.breaks ?? [];
  const nativeBreaks = currentDiagnostics?.nativeLayout?.breaks ?? [];
  const nativeLineCount = currentDiagnostics?.nativeLayout?.lineCount ?? 1;
  const semanticLineCount = currentSelection?.lines.length ?? nativeLineCount;

  useEffect(() => () => {
    if (widthFrameRef.current !== null) {
      window.cancelAnimationFrame(widthFrameRef.current);
    }
  }, []);

  function scheduleWidth(nextWidth: number) {
    pendingWidthRef.current = nextWidth;
    if (widthFrameRef.current !== null) return;
    widthFrameRef.current = window.requestAnimationFrame(() => {
      widthFrameRef.current = null;
      const pendingWidth = pendingWidthRef.current;
      pendingWidthRef.current = null;
      if (pendingWidth !== null) setWidth(pendingWidth);
    });
  }

  function flushScheduledWidth() {
    if (widthFrameRef.current !== null) {
      window.cancelAnimationFrame(widthFrameRef.current);
      widthFrameRef.current = null;
    }
    const pendingWidth = pendingWidthRef.current;
    pendingWidthRef.current = null;
    if (pendingWidth !== null) setWidth(pendingWidth);
  }

  function setWidthFromPointer(event: ReactPointerEvent<HTMLSpanElement>) {
    const contentLeft = dragContentLeftRef.current;
    if (contentLeft === null) return;
    const nextWidth = Math.round((event.clientX - contentLeft) / 2) * 2;
    scheduleWidth(Math.max(240, Math.min(maxWidth, nextWidth)));
  }

  function startMeasureDrag(event: ReactPointerEvent<HTMLSpanElement>) {
    const paneBody = event.currentTarget.closest<HTMLElement>(".measure-pane-body");
    if (!paneBody) return;
    const bounds = paneBody.getBoundingClientRect();
    const styles = window.getComputedStyle(paneBody);
    dragContentLeftRef.current = bounds.left + Number.parseFloat(styles.paddingLeft);
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
    dragContentLeftRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    flushScheduledWidth();
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

        <div
          className={`measure-instrument${measureDragging ? " is-dragging" : ""}`}
          data-result={currentSelection?.applied ? "applied" : "native"}
          data-semantic-phrase={currentExample.semanticPhrase}
        >
          <div className="headline-presets" role="group" aria-label={playground.presetLabel}>
            {examples.map((example, index) => (
              <button
                type="button"
                key={example.id}
                className={index === headlineIndex ? "is-current" : undefined}
                aria-pressed={index === headlineIndex}
                onClick={() => {
                  const availableWidth = paneBodyRef.current
                    ? availableMeasureWidth(paneBodyRef.current)
                    : maxWidth;
                  setHeadlineIndex(index);
                  setWidth(
                    example.playgroundMeasures.find((measure) => measure <= availableWidth)
                      ?? Math.min(240, availableWidth),
                  );
                }}
              >
                <span className="gradient-text-safe">{playground.example} 0{index + 1}</span>
                <SemanticWrap model={model}>
                  <strong>{example.text}</strong>
                </SemanticWrap>
              </button>
            ))}
          </div>

          <div className="measure-comparison">
            <article className="measure-pane is-browser" aria-labelledby="browser-measure-label">
              <div className="measure-pane-head">
                <span id="browser-measure-label"><b className="gradient-text-safe">01</b> {playground.browser}</span>
                <span>{playground.lines(nativeLineCount)}</span>
              </div>
              <div className="measure-pane-body" ref={paneBodyRef}>
                <div className="headline-measure" style={{ width: `${width}px` }}>
                  <span className="measure-edge measure-edge-left" aria-hidden="true" />
                  <h3 ref={ref} className="demo-headline demo-headline-measure-source" lang={locale} aria-hidden="true">
                    {text}
                  </h3>
                  <h3 className="demo-headline" lang={locale}>
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
                <span className="gradient-text-safe" id="semantic-measure-label"><b>02</b> {playground.semantic}</span>
                <span className="gradient-text-safe">{playground.lines(semanticLineCount)}</span>
              </div>
              <div className="measure-pane-body">
                <div className="headline-measure" style={{ width: `${width}px` }}>
                  <span className="measure-edge measure-edge-left" aria-hidden="true" />
                  <h3 className="demo-headline" lang={locale}>
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
                aria-label={playground.widthLabel}
                min="240"
                max={maxWidth}
                step="2"
                value={width}
                aria-valuetext={playground.widthValue(width)}
                onChange={(event) => scheduleWidth(Number(event.currentTarget.value))}
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

function Hero({ locale }: { locale: SiteLocale }) {
  return (
    <main id="main-content">
      <IntroStory locale={locale} />

      <ProcessSection locale={locale} />
      <Playground locale={locale} />
    </main>
  );
}

type ProcessLayoutEntry = {
  id: string;
  layout: LineBreakLayout;
  source: "browser" | "calculated";
};

function getProcessLayoutEntries(
  diagnostics: LineBreakDiagnostics | null,
): readonly ProcessLayoutEntry[] {
  if (!diagnostics) return [];

  const nativeBreaks = diagnostics.nativeLayout?.breaks.join(":");
  const nativeEntry = diagnostics.nativeLayout
    ? [{
        id: "N",
        layout: diagnostics.nativeLayout,
        source: "browser" as const,
      }]
    : [];
  const calculatedEntries: ProcessLayoutEntry[] = [];
  for (const layout of diagnostics.calculatedLayouts) {
    if (layout.breaks.join(":") === nativeBreaks) continue;
    calculatedEntries.push({
      id: String.fromCharCode(65 + calculatedEntries.length),
      layout,
      source: "calculated",
    });
  }

  return [...nativeEntry, ...calculatedEntries];
}

function ProcessCandidates({
  candidates,
  content,
  locale,
  text,
}: {
  candidates: readonly BreakCandidate[];
  content: LandingContent;
  locale: SiteLocale;
  text: string;
}) {
  const segments: { candidate?: BreakCandidate; text: string }[] = [];
  let start = 0;

  for (const candidate of candidates) {
    segments.push({
      candidate,
      text: text.slice(start, candidate.offset).trim(),
    });
    start = candidate.offset;
  }
  segments.push({ text: text.slice(start).trim() });

  return (
    <p
      className="process-candidates"
      lang={locale}
      aria-label={`${content.process.candidateLabel}: ${text}`}
    >
      {segments.map((segment) => (
        <Fragment key={`${segment.candidate?.offset ?? "end"}-${segment.text}`}>
          <span>{segment.text}</span>
          {segment.candidate ? (
            <i
              className={`gradient-text-safe ${segment.candidate.level === null ? "is-fallback" : "is-predicted"}`}
              title={
                segment.candidate.level === null
                  ? content.process.fallbackCandidate
                  : content.process.predictedCandidate(segment.candidate.name ?? "model")
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
  content,
  diagnostics,
  locale,
}: {
  content: LandingContent;
  diagnostics: LineBreakDiagnostics | null;
  locale: SiteLocale;
}) {
  const layouts = getProcessLayoutEntries(diagnostics);
  const shouldReduceMotion = Boolean(usePrefersReducedMotion());

  if (layouts.length === 0) {
    return <p className="process-diagnostics-loading">{content.process.measureLoading}</p>;
  }

  return (
    <div
      className="process-layout-options"
      lang={locale}
      aria-label={content.process.layoutLabel}
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
            <span className="gradient-text-safe process-layout-id">{entry.id}</span>
            <p lang={locale}>
              {entry.layout.lines.map((line, lineIndex) => (
                <Fragment key={`${entry.id}-${lineIndex}-${line}`}>
                  {line}
                  {lineIndex < entry.layout.lines.length - 1 ? <br /> : null}
                </Fragment>
              ))}
            </p>
            <span className="process-layout-state">
              <span>{content.process.balanceCost} {entry.layout.balanceScore.toFixed(2)}</span>
              <span>{content.process.semanticCost} {entry.layout.modelCost.toFixed(2)}</span>
            </span>
          </motion.article>
        );
      })}
    </div>
  );
}

function ProcessSelectionComparison({
  content,
  diagnostics,
  locale,
  selection,
  text,
}: {
  content: LandingContent;
  diagnostics: LineBreakDiagnostics | null;
  locale: SiteLocale;
  selection: LineBreakSelection | null;
  text: string;
}) {
  const nativeLayout = diagnostics?.nativeLayout;
  if (!nativeLayout || !selection) {
    return <p className="process-diagnostics-loading">{content.process.selectionLoading}</p>;
  }

  return (
    <div
      className="process-selection-comparison"
      data-result={selection.applied ? "applied" : "native"}
      data-semantic-phrase={content.process.semanticPhrase}
      aria-label={content.process.selectionLabel}
    >
      <article className="process-selection-card is-native">
        <span aria-label={content.process.beforeLabel}>BEFORE</span>
        <p lang={locale}>{renderWithBreaks(text, nativeLayout.breaks)}</p>
      </article>
      <span className="process-selection-arrow" aria-hidden="true">↓</span>
      <article className="process-selection-card is-semantic">
        <span aria-label={content.process.afterLabel}>AFTER</span>
        <p lang={locale}>
          {renderSemanticDiff(text, selection.breaks, nativeLayout.breaks)}
        </p>
      </article>
    </div>
  );
}

function ProcessStage({ activeStep, locale }: { activeStep: number; locale: SiteLocale }) {
  const content = landingContent[locale];
  const processExampleText = content.process.example;
  const processSemanticReason = content.process.selectionReason;
  const processMeasureWidth = content.process.measureWidth;
  const { ref, selection, diagnostics } = useSemanticWrap({
    text: processExampleText,
    model: titleModels[locale],
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
        content.process.diagnostic(currentDiagnostics.candidates.length, predictedOffsets.size),
        content.process.measurement(processMeasureWidth, layoutEntries.length),
        currentSelection?.applied
          ? processSemanticReason
          : content.process.nativeKept,
      ]
    : [
        content.process.candidateLoading,
        content.process.measureLoading,
        content.process.selectionLoading,
      ];

  return (
    <motion.aside
      className="process-stage"
      id="process-stage"
      aria-label={content.process.ariaLabel}
      {...revealMotion}
    >
      <div className="process-stage-head">
        <strong className="gradient-text-safe">0{activeStep + 1} / 03</strong>
      </div>
      <p
        className="process-measure-source"
        ref={ref}
        aria-hidden="true"
        lang={locale}
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
              ? <ProcessCandidates candidates={currentDiagnostics.candidates} content={content} locale={locale} text={processExampleText} />
              : <p className="process-diagnostics-loading">{content.process.candidateLoading}</p>
          ) : null}
          {activeStep === 1 ? (
            <ProcessLayoutOptions content={content} diagnostics={currentDiagnostics} locale={locale} />
          ) : null}
          {activeStep === 2 ? (
            <ProcessSelectionComparison
              content={content}
              diagnostics={currentDiagnostics}
              locale={locale}
              selection={currentSelection}
              text={processExampleText}
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

function ProcessSection({ locale }: { locale: SiteLocale }) {
  const content = landingContent[locale];
  const processSteps = content.process.steps;
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
          <LocalizedSemanticWrap locale={locale}>
            <h2 id="process-title">{content.process.title}</h2>
          </LocalizedSemanticWrap>
          <LocalizedSemanticWrap locale={locale}>
            <p>{content.process.lead}</p>
          </LocalizedSemanticWrap>
        </motion.div>

        <div className="process-workbench">
          <ProcessStage activeStep={activeStep} locale={locale} />
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
                  <span className="gradient-text-safe process-number">{step.number}</span>
                  <span className="process-step-copy">
                    <LocalizedSemanticWrap locale={locale}>
                      <strong>{step.title}</strong>
                    </LocalizedSemanticWrap>
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
  const locale = localeFromPath(window.location.pathname);
  const isDocs = window.location.pathname === "/docs"
    || window.location.pathname.startsWith("/docs/")
    || window.location.pathname === "/ko/docs"
    || window.location.pathname.startsWith("/ko/docs/");

  useInitialLandingHash(!isDocs);

  useEffect(() => {
    const canonicalPath = isDocs ? docsPath(locale) : landingPath(locale);
    const alternateLocale = locale === "en" ? "ko" : "en";
    const alternatePath = isDocs ? docsPath(alternateLocale) : landingPath(alternateLocale);
    const description = locale === "ko"
      ? "학습된 모델과 실제 렌더링 결과를 바탕으로 더 자연스러운 줄바꿈을 선택하는 JavaScript 라이브러리"
      : "A JavaScript library that selects natural line breaks from a trained model and the actual rendered layout.";

    document.documentElement.lang = locale;
    document.title = isDocs
      ? locale === "ko" ? "semantic-wrap 소개 | 문서" : "Introduction | semantic-wrap docs"
      : locale === "ko" ? "semantic-wrap — 의미를 지키는 줄바꿈" : "semantic-wrap — line breaks that preserve meaning";
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", description);

    document.querySelectorAll("link[data-semantic-wrap-locale]").forEach((link) => link.remove());
    for (const attributes of [
      { rel: "canonical", href: `${productionUrl}${canonicalPath}` },
      { rel: "alternate", href: `${productionUrl}${locale === "en" ? canonicalPath : alternatePath}`, hrefLang: "en" },
      { rel: "alternate", href: `${productionUrl}${locale === "ko" ? canonicalPath : alternatePath}`, hrefLang: "ko" },
      { rel: "alternate", href: `${productionUrl}${locale === "en" ? canonicalPath : alternatePath}`, hrefLang: "x-default" },
    ]) {
      const link = document.createElement("link");
      link.dataset.semanticWrapLocale = "true";
      link.rel = attributes.rel;
      link.href = attributes.href;
      if (attributes.hrefLang) link.hreflang = attributes.hrefLang;
      document.head.append(link);
    }
  }, [isDocs, locale]);

  if (isDocs) return <DocsApp locale={locale} />;

  const skipLabel = locale === "ko" ? "본문으로 바로가기" : "Skip to content";

  return (
    <div className="site-shell" data-locale={locale}>
      <a className="skip-link" href="#main-content">{skipLabel}</a>
      <SiteHeader hideBrandWhile=".hero-brand-visibility-sentinel" locale={locale} />
      <Hero locale={locale} />
      <SiteFooter />
    </div>
  );
}
