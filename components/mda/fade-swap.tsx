"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE_OUT, TAB_PANEL_S } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

/**
 * Opacity crossfade for a panel that already fills its slot.
 * No slide. Reduced motion swaps immediately. The first paint does not fade.
 */
export function FadeSwap({
  panelKey,
  duration = TAB_PANEL_S,
  className,
  panelClassName,
  children,
}: {
  panelKey: string;
  duration?: number;
  className?: string;
  panelClassName?: string;
  children: ReactNode;
}): ReactNode {
  const reduce = useReducedMotion();
  const seconds = reduce ? 0 : duration;

  return (
    <div className={cn("relative min-h-0 flex-1 overflow-hidden", className)}>
      <AnimatePresence initial={false}>
        <motion.div
          key={panelKey}
          initial={{ opacity: seconds === 0 ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: seconds, ease: EASE_OUT }}
          className={cn(
            "absolute inset-0 flex min-h-0 flex-col",
            panelClassName,
          )}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
