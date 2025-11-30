import { ToggleGroup, ToggleGroupItem } from "@radix-ui/react-toggle-group";
import { Label } from "./label";

export type ToggleFilterOption = {
  value: string;
  label: string;
};

interface ToggleFilterProps {
  label: string;
  value: string[];
  options: ToggleFilterOption[];
  onChange: (value: string[]) => void;
}

export function ToggleFilter({
  label,
  value,
  options,
  onChange,
}: ToggleFilterProps) {
  return (
    <div className="space-y-2">
      <Label className="text-cyan-300 font-medium">{label}</Label>
      <ToggleGroup
        type="multiple"
        value={value}
        onValueChange={onChange}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            type="button"
            className="px-3 py-1 text-sm border border-cyan-500/50 rounded-md bg-slate-950/60 text-slate-300 hover:text-cyan-300 hover:border-cyan-400/70 data-[state=on]:bg-cyan-500/40 data-[state=on]:text-cyan-100 data-[state=on]:border-cyan-400/70 transition-colors"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
