import { useState, useMemo, useRef } from "react";
import fuzzysort from "fuzzysort";
import { Input } from "./input";
import { X } from "lucide-react";
import { CARD_ARCHETYPE_FILTERS } from "../../lib/constants";
import CutCornerWrapper from "../cut-corner-wrapper";

type ArchetypeOption = { value: string; label: string };

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 rounded px-2 py-1 mr-1 mb-1">
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
          className="pr-8 bg-slate-950/60 border-cyan-500/50 text-slate-50 placeholder:text-slate-400 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/60"
        />
        {/* X/Clear button */}
        {(search || values.length > 0) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-red-400 transition-colors"
            tabIndex={-1}
            aria-label="Clear"
          >
            <X size={18} />
          </button>
        )}
        {/* Dropdown */}
        {open && filtered.length > 0 && (
          <CutCornerWrapper
            size="sm"
            padding="0"
            className="absolute z-10 w-full max-h-60 overflow-y-auto mt-1"
            style={{
              ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
              ["--cut-corner-fill" as any]: "transparent",
            }}
          >
            <div className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 shadow-xl">
              {filtered.map((archetype) => (
                <div
                  key={archetype.value}
                  className="px-3 py-2 cursor-pointer hover:bg-cyan-500/20 text-slate-50 transition-colors"
                  onMouseDown={() => handleSelect(archetype)}
                >
                  {archetype.label}
                </div>
              ))}
            </div>
          </CutCornerWrapper>
        )}
        {open && search && filtered.length === 0 && (
          <CutCornerWrapper
            size="sm"
            padding="0"
            className="absolute z-10 w-full max-h-60 overflow-y-auto mt-1"
            style={{
              ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
              ["--cut-corner-fill" as any]: "transparent",
            }}
          >
            <div className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 shadow-xl">
              <div className="px-3 py-2 text-slate-400">No results</div>
            </div>
          </CutCornerWrapper>
        )}
      </div>
    </div>
  );
}
