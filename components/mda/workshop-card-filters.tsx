"use client";

import type { ChangeEvent, ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { FILTER_CONFIGS } from "@/lib/constants";
import { ToggleFilter } from "@/components/ui/filter-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type WorkshopFilterState = {
  name: string;
  type: string;
  race: string;
  attribute: string;
  level: string;
  atk: string;
  def: string;
  atkRange: string;
  defRange: string;
  rarity: string;
  archetype: string;
  effect: string;
  sort: string;
  sortDirection: "asc" | "desc";
  misc: string;
  banStatus: string;
};

export const EMPTY_WORKSHOP_FILTERS: WorkshopFilterState = {
  name: "",
  type: "",
  race: "",
  attribute: "",
  level: "",
  atk: "",
  def: "",
  atkRange: "",
  defRange: "",
  rarity: "",
  archetype: "",
  effect: "",
  sort: "name",
  sortDirection: "asc",
  misc: "",
  banStatus: "",
};

export type WorkshopCardFiltersProps = {
  open: boolean;
  onToggle: () => void;
  searchParams: WorkshopFilterState;
  onSelectChange: (key: string, value: string) => void;
  onEffectChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  activeCount: number;
};

/**
 * Card Browser filters as a slide-in drawer (Sheet).
 * Not visible when collapsed.
 */
export function WorkshopCardFilters({
  open,
  onToggle,
  searchParams,
  onSelectChange,
  onEffectChange,
  onClear,
  activeCount,
}: WorkshopCardFiltersProps): ReactNode {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next !== open) onToggle();
      }}
    >
      <SheetContent
        side="right"
        className="w-full border-l border-white/10 bg-[color:var(--mda-bg-deep)] p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-white/10 bg-[#0B5393] px-4 py-3 text-left">
          <SheetTitle className="font-mda text-base font-bold uppercase tracking-wide text-white">
            Filters
            {activeCount > 0 ? (
              <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-xs font-bold normal-case tracking-normal">
                {activeCount}
              </span>
            ) : null}
          </SheetTitle>
        </SheetHeader>
        <div className="max-h-[calc(100vh-4rem)] space-y-4 overflow-y-auto p-4">
          {FILTER_CONFIGS.map((config, index) => {
            const currentValue =
              searchParams[config.key as keyof WorkshopFilterState] || "";
            const valueArray = currentValue
              ? String(currentValue).split(",").filter(Boolean)
              : [];
            return (
              <div
                key={config.key}
                className={cn(index > 0 && "border-t border-white/10 pt-4")}
              >
                <ToggleFilter
                  label={config.label}
                  value={valueArray}
                  options={config.options}
                  onChange={(values) =>
                    onSelectChange(config.key, values.join(","))
                  }
                />
              </div>
            );
          })}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <label
              htmlFor="mda-effect-filter"
              className="font-mda text-sm font-medium text-white/80"
            >
              Effect Text
            </label>
            <input
              id="mda-effect-filter"
              name="effect"
              value={searchParams.effect || ""}
              onChange={onEffectChange}
              placeholder="Search card effects…"
              className="w-full bg-[#45474B] px-3 py-2 font-mda text-sm text-white placeholder:text-white/45 ring-1 ring-transparent transition-[box-shadow,background-color] duration-200 focus:bg-[#55585c] focus:outline-none focus:ring-[color:var(--mda-cyan)]"
            />
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={activeCount === 0}
            className="inline-flex w-full items-center justify-center gap-2 border border-white/20 bg-white/5 px-3 py-2 font-mda text-sm font-bold uppercase text-white/80 transition-colors duration-200 ease-in-out hover:bg-white hover:text-[color:var(--mda-bg-deep)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Reset Filters
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
