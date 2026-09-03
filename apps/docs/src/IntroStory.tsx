import { useSemanticWrap } from "@semantic-wrap/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useAnimationControls,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import {
  easeOutExpo,
  easeOutQuint,
  headlineLayoutTransition,
} from "./motion-values";
import {
  landingContent,
  type LandingContent,
  type LineBreakExample,
} from "./landing-content";
import { SceneFrame, ShimmerText } from "./motion";
import { titleModels } from "./site-models";
import {
  ArrowIcon,
  BrandLockup,
  CheckIcon,
  CopyIcon,
} from "./site";
import { copyText, docsPath, type SiteLocale } from "./site-config";

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

function buildIntroScenes(examples: readonly LineBreakExample[]): readonly IntroScene[] {
  return [
    { id: "hero", kind: "hero", weight: 1 },
    { id: "message", kind: "message", weight: 2.2, shimmerAt: 0.7 },
    ...examples.flatMap<IntroScene>((example, exampleIndex) => [
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
}

const shimmerResetAt = 0.15;

function resolveTimeline(
  progress: number,
  scenes: readonly IntroScene[],
  timelineUnits: number,
) {
  const scaledProgress = Math.min(1, Math.max(0, progress)) * timelineUnits;
  let sceneStart = 0;

  for (const [sceneIndex, scene] of scenes.entries()) {
    const isLast = sceneIndex === scenes.length - 1;
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

  return { scene: scenes[0]!, sceneIndex: 0, scaledProgress: 0, sceneProgress: 0 };
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

function useIntroTimeline(
  storyRef: RefObject<HTMLElement | null>,
  scenes: readonly IntroScene[],
  timelineUnits: number,
) {
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
    const next = resolveTimeline(progress, scenes, timelineUnits);
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
  }, [scenes, shouldReduceMotion, timelineUnits]);

  useMotionValueEvent(scrollYProgress, "change", syncProgress);

  useEffect(() => {
    syncProgress(scrollYProgress.get());
  }, [scrollYProgress, syncProgress]);

  const markLayoutComplete = useCallback((sceneIndex: number) => {
    if (cursor.current.sceneIndex !== sceneIndex) return;

    const scene = scenes[sceneIndex];
    const gate = shimmer.current;
    if (!scene || scene.shimmerAt === undefined) return;

    gate.layoutReady = true;
    if (!gate.pending || !gate.armed) return;

    gate.pending = false;
    gate.armed = false;
    gate.run = ++runCount.current;
    setPlayback((current) => ({ ...current, shimmerRun: gate.run }));
  }, [scenes]);

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

function StartAction({ content, locale }: { content: LandingContent; locale: SiteLocale }) {
  return (
    <a
      className="primary-action"
      href={docsPath(locale)}
      onPointerMove={moveActionSpotlight}
      onPointerLeave={resetActionSpotlight}
    >
      <span>{content.intro.start}</span>
      <span className="action-arrow" aria-hidden="true">
        <ArrowIcon />
        <ArrowIcon />
      </span>
    </a>
  );
}

function InstallCommand({ content }: { content: LandingContent }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copyState === "idle") return undefined;
    const timeout = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  async function copyCommand() {
    const copied = await copyText(content.intro.installCommand);
    setCopyState(copied ? "copied" : "failed");
  }

  const copyLabel = copyState === "copied" ? content.intro.copied : content.intro.copyFailed;

  return (
    <motion.button
      type="button"
      className={`quick-install${copyState === "idle" ? "" : ` is-${copyState}`}`}
      onClick={copyCommand}
      aria-label={content.intro.copy}
      animate={copyState === "copied" ? { scale: [1, 0.97, 1] } : { scale: 1 }}
      transition={{ duration: 0.26, ease: easeOutExpo }}
    >
      <code><span className="gradient-text-safe" aria-hidden="true">~ </span>{content.intro.installCommand}</code>
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

type HeadlineToken = {
  end: number;
  start: number;
  text: string;
};

function headlineTokens(text: string): readonly HeadlineToken[] {
  return [...text.matchAll(/\S+/gu)].map((match) => ({
    end: (match.index ?? 0) + match[0].length,
    start: match.index ?? 0,
    text: match[0],
  }));
}

function lineIndexAt(offset: number, breaks: readonly number[]): number {
  let lineIndex = 0;
  for (const breakOffset of breaks) {
    if (offset < breakOffset) break;
    lineIndex += 1;
  }
  return lineIndex;
}

function LineBreakHeadline({
  example,
  onLayoutComplete,
  run,
  sceneIndex,
  semantic,
  staticScene = false,
  content,
  locale,
}: {
  content: LandingContent;
  example: LineBreakExample;
  locale: SiteLocale;
  onLayoutComplete?: (sceneIndex: number) => void;
  run: number | null;
  sceneIndex?: number;
  semantic: boolean;
  staticScene?: boolean;
}) {
  const { ref, selection, diagnostics } = useSemanticWrap({
    text: example.text,
    model: titleModels[locale],
    diagnostics: true,
  });
  const currentSelection = selection?.text === example.text ? selection : null;
  const currentDiagnostics = currentSelection ? diagnostics : null;
  const nativeBreaks = currentDiagnostics?.nativeLayout?.breaks ?? [];
  const semanticBreaks = currentSelection?.breaks ?? nativeBreaks;
  const displayedBreaks = semantic ? semanticBreaks : nativeBreaks;
  const displayedBreakOffsets = new Set(displayedBreaks);
  const tokens = useMemo(() => headlineTokens(example.text), [example.text]);
  const changedTokenIndexes = new Set<number>();
  if (currentSelection?.applied) {
    for (const [index, token] of tokens.entries()) {
      if (lineIndexAt(token.start, nativeBreaks) !== lineIndexAt(token.start, semanticBreaks)) {
        changedTokenIndexes.add(index);
      }
    }
  }
  const lastChangedIndex = Math.max(-1, ...changedTokenIndexes);
  const measureStyle = {
    "--line-break-measure": `${example.introMeasureEm}em`,
  } as CSSProperties;

  return (
    <Fragment>
      <p
        className="line-break-headline-measure-source"
        ref={ref}
        aria-hidden="true"
        lang={locale}
        style={measureStyle}
      >
        {example.text}
      </p>
      <motion.p
        className="line-break-headline"
        layout={staticScene ? false : true}
        aria-label={`${semantic ? content.intro.semanticLabel : content.intro.nativeLabel}: ${example.text}`}
        data-baseline="css-balance"
        data-breaks={displayedBreaks.join(",")}
        data-selection-applied={currentSelection?.applied ? "true" : "false"}
        data-semantic-phrase={example.semanticPhrase}
        data-source-text={example.text}
        lang={locale}
        style={measureStyle}
      >
        {tokens.map((token, index) => {
          const previousToken = tokens[index - 1];
          const followsBreak = previousToken
            ? displayedBreakOffsets.has(previousToken.end)
            : false;
          const hasBreak = displayedBreakOffsets.has(token.end);
          const changed = changedTokenIndexes.has(index);
          const shimmerTarget = semantic && changed;
          const pieceClassName = [
            "line-break-piece",
            changed ? "is-focus" : "",
          ].filter(Boolean).join(" ");

          return (
            <Fragment key={`${example.id}-${token.start}`}>
              {index > 0 && !followsBreak ? (
                <span className="line-break-gap" aria-hidden="true">{" "}</span>
              ) : null}
              <motion.span
                className={pieceClassName}
                data-flip-piece={`${example.id}-${index}`}
                data-motion-layout={staticScene ? undefined : "position"}
                data-piece-index={index}
                data-piece-start={token.start}
                data-piece-end={token.end}
                layout={staticScene ? false : "position"}
                layoutDependency={`${semantic}:${displayedBreaks.join(",")}`}
                initial={staticScene ? false : { opacity: 0, y: 19 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...headlineLayoutTransition,
                  delay: index * 0.025,
                  duration: 0.62,
                  ease: easeOutExpo,
                }}
                onLayoutAnimationComplete={
                  index === lastChangedIndex && sceneIndex !== undefined
                    ? () => onLayoutComplete?.(sceneIndex)
                    : undefined
                }
                aria-hidden="true"
              >
                {shimmerTarget ? <ShimmerText run={run}>{token.text}</ShimmerText> : token.text}
              </motion.span>
              {hasBreak ? <span className="line-break-force" aria-hidden="true" /> : null}
            </Fragment>
          );
        })}
      </motion.p>
    </Fragment>
  );
}

type SceneViewProps = {
  content: LandingContent;
  direction?: 1 | -1;
  examples: readonly LineBreakExample[];
  locale: SiteLocale;
  messagePhase?: MessagePhase | null;
  onLayoutComplete?: (sceneIndex: number) => void;
  run?: number | null;
  scene: IntroScene;
  sceneIndex?: number;
  staticScene?: boolean;
};

function HeroScrollCue({ staticScene }: { staticScene: boolean }) {
  const controls = useAnimationControls();

  useEffect(() => {
    controls.set({ opacity: 0.58, y: 0 });
    if (staticScene) return undefined;

    void controls.start({
      opacity: [0.58, 1, 0.58],
      y: [0, 6, 0],
      transition: { duration: 1.8, ease: easeOutQuint, repeat: Infinity },
    });
    return () => controls.stop();
  }, [controls, staticScene]);

  return (
    <div className="hero-scroll-cue" aria-hidden="true">
      <motion.span animate={controls} initial={false}>↓</motion.span>
    </div>
  );
}

function HeroScene({ content, direction, locale, staticScene }: SceneViewProps) {
  return (
    <SceneFrame
      className="hero-brand-stage intro-story-scene"
      direction={direction}
      staticScene={staticScene}
    >
      <div className="hero-brand-content">
        <BrandLockup className="hero-brand-lockup" priority />
        <InstallCommand content={content} />
        <StartAction content={content} locale={locale} />
      </div>
      <HeroScrollCue staticScene={Boolean(staticScene)} />
    </SceneFrame>
  );
}

function MessageScene({
  direction,
  content,
  messagePhase: phase,
  run,
  staticScene,
}: Pick<SceneViewProps, "content" | "direction" | "messagePhase" | "run" | "staticScene">) {
  const resolvedPhase = staticScene ? "complete" : phase ?? "blank";
  const sourceVisible = resolvedPhase === "source" || resolvedPhase === "complete";
  const highlightVisible = resolvedPhase === "complete";

  return (
    <SceneFrame
      className="intro-message-stage intro-story-scene"
      direction={direction}
      staticScene={staticScene}
    >
      <p className="intro-message-copy" aria-label={content.intro.message.join(" ")}>
        <motion.span
          className="intro-message-source"
          initial={false}
          animate={sourceVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: 0.52, ease: easeOutExpo }}
        >
          {content.intro.message[0]}
        </motion.span>
        <motion.span
          className="intro-message-highlight"
          initial={false}
          animate={highlightVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: 0.56, ease: easeOutExpo }}
        >
          <ShimmerText run={run ?? null}>{content.intro.message[1]}</ShimmerText>
        </motion.span>
      </p>
    </SceneFrame>
  );
}

function HeadlineScene({
  direction,
  content,
  examples,
  locale,
  onLayoutComplete,
  run,
  scene,
  sceneIndex,
  staticScene,
}: SceneViewProps & { scene: IntroScene & { kind: "headline" } }) {
  const example = examples[scene.exampleIndex] ?? examples[0];
  if (!example) return null;

  return (
    <SceneFrame
      className="line-break-composition page-width intro-story-scene"
      direction={direction}
      staticScene={staticScene}
      data-semantic={scene.semantic ? "true" : "false"}
      data-semantic-phrase={example.semanticPhrase}
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
            aria-label={`${scene.semantic ? content.intro.semanticLabel : content.intro.nativeLabel}`}
          >
            <span className={scene.semantic ? undefined : "is-current"}>BEFORE</span>
            <span aria-hidden="true">→</span>
            <span className={scene.semantic ? "is-current" : undefined}>AFTER</span>
          </p>
          <span className="line-break-example-count">
            {String(scene.exampleIndex + 1).padStart(2, "0")} /{" "}
            {String(examples.length).padStart(2, "0")}
          </span>
        </div>
        <p className="line-break-scene-description">
          {scene.semantic ? example.semanticDescription : example.nativeDescription}
        </p>
      </motion.div>
      <LineBreakHeadline
        example={example}
        content={content}
        locale={locale}
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
    return <HeroScene {...props} />;
  }
  if (props.scene.kind === "message") {
    return (
      <MessageScene
        direction={props.direction}
        content={props.content}
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

export function IntroStory({ locale }: { locale: SiteLocale }) {
  const storyRef = useRef<HTMLElement>(null);
  const content = landingContent[locale];
  const scenes = useMemo(() => buildIntroScenes(content.examples), [content.examples]);
  const timelineUnits = useMemo(
    () => scenes.reduce((total, scene) => total + scene.weight, 0),
    [scenes],
  );
  const { markLayoutComplete, playback, shouldReduceMotion } = useIntroTimeline(
    storyRef,
    scenes,
    timelineUnits,
  );
  const currentScene = scenes[playback.sceneIndex] ?? scenes[0]!;

  if (shouldReduceMotion) {
    return (
      <section className="intro-story is-static" id="top" ref={storyRef}>
        <span className="hero-brand-visibility-sentinel" aria-hidden="true" />
        {scenes.map((scene) => (
          <SceneView
            content={content}
            examples={content.examples}
            key={scene.id}
            locale={locale}
            scene={scene}
            staticScene
          />
        ))}
      </section>
    );
  }

  return (
    <section
      className="intro-story"
      id="top"
      aria-label={content.intro.comparisonLabel}
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
                content={content}
                examples={content.examples}
                key={sceneKey(currentScene)}
                messagePhase={playback.messagePhase}
                onLayoutComplete={markLayoutComplete}
                run={playback.shimmerRun}
                scene={currentScene}
                sceneIndex={playback.sceneIndex}
                locale={locale}
              />
            </AnimatePresence>
          </LayoutGroup>
        </div>
      </motion.div>
    </section>
  );
}
