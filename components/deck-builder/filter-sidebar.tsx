"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, ChevronLeft, X, Filter } from "lucide-react";
import { CARD_ARCHETYPE_FILTERS, FILTER_CONFIGS } from "@/lib/constants";
import { ToggleFilter } from "@/components/ui/filter-toggle";
import { SearchParams } from "@/types/types";
import { ArchetypeAutocomplete } from "@/components/ui/archetype-autocomplete";

type ArchetypeOption = { value: string; label: string };
type HandleSelectChange = (key: string, value: string) => void;
type HandleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => void;

interface FilterSidebarProps {
  searchParams: SearchParams & {
    sort?: string;
    sortDirection?: "asc" | "desc";
  };
  setSearchParams: React.Dispatch<
    React.SetStateAction<{
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
    }>
  >;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  handleSelectChange: HandleSelectChange;
  handleInputChange: HandleInputChange;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * Phase 2: Persistent filter sidebar (not modal)
 * - Always visible (can be collapsed)
 * - Filters applied client-side
 * - Fast and composable
 */
export function FilterSidebar({
  searchParams,
  setSearchParams,
  setSearchQuery,
  handleSelectChange,
  handleInputChange,
  isCollapsed = false,
  onToggleCollapse,
}: FilterSidebarProps) {
  // Get active filters as pills
  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; value: string }> = [];
    
    FILTER_CONFIGS.forEach((config) => {
      const value = searchParams[config.key as keyof SearchParams];
      if (value && value.trim()) {
        const values = value.split(",").filter(v => v.trim());
        values.forEach(v => {
          const option = config.options.find(opt => opt.value === v);
          if (option) {
            filters.push({ key: config.key, label: option.label, value: v });
          }
        });
      }
    });

    if (searchParams.archetype) {
      const archetypes = searchParams.archetype.split(",").filter(v => v.trim());
      archetypes.forEach(arch => {
        const option = CARD_ARCHETYPE_FILTERS.find(opt => opt.value === arch);
        if (option) {
          filters.push({ key: "archetype", label: option.label, value: arch });
        }
      });
    }

    if (searchParams.effect && searchParams.effect.trim()) {
      filters.push({ key: "effect", label: "Effect", value: searchParams.effect });
    }

    return filters;
  }, [searchParams]);

  const handleClearFilters = () => {
    setSearchParams({
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
    });
    setSearchQuery("");
  };

  const handleRemoveFilter = (key: string, value: string) => {
    const currentValue = searchParams[key as keyof SearchParams] || "";
    if (key === "effect") {
      setSearchParams(prev => ({ ...prev, effect: "" }));
    } else {
      const values = currentValue.split(",").filter(v => v !== value);
      handleSelectChange(key, values.join(","));
    }
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <>
      {/* Backdrop - Full screen */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onToggleCollapse}
        aria-hidden="true"
      />
      {/* Filter Panel - Full Page Slideout */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-slate-900/98 backdrop-blur-md border-l border-white/10 shadow-2xl shadow-black/50 flex flex-col h-full overflow-y-auto z-50 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-white/80" />
          <h3 className="text-lg font-semibold text-white font-display">
            Filters
          </h3>
          {activeFilters.length > 0 && (
            <Badge className="bg-white/10 text-white border-white/20 text-xs">
              {activeFilters.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearFilters}
              className="text-white/80 hover:text-white h-8 w-8"
              aria-label="Clear all filters"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="text-white/80 hover:text-white"
            aria-label="Collapse filters"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Active Filters Pills */}
      {activeFilters.length > 0 && (
        <div className="px-4 pt-3 pb-2 border-b border-white/10">
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter, idx) => (
              <Badge
                key={`${filter.key}-${filter.value}-${idx}`}
                variant="secondary"
                className="bg-white/10 text-white border-white/20 text-xs px-2 py-1 pr-1 flex items-center gap-1.5"
              >
                <span className="truncate max-w-[120px]">{filter.label}</span>
                <button
                  onClick={() => handleRemoveFilter(filter.key, filter.value)}
                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Filter Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Render all filter sections */}
        {FILTER_CONFIGS.map((config, idx) => {
          const currentValue =
            searchParams[config.key as keyof SearchParams] || "";
          const valueArray = currentValue ? currentValue.split(",") : [];
          return (
            <div key={config.key} className={idx > 0 ? "border-t border-white/10 pt-5" : ""}>
              <ToggleFilter
                label={config.label}
                value={valueArray}
                options={config.options}
                onChange={(values) =>
                  handleSelectChange(config.key, values.join(","))
                }
              />
            </div>
          );
        })}

        {/* Archetype Autocomplete */}
        <div className="border-t border-white/10 pt-5">
          <ArchetypeAutocomplete
            values={
              searchParams.archetype
                ? CARD_ARCHETYPE_FILTERS.filter((opt: ArchetypeOption) =>
                    searchParams.archetype?.split(",").includes(opt.value),
                  )
                : []
            }
            onChange={(archetypes: ArchetypeOption[]) =>
              handleSelectChange(
                "archetype",
                archetypes.map((a: ArchetypeOption) => a.value).join(","),
              )
            }
          />
        </div>

        {/* Effect Text Input */}
        <div className="space-y-2 border-t border-white/10 pt-5">
          <Label htmlFor="effect" className="text-white/80 font-medium text-sm">
            Effect Text
          </Label>
          <Input
            id="effect"
            name="effect"
            placeholder="Search card effects..."
            value={searchParams.effect || ""}
            onChange={handleInputChange}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/50 focus-visible:outline-none rounded-lg"
          />
        </div>
      </div>

      {/* Footer with Reset Button */}
      <div className="border-t border-white/10 p-4 bg-slate-900/50">
        <Button
          variant="outline"
          onClick={handleClearFilters}
          className="w-full border-white/20 text-white/80 hover:bg-white/10 hover:border-white/30"
          disabled={activeFilters.length === 0}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Reset Filters
        </Button>
      </div>
    </div>
    </>
  );
}
