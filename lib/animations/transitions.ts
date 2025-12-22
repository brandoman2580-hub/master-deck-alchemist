/**
 * Page Transition Utilities
 * 
 * Utilities for smooth page transitions and route changes.
 */

import type { Transition } from "framer-motion";
import { ANIMATION_DURATION, EASING } from "./constants";

/**
 * Default page transition configuration
 */
export const defaultPageTransition: Transition = {
  duration: ANIMATION_DURATION.normal,
  ease: EASING.smooth,
};

/**
 * Fast page transition for quick navigation
 */
export const fastPageTransition: Transition = {
  duration: ANIMATION_DURATION.fast,
  ease: EASING.smooth,
};

/**
 * Slow page transition for deliberate navigation
 */
export const slowPageTransition: Transition = {
  duration: ANIMATION_DURATION.slow,
  ease: EASING.elegant,
};

/**
 * Get transition based on reduced motion preference
 */
export function getTransition(
  transition: Transition = defaultPageTransition,
): Transition {
  if (typeof window === "undefined") return transition;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion) {
    return {
      duration: 0,
      ease: EASING.smooth,
    };
  }

  return transition;
}

/**
 * Page transition variants for Next.js App Router
 */
export function getPageTransitionVariants() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }

  return {
    initial: {
      opacity: 0,
      y: 20,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: defaultPageTransition,
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: fastPageTransition,
    },
  };
}

/**
 * Layout transition for shared elements
 */
export function getLayoutTransition(): Transition {
  return getTransition({
    duration: ANIMATION_DURATION.normal,
    ease: EASING.smooth,
  });
}

