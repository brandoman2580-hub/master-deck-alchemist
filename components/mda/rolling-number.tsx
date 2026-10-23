"use client";

import type { ReactNode } from "react";
import { useRollingNumber } from "@/hooks/useRollingNumber";
import { COUNT_MS } from "@/lib/motion/tokens";

export function RollingNumber({
  value,
  durationMs = COUNT_MS,
  className,
}: {
  value: number;
  durationMs?: number;
  className?: string;
}): ReactNode {
  const display = useRollingNumber(value, durationMs);
  return <span className={className}>{display}</span>;
}
