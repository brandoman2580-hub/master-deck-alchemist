import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";
import { FILTER_CONFIGS } from "@/lib/constants";
import { ToggleFilter } from "./filter-toggle";
import { SearchParams } from "@/types/types";

type HandleSelectChange = (key: string, value: string) => void;
type HandleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => void;
type HandleSearch = () => void;

interface FilterMenuProps {
  loading: boolean;
  searchParams: SearchParams;
  handleSelectChange: HandleSelectChange;
  handleInputChange: HandleInputChange;
  handleSearch: HandleSearch;
}

export function FilterMenu({
  loading,
  searchParams,
  handleSelectChange,
  handleInputChange,
  handleSearch,
}: FilterMenuProps) {
  const handleClearFilters = () => {
    // Clear all toggle filters
    FILTER_CONFIGS.forEach((config) => {
      handleSelectChange(config.key, "");
    });

    // Clear effect text (if present in your SearchParams)
    handleInputChange({
      target: { name: "effect", value: "" },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Filter Cards</SheetTitle>
          <SheetDescription>Refine your card search</SheetDescription>
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

          {/* Effect Text as Input */}
          <div className="space-y-2">
            <Label htmlFor="effect">Effect Text</Label>
            <Input
              id="effect"
              name="effect"
              placeholder="Search card effects..."
              value={searchParams.effect}
              onChange={handleInputChange}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="w-1/2"
            >
              Clear Filters
            </Button>
            <Button onClick={handleSearch} className="w-1/2" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Apply Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
