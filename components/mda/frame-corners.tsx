import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MdaFrameCornersVariant = "quiet" | "selected" | "command";

export type MdaFrameCornersProps = {
  className?: string;
  /** Corner arm length (default 12px via h-3/w-3). */
  sizeClassName?: string;
  /** Border thickness for each L arm (default 1px). */
  thicknessClassName?: string;
  /**
   * HUD bezel density:
   * - quiet: restrained (grids / default)
   * - selected: slightly denser selected state
   * - command: denser chrome/modals/preview
   */
  variant?: MdaFrameCornersVariant;
};

const VARIANT_DEFAULTS: Record<
  MdaFrameCornersVariant,
  { size: string; thickness: string; color: string }
> = {
  quiet: {
    size: "h-3 w-3",
    thickness: "border",
    color: "border-mda-chrome",
  },
  selected: {
    size: "h-3.5 w-3.5",
    thickness: "border-[1.5px]",
    color: "border-mda-cyan",
  },
  command: {
    size: "h-4 w-4",
    thickness: "border-2",
    color: "border-mda-bezel",
  },
};

/**
 * L-bracket / HUD bezel corners for Workshop panels and card previews.
 * Prefer `quiet` on grids; `command` on chrome/modals; `selected` on focus.
 */
export function MdaFrameCorners({
  className,
  sizeClassName,
  thicknessClassName,
  variant = "quiet",
}: MdaFrameCornersProps): ReactNode {
  const defaults = VARIANT_DEFAULTS[variant];
  const arm = cn(
    "pointer-events-none absolute",
    defaults.color,
    sizeClassName ?? defaults.size,
    thicknessClassName ?? defaults.thickness,
  );
  return (
    <div
      aria-hidden
      data-mda-bezel={variant}
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <span className={cn(arm, "left-0 top-0 border-b-0 border-r-0")} />
      <span className={cn(arm, "right-0 top-0 border-b-0 border-l-0")} />
      <span className={cn(arm, "bottom-0 left-0 border-r-0 border-t-0")} />
      <span className={cn(arm, "bottom-0 right-0 border-l-0 border-t-0")} />
    </div>
  );
}
