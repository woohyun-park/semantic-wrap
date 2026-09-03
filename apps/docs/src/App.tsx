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
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { DocsApp } from "./Docs";
import { KoreanSemanticWrap } from "./KoreanSemanticWrap";
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

type FlipRectsRef = {
  current: Map<string, DOMRect>;
};

type IntroStoryScene =
  | { kind: "hero" }
  | { kind: "message" }
  | { kind: "headline"; exampleIndex: number; semantic: boolean };

type IntroStoryState = {
  stepIndex: number;
  direction: 1 | -1;
  previous: IntroStoryScene | null;
};

type StoryShimmerState = {
  armed: boolean;
  layoutReady: boolean;
  scaledProgress: number;
  sceneProgress: number;
  stepIndex: number;
  thresholdCrossed: boolean;
};

const storyShimmerResetPoint = 0.15;
const storyShimmerTriggerPoint = 0.45;
const storyMessageSourcePoint = 0.2;
const storyMessageCompletePoint = 0.45;
const storyMessageShimmerTriggerPoint = 0.7;
const introHeroSceneWeight = 1;
const introMessageSceneWeight = 2.2;
const introBeforeSceneWeight = 1.1;
const introAfterSceneWeight = 1.7;

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

const introStorySceneWeights = [
  introHeroSceneWeight,
  introMessageSceneWeight,
  ...lineBreakExamples.flatMap(() => [
    introBeforeSceneWeight,
    introAfterSceneWeight,
  ]),
];
const introStoryTimelineUnits = introStorySceneWeights.reduce(
  (total, weight) => total + weight,
  0,
);

function getIntroStoryScrollState(progress: number) {
  const timelineProgress = progress * introStoryTimelineUnits;
  let sceneStart = 0;

  for (let stepIndex = 0; stepIndex < introStorySceneWeights.length; stepIndex += 1) {
    const sceneWeight = introStorySceneWeights[stepIndex] ?? 1;
    const isLastScene = stepIndex === introStorySceneWeights.length - 1;
    if (timelineProgress < sceneStart + sceneWeight || isLastScene) {
      return {
        scaledProgress: timelineProgress,
        sceneProgress: Math.min(
          1,
          Math.max(0, (timelineProgress - sceneStart) / sceneWeight),
        ),
        stepIndex,
      };
    }
    sceneStart += sceneWeight;
  }

  return { scaledProgress: timelineProgress, sceneProgress: 1, stepIndex: 0 };
}

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

function useFlipHeadline(
  headlineRef: RefObject<HTMLParagraphElement | null>,
  semantic: boolean,
  flipRectsRef?: FlipRectsRef,
  sceneStepIndex?: number,
  onLayoutSettled?: (stepIndex: number) => void,
) {
  useLayoutEffect(() => {
    const headline = headlineRef.current;
    if (!headline || !flipRectsRef) return;

    const pieces = Array.from(headline.querySelectorAll<HTMLElement>("[data-flip-piece]"));
    const nextRects = new Map(
      pieces.map((piece) => [piece.dataset.flipPiece ?? "", piece.getBoundingClientRect()]),
    );
    const previous = flipRectsRef.current;
    flipRectsRef.current = new Map();

    if (previous.size === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (sceneStepIndex !== undefined) onLayoutSettled?.(sceneStepIndex);
      return;
    }

    const animations: Animation[] = [];
    for (const piece of pieces) {
      const before = previous.get(piece.dataset.flipPiece ?? "");
      const after = nextRects.get(piece.dataset.flipPiece ?? "");
      if (!before || !after) continue;

      const deltaX = before.left - after.left;
      const deltaY = before.top - after.top;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue;

      const animation = piece.animate(
        [
          { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration: 480,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "both",
        },
      );
      animations.push(animation);
    }

    if (animations.length === 0) {
      if (sceneStepIndex !== undefined) onLayoutSettled?.(sceneStepIndex);
      return;
    }

    let cancelled = false;
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      for (const animation of animations) animation.cancel();
      if (!cancelled && sceneStepIndex !== undefined) onLayoutSettled?.(sceneStepIndex);
    });

    return () => {
      cancelled = true;
      for (const animation of animations) animation.cancel();
    };
  }, [flipRectsRef, headlineRef, onLayoutSettled, sceneStepIndex, semantic]);
}

