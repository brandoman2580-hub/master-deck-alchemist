import { useState, useMemo, useRef } from "react";
import fuzzysort from "fuzzysort";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { CARD_ARCHETYPE_FILTERS } from "@/lib/constants";

type ArchetypeOption = { value: string; label: string };

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center bg-gray-200 text-black rounded px-2 py-1 mr-1 mb-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 text-gray-600 hover:text-red-600"
        aria-label={`Remove ${label}`}
        tabIndex={-1}
      >
        <X size={14} />
      </button>
    </span>
  );
}

interface ArchetypeAutocompleteProps {
  values: ArchetypeOption[];
  onChange: (values: ArchetypeOption[]) => void;
}

export function ArchetypeAutocomplete({
  values,
  onChange,
}: ArchetypeAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Always filter from the full list minus selected
  const availableOptions = useMemo(
    () =>
      CARD_ARCHETYPE_FILTERS.filter(
        (opt) => !values.some((v) => v.value === opt.value)
      ),
    [values]
  );

  // Fuzzy search on label
  const filtered = useMemo(() => {
    if (!search) return availableOptions;
    return fuzzysort
      .go(search, availableOptions, { key: "label" })
      .map((r) => r.obj);
  }, [search, availableOptions]);

  // Add archetype
  const handleSelect = (archetype: ArchetypeOption) => {
    if (!values.some((v) => v.value === archetype.value)) {
      onChange([...values, archetype]);
      setSearch("");
      setOpen(false);
      inputRef.current?.focus();
    }
  };

  // Remove archetype
  const handleRemove = (archetype: ArchetypeOption) => {
    onChange(values.filter((v) => v.value !== archetype.value));
  };

  // Clear all
  const handleClear = () => {
    onChange([]);
    setSearch("");
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1">Archetype</label>
      <div className="flex flex-wrap items-center gap-1 mb-1">
        {values.map((archetype) => (
          <Chip
            key={archetype.value}
            label={archetype.label}
            onRemove={() => handleRemove(archetype)}
          />
        ))}
      </div>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="Search archetype..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="pr-8 text-white bg-transparent"
          style={{ color: "white" }}
        />
        {/* X/Clear button */}
        {(search || values.length > 0) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-600"
            tabIndex={-1}
            aria-label="Clear"
          >
            <X size={18} />
          </button>
        )}
        {/* Dropdown */}
        {open && filtered.length > 0 && (
          <div className="absolute z-10 bg-white border border-gray-200 rounded shadow w-full max-h-60 overflow-y-auto mt-1">
            {filtered.map((archetype) => (
              <div
                key={archetype.value}
                className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-black"
                onMouseDown={() => handleSelect(archetype)}
              >
                {archetype.label}
              </div>
            ))}
          </div>
        )}
        {open && search && filtered.length === 0 && (
          <div className="absolute z-10 bg-white border border-gray-200 rounded shadow w-full max-h-60 overflow-y-auto mt-1">
            <div className="px-3 py-2 text-gray-500">No results</div>
          </div>
        )}
      </div>
    </div>
  );
}
