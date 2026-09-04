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
        className="w-full border-l border-mda-ink/15 bg-mda-bg p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-mda-ink/10 bg-mda-chrome px-4 py-3 text-left">
          <SheetTitle className="font-mda text-base font-bold uppercase tracking-wide text-mda-inverse-text">
            Filters
            {activeCount > 0 ? (
              <span className="ml-2 rounded bg-mda-inverse-text/15 px-1.5 py-0.5 text-xs font-bold normal-case tracking-normal">
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
                className={cn(index > 0 && "border-t border-mda-ink/10 pt-4")}
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
          <div className="space-y-2 border-t border-mda-ink/10 pt-4">
            <label
              htmlFor="mda-effect-filter"
              className="font-mda text-sm font-medium text-mda-ink"
            >
              Effect Text
            </label>
            <input
              id="mda-effect-filter"
              name="effect"
              value={searchParams.effect || ""}
              onChange={onEffectChange}
              placeholder="Search card effects…"
              className="w-full bg-mda-panel px-3 py-2 font-mda text-sm text-mda-ink placeholder:text-mda-ink-muted ring-1 ring-mda-ink/10 transition-[box-shadow,background-color] duration-200 focus:bg-mda-surface focus:outline-none focus:ring-mda-cyan"
            />
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={activeCount === 0}
            className="inline-flex w-full items-center justify-center gap-2 border border-mda-chrome/30 bg-mda-surface px-3 py-2 font-mda text-sm font-bold uppercase text-mda-ink transition-colors duration-200 ease-in-out hover:bg-mda-chrome hover:text-mda-inverse-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Reset Filters
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
