"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ANIMATION_DURATION, EASING } from "@/lib/animations";

export interface AnimatedCheckmarkProps {
  className?: string;
  "aria-label"?: string;
}

export function AnimatedCheckmark({ className, ...props }: AnimatedCheckmarkProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn("h-4 w-4", className)}
        role="img"
        aria-hidden={props["aria-label"] ? undefined : true}
        {...props}
      >
        <path
          d="M20 6L9 17l-5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <motion.svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4", className)}
      role="img"
      aria-hidden={props["aria-label"] ? undefined : true}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        duration: ANIMATION_DURATION.fast,
        ease: EASING.smooth,
      }}
      {...props}
    >
      <motion.path
        d="M20 6L9 17l-5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: ANIMATION_DURATION.slow,
          ease: EASING.smooth,
        }}
      />
    </motion.svg>
  );
}

