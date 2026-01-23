import type { Variants } from "framer-motion";
import {
  ANIMATION_DURATION,
  EASING,
  SCALE,
  TRANSLATE,
} from "./constants";

/**
 * Check if user prefers reduced motion
 */
const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/**
 * Base variant configuration
 */
const baseConfig = {
  duration: ANIMATION_DURATION.normal,
  ease: EASING.smooth,
};

/**
 * Fade in variants
 */
export const fadeInVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Fade in from bottom
 */
export const fadeInUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: prefersReducedMotion() ? 0 : TRANSLATE.slideUp,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Fade in from top
 */
export const fadeInDownVariants: Variants = {
  hidden: {
    opacity: 0,
    y: prefersReducedMotion() ? 0 : TRANSLATE.slideDown,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Fade in from left
 */
export const fadeInLeftVariants: Variants = {
  hidden: {
    opacity: 0,
    x: prefersReducedMotion() ? 0 : TRANSLATE.slideLeft,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Fade in from right
 */
export const fadeInRightVariants: Variants = {
  hidden: {
    opacity: 0,
    x: prefersReducedMotion() ? 0 : TRANSLATE.slideRight,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Scale in variants
 */
export const scaleInVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: prefersReducedMotion() ? 1 : SCALE.initial,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Scale in from bottom
 */
export const scaleUpVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: prefersReducedMotion() ? 1 : SCALE.initial,
    y: prefersReducedMotion() ? 0 : TRANSLATE.slideUp,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Scale in from top
 */
export const scaleDownVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: prefersReducedMotion() ? 1 : SCALE.initial,
    y: prefersReducedMotion() ? 0 : TRANSLATE.slideDown,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Slide in from left
 */
export const slideInLeftVariants: Variants = {
  hidden: {
    opacity: 0,
    x: prefersReducedMotion() ? 0 : -TRANSLATE.slideLeft,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Slide in from right
 */
export const slideInRightVariants: Variants = {
  hidden: {
    opacity: 0,
    x: prefersReducedMotion() ? 0 : -TRANSLATE.slideRight,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Slide in from top
 */
export const slideInUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: prefersReducedMotion() ? 0 : -TRANSLATE.slideUp,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Slide in from bottom
 */
export const slideInDownVariants: Variants = {
  hidden: {
    opacity: 0,
    y: prefersReducedMotion() ? 0 : -TRANSLATE.slideDown,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Stagger container for children animations
 */
export const staggerContainer = (
  delay: number = 0.1,
): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: prefersReducedMotion() ? 0 : delay,
      delayChildren: prefersReducedMotion() ? 0 : 0.1,
    },
  },
});

/**
 * Stagger item (used with staggerContainer)
 */
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: prefersReducedMotion() ? 0 : 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...baseConfig },
  },
};

/**
 * Page transition variants
 */
export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: prefersReducedMotion() ? 0 : 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          duration: ANIMATION_DURATION.normal,
          ease: EASING.smooth,
        },
  },
  exit: {
    opacity: 0,
    y: prefersReducedMotion() ? 0 : -20,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          duration: ANIMATION_DURATION.fast,
          ease: EASING.smooth,
        },
  },
};

/**
 * Modal/Dialog variants
 */
export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: prefersReducedMotion() ? 1 : SCALE.initial,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          duration: ANIMATION_DURATION.normal,
          ease: EASING.elegant,
        },
  },
  exit: {
    opacity: 0,
    scale: prefersReducedMotion() ? 1 : SCALE.initial,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          duration: ANIMATION_DURATION.fast,
          ease: EASING.smooth,
        },
  },
};

/**
 * Backdrop variants
 */
export const backdropVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          duration: ANIMATION_DURATION.normal,
          ease: EASING.smooth,
        },
  },
  exit: {
    opacity: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          duration: ANIMATION_DURATION.fast,
          ease: EASING.smooth,
        },
  },
};

/**
 * Pulse variants for empty states and loading indicators
 */
export const pulseVariants: Variants = {
  hidden: {
    opacity: 0.5,
    scale: 1,
  },
  visible: {
    opacity: [0.5, 1, 0.5],
    scale: [1, 1.02, 1],
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          duration: 2,
          repeat: Infinity,
          ease: EASING.gentle,
        },
  },
};

/**
 * Ripple effect variants for button clicks
 */
export const rippleVariants: Variants = {
  initial: {
    scale: 0,
    opacity: 0.6,
  },
  animate: {
    scale: 4,
    opacity: 0,
    transition: {
      duration: ANIMATION_DURATION.normal,
      ease: EASING.smooth,
    },
  },
};

/**
 * Message bubble variants with spring physics for natural feel
 */
export const messageBubbleVariants: Variants = {
  hidden: {
    opacity: 0,
    y: prefersReducedMotion() ? 0 : 20,
    scale: prefersReducedMotion() ? 1 : 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          type: "spring",
          stiffness: 300,
          damping: 25,
          mass: 0.5,
        },
  },
};

/**
 * Message container variants for staggering multiple messages
 */
export const messageContainerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          staggerChildren: 0.1,
          delayChildren: 0.05,
        },
  },
};

/**
 * User message bubble variants (slides from right)
 */
export const userMessageVariants: Variants = {
  hidden: {
    opacity: 0,
    x: prefersReducedMotion() ? 0 : 20,
    scale: prefersReducedMotion() ? 1 : 0.95,
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          type: "spring",
          stiffness: 300,
          damping: 25,
          mass: 0.5,
        },
  },
};

/**
 * Assistant message bubble variants (slides from left)
 */
export const assistantMessageVariants: Variants = {
  hidden: {
    opacity: 0,
    x: prefersReducedMotion() ? 0 : -20,
    scale: prefersReducedMotion() ? 1 : 0.95,
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : {
          type: "spring",
          stiffness: 300,
          damping: 25,
          mass: 0.5,
        },
  },
};
