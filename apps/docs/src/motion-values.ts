import type { Transition, Variants } from "motion/react";

export const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const easeOutQuint: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const headlineLayoutTransition: Transition = {
  layout: {
    type: "spring",
    stiffness: 520,
    damping: 42,
    mass: 0.82,
  },
};

export const revealMotion = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { amount: 0.35, once: true },
  transition: { duration: 0.5, ease: easeOutExpo },
} as const;

export const sceneVariants: Variants = {
  enter: (direction: 1 | -1) => ({ opacity: 0, y: direction * 40 }),
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
