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
      <Label className="text-white/80 font-medium">{label}</Label>
      <div className="relative flex w-fit bg-white/5 border border-white/10 backdrop-blur-xl rounded-lg">
        <ToggleGroup
          type="multiple"
          value={value}
          onValueChange={onChange}
          className="flex flex-wrap gap-0"
        >
          {options.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              type="button"
              className={`relative z-10 px-3 py-2 font-semibold transition-colors duration-200 focus:outline-none flex items-center justify-center gap-1 text-xs font-display rounded-lg
                ${value.includes(option.value) ? "text-white bg-white/10" : "text-white/60 hover:bg-white/5"}
              `}
              aria-pressed={value.includes(option.value)}
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
