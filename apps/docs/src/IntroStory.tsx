import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import {
  easeOutExpo,
  easeOutQuint,
  headlineLayoutTransition,
} from "./motion-values";
import { lineBreakExamples, type LineBreakExample } from "./landing-content";
import { SceneFrame, ShimmerText } from "./motion";
import {
  ArrowIcon,
  BrandLockup,
  CheckIcon,
  CopyIcon,
} from "./site";
import { copyText } from "./site-config";

const installCommand =
  "npm i @semantic-wrap/react @semantic-wrap/ko";

type MessagePhase = "blank" | "source" | "complete";
type SceneContent =
  | { kind: "hero" }
  | { kind: "message" }
  | { kind: "headline"; exampleIndex: number; semantic: boolean };
type IntroScene = SceneContent & {
  id: string;
  weight: number;
  shimmerAt?: number;
};

const introScenes: readonly IntroScene[] = [
  { id: "hero", kind: "hero", weight: 1 },
  { id: "message", kind: "message", weight: 2.2, shimmerAt: 0.7 },
  ...lineBreakExamples.flatMap<IntroScene>((example, exampleIndex) => [
    {
      id: `${example.id}-before`,
      kind: "headline",
      exampleIndex,
      semantic: false,
      weight: 1.1,
    },
    {
      id: `${example.id}-after`,
      kind: "headline",
      exampleIndex,
      semantic: true,
      weight: 1.7,
      shimmerAt: 0.45,
    },
  ]),
];

const timelineUnits = introScenes.reduce((total, scene) => total + scene.weight, 0);
const shimmerResetAt = 0.15;

function resolveTimeline(progress: number) {
  const scaledProgress = Math.min(1, Math.max(0, progress)) * timelineUnits;
  let sceneStart = 0;

  for (const [sceneIndex, scene] of introScenes.entries()) {
    const isLast = sceneIndex === introScenes.length - 1;
    if (scaledProgress < sceneStart + scene.weight || isLast) {
      return {
        scene,
        sceneIndex,
        scaledProgress,
        sceneProgress: Math.min(1, Math.max(0, (scaledProgress - sceneStart) / scene.weight)),
      };
    }
    sceneStart += scene.weight;
  }

  return { scene: introScenes[0]!, sceneIndex: 0, scaledProgress: 0, sceneProgress: 0 };
}

function messagePhase(scene: IntroScene, progress: number): MessagePhase | null {
  if (scene.kind !== "message") return null;
  if (progress >= 0.45) return "complete";
  if (progress >= 0.2) return "source";
  return "blank";
}

type Playback = {
  direction: 1 | -1;
  messagePhase: MessagePhase | null;
  sceneIndex: number;
  shimmerRun: number | null;
};

function useIntroTimeline(storyRef: RefObject<HTMLElement | null>) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({
    target: storyRef,
    offset: ["start start", "end end"],
  });
  const cursor = useRef({ sceneIndex: 0, scaledProgress: 0, sceneProgress: 0 });
  const shimmer = useRef({ armed: true, layoutReady: true, pending: false, run: null as number | null });
  const runCount = useRef(0);
  const [playback, setPlayback] = useState<Playback>({
    direction: 1,
    messagePhase: null,
    sceneIndex: 0,
    shimmerRun: null,
  });

  const syncProgress = useCallback((progress: number) => {
    if (shouldReduceMotion) return;

    const previous = cursor.current;
    const next = resolveTimeline(progress);
    const sceneChanged = next.sceneIndex !== previous.sceneIndex;
    const movingForward = next.scaledProgress > previous.scaledProgress;
    const usesShimmer = next.scene.shimmerAt !== undefined;
    const gate = shimmer.current;

    if (sceneChanged) {
      gate.armed = movingForward;
      gate.layoutReady = !usesShimmer || next.scene.kind === "message";
      gate.pending = false;
      gate.run = null;
    }

    if (next.sceneProgress <= shimmerResetAt) {
      gate.armed = true;
      gate.pending = false;
      gate.run = null;
    }

    const triggerAt = next.scene.shimmerAt;
    const crossedTrigger = triggerAt !== undefined && (
      sceneChanged
        ? next.sceneProgress >= triggerAt
        : previous.sceneProgress < triggerAt && next.sceneProgress >= triggerAt
    );

    if (movingForward && gate.armed && crossedTrigger) {
      if (gate.layoutReady) {
        gate.run = ++runCount.current;
        gate.armed = false;
      } else {
        gate.pending = true;
      }
    }

    const direction = sceneChanged
      ? next.sceneIndex > previous.sceneIndex ? 1 : -1
      : null;
    const phase = messagePhase(next.scene, next.sceneProgress);
    cursor.current = {
      sceneIndex: next.sceneIndex,
      scaledProgress: next.scaledProgress,
      sceneProgress: next.sceneProgress,
    };

    setPlayback((current) => {
      const updated: Playback = {
        direction: direction ?? current.direction,
        messagePhase: phase,
        sceneIndex: next.sceneIndex,
        shimmerRun: gate.run,
      };
      return current.direction === updated.direction
        && current.messagePhase === updated.messagePhase
        && current.sceneIndex === updated.sceneIndex
        && current.shimmerRun === updated.shimmerRun
        ? current
        : updated;
    });
  }, [shouldReduceMotion]);

  useMotionValueEvent(scrollYProgress, "change", syncProgress);

  useEffect(() => {
    syncProgress(scrollYProgress.get());
  }, [scrollYProgress, syncProgress]);

  const markLayoutComplete = useCallback((sceneIndex: number) => {
    if (cursor.current.sceneIndex !== sceneIndex) return;

    const scene = introScenes[sceneIndex];
    const gate = shimmer.current;
    if (!scene || scene.shimmerAt === undefined) return;

    gate.layoutReady = true;
    if (!gate.pending || !gate.armed) return;

    gate.pending = false;
    gate.armed = false;
    gate.run = ++runCount.current;
    setPlayback((current) => ({ ...current, shimmerRun: gate.run }));
  }, []);

  return { markLayoutComplete, playback, shouldReduceMotion };
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

