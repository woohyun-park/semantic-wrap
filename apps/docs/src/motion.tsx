import { useEffect, useState, type ReactNode } from "react";
import {
  motion,
  useAnimationControls,
  useIsPresent,
  type HTMLMotionProps,
} from "motion/react";
import { sceneVariants } from "./motion-values";

type SceneFrameProps = Omit<
  HTMLMotionProps<"div">,
  "animate" | "children" | "custom" | "exit" | "initial" | "variants"
> & {
  children: ReactNode;
  direction?: 1 | -1;
  staticScene?: boolean;
};

export function SceneFrame({
  children,
  direction = 1,
  staticScene = false,
  ...props
}: SceneFrameProps) {
  const isPresent = useIsPresent();
  const current = staticScene || isPresent;

  return (
    <motion.div
      {...props}
      data-intro-current={current ? "true" : undefined}
      aria-hidden={!current}
      custom={direction}
      variants={sceneVariants}
      initial={staticScene ? false : "enter"}
      animate={staticScene ? undefined : "center"}
      exit={staticScene ? undefined : "exit"}
    >
      {children}
    </motion.div>
  );
}

const shimmer = {
  delay: 0.08,
  duration: 0.35,
  opacity: [0, 0.7, 1, 1, 0.45, 0],
  positions: ["130% 50%", "114% 50%", "95% 50%", "42% 50%", "-5% 50%", "-30% 50%"],
  times: [0, 0.1, 0.22, 0.68, 0.88, 1],
} as const;

export function ShimmerText({
  children,
  run,
}: {
  children: string;
  run: number | null;
}) {
  const target = useAnimationControls();
  const overlay = useAnimationControls();
  const active = run !== null;
  const [motionState, setMotionState] = useState<"complete" | "idle" | "running">("idle");

  useEffect(() => {
    let cancelled = false;
    target.stop();
    overlay.stop();

    if (!active) {
      setMotionState("idle");
      target.set({ scale: 1 });
      overlay.set({ backgroundPosition: "130% 50%", opacity: 0 });
      return undefined;
    }

    setMotionState("running");

    void target.start({
      scale: 0.955,
      transition: { duration: 0.07, ease: [0.32, 0, 0.67, 0] },
    }).then(() => {
      if (!cancelled) {
        return target.start({
          scale: 1,
          transition: { type: "spring", stiffness: 620, damping: 32, mass: 0.42 },
        });
      }
      return undefined;
    });

    void overlay.start({
      backgroundPosition: [...shimmer.positions],
      opacity: [...shimmer.opacity],
      transition: {
        delay: shimmer.delay,
        duration: shimmer.duration,
        ease: "linear",
        times: [...shimmer.times],
      },
    }).then(() => {
      if (!cancelled) setMotionState("complete");
    });

    return () => {
      cancelled = true;
      target.stop();
      overlay.stop();
    };
  }, [active, overlay, run, target]);

  return (
    <motion.span
      animate={target}
      className="gradient-text-safe text-shimmer-target"
      data-motion-shimmer={active ? "active" : "idle"}
      data-motion-shimmer-run={run ?? undefined}
      data-motion-shimmer-state={motionState}
      initial={false}
    >
      {children}
      <motion.span
        animate={overlay}
        className="text-shimmer"
        initial={false}
        aria-hidden="true"
      >
        {children}
      </motion.span>
    </motion.span>
  );
}
