"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type MdaLoadingScreenProps = {
  open: boolean;
  /** Feedback describing what is happening behind the scenes. */
  status?: string;
  className?: string;
  /** When true, fills only the parent (view-scoped) instead of the viewport. */
  scoped?: boolean;
};

/**
 * High-tech MDA loading overlay with status copy.
 * Stays visible while `open` is true; ease-in on enter, ease-out on leave.
 */
export function MdaLoadingScreen({
  open,
  status = "Loading…",
  className,
  scoped = false,
}: MdaLoadingScreenProps): ReactNode {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="mda-loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className={cn(
            "z-50 flex flex-col items-center justify-center gap-6 bg-[color:var(--mda-bg-deep)]/92 backdrop-blur-md",
            scoped ? "absolute inset-0" : "fixed inset-0",
            className,
          )}
        >
          <div className="relative h-16 w-16" aria-hidden>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-[color:var(--mda-cyan)]/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-2 rounded-full border-2 border-t-[color:var(--mda-cyan-soft)] border-r-transparent border-b-transparent border-l-transparent"
              animate={{ rotate: -360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-5 rounded-full bg-[color:var(--mda-cyan)]/40"
              animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.92, 1.05, 0.92] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.3, ease: "easeOut" }}
            className="max-w-sm px-6 text-center font-mda text-sm font-medium uppercase tracking-[0.08em] text-mda-ink"
          >
            {status}
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
