"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared navbar wordmark — matches the Landing / MDA shell lockup (light tokens). */
export const MDA_BRAND_TITLE_CLASS =
  "font-display text-[22px] font-black uppercase leading-none tracking-wide text-mda-ink sm:text-2xl";

export type MdaBrandTitleProps = {
  className?: string;
};

export function MdaBrandTitle({ className }: MdaBrandTitleProps): ReactNode {
  return (
    <span className={cn(MDA_BRAND_TITLE_CLASS, className)}>
      Master Deck Alchemist
    </span>
  );
}
