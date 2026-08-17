"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type MdaSearchFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  containerClassName?: string;
};

/**
 * Search input with distinct default vs active (focus-within) states.
 */
export function MdaSearchField({
  className,
  containerClassName,
  ...props
}: MdaSearchFieldProps): ReactNode {
  return (
    <label
      className={cn(
        "flex h-11 w-full items-center gap-2.5 px-[18px] text-white transition-[background-color,box-shadow,ring] duration-200 ease-in-out",
        "bg-[color:var(--mda-cyan-muted)] ring-1 ring-transparent",
        "focus-within:bg-[rgba(126,232,255,0.4)] focus-within:ring-[color:var(--mda-cyan)] focus-within:ring-offset-0",
        containerClassName,
      )}
    >
      <Search
        className="h-5 w-5 shrink-0 text-white/70 transition-colors duration-200 focus-within:text-white peer-focus:text-white"
        aria-hidden
      />
      <input
        type="search"
        className={cn(
          "peer w-full bg-transparent font-mda text-base uppercase tracking-wide text-white placeholder:text-white/45 focus:outline-none",
          className,
        )}
        {...props}
      />
    </label>
  );
}
