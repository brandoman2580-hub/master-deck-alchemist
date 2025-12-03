import { ToggleGroup, ToggleGroupItem } from "@radix-ui/react-toggle-group";
import { Label } from "./label";
import CutCornerWrapper from "../cut-corner-wrapper";

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
      <CutCornerWrapper
        size="sm"
        padding="0"
        className="relative flex w-fit"
        style={{
          ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
          ["--cut-corner-fill" as any]: "transparent",
        }}
      >
        <div className="relative flex w-fit bg-cyb-800/40 border border-accent-cyan/18 backdrop-blur-sm">
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
                className={`relative z-10 px-3 py-2 font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 flex items-center justify-center gap-1 text-xs font-display
                  ${value.includes(option.value) ? "text-accent-cyan/80" : "text-muted-50"}
                `}
                aria-pressed={value.includes(option.value)}
                style={{
                  background: value.includes(option.value) ? "rgba(20,239,255,0.20)" : "transparent",
                  position: "relative",
                }}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CutCornerWrapper>
    </div>
  );
}
