import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ANIMATION_DURATION, EASING, SCALE } from "./constants";

/**
 * Hook to detect if element is in viewport
 * Useful for scroll-triggered animations
 */
export function useInViewAnimation(
  ref: React.RefObject<HTMLElement>,
  options?: {
    once?: boolean;
    amount?: number;
    margin?: string;
  },
) {
  const isInView = useInView(ref, {
    once: options?.once ?? true,
    amount: options?.amount ?? 0.2,
    ...(options?.margin ? { margin: options.margin as any } : {}),
  });

  return isInView;
}

/**
 * Hook for fade-in animation
 */
export function useFadeIn(
  delay: number = 0,
  duration: number = ANIMATION_DURATION.normal,
) {
  const prefersReducedMotion = useReducedMotion();

  return {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : {
            duration,
            delay,
            ease: EASING.smooth,
          },
    },
  };
}

/**
 * Hook for slide-in animation
 */
export function useSlideIn(
  direction: "up" | "down" | "left" | "right" = "up",
  delay: number = 0,
  distance: number = 20,
) {
  const prefersReducedMotion = useReducedMotion();

  const directions = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
  };

  return {
    initial: {
      opacity: 0,
      ...(prefersReducedMotion ? {} : directions[direction]),
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : {
            duration: ANIMATION_DURATION.normal,
            delay,
            ease: EASING.smooth,
          },
    },
  };
}

/**
 * Hook for scale-in animation
 */
export function useScaleIn(
  delay: number = 0,
  initialScale: number = SCALE.initial,
) {
  const prefersReducedMotion = useReducedMotion();

  return {
    initial: {
      opacity: 0,
      scale: prefersReducedMotion ? 1 : initialScale,
    },
    animate: {
      opacity: 1,
      scale: 1,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : {
            duration: ANIMATION_DURATION.normal,
            delay,
            ease: EASING.elegant,
          },
    },
  };
}

/**
 * Hook for hover animations
 */
export function useHoverAnimation(
  scale: number = SCALE.hover,
  lift: number = -2,
) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return {
      whileHover: {},
      whileTap: {},
    };
  }

  return {
    whileHover: {
      scale,
      y: lift,
      transition: {
        duration: ANIMATION_DURATION.fast,
        ease: EASING.smooth,
      },
    },
    whileTap: {
      scale: SCALE.active,
      transition: {
        duration: ANIMATION_DURATION.instant,
      },
    },
  };
}

/**
 * Hook for number counter animation
 */
export function useCounterAnimation(
  targetValue: number,
  duration: number = ANIMATION_DURATION.normal,
) {
  const prefersReducedMotion = useReducedMotion();
  const [count, setCount] = useState(targetValue);
  const previousValueRef = useRef(targetValue);

  useEffect(() => {
    if (prefersReducedMotion) {
      setCount(targetValue);
      previousValueRef.current = targetValue;
      return;
    }

    // If value hasn't changed, don't animate
    if (targetValue === previousValueRef.current) {
      return;
    }

    let startTime: number | null = null;
    const startValue = previousValueRef.current;

    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(
        startValue + (targetValue - startValue) * easeOut,
      );

      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(targetValue);
        previousValueRef.current = targetValue;
      }
    };

    requestAnimationFrame(animate);
  }, [targetValue, duration, prefersReducedMotion]);

  return count;
}

/**
 * Hook to detect if animation should be reduced
 * Returns true if user prefers reduced motion
 */
export function useAnimationEnabled(): boolean {
  const prefersReducedMotion = useReducedMotion();
  return !prefersReducedMotion;
}

