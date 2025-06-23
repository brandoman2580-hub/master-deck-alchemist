import { ToggleGroup, ToggleGroupItem } from "@radix-ui/react-toggle-group";
import { Label } from "@/components/ui/label";

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
      <Label>{label}</Label>
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
            className="px-3 py-1 text-sm border rounded-md data-[state=on]:bg-primary data-[state=on]:text-white"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
