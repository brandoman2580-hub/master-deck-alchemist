"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/utils";

export type DeckCapBadgeProps = {
  label: string;
  value: number;
  className?: string;
  /** light = Archives light shell; inverse = dark islands (legacy). */
  tone?: "light" | "inverse";
};

function AnimatedCount({
  value,
  className,
}: {
  value: number;
  className?: string;
}): ReactNode {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 200, damping: 28 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduceMotion) return;
    motionValue.set(value);
  }, [value, motionValue, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const unsubscribe = spring.on("change", (latest) => {
      setDisplay(Math.round(latest));
    });
    return unsubscribe;
  }, [spring, reduceMotion]);

  return (
    <motion.span
      className={cn("inline-block tabular-nums font-bold", className)}
      layout
    >
      {reduceMotion ? value : display}
    </motion.span>
  );
}

/** Capacity chip for Deck Archives (count above the section name). */
export function DeckCapBadge({
  label,
  value,
  className,
  tone = "light",
}: DeckCapBadgeProps): ReactNode {
  const isLight = tone === "light";
  return (
    <span
      className={cn(
        "inline-flex flex-col items-center gap-0.5 px-1.5 py-0.5 font-mda",
        isLight
          ? "bg-mda-panel text-mda-ink-strong"
          : "rounded bg-black/20 text-mda-inverse-text",
        className,
      )}
      aria-label={`${label}, ${value}`}
    >
      <span aria-hidden className="text-base leading-none">
        <AnimatedCount value={value} />
      </span>
      <span
        aria-hidden
        className={cn(
          "whitespace-nowrap text-xs leading-none",
          isLight ? "text-mda-ink-muted" : "text-white",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/** Standalone Motion number counter for Workshop qty chips. */
export function MdaAnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}): ReactNode {
  return (
    <span className={cn("tabular-nums", className)}>
      <AnimatedCount value={value} className={className} />
    </span>
  );
}
