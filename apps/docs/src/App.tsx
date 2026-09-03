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
  LayoutGroup,
  motion,
  useAnimationControls,
  useIsPresent,
  useMotionValueEvent,
  useReducedMotion as usePrefersReducedMotion,
  useScroll,
} from "motion/react";
import { DocsApp } from "./Docs";
import {
  getIntroStoryScene,
  introStoryTimelineUnits,
  useIntroStoryMotion,
  type IntroMessagePhase,
  type IntroStoryScene,
} from "./intro-story-motion";
import { KoreanSemanticWrap } from "./KoreanSemanticWrap";
import {
  easeOutExpo,
  easeOutQuint,
  headlineLayoutTransition,
  shimmerCompression,
  shimmerMotion,
  shimmerRelease,
  storySceneVariants,
  viewReveal,
} from "./motion-config";
import {
  ArrowIcon,
  BrandLockup,
  CheckIcon,
  CopyIcon,
  SiteFooter,
  SiteHeader,
} from "./site";
import { copyText } from "./site-config";

const installCommand =
  "npm install @semantic-wrap/core @semantic-wrap/react @semantic-wrap/ko react react-dom";

const demoHeadlines = [
  "디자인 시스템을 도입하기 전에 반드시 확인해야 할 기준",
  "사용자를 이해하고, 더 나은 해결책을 만드는 방법",
  "효율적인 회의를 만들기 위해 버려야 할 습관",
];

type LineBreakExample = {
  id: string;
  text: string;
  pieces: readonly string[];
  nativeBreakAfter: number;
  semanticBreakAfter: number;
  focusIndex: number;
  nativeDescription: string;
  semanticDescription: string;
};

const lineBreakExamples: readonly LineBreakExample[] = [
  {
    id: "before",
    text: demoHeadlines[0] ?? "",
    pieces: ["디자인 시스템을 도입하기", "전에", "반드시 확인해야 할 기준"],
    nativeBreakAfter: 0,
    semanticBreakAfter: 1,
    focusIndex: 1,
    nativeDescription: "‘전에’가 다음 줄로 밀려 조건을 나타내는 구절이 갈라집니다.",
    semanticDescription: "‘도입하기 전에’를 같은 줄에 묶어 하나의 의미 단위로 유지합니다.",
  },
  {
    id: "readable",
    text: demoHeadlines[1] ?? "",
    pieces: ["사용자를 이해하고,", "더 나은", "해결책을 만드는 방법"],
    nativeBreakAfter: 1,
    semanticBreakAfter: 0,
    focusIndex: 1,
    nativeDescription: "‘더 나은’이 서로 다른 줄에 놓여 수식 관계가 끊깁니다.",
    semanticDescription: "쉼표 뒤에서 줄을 나눠 ‘더 나은’을 함께 읽도록 만듭니다.",
  },
  {
    id: "purpose",
    text: demoHeadlines[2] ?? "",
    pieces: ["효율적인 회의를", "만들기", "위해 버려야 할 습관"],
    nativeBreakAfter: 1,
    semanticBreakAfter: 0,
    focusIndex: 1,
    nativeDescription: "‘만들기’와 ‘위해’가 서로 다른 줄에 놓여 목적을 나타내는 표현이 갈라집니다.",
    semanticDescription: "‘만들기 위해’를 한 줄에 묶어 목적을 분명하게 전달합니다.",
  },
];

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

function moveActionSpotlight(event: ReactPointerEvent<HTMLAnchorElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--action-x", `${event.clientX - bounds.left}px`);
  event.currentTarget.style.setProperty("--action-y", `${event.clientY - bounds.top}px`);
}

function resetActionSpotlight(event: ReactPointerEvent<HTMLAnchorElement>) {
  event.currentTarget.style.setProperty("--action-x", "50%");
  event.currentTarget.style.setProperty("--action-y", "50%");
}

function StartAction() {
  return (
    <a
      className="primary-action"
      href="/ko/docs/introduction"
      onPointerMove={moveActionSpotlight}
      onPointerLeave={resetActionSpotlight}
    >
      <span>시작하기</span>
      <span className="action-arrow" aria-hidden="true">
        <ArrowIcon />
        <ArrowIcon />
      </span>
    </a>
  );
}

