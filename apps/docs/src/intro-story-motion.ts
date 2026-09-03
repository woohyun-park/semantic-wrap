import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";

export type IntroStoryScene =
  | { kind: "hero" }
  | { kind: "message" }
  | { kind: "headline"; exampleIndex: number; semantic: boolean };

export type IntroMessagePhase = "blank" | "source" | "complete";

export type IntroStoryPlayback = {
  direction: 1 | -1;
  messagePhase: IntroMessagePhase | null;
  shimmerActive: boolean;
  stepIndex: number;
};

type IntroStoryRuntime = IntroStoryPlayback & {
  armed: boolean;
  layoutReady: boolean;
  scaledProgress: number;
  sceneProgress: number;
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
const introExampleCount = 3;

const introStorySceneWeights = [
  introHeroSceneWeight,
  introMessageSceneWeight,
  ...Array.from({ length: introExampleCount }, () => [
    introBeforeSceneWeight,
    introAfterSceneWeight,
  ]).flat(),
];

export const introStoryTimelineUnits = introStorySceneWeights.reduce(
  (total, weight) => total + weight,
  0,
);

const initialPlayback: IntroStoryPlayback = {
  direction: 1,
  messagePhase: null,
  shimmerActive: false,
  stepIndex: 0,
};

const initialRuntime: IntroStoryRuntime = {
  ...initialPlayback,
  armed: true,
  layoutReady: true,
  scaledProgress: 0,
  sceneProgress: 0,
  thresholdCrossed: false,
};

export function getIntroStoryScene(stepIndex: number): IntroStoryScene {
  if (stepIndex === 0) return { kind: "hero" };
  if (stepIndex === 1) return { kind: "message" };

  const headlineStep = stepIndex - 2;
  return {
    kind: "headline",
    exampleIndex: Math.floor(headlineStep / 2),
    semantic: headlineStep % 2 === 1,
  };
}

function getIntroStoryScrollState(progress: number) {
  const timelineProgress = progress * introStoryTimelineUnits;
  let sceneStart = 0;

  for (const [stepIndex, sceneWeight = 1] of introStorySceneWeights.entries()) {
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

function sceneUsesShimmer(scene: IntroStoryScene) {
  return scene.kind === "message" || (scene.kind === "headline" && scene.semantic);
}

function messagePhaseFor(
  scene: IntroStoryScene,
  sceneProgress: number,
): IntroMessagePhase | null {
  if (scene.kind !== "message") return null;
  if (sceneProgress >= storyMessageCompletePoint) return "complete";
  if (sceneProgress >= storyMessageSourcePoint) return "source";
  return "blank";
}

function playbackFromRuntime(runtime: IntroStoryRuntime): IntroStoryPlayback {
  return {
    direction: runtime.direction,
    messagePhase: runtime.messagePhase,
    shimmerActive: runtime.shimmerActive,
    stepIndex: runtime.stepIndex,
  };
}

function playbackChanged(left: IntroStoryRuntime, right: IntroStoryRuntime) {
  return left.direction !== right.direction
    || left.messagePhase !== right.messagePhase
    || left.shimmerActive !== right.shimmerActive
    || left.stepIndex !== right.stepIndex;
}

export function useIntroStoryMotion(storyRef: RefObject<HTMLElement | null>) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({
    target: storyRef,
    offset: ["start start", "end end"],
  });
  const runtimeRef = useRef<IntroStoryRuntime>(initialRuntime);
  const [playback, setPlayback] = useState<IntroStoryPlayback>(initialPlayback);

  const syncProgress = useCallback((progress: number) => {
    if (shouldReduceMotion) return;

    const previous = runtimeRef.current;
    const { scaledProgress, sceneProgress, stepIndex } = getIntroStoryScrollState(progress);
    const scene = getIntroStoryScene(stepIndex);
    const sceneChanged = stepIndex !== previous.stepIndex;
    const movingForward = scaledProgress > previous.scaledProgress;
    const triggerPoint = scene.kind === "message"
      ? storyMessageShimmerTriggerPoint
      : storyShimmerTriggerPoint;
    let armed = sceneChanged ? movingForward : previous.armed;
    let layoutReady = sceneChanged
      ? !sceneUsesShimmer(scene) || scene.kind === "message"
      : previous.layoutReady;
    let thresholdCrossed = sceneChanged ? false : previous.thresholdCrossed;
    let shimmerActive = sceneChanged ? false : previous.shimmerActive;

    if (sceneProgress <= storyShimmerResetPoint) {
      armed = true;
      thresholdCrossed = false;
      shimmerActive = false;
    }

    const crossedTrigger = sceneChanged
      ? sceneProgress >= triggerPoint
      : previous.sceneProgress < triggerPoint && sceneProgress >= triggerPoint;
    if (movingForward && armed && crossedTrigger && sceneUsesShimmer(scene)) {
      thresholdCrossed = true;
      if (layoutReady) {
        shimmerActive = true;
        armed = false;
      }
    }

    if (!sceneUsesShimmer(scene)) layoutReady = true;

    const next: IntroStoryRuntime = {
      armed,
      direction: sceneChanged
        ? stepIndex > previous.stepIndex ? 1 : -1
        : previous.direction,
      layoutReady,
      messagePhase: messagePhaseFor(scene, sceneProgress),
      scaledProgress,
      sceneProgress,
      shimmerActive,
      stepIndex,
      thresholdCrossed,
    };

    runtimeRef.current = next;
    if (playbackChanged(previous, next)) setPlayback(playbackFromRuntime(next));
  }, [shouldReduceMotion]);

  useMotionValueEvent(scrollYProgress, "change", syncProgress);

  useEffect(() => {
    syncProgress(scrollYProgress.get());
  }, [scrollYProgress, syncProgress]);

  const markLayoutSettled = useCallback((stepIndex: number) => {
    const previous = runtimeRef.current;
    if (previous.stepIndex !== stepIndex) return;

    const scene = getIntroStoryScene(stepIndex);
    if (!sceneUsesShimmer(scene)) return;

    const shimmerActive = previous.thresholdCrossed && previous.armed
      ? true
      : previous.shimmerActive;
    const next: IntroStoryRuntime = {
      ...previous,
      armed: shimmerActive ? false : previous.armed,
      layoutReady: true,
      shimmerActive,
    };
    runtimeRef.current = next;
    if (playbackChanged(previous, next)) setPlayback(playbackFromRuntime(next));
  }, []);

  return { markLayoutSettled, playback, shouldReduceMotion };
}
