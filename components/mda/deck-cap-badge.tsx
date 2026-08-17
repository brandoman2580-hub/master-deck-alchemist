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
};

function AnimatedCount({ value }: { value: number }): ReactNode {
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
    <motion.span className="inline-block tabular-nums font-bold" layout>
      {reduceMotion ? value : display}
    </motion.span>
  );
}

/** Capacity chip matching Deck Archives card (M / E / S). */
export function DeckCapBadge({
  label,
  value,
  className,
}: DeckCapBadgeProps): ReactNode {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 font-mda text-sm text-[color:var(--mda-cyan-soft)]",
        className,
      )}
    >
      <span className="text-white/70">{label}</span>
      <AnimatedCount value={value} />
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
      <AnimatedCount value={value} />
    </span>
  );
}
