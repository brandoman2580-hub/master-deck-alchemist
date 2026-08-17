"use client";

import type { ReactNode } from "react";
import { CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

export type LandingSideNavProps = {
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
};

const LABELS = ["01", "02", "03", "04"] as const;

/**
 * Vertical section indicator (Share Tech Mono) with active circle-dot.
 * Each item is magnetic so the cursor ring morphs onto it.
 */
export function LandingSideNav({
  activeIndex,
  onSelect,
  className,
}: LandingSideNavProps): ReactNode {
  return (
    <nav
      aria-label="Landing sections"
      className={cn(
        "pointer-events-auto flex h-[423px] shrink-0 items-stretch",
        className,
      )}
    >
      <div className="flex h-full flex-col items-end justify-between py-2.5">
        {LABELS.map((label, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={label}
              type="button"
              data-magnetic
              onClick={() => onSelect(index)}
              aria-current={isActive ? "true" : undefined}
              aria-label={`Go to section ${label}`}
              className={cn(
                "flex items-center gap-2.5 rounded-full px-2.5 py-1 font-share-tech text-2xl text-white transition-opacity duration-200",
                isActive ? "opacity-100" : "opacity-55 hover:opacity-90",
              )}
            >
              {isActive ? (
                <CircleDot
                  className="size-6 text-[#7ee8ff]"
                  strokeWidth={2}
                  aria-hidden
                />
              ) : null}
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <div className="ml-0 w-px self-stretch bg-white/70" aria-hidden />
    </nav>
  );
}
