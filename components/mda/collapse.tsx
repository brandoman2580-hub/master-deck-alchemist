"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type MdaCollapseProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  /** Seconds. The filter drawer passes 0.2. Other collapses keep 0.28. */
  duration?: number;
  ease?: "easeInOut" | "easeOut" | [number, number, number, number];
};

/**
 * Height + opacity collapse used by section headers and the Alerts panel.
 */
export function MdaCollapse({
  open,
  children,
  className,
  duration = 0.28,
  ease = "easeInOut",
}: MdaCollapseProps): ReactNode {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="collapse-body"
          initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration, ease }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
