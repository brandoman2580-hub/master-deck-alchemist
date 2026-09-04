"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type MdaSearchFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  containerClassName?: string;
  /** When true, wraps the field for magnetic cursor morph. */
  "data-magnetic"?: boolean | string;
};

/**
 * Dark chrome search bar (Archives / app shells) with light placeholder.
 */
export function MdaSearchField({
  className,
  containerClassName,
  "data-magnetic": _dataMagnetic,
  ...props
}: MdaSearchFieldProps): ReactNode {
  return (
    <label
      data-magnetic
      className={cn(
        "flex h-11 w-full items-center gap-2.5 rounded-sm bg-mda-chrome px-[18px] text-mda-inverse-text ring-1 ring-transparent transition-[background-color,box-shadow,ring-color] duration-200 ease-in-out",
        "focus-within:bg-mda-chrome-muted focus-within:ring-mda-cyan/60",
        containerClassName,
      )}
    >
      <Search
        className="h-5 w-5 shrink-0 text-mda-inverse-text/80"
        aria-hidden
      />
      <input
        type="search"
        className={cn(
          "peer w-full bg-transparent font-mda text-base uppercase tracking-wide text-mda-inverse-text placeholder:text-mda-inverse-text/55 focus:outline-none",
          className,
        )}
        {...props}
      />
    </label>
  );
}
