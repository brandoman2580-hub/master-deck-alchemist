import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { MdaFrameCorners } from "@/components/mda/frame-corners";
import { cn } from "@/lib/utils";

export type MdaGlassPopoverProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Extra classes on the frosted surface (padding, etc.). */
  panelClassName?: string;
};

const GLASS_STYLE: CSSProperties = {
  WebkitBackdropFilter: "blur(12px) saturate(160%)",
  backdropFilter: "blur(12px) saturate(160%)",
};

/**
 * Frosted popover shell. The silver fill stays translucent so color and shape
 * behind the panel remain readable, and the corner brackets are the only edge.
 *
 * Wrap card-preview body, archive action menus, and user menu contents.
 * Host Tooltip/Popover/portal must stay `bg-transparent`.
 */
export function MdaGlassPopover({
  children,
  className,
  panelClassName,
  style,
  ...props
}: MdaGlassPopoverProps): ReactNode {
  return (
    <div
      className={cn("relative", className)}
      data-mda-glass-popover
      {...props}
    >
      <div
        className={cn(
          "relative bg-[rgba(247,251,253,0.3)] text-mda-ink shadow-mda-lift",
          "backdrop-blur-[12px] backdrop-saturate-[1.6]",
          panelClassName,
        )}
        style={{ ...GLASS_STYLE, ...style }}
        data-mda-glass-surface
      >
        <MdaFrameCorners variant="selected" />
        {children}
      </div>
    </div>
  );
}
