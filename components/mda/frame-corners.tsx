import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MdaFrameCornersProps = {
  className?: string;
  /** Corner arm length (default 12px via h-3/w-3). */
  sizeClassName?: string;
  /** Border thickness for each L arm (default 1px). */
  thicknessClassName?: string;
};

/**
 * L-bracket corners used by Workshop panels and card previews.
 */
export function MdaFrameCorners({
  className,
  sizeClassName = "h-3 w-3",
  thicknessClassName = "border",
}: MdaFrameCornersProps): ReactNode {
  const arm = cn(
    "pointer-events-none absolute border-mda-chrome",
    sizeClassName,
    thicknessClassName,
  );
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <span className={cn(arm, "left-0 top-0 border-b-0 border-r-0")} />
      <span className={cn(arm, "right-0 top-0 border-b-0 border-l-0")} />
      <span className={cn(arm, "bottom-0 left-0 border-r-0 border-t-0")} />
      <span className={cn(arm, "bottom-0 right-0 border-l-0 border-t-0")} />
    </div>
  );
}
