import { ToggleGroup, ToggleGroupItem } from "@radix-ui/react-toggle-group";
import { Label } from "./label";
import { cn } from "@/lib/utils";

export type ToggleFilterOption = {
  value: string;
  label: string;
};

interface ToggleFilterProps {
  label: string;
  value: string[];
  options: ToggleFilterOption[];
  onChange: (value: string[]) => void;
  /** `glass` = dark builder overlay; `chrome` = MDA light workshop filters. */
  variant?: "glass" | "chrome";
}

export function ToggleFilter({
  label,
  value,
  options,
  onChange,
  variant = "glass",
}: ToggleFilterProps) {
  const isChrome = variant === "chrome";

  return (
    <div className="space-y-2">
      <Label
        className={cn(
          "font-medium",
          isChrome ? "font-spaceGrotesk text-sm text-mda-ink" : "text-white/80",
        )}
      >
        {label}
      </Label>
      <div
        className={cn(
          "relative flex w-fit",
          isChrome
            ? "border border-mda-chrome-deep bg-mda-chrome"
            : "rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl",
        )}
      >
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
              data-magnetic={isChrome ? true : undefined}
              className={cn(
                "relative z-10 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold transition-colors duration-200 focus:outline-none",
                isChrome
                  ? cn(
                      "font-spaceGrotesk uppercase tracking-wide text-mda-inverse-text hover:bg-[#e2e8f0] hover:text-[#14181f]",
                      value.includes(option.value)
                        ? "bg-mda-chrome-deep"
                        : "bg-transparent",
                    )
                  : cn(
                      "rounded-lg font-display",
                      value.includes(option.value)
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5",
                    ),
              )}
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