function InstallCommand() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copyState === "idle") return undefined;
    const timeout = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  async function copyCommand() {
    const copied = await copyText(installCommand);
    setCopyState(copied ? "copied" : "failed");
  }

  const copyLabel = copyState === "copied" ? "복사됨" : "복사하지 못했습니다";

  return (
    <motion.button
      type="button"
      className={`quick-install${copyState === "idle" ? "" : ` is-${copyState}`}`}
      onClick={copyCommand}
      aria-label="npm 설치 명령 복사"
      animate={copyState === "copied" ? { scale: [1, 0.97, 1] } : { scale: 1 }}
      transition={{ duration: 0.26, ease: easeOutExpo }}
    >
      <code><span aria-hidden="true">~ </span>{installCommand}</code>
      <span className="quick-install-icon" aria-hidden="true">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            className="quick-install-feedback-icon"
            key={copyState === "copied" ? "check" : "copy"}
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.82 }}
            transition={{ duration: 0.2, ease: easeOutExpo }}
          >
            {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="visually-hidden" aria-live="polite">
        {copyState === "idle" ? "" : copyLabel}
      </span>
    </motion.button>
  );
}

function TextShimmer({ active, children }: { active: boolean; children: string }) {
  const targetControls = useAnimationControls();
  const shimmerControls = useAnimationControls();

  useEffect(() => {
    let cancelled = false;
    targetControls.stop();
    shimmerControls.stop();

    if (!active) {
      targetControls.set({ scale: 1 });
      shimmerControls.set({ backgroundPosition: "130% 50%", opacity: 0 });
      return undefined;
    }

    const playSpring = async () => {
      await targetControls.start({
        scale: shimmerCompression.scale,
        transition: {
          duration: shimmerCompression.duration,
          ease: shimmerCompression.ease,
        },
      });
      if (!cancelled) {
        await targetControls.start({ scale: 1, transition: shimmerRelease });
      }
    };

    void playSpring();
    void shimmerControls.start({
      backgroundPosition: [...shimmerMotion.positions],
      opacity: [...shimmerMotion.opacity],
      transition: {
        delay: shimmerMotion.delay,
        duration: shimmerMotion.duration,
        ease: "linear",
        times: [...shimmerMotion.times],
      },
    });

    return () => {
      cancelled = true;
      targetControls.stop();
      shimmerControls.stop();
    };
  }, [active, shimmerControls, targetControls]);

  return (
    <motion.span
      animate={targetControls}
      className="text-shimmer-target"
      data-motion-shimmer={active ? "active" : "idle"}
      initial={false}
    >
      {children}
      <motion.span
        animate={shimmerControls}
        className="text-shimmer"
        initial={false}
        aria-hidden="true"
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

function LineBreakHeadline({
  example,
  semantic,
  shimmerActive,
  staticScene = false,
  sceneStepIndex,
  onLayoutSettled,
}: {
  example: LineBreakExample;
  semantic: boolean;
  shimmerActive: boolean;
  staticScene?: boolean;
  sceneStepIndex?: number;
  onLayoutSettled?: (stepIndex: number) => void;
}) {
  const breakAfter = semantic ? example.semanticBreakAfter : example.nativeBreakAfter;

  return (
    <motion.p
      className="line-break-headline"
      layout={staticScene ? false : true}
      aria-label={`${semantic ? "semantic-wrap 의미 줄바꿈" : "브라우저 기본 줄바꿈"}: ${example.text}`}
      lang="ko"
    >
      {example.pieces.map((piece, index) => {
        const followsBreak = index === breakAfter + 1;
        const shimmerTarget = semantic && index === example.focusIndex;
        const pieceClassName = [
          "line-break-piece",
          index === example.focusIndex ? "is-focus" : "",
          index > 0 && !followsBreak ? "has-gap" : "",
        ].filter(Boolean).join(" ");

        return (
          <Fragment key={`${example.id}-${piece}`}>
            <motion.span
              className={pieceClassName}
              data-flip-piece={`${example.id}-${index}`}
              data-motion-layout={staticScene ? undefined : "position"}
              data-piece-index={index}
              layout={staticScene ? false : "position"}
              layoutDependency={semantic}
              initial={staticScene ? false : { opacity: 0, y: 19 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                ...headlineLayoutTransition,
                delay: index * 0.055,
                duration: 0.62,
                ease: easeOutExpo,
              }}
              onLayoutAnimationComplete={
                index === example.focusIndex && sceneStepIndex !== undefined
                  ? () => onLayoutSettled?.(sceneStepIndex)
                  : undefined
              }
              aria-hidden="true"
            >
              {shimmerTarget ? (
                <TextShimmer active={shimmerActive}>{piece}</TextShimmer>
              ) : piece}
            </motion.span>
            {index === breakAfter ? (
              <Fragment>
                <motion.span
                  className="line-break-marker"
                  initial={staticScene ? false : { opacity: 0, scale: 0.8, y: "0.08em" }}
                  animate={{ opacity: 1, scale: 1, y: "0.08em" }}
                  transition={{ duration: 0.18, ease: easeOutExpo }}
                  aria-hidden="true"
                >
                  ↵
                </motion.span>
                <span className="line-break-force" aria-hidden="true" />
              </Fragment>
            ) : null}
          </Fragment>
        );
      })}
    </motion.p>
  );
}

type IntroStorySceneViewProps = {
  direction?: 1 | -1;
  messagePhase?: IntroMessagePhase | null;
  scene: IntroStoryScene;
  sceneStepIndex?: number;
  shimmerActive?: boolean;
  staticScene?: boolean;
  onLayoutSettled?: (stepIndex: number) => void;
};

function IntroHeroScene({
  direction = 1,
  staticScene = false,
}: Omit<IntroStorySceneViewProps, "scene">) {
  const isPresent = useIsPresent();
  const current = staticScene || isPresent;

  return (
    <motion.div
      className="hero-brand-stage intro-story-scene"
      data-intro-current={current ? "true" : undefined}
      aria-hidden={!current}
      custom={direction}
      variants={storySceneVariants}
      initial={staticScene ? false : "enter"}
      animate={staticScene ? undefined : "center"}
      exit={staticScene ? undefined : "exit"}
    >
      <div className="hero-brand-content">
        <BrandLockup className="hero-brand-lockup" />
        <InstallCommand />
        <StartAction />
      </div>
      <p className="hero-scroll-cue">
        <span>스크롤하여 줄바꿈 비교</span>
        <motion.span
          animate={staticScene ? undefined : { opacity: [0.35, 1, 0.35], y: [0, 6, 0] }}
          transition={{ duration: 1.8, ease: easeOutQuint, repeat: Infinity }}
          aria-hidden="true"
        >
          ↓
        </motion.span>
      </p>
    </motion.div>
  );
}

function IntroMessageScene({
  direction = 1,
  messagePhase = "blank",
  shimmerActive = false,
  staticScene = false,
}: Omit<IntroStorySceneViewProps, "scene">) {
  const isPresent = useIsPresent();
  const current = staticScene || isPresent;
  const resolvedPhase = staticScene ? "complete" : messagePhase;
  const sourceVisible = resolvedPhase === "source" || resolvedPhase === "complete";
  const highlightVisible = resolvedPhase === "complete";

  return (
    <motion.div
      className="intro-message-stage intro-story-scene"
      data-intro-current={current ? "true" : undefined}
      aria-hidden={!current}
      custom={direction}
      variants={storySceneVariants}
      initial={staticScene ? false : "enter"}
      animate={staticScene ? undefined : "center"}
      exit={staticScene ? undefined : "exit"}
    >
      <p className="intro-message-copy" aria-label="줄바꿈을 자연스럽게">
        <motion.span
          className="intro-message-source"
          initial={false}
          animate={sourceVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: 0.52, ease: easeOutExpo }}
        >
          줄바꿈을
        </motion.span>
        <motion.span
          className="intro-message-highlight"
          initial={false}
          animate={highlightVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: 0.56, ease: easeOutExpo }}
        >
          <TextShimmer active={shimmerActive}>자연스럽게</TextShimmer>
        </motion.span>
      </p>
    </motion.div>
  );
}

