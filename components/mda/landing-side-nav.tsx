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
 * Vertical section indicator with active circle-dot (Alt4 light).
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
                "flex items-center gap-2.5 rounded-full px-2.5 py-1 font-display text-2xl text-mda-ink transition-opacity duration-200",
                isActive ? "opacity-100" : "opacity-45 hover:opacity-80",
              )}
            >
              {isActive ? (
                <CircleDot
                  className="size-6 text-mda-cyan"
                  strokeWidth={2}
                  aria-hidden
                />
              ) : null}
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <div className="ml-0 w-px self-stretch bg-mda-ink/50" aria-hidden />
    </nav>
  );
}
