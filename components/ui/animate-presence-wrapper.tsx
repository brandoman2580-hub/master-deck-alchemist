/**
 * AnimatePresence Wrapper
 * 
 * Wrapper component for Framer Motion's AnimatePresence
 * with built-in reduced motion support.
 */

"use client";

import { AnimatePresence as FramerAnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { AnimatePresenceProps } from "framer-motion";
import type { ReactNode } from "react";

interface AnimatePresenceWrapperProps extends Omit<AnimatePresenceProps, "children"> {
  /**
   * Child elements to animate
   */
  children?: ReactNode;
  /**
   * Animation mode
   * @default "wait"
   */
  mode?: "wait" | "sync" | "popLayout";
  /**
   * Whether to disable animations when reduced motion is preferred
   * @default true
   */
  respectReducedMotion?: boolean;
}

/**
 * AnimatePresence wrapper with reduced motion support
 */
export function AnimatePresence({
  children,
  mode = "wait",
  respectReducedMotion = true,
  ...props
}: AnimatePresenceWrapperProps) {
  const prefersReducedMotion = useReducedMotion();

  // If reduced motion is preferred and we should respect it, disable animations
  if (prefersReducedMotion && respectReducedMotion) {
    return <>{children}</>;
  }

  return (
    <FramerAnimatePresence mode={mode} {...props}>
      {children}
    </FramerAnimatePresence>
  );
}

