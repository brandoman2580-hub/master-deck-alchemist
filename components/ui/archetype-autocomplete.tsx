import { useState, useMemo, useRef } from "react";
import fuzzysort from "fuzzysort";
import { Input } from "./input";
import { X } from "lucide-react";
import { CARD_ARCHETYPE_FILTERS } from "../../lib/constants";

type ArchetypeOption = { value: string; label: string };

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center bg-white/10 border border-white/20 text-white rounded px-2 py-1 mr-1 mb-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 text-cyan-200 hover:text-red-400 transition-colors"
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
        (opt) => !values.some((v) => v.value === opt.value),
      ),
    [values],
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
      <label className="block text-sm font-medium mb-1 text-cyan-300">
        Archetype
      </label>
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
          className="pr-8 bg-white/5 border-white/10 text-white placeholder:text-white/50 focus-visible:outline-none rounded-lg"
        />
        {/* X/Clear button */}
        {(search || values.length > 0) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-red-400 transition-colors"
            tabIndex={-1}
            aria-label="Clear"
          >
            <X size={18} />
          </button>
        )}
        {/* Dropdown */}
        {open && filtered.length > 0 && (
          <div className="absolute z-10 w-full max-h-60 overflow-y-auto mt-1 bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-lg">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl">
              {filtered.map((archetype) => (
                <div
                  key={archetype.value}
                  className="px-3 py-2 cursor-pointer hover:bg-white/10 text-white transition-colors"
                  onMouseDown={() => handleSelect(archetype)}
                >
                  {archetype.label}
                </div>
              ))}
            </div>
          </div>
        )}
        {open && search && filtered.length === 0 && (
          <div className="absolute z-10 w-full max-h-60 overflow-y-auto mt-1 bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-lg">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl">
              <div className="px-3 py-2 text-white/60">No results</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
