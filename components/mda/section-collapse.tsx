"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionCollapseProps = {
  title: string;
  icon?: LucideIcon;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
  className?: string;
};

export function SectionCollapse({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
  className,
}: SectionCollapseProps): ReactNode {
  const reduceMotion = useReducedMotion();

  return (
    <section className={cn("w-full", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-magnetic
        className="flex w-full items-center gap-3 px-6 py-2.5 text-left transition-colors duration-200 hover:bg-mda-ink/5"
      >
        {Icon ? <Icon className="h-5 w-5 text-mda-ink" aria-hidden /> : null}
        <span className="font-mda text-sm font-bold uppercase tracking-[0.08em] text-mda-ink">
          {title}
        </span>
        <span className="h-px flex-1 bg-mda-ink/35" aria-hidden />
        <ChevronDown
          className={cn(
            "h-5 w-5 text-mda-ink transition-transform duration-300 ease-in-out",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="section-body"
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { height: 0, opacity: 0 }
            }
            animate={
              reduceMotion
                ? { opacity: 1 }
                : { height: "auto", opacity: 1 }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { height: 0, opacity: 0 }
            }
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
