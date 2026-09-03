import type { Transition, Variants } from "motion/react";

export const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const easeOutQuint: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const storySceneVariants: Variants = {
  enter: (direction: 1 | -1) => ({
    opacity: 0,
    y: direction * 40,
  }),
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.62, ease: easeOutExpo },
  },
  exit: (direction: 1 | -1) => ({
    opacity: 0,
    y: direction * -32,
    transition: { duration: 0.3, ease: easeOutExpo },
  }),
};

export const headlineLayoutTransition: Transition = {
  layout: {
    type: "spring",
    stiffness: 520,
    damping: 42,
    mass: 0.82,
  },
};

export const viewReveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { amount: 0.35, once: true },
  transition: { duration: 0.5, ease: easeOutExpo },
} as const;

export const shimmerMotion = {
  delay: 0.08,
  duration: 0.35,
  opacity: [0, 0.7, 1, 1, 0.45, 0],
  positions: ["130% 50%", "114% 50%", "95% 50%", "42% 50%", "-5% 50%", "-30% 50%"],
  times: [0, 0.1, 0.22, 0.68, 0.88, 1],
} as const;

export const shimmerCompression = {
  duration: 0.07,
  ease: [0.32, 0, 0.67, 0] as [number, number, number, number],
  scale: 0.955,
} as const;

export const shimmerRelease: Transition = {
  type: "spring",
  stiffness: 620,
  damping: 32,
  mass: 0.42,
};