function IntroHeadlineScene({
  direction = 1,
  scene,
  shimmerActive = false,
  staticScene = false,
  onLayoutSettled,
  sceneStepIndex,
}: IntroStorySceneViewProps & {
  scene: Extract<IntroStoryScene, { kind: "headline" }>;
}) {
  const example = lineBreakExamples[scene.exampleIndex] ?? lineBreakExamples[0];
  const isPresent = useIsPresent();
  const current = staticScene || isPresent;
  if (!example) return null;

  return (
    <motion.div
      className="line-break-composition page-width intro-story-scene"
      data-intro-current={current ? "true" : undefined}
      data-semantic={scene.semantic ? "true" : "false"}
      aria-hidden={!current}
      custom={direction}
      variants={storySceneVariants}
      initial={staticScene ? false : "enter"}
      animate={staticScene ? undefined : "center"}
      exit={staticScene ? undefined : "exit"}
    >
      <motion.div
        className="line-break-scene-context"
        key={`${example.id}-${scene.semantic ? "semantic" : "native"}`}
        initial={staticScene ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: easeOutExpo }}
      >
        <div className="line-break-scene-state">
          <p
            className="line-break-state-track"
            aria-label={`현재 보기: ${scene.semantic ? "semantic-wrap" : "브라우저 기본"}`}
          >
            <span className={scene.semantic ? undefined : "is-current"}>BEFORE</span>
            <span aria-hidden="true">→</span>
            <span className={scene.semantic ? "is-current" : undefined}>AFTER</span>
          </p>
          <span className="line-break-example-count">
            {String(scene.exampleIndex + 1).padStart(2, "0")} /{" "}
            {String(lineBreakExamples.length).padStart(2, "0")}
          </span>
        </div>
        <p className="line-break-scene-description">
          {scene.semantic ? example.semanticDescription : example.nativeDescription}
        </p>
      </motion.div>
      <LineBreakHeadline
        example={example}
        semantic={scene.semantic}
        shimmerActive={shimmerActive}
        staticScene={staticScene}
        sceneStepIndex={sceneStepIndex}
        onLayoutSettled={onLayoutSettled}
      />
    </motion.div>
  );
}