function getIntroStoryScene(stepIndex: number): IntroStoryScene {
  if (stepIndex === 0) return { kind: "hero" };
  if (stepIndex === 1) return { kind: "message" };

  const headlineStep = stepIndex - 2;
  return {
    kind: "headline",
    exampleIndex: Math.floor(headlineStep / 2),
    semantic: headlineStep % 2 === 1,
  };
}

function sceneUsesShimmer(scene: IntroStoryScene) {
  return scene.kind === "message" || (scene.kind === "headline" && scene.semantic);
}

function syncStoryMessagePhase(
  story: HTMLElement,
  scene: IntroStoryScene,
  sceneProgress: number,
) {
  if (scene.kind !== "message") {
    story.removeAttribute("data-intro-message-phase");
    return;
  }

  const phase = sceneProgress >= storyMessageCompletePoint
    ? "complete"
    : sceneProgress >= storyMessageSourcePoint
      ? "source"
      : "blank";
  story.setAttribute("data-intro-message-phase", phase);
}

function syncStoryShimmer(
  story: HTMLElement,
  stateRef: { current: StoryShimmerState },
  settleTimerRef: { current: number | null },
  nextStepIndex: number,
  sceneProgress: number,
  scaledProgress: number,
) {
  const previous = stateRef.current;
  const sceneChanged = previous.stepIndex !== nextStepIndex;
  const movingForward = scaledProgress > previous.scaledProgress;
  const nextScene = getIntroStoryScene(nextStepIndex);
  const triggerPoint = nextScene.kind === "message"
    ? storyMessageShimmerTriggerPoint
    : storyShimmerTriggerPoint;
  let armed = sceneChanged ? movingForward : previous.armed;
  const layoutReady = sceneChanged
    ? !sceneUsesShimmer(nextScene) || nextScene.kind === "message"
    : previous.layoutReady;
  let thresholdCrossed = sceneChanged ? false : previous.thresholdCrossed;

  if (sceneChanged) {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    story.removeAttribute("data-shimmer-active");
  }
  if (sceneProgress <= storyShimmerResetPoint) {
    armed = true;
    thresholdCrossed = false;
    story.removeAttribute("data-shimmer-active");
  }

  const crossedTrigger = sceneChanged
    ? sceneProgress >= triggerPoint
    : previous.sceneProgress < triggerPoint
      && sceneProgress >= triggerPoint;
  if (movingForward && armed && crossedTrigger && sceneUsesShimmer(nextScene)) {
    thresholdCrossed = true;
    if (layoutReady) {
      story.setAttribute("data-shimmer-active", "true");
      armed = false;
    }
  }

  stateRef.current = {
    armed,
    layoutReady,
    scaledProgress,
    sceneProgress,
    stepIndex: nextStepIndex,
    thresholdCrossed,
  };
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReducedMotion(media.matches);
    media.addEventListener("change", syncPreference);
    return () => media.removeEventListener("change", syncPreference);
  }, []);

  return reducedMotion;
}

