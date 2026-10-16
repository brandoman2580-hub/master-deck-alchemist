import type { HTMLAttributes, ReactNode } from "react";
import { MdaFrameCorners } from "@/components/mda/frame-corners";
import { cn } from "@/lib/utils";

export type MdaCropFrameProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Show technical grid watermark behind content. */
  grid?: boolean;
  /** Outer inset for crop marks (default comfortable chrome padding). */
  insetClassName?: string;
};

/**
 * Command-shell crop-mark frame. Use on page chrome / modals — never on every card tile.
 */
export function MdaCropFrame({
  children,
  grid = false,
  className,
  insetClassName = "p-4 md:p-6",
  ...props
}: MdaCropFrameProps): ReactNode {
  return (
    <div
      className={cn(
        "relative",
        grid && "mda-grid-surface",
        insetClassName,
        className,
      )}
      {...props}
    >
      <div aria-hidden className="pointer-events-none absolute inset-2 md:inset-3">
        <MdaFrameCorners variant="command" cropMarks />
      </div>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
