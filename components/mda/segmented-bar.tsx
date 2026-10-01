import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MdaSegmentedBarProps = HTMLAttributes<HTMLDivElement> & {
  /** Filled segments (0..segments). */
  value: number;
  /** Total tick count (default 10). */
  segments?: number;
  /** Orientation of ticks. */
  orientation?: "horizontal" | "vertical";
  /** Accessible name for the meter. */
  label: string;
  tone?: "cyan" | "hazard" | "success" | "ink";
};

const TONE_CLASS: Record<NonNullable<MdaSegmentedBarProps["tone"]>, string> = {
  cyan: "bg-mda-chrome-deep",
  hazard: "bg-mda-hazard-text",
  success: "bg-mda-success-text",
  ink: "bg-mda-ink",
};

/**
 * Segmented gauge atom (Grade axes / quota HUD plug). CSS rects only.
 * Filled ticks use text-safe chroma so contrast vs track meets ~3:1 UI.
 */
export function MdaSegmentedBar({
  value,
  segments = 10,
  orientation = "horizontal",
  label,
  tone = "cyan",
  className,
  ...props
}: MdaSegmentedBarProps): ReactNode {
  const capped = Math.max(0, Math.min(segments, Math.round(value)));
  const isVertical = orientation === "vertical";

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={segments}
      aria-valuenow={capped}
      className={cn(
        "inline-flex gap-0.5",
        isVertical ? "h-16 flex-col-reverse" : "h-3 w-full flex-row",
        className,
      )}
      {...props}
    >
      {Array.from({ length: segments }, (_, index) => {
        const filled = index < capped;
        return (
          <span
            key={index}
            aria-hidden
            className={cn(
              "flex-1 rounded-[1px]",
              isVertical ? "w-2 min-h-[4px]" : "min-w-[4px]",
              filled ? TONE_CLASS[tone] : "bg-mda-panel",
            )}
          />
        );
      })}
    </div>
  );
}