function useIntroStoryState(
  storyRef: RefObject<HTMLElement | null>,
  flipRectsRef: FlipRectsRef,
) {
  const stepCount = introStorySceneWeights.length;
  const [storyState, setStoryState] = useState<IntroStoryState>({
    stepIndex: 0,
    direction: 1,
    previous: null,
  });
  const storyStateRef = useRef(storyState);
  const shimmerStateRef = useRef<StoryShimmerState>({
    armed: true,
    layoutReady: true,
    scaledProgress: 0,
    sceneProgress: 0,
    stepIndex: 0,
    thresholdCrossed: false,
  });
  const shimmerSettleTimerRef = useRef<number | null>(null);

  const markShimmerLayoutSettled = useCallback((settledStepIndex: number) => {
    const story = storyRef.current;
    const current = shimmerStateRef.current;
    if (
      !story
      || current.stepIndex !== settledStepIndex
      || !sceneUsesShimmer(getIntroStoryScene(settledStepIndex))
    ) {
      return;
    }

    if (shimmerSettleTimerRef.current !== null) {
      window.clearTimeout(shimmerSettleTimerRef.current);
    }
    shimmerSettleTimerRef.current = window.setTimeout(() => {
      shimmerSettleTimerRef.current = null;
      const latest = shimmerStateRef.current;
      if (latest.stepIndex !== settledStepIndex) return;

      let armed = latest.armed;
      if (latest.thresholdCrossed && armed) {
        story.setAttribute("data-shimmer-active", "true");
        armed = false;
      }
      shimmerStateRef.current = { ...latest, armed, layoutReady: true };
    }, 50);
  }, [storyRef]);

  useEffect(() => {
    storyStateRef.current = storyState;
  }, [storyState]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let animationFrame = 0;
    const syncStoryState = () => {
      animationFrame = 0;
      const story = storyRef.current;
      const pin = story?.querySelector<HTMLElement>(".intro-story-pin");
      if (!story || !pin) return;

      const bounds = story.getBoundingClientRect();
      const travel = Math.max(1, bounds.height - pin.getBoundingClientRect().height);
      const progress = Math.min(1, Math.max(0, -bounds.top / travel));
      const {
        scaledProgress,
        sceneProgress,
        stepIndex: nextStepIndex,
      } = getIntroStoryScrollState(progress);
      const nextScene = getIntroStoryScene(nextStepIndex);
      syncStoryMessagePhase(story, nextScene, sceneProgress);
      syncStoryShimmer(
        story,
        shimmerStateRef,
        shimmerSettleTimerRef,
        nextStepIndex,
        sceneProgress,
        scaledProgress,
      );

      const current = storyStateRef.current;
      if (nextStepIndex === current.stepIndex) return;

      const currentScene = getIntroStoryScene(current.stepIndex);
      const sameHeadline = currentScene.kind === "headline"
        && nextScene.kind === "headline"
        && currentScene.exampleIndex === nextScene.exampleIndex;

      if (sameHeadline) {
        const pieces = Array.from(
          story.querySelectorAll<HTMLElement>(
            '[data-intro-current="true"] [data-flip-piece]',
          ),
        );
        flipRectsRef.current = new Map(
          pieces.map((piece) => [
            piece.dataset.flipPiece ?? "",
            piece.getBoundingClientRect(),
          ]),
        );
      } else {
        flipRectsRef.current = new Map();
      }

      const nextState: IntroStoryState = {
        stepIndex: nextStepIndex,
        direction: nextStepIndex > current.stepIndex ? 1 : -1,
        previous: sameHeadline ? null : currentScene,
      };
      storyStateRef.current = nextState;
      setStoryState(nextState);
    };
    const scheduleStoryStateSync = () => {
      if (animationFrame !== 0) return;
      animationFrame = window.requestAnimationFrame(syncStoryState);
    };

    window.addEventListener("scroll", scheduleStoryStateSync, { passive: true });
    window.addEventListener("resize", scheduleStoryStateSync);
    syncStoryState();

    return () => {
      window.removeEventListener("scroll", scheduleStoryStateSync);
      window.removeEventListener("resize", scheduleStoryStateSync);
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
      if (shimmerSettleTimerRef.current !== null) {
        window.clearTimeout(shimmerSettleTimerRef.current);
      }
    };
  }, [flipRectsRef, stepCount, storyRef]);

  const clearPrevious = () => {
    const current = storyStateRef.current;
    if (!current.previous) return;
    const nextState = { ...current, previous: null };
    storyStateRef.current = nextState;
    setStoryState(nextState);
  };

  return { clearPrevious, markShimmerLayoutSettled, storyState };
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
    <button
      type="button"
      className={`quick-install${copyState === "idle" ? "" : ` is-${copyState}`}`}
      onClick={copyCommand}
      aria-label="npm 설치 명령 복사"
    >
      <code><span aria-hidden="true">~ </span>{installCommand}</code>
      <span className="quick-install-icon" aria-hidden="true">
        {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
      </span>
      <span className="visually-hidden" aria-live="polite">
        {copyState === "idle" ? "" : copyLabel}
      </span>
    </button>
  );
}

function TextShimmer({ children }: { children: string }) {
  return (
    <span className="text-shimmer" aria-hidden="true">
      {children}
    </span>
  );
}

function LineBreakHeadline({
  example,
  semantic,
  flipRectsRef,
  sceneStepIndex,
  onLayoutSettled,
}: {
  example: LineBreakExample;
  semantic: boolean;
  flipRectsRef?: FlipRectsRef;
  sceneStepIndex?: number;
  onLayoutSettled?: (stepIndex: number) => void;
}) {
  const headlineRef = useRef<HTMLParagraphElement>(null);
  useFlipHeadline(
    headlineRef,
    semantic,
    flipRectsRef,
    sceneStepIndex,
    onLayoutSettled,
  );
  const breakAfter = semantic ? example.semanticBreakAfter : example.nativeBreakAfter;

  return (
    <p
      className="line-break-headline"
      ref={headlineRef}
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
            <span
              className={pieceClassName}
              data-flip-piece={`${example.id}-${index}`}
              data-piece-index={index}
              aria-hidden="true"
            >
              {shimmerTarget ? (
                <span className="text-shimmer-target">
                  {piece}
                  <TextShimmer>{piece}</TextShimmer>
                </span>
              ) : piece}
            </span>
            {index === breakAfter ? (
              <Fragment>
                <span className="line-break-marker" aria-hidden="true">↵</span>
                <span className="line-break-force" aria-hidden="true" />
              </Fragment>
            ) : null}
          </Fragment>
        );
      })}
    </p>
  );
}

