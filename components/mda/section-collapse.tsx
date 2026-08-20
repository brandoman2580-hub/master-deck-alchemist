"use client";

import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { MdaCollapse } from "@/components/mda/collapse";
import { cn } from "@/lib/utils";

export type SectionCollapseProps = {
  title: string;
  icon?: LucideIcon;
  /** Extra classes applied to the section icon (e.g. filled pin). */
  iconClassName?: string;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
  className?: string;
};

export function SectionCollapse({
  title,
  icon: Icon,
  iconClassName,
  open,
  onToggle,
  children,
  className,
}: SectionCollapseProps): ReactNode {
  return (
    <section className={cn("w-full", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-magnetic
        className="flex w-full items-center gap-3 px-6 py-2.5 text-left transition-colors duration-200 hover:bg-white/5"
      >
        {Icon ? (
          <Icon
            className={cn("h-5 w-5 text-white/80", iconClassName)}
            aria-hidden
          />
        ) : null}
        <span className="font-mda text-sm font-bold uppercase tracking-[0.08em] text-white">
          {title}
        </span>
        <span className="h-px flex-1 bg-white/20" aria-hidden />
        <ChevronDown
          className={cn(
            "h-5 w-5 text-white/70 transition-transform duration-300 ease-in-out",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <MdaCollapse open={open}>{children}</MdaCollapse>
    </section>
  );
}
