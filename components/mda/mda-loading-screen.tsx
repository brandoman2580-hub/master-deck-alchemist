"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type MdaLoaderVariant = "legacy" | "quad" | "waveform";

export type MdaLoadingScreenProps = {
  open: boolean;
  /** Feedback describing what is happening behind the scenes. */
  status?: string;
  className?: string;
  /** When true, fills only the parent (view-scoped) instead of the viewport. */
  scoped?: boolean;
  /**
   * Visual indicator. `legacy` keeps the current ring spinner as fallback.
   * `quad` and `waveform` are Phase 2a A/B candidates.
   */
  variant?: MdaLoaderVariant;
};

function LegacySpinner({ reduced }: { reduced: boolean }): ReactNode {
  if (reduced) {
    return (
      <div
        className="h-16 w-16 rounded-full border-2 border-mda-cyan/40 border-t-mda-cyan"
        aria-hidden
      />
    );
  }
  return (
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
  );
}

function QuadPulse({ reduced }: { reduced: boolean }): ReactNode {
  return (
    <div
      className={cn("mda-loader-quad grid h-14 w-14 grid-cols-2 gap-1.5", reduced && "mda-loader-static")}
      aria-hidden
    >
      <span className="mda-loader-quad-cell bg-mda-chrome-deep" />
      <span className="mda-loader-quad-cell bg-mda-chrome" />
      <span className="mda-loader-quad-cell bg-mda-chrome" />
      <span className="mda-loader-quad-cell bg-mda-chrome-deep" />
    </div>
  );
}

function WaveformBars({ reduced }: { reduced: boolean }): ReactNode {
  return (
    <div
      className={cn(
        "mda-loader-wave flex h-14 w-20 items-end justify-center gap-1",
        reduced && "mda-loader-static",
      )}
      aria-hidden
    >
      {Array.from({ length: 7 }, (_, index) => (
        <span
          key={index}
          className="mda-loader-wave-bar w-1.5 bg-mda-chrome-deep"
          style={{ animationDelay: `${index * 0.08}s` }}
        />
      ))}
    </div>
  );
}

/**
 * High-tech MDA loading overlay with status copy.
 * Stays visible while `open` is true; ease-in on enter, ease-out on leave.
 * Production default is `quad` (Phase 2a A/B pick). `legacy` and `waveform` remain available.
 */
export function MdaLoadingScreen({
  open,
  status = "Loading…",
  className,
  scoped = false,
  variant = "quad",
}: MdaLoadingScreenProps): ReactNode {
  const reducedMotion = useReducedMotion() === true;

  const indicator =
    variant === "quad" ? (
      <QuadPulse reduced={reducedMotion} />
    ) : variant === "waveform" ? (
      <WaveformBars reduced={reducedMotion} />
    ) : (
      <LegacySpinner reduced={reducedMotion} />
    );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key={`mda-loading-${variant}`}
          role="status"
          aria-live="polite"
          aria-busy="true"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className={cn(
            "z-50 flex flex-col items-center justify-center gap-6 bg-[color:var(--mda-bg-deep)]/92 backdrop-blur-md",
            scoped ? "absolute inset-0" : "fixed inset-0",
            className,
          )}
        >
          {indicator}
          <motion.p
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
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

/** Inline indicator for Storybook / gallery without the full overlay. */
export function MdaLoaderMark({
  variant = "quad",
  className,
}: {
  variant?: MdaLoaderVariant;
  className?: string;
}): ReactNode {
  const reducedMotion = useReducedMotion() === true;
  return (
    <div className={cn("inline-flex items-center justify-center p-4", className)}>
      {variant === "quad" ? (
        <QuadPulse reduced={reducedMotion} />
      ) : variant === "waveform" ? (
        <WaveformBars reduced={reducedMotion} />
      ) : (
        <LegacySpinner reduced={reducedMotion} />
      )}
    </div>
  );
}
