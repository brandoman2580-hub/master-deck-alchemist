"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT, TAB_INDICATOR_S } from "@/lib/motion/tokens";

/**
 * Ice tab indicator. It slides between tabs on the compositor via layout.
 * Hover color stays a CSS class so the inversion is instant.
 */
export function SlidingTabMark({
  layoutId,
  className,
}: {
  layoutId: string;
  className: string;
}): ReactNode {
  const reduce = useReducedMotion();
  if (reduce) {
    return <span aria-hidden="true" className={className} />;
  }
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden="true"
      className={className}
      transition={{
        layout: { type: "tween", duration: TAB_INDICATOR_S, ease: EASE_OUT },
      }}
    />
  );
}
