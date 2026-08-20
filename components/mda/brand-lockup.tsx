"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared navbar wordmark — matches the Landing header lockup. */
export const MDA_BRAND_TITLE_CLASS =
  "font-anton text-[22px] uppercase leading-none tracking-wide text-white sm:text-2xl";

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
