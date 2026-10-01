import type { HTMLAttributes, ReactNode } from "react";
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
        {/* Top-left */}
        <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-mda-bezel" />
        <span className="absolute left-0 top-0 h-2 w-px -translate-x-1.5 translate-y-4 bg-mda-bezel" />
        <span className="absolute left-0 top-0 h-px w-2 -translate-y-1.5 translate-x-4 bg-mda-bezel" />
        {/* Top-right */}
        <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-mda-bezel" />
        <span className="absolute right-0 top-0 h-2 w-px translate-x-1.5 translate-y-4 bg-mda-bezel" />
        <span className="absolute right-0 top-0 h-px w-2 -translate-y-1.5 -translate-x-4 bg-mda-bezel" />
        {/* Bottom-left */}
        <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-mda-bezel" />
        <span className="absolute bottom-0 left-0 h-2 w-px -translate-x-1.5 -translate-y-4 bg-mda-bezel" />
        <span className="absolute bottom-0 left-0 h-px w-2 translate-y-1.5 translate-x-4 bg-mda-bezel" />
        {/* Bottom-right */}
        <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-mda-bezel" />
        <span className="absolute bottom-0 right-0 h-2 w-px translate-x-1.5 -translate-y-4 bg-mda-bezel" />
        <span className="absolute bottom-0 right-0 h-px w-2 translate-y-1.5 -translate-x-4 bg-mda-bezel" />
      </div>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