type IntroStorySceneViewProps = {
  current?: boolean;
  scene: IntroStoryScene;
  sceneStepIndex?: number;
  status: "current" | "incoming" | "outgoing";
  flipRectsRef?: FlipRectsRef;
  onAnimationEnd?: () => void;
  onLayoutSettled?: (stepIndex: number) => void;
};

function IntroHeroScene({
  current,
  status,
  onAnimationEnd,
}: Omit<IntroStorySceneViewProps, "scene" | "flipRectsRef">) {
  return (
    <div
      className={`hero-brand-stage intro-story-scene is-${status}`}
      data-intro-current={current ? "true" : undefined}
      aria-hidden={!current}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onAnimationEnd?.();
      }}
    >
      <div className="hero-brand-content">
        <BrandLockup className="hero-brand-lockup" />
        <InstallCommand />
        <StartAction />
      </div>
      <p className="hero-scroll-cue">
        <span>스크롤하여 줄바꿈 비교</span>
        <span aria-hidden="true">↓</span>
      </p>
    </div>
  );
}

function IntroMessageScene({
  current,
  status,
  onAnimationEnd,
}: Omit<IntroStorySceneViewProps, "scene" | "flipRectsRef">) {
  return (
    <div
      className={`intro-message-stage intro-story-scene is-${status}`}
      data-intro-current={current ? "true" : undefined}
      aria-hidden={!current}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onAnimationEnd?.();
      }}
    >
      <p className="intro-message-copy" aria-label="줄바꿈을 자연스럽게">
        <span className="intro-message-source">줄바꿈을</span>
        <span className="intro-message-highlight">
          <span className="text-shimmer-target">
            자연스럽게
            <TextShimmer>자연스럽게</TextShimmer>
          </span>
        </span>
      </p>
    </div>
  );
}

function IntroHeadlineScene({
  current,
  scene,
  status,
  flipRectsRef,
  onAnimationEnd,
  onLayoutSettled,
  sceneStepIndex,
}: IntroStorySceneViewProps & {
  scene: Extract<IntroStoryScene, { kind: "headline" }>;
}) {
  const example = lineBreakExamples[scene.exampleIndex] ?? lineBreakExamples[0];
  if (!example) return null;

  return (
    <div
      className={`line-break-composition page-width intro-story-scene is-${status}`}
      data-intro-current={current ? "true" : undefined}
      data-semantic={scene.semantic ? "true" : "false"}
      aria-hidden={!current}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onAnimationEnd?.();
      }}
    >
      <div
        className="line-break-scene-context"
        key={`${example.id}-${scene.semantic ? "semantic" : "native"}`}
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
      </div>
      <LineBreakHeadline
        example={example}
        semantic={scene.semantic}
        flipRectsRef={current ? flipRectsRef : undefined}
        sceneStepIndex={sceneStepIndex}
        onLayoutSettled={onLayoutSettled}
      />
    </div>
  );
}

function IntroStorySceneView(props: IntroStorySceneViewProps) {
  if (props.scene.kind === "hero") return <IntroHeroScene {...props} />;
  if (props.scene.kind === "message") return <IntroMessageScene {...props} />;
  return <IntroHeadlineScene {...props} scene={props.scene} />;
}

