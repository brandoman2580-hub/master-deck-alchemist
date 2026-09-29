"use client";

import type { ChangeEvent, ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { FILTER_CONFIGS } from "@/lib/deck/constants";
import { ToggleFilter } from "@/components/ui/filter-toggle";
import { MdaCollapse } from "@/components/mda/collapse";
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
  searchParams: WorkshopFilterState;
  onSelectChange: (key: string, value: string) => void;
  onEffectChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  activeCount: number;
};

/**
 * Card library filters as an inline accordion under the search row.
 * Hidden until the filter button toggles it open.
 */
export function WorkshopCardFilters({
  open,
  searchParams,
  onSelectChange,
  onEffectChange,
  onClear,
  activeCount,
}: WorkshopCardFiltersProps): ReactNode {
  return (
    <MdaCollapse open={open}>
      <div className="mb-3 max-h-[min(40vh,360px)] space-y-4 overflow-y-auto border border-mda-ink/15 bg-mda-surface px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mda text-sm font-bold uppercase tracking-wide text-mda-ink-strong">
            Filters
            {activeCount > 0 ? (
              <span className="ml-2 bg-mda-chrome px-1.5 py-0.5 text-xs font-bold normal-case tracking-normal text-mda-inverse-text">
                {activeCount}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={onClear}
            disabled={activeCount === 0}
            data-magnetic
            className="inline-flex items-center gap-1.5 border border-mda-chrome/40 bg-transparent px-2 py-1 font-mda text-xs font-bold uppercase text-mda-ink transition-colors hover:bg-mda-chrome hover:text-mda-inverse-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Reset
          </button>
        </div>
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
                variant="chrome"
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
            data-magnetic
            value={searchParams.effect || ""}
            onChange={onEffectChange}
            placeholder="Search card effects…"
            className="w-full bg-mda-panel px-3 py-2 font-mda text-sm text-mda-ink placeholder:text-mda-ink-muted ring-1 ring-mda-ink/10 transition-[box-shadow,background-color] duration-200 focus:bg-mda-surface focus:outline-none focus:ring-mda-cyan"
          />
        </div>
      </div>
    </MdaCollapse>
  );
}
