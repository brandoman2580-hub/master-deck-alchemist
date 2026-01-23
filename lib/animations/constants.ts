/**
 * Animation durations in seconds
 */
export const ANIMATION_DURATION = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  slower: 0.8,
} as const;

/**
 * Easing functions (cubic-bezier values)
 * Used for smooth, professional transitions
 */
export const EASING = {
  smooth: [0.4, 0, 0.2, 1] as const, // Standard smooth easing
  elegant: [0.25, 0.1, 0.25, 1] as const, // Elegant, refined easing
  gentle: [0.2, 0, 0, 1] as const, // Gentle, subtle easing
  bounce: [0.68, -0.55, 0.265, 1.55] as const, // Playful bounce (use sparingly)
} as const;

/**
 * Spring physics configurations for natural motion
 */
export const SPRING_CONFIG = {
  gentle: { tension: 120, friction: 14 },
  bouncy: { tension: 300, friction: 20 },
  stiff: { tension: 500, friction: 30 },
} as const;

/**
 * Common animation delays for staggered animations
 */
export const STAGGER_DELAY = {
  fast: 0.05,
  normal: 0.1,
  slow: 0.15,
} as const;

/**
 * Scale values for subtle animations
 */
export const SCALE = {
  hover: 1.02,
  hoverLarge: 1.05,
  active: 0.98,
  initial: 0.95,
  initialSubtle: 0.98,
} as const;

/**
 * Translation values for slide animations
 */
export const TRANSLATE = {
  slideUp: 20,
  slideDown: -20,
  slideLeft: 20,
  slideRight: -20,
} as const;