function IntroStory() {
  const storyRef = useRef<HTMLElement>(null);
  const flipRectsRef = useRef(new Map<string, DOMRect>());
  const reducedMotion = useReducedMotion();
  const { clearPrevious, markShimmerLayoutSettled, storyState } = useIntroStoryState(
    storyRef,
    flipRectsRef,
  );
  const currentScene = getIntroStoryScene(storyState.stepIndex);

  if (reducedMotion) {
    return (
      <section className="intro-story is-static" id="top" ref={storyRef}>
        <span className="hero-brand-visibility-sentinel" aria-hidden="true" />
        <IntroStorySceneView current scene={{ kind: "hero" }} status="current" />
        <IntroStorySceneView current scene={{ kind: "message" }} status="current" />
        {lineBreakExamples.flatMap((example, exampleIndex) =>
          [false, true].map((semantic) => (
            <IntroStorySceneView
              current
              key={`${example.id}-${semantic ? "semantic" : "native"}`}
              scene={{ kind: "headline", exampleIndex, semantic }}
              status="current"
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
      style={{ minHeight: `${(introStoryTimelineUnits + 1) * 100}svh` }}
    >
      <span className="hero-brand-visibility-sentinel" aria-hidden="true" />
      <div className="intro-story-pin">
        <h1 className="visually-hidden">semantic-wrap</h1>
        <div
          className="intro-story-stack"
          data-direction={storyState.direction === 1 ? "forward" : "backward"}
          aria-live="polite"
        >
          {storyState.previous ? (
            <IntroStorySceneView scene={storyState.previous} status="outgoing" />
          ) : null}
          <IntroStorySceneView
            current
            scene={currentScene}
            sceneStepIndex={storyState.stepIndex}
            status={storyState.previous ? "incoming" : "current"}
            flipRectsRef={flipRectsRef}
            onAnimationEnd={clearPrevious}
            onLayoutSettled={markShimmerLayoutSettled}
          />
        </div>
      </div>
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
        <div className="playground-intro">
          <h2 id="playground-title">Playground</h2>
        </div>

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

  if (layouts.length === 0) {
    return <p className="process-diagnostics-loading">현재 글꼴과 너비를 측정하고 있습니다…</p>;
  }

  return (
    <div
      className="process-layout-options is-measuring"
      aria-label="실제로 측정한 레이아웃 후보"
    >
      {layouts.map((entry, index) => {
        return (
          <article
            className="process-layout-option"
            key={`${entry.source}-${entry.id}`}
            style={{ "--layout-index": index } as CSSProperties}
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
          </article>
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
    <aside className="process-stage" id="process-stage" aria-label="작동 방식 실시간 미리보기">
      <div className="process-stage-head">
        <strong>0{activeStep + 1} / 03</strong>
      </div>
      <div className={`process-stage-scene is-step-${activeStep + 1}`} key={activeStep}>
        <p
          className="process-measure-source"
          ref={ref}
          aria-hidden="true"
          lang="ko"
          style={{ "--process-measure-width": `${processMeasureWidth}px` } as CSSProperties}
        >
          {processExampleText}
        </p>
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
      </div>
      <p className="process-stage-status" aria-live="polite">
        <span aria-hidden="true" />
        {processStageStatus[activeStep]}
      </p>
    </aside>
  );
}

function ProcessSection() {
  const listRef = useRef<HTMLOListElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    const items = Array.from(list.querySelectorAll<HTMLElement>("[data-process-step]"));
    let animationFrame = 0;
    const syncActiveStep = () => {
      animationFrame = 0;
      const readingLine = window.innerHeight * 0.46;
      let nextStep = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const [index, item] of items.entries()) {
        const bounds = item.getBoundingClientRect();
        const distance = Math.abs(bounds.top + bounds.height / 2 - readingLine);
        if (distance < nearestDistance) {
          nextStep = index;
          nearestDistance = distance;
        }
      }

      setActiveStep((current) => current === nextStep ? current : nextStep);
    };
    const scheduleActiveStepSync = () => {
      if (animationFrame !== 0) return;
      animationFrame = window.requestAnimationFrame(syncActiveStep);
    };

    window.addEventListener("scroll", scheduleActiveStepSync, { passive: true });
    window.addEventListener("resize", scheduleActiveStepSync);
    syncActiveStep();

    return () => {
      window.removeEventListener("scroll", scheduleActiveStepSync);
      window.removeEventListener("resize", scheduleActiveStepSync);
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <section className="process-section" id="process" aria-labelledby="process-title">
      <div className="page-width">
        <div className="section-intro">
          <KoreanSemanticWrap>
            <h2 id="process-title">모델이 제안하고, 브라우저가 검증합니다.</h2>
          </KoreanSemanticWrap>
          <KoreanSemanticWrap>
            <p>모델이 찾은 의미 경계와 실제 렌더링 너비를 함께 비교해, 바꿀 가치가 있는 줄바꿈만 적용합니다.</p>
          </KoreanSemanticWrap>
        </div>

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