function IntroStorySceneView(props: IntroStorySceneViewProps) {
  if (props.scene.kind === "hero") return <IntroHeroScene {...props} />;
  if (props.scene.kind === "message") return <IntroMessageScene {...props} />;
  return <IntroHeadlineScene {...props} scene={props.scene} />;
}

function introStorySceneKey(scene: IntroStoryScene) {
  return scene.kind === "headline" ? `headline-${scene.exampleIndex}` : scene.kind;
}

function IntroStory() {
  const storyRef = useRef<HTMLElement>(null);
  const { markLayoutSettled, playback, shouldReduceMotion } = useIntroStoryMotion(storyRef);
  const currentScene = getIntroStoryScene(playback.stepIndex);

  if (shouldReduceMotion) {
    return (
      <section className="intro-story is-static" id="top" ref={storyRef}>
        <span className="hero-brand-visibility-sentinel" aria-hidden="true" />
        <IntroStorySceneView scene={{ kind: "hero" }} staticScene />
        <IntroStorySceneView scene={{ kind: "message" }} staticScene />
        {lineBreakExamples.flatMap((example, exampleIndex) =>
          [false, true].map((semantic) => (
            <IntroStorySceneView
              key={`${example.id}-${semantic ? "semantic" : "native"}`}
              scene={{ kind: "headline", exampleIndex, semantic }}
              shimmerActive={false}
              staticScene
            />
          )),
        )}
      </section>
    );
  }

  return (
    <section
      className="intro-story"
      id="top"
      aria-label="브라우저 기본 줄바꿈과 semantic-wrap 비교"
      ref={storyRef}
      data-intro-message-phase={playback.messagePhase ?? undefined}
      data-shimmer-active={playback.shimmerActive ? "true" : undefined}
      style={{ minHeight: `${(introStoryTimelineUnits + 1) * 100}svh` }}
    >
      <span className="hero-brand-visibility-sentinel" aria-hidden="true" />
      <motion.div className="intro-story-pin" layoutRoot>
        <h1 className="visually-hidden">semantic-wrap</h1>
        <div
          className="intro-story-stack"
          data-direction={playback.direction === 1 ? "forward" : "backward"}
          aria-live="polite"
        >
          <LayoutGroup id="intro-story-headline">
            <AnimatePresence initial={false} custom={playback.direction} mode="sync">
              <IntroStorySceneView
                direction={playback.direction}
                key={introStorySceneKey(currentScene)}
                messagePhase={playback.messagePhase}
                scene={currentScene}
                sceneStepIndex={playback.stepIndex}
                shimmerActive={playback.shimmerActive}
                onLayoutSettled={markLayoutSettled}
              />
            </AnimatePresence>
          </LayoutGroup>
        </div>
      </motion.div>
    </section>
  );
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
        <motion.div className="playground-intro" {...viewReveal}>
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
      {...viewReveal}
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
        <motion.div className="section-intro" {...viewReveal}>
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
