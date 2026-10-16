import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MdaFrameCornersVariant = "quiet" | "selected" | "command";

export type MdaFrameCornersProps = {
  className?: string;
  /**
   * HUD bezel color:
   * - quiet: steel chrome
   * - selected: ice
   * - command: bezel
   * Arm length is always 12% of the frame's shorter side, and both arms match.
   */
  variant?: MdaFrameCornersVariant;
  /** Outer crop ticks, used by command shells. */
  cropMarks?: boolean;
};

const VARIANT_COLOR: Record<
  MdaFrameCornersVariant,
  { line: string; tick: string }
> = {
  quiet: { line: "border-mda-chrome", tick: "bg-mda-chrome" },
  selected: { line: "border-mda-cyan", tick: "bg-mda-cyan" },
  command: { line: "border-mda-bezel", tick: "bg-mda-bezel" },
};

/**
 * L-bracket corners. The frame is a size container, so each arm is
 * `max(8px, 12cqmin)` — equal length, scaled to the parent.
 */
export function MdaFrameCorners({
  className,
  variant = "quiet",
  cropMarks = false,
}: MdaFrameCornersProps): ReactNode {
  const color = VARIANT_COLOR[variant];
  return (
    <div
      aria-hidden
      data-mda-bezel={variant}
      className={cn("mda-l-frame", className)}
    >
      <span className={cn("mda-l-arm mda-l-arm-tl", color.line)} />
      <span className={cn("mda-l-arm mda-l-arm-tr", color.line)} />
      <span className={cn("mda-l-arm mda-l-arm-bl", color.line)} />
      <span className={cn("mda-l-arm mda-l-arm-br", color.line)} />
      {cropMarks ? (
        <>
          <span className={cn("mda-l-tick mda-l-tick-tl-y", color.tick)} />
          <span className={cn("mda-l-tick mda-l-tick-tl-x", color.tick)} />
          <span className={cn("mda-l-tick mda-l-tick-tr-y", color.tick)} />
          <span className={cn("mda-l-tick mda-l-tick-tr-x", color.tick)} />
          <span className={cn("mda-l-tick mda-l-tick-bl-y", color.tick)} />
          <span className={cn("mda-l-tick mda-l-tick-bl-x", color.tick)} />
          <span className={cn("mda-l-tick mda-l-tick-br-y", color.tick)} />
          <span className={cn("mda-l-tick mda-l-tick-br-x", color.tick)} />
        </>
      ) : null}
    </div>
  );
}