function LineBreakHeadline({
  example,
  onLayoutComplete,
  run,
  sceneIndex,
  semantic,
  staticScene = false,
}: {
  example: LineBreakExample;
  onLayoutComplete?: (sceneIndex: number) => void;
  run: number | null;
  sceneIndex?: number;
  semantic: boolean;
  staticScene?: boolean;
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
                index === example.focusIndex && sceneIndex !== undefined
                  ? () => onLayoutComplete?.(sceneIndex)
                  : undefined
              }
              aria-hidden="true"
            >
              {shimmerTarget ? <ShimmerText run={run}>{piece}</ShimmerText> : piece}
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

type SceneViewProps = {
  direction?: 1 | -1;
  messagePhase?: MessagePhase | null;
  onLayoutComplete?: (sceneIndex: number) => void;
  run?: number | null;
  scene: IntroScene;
  sceneIndex?: number;
  staticScene?: boolean;
};

type SceneMotionProps = Pick<SceneViewProps, "direction" | "staticScene">;

function HeroScene({ direction, staticScene }: SceneMotionProps) {
  return (
    <SceneFrame
      className="hero-brand-stage intro-story-scene"
      direction={direction}
      staticScene={staticScene}
    >
      <div className="hero-brand-content">
        <BrandLockup className="hero-brand-lockup" />
        <InstallCommand />
        <StartAction />
      </div>
      <div className="hero-scroll-cue" aria-hidden="true">
        <motion.span
          animate={staticScene ? undefined : { opacity: [0.58, 1, 0.58], y: [0, 6, 0] }}
          transition={{ duration: 1.8, ease: easeOutQuint, repeat: Infinity }}
        >
          ↓
        </motion.span>
      </div>
    </SceneFrame>
  );
}

function MessageScene({
  direction,
  messagePhase: phase,
  run,
  staticScene,
}: Pick<SceneViewProps, "direction" | "messagePhase" | "run" | "staticScene">) {
  const resolvedPhase = staticScene ? "complete" : phase ?? "blank";
  const sourceVisible = resolvedPhase === "source" || resolvedPhase === "complete";
  const highlightVisible = resolvedPhase === "complete";

  return (
    <SceneFrame
      className="intro-message-stage intro-story-scene"
      direction={direction}
      staticScene={staticScene}
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
          <ShimmerText run={run ?? null}>자연스럽게</ShimmerText>
        </motion.span>
      </p>
    </SceneFrame>
  );
}

function HeadlineScene({
  direction,
  onLayoutComplete,
  run,
  scene,
  sceneIndex,
  staticScene,
}: SceneViewProps & { scene: IntroScene & { kind: "headline" } }) {
  const example = lineBreakExamples[scene.exampleIndex] ?? lineBreakExamples[0];
  if (!example) return null;

  return (
    <SceneFrame
      className="line-break-composition page-width intro-story-scene"
      direction={direction}
      staticScene={staticScene}
      data-semantic={scene.semantic ? "true" : "false"}
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
        run={run ?? null}
        staticScene={staticScene}
        sceneIndex={sceneIndex}
        onLayoutComplete={onLayoutComplete}
      />
    </SceneFrame>
  );
}

function SceneView(props: SceneViewProps) {
  if (props.scene.kind === "hero") {
    return <HeroScene direction={props.direction} staticScene={props.staticScene} />;
  }
  if (props.scene.kind === "message") {
    return (
      <MessageScene
        direction={props.direction}
        messagePhase={props.messagePhase}
        run={props.run}
        staticScene={props.staticScene}
      />
    );
  }
  return <HeadlineScene {...props} scene={props.scene} />;
}

function sceneKey(scene: IntroScene) {
  return scene.kind === "headline" ? `headline-${scene.exampleIndex}` : scene.kind;
}

export function IntroStory() {
  const storyRef = useRef<HTMLElement>(null);
  const { markLayoutComplete, playback, shouldReduceMotion } = useIntroTimeline(storyRef);
  const currentScene = introScenes[playback.sceneIndex] ?? introScenes[0]!;

  if (shouldReduceMotion) {
    return (
      <section className="intro-story is-static" id="top" ref={storyRef}>
        <span className="hero-brand-visibility-sentinel" aria-hidden="true" />
        {introScenes.map((scene) => (
          <SceneView key={scene.id} scene={scene} staticScene />
        ))}
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
      data-shimmer-active={playback.shimmerRun === null ? undefined : "true"}
      style={{ minHeight: `${(timelineUnits + 1) * 100}svh` }}
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
              <SceneView
                direction={playback.direction}
                key={sceneKey(currentScene)}
                messagePhase={playback.messagePhase}
                onLayoutComplete={markLayoutComplete}
                run={playback.shimmerRun}
                scene={currentScene}
                sceneIndex={playback.sceneIndex}
              />
            </AnimatePresence>
          </LayoutGroup>
        </div>
      </motion.div>
    </section>
  );
}
