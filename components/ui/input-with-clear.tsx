import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface InputWithClearProps extends React.ComponentProps<"input"> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
}

const InputWithClear = React.forwardRef<HTMLInputElement, InputWithClearProps>(
  ({ className, value, onChange, onClear, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <input
          ref={ref}
          value={value}
          onChange={onChange}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pr-10",
            className,
          )}
          {...props}
        />
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-muted hover:bg-accent text-muted-foreground rounded-full p-1 flex items-center justify-center focus:outline-none"
            tabIndex={-1}
            aria-label="Clear input"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);
InputWithClear.displayName = "InputWithClear";

export { InputWithClear };
