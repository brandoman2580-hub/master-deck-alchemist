import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./sheet";
import { Button } from "./button";
import { Filter, Trash2 } from "lucide-react";
import { Input } from "./input";
import { Label } from "./label";
import { CARD_ARCHETYPE_FILTERS, FILTER_CONFIGS } from "../../lib/constants";
import { ToggleFilter } from "./filter-toggle";
import { SearchParams } from "../../types/types";
import { ArchetypeAutocomplete } from "./archetype-autocomplete";

type ArchetypeOption = { value: string; label: string };
type HandleSelectChange = (key: string, value: string) => void;
type HandleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => void;

interface FilterMenuProps {
  searchParams: SearchParams;
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
}

export function FilterMenu({
  searchParams,
  setSearchParams,
  setSearchQuery,
  handleSelectChange,
  handleInputChange,
}: FilterMenuProps) {
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
    setSearchQuery(""); // if you want to clear the text search as well
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-[rgba(10,20,30,0.92)] backdrop-blur-md border-l border-cyan-500/30 [&>button]:text-cyan-400 [&>button]:hover:text-cyan-300 [&>button]:hover:bg-cyan-500/10"
      >
        <SheetHeader>
          <SheetTitle
            className="text-slate-50"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Filter Cards
          </SheetTitle>
          <SheetDescription className="text-slate-300">
            Refine your card search
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          {/* Render all filter sections */}
          {FILTER_CONFIGS.map((config) => {
            const currentValue =
              searchParams[config.key as keyof SearchParams] || "";
            const valueArray = currentValue ? currentValue.split(",") : [];
            return (
              <ToggleFilter
                key={config.key}
                label={config.label}
                value={valueArray}
                options={config.options}
                onChange={(values) =>
                  handleSelectChange(config.key, values.join(","))
                }
              />
            );
          })}

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

          {/* Effect Text as Input */}
          <div className="space-y-2">
            <Label htmlFor="effect" className="text-cyan-300 font-medium">
              Effect Text
            </Label>
            <Input
              id="effect"
              name="effect"
              placeholder="Search card effects..."
              value={searchParams.effect}
              onChange={handleInputChange}
              className="bg-slate-950/60 border-cyan-500/50 text-slate-50 placeholder:text-slate-400 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/60"
            />
          </div>

          <div className="flex gap-2">
            <Button
              startIcon={<Trash2 />}
              variant="outline"
              onClick={handleClearFilters}
              className="w-1/2"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
