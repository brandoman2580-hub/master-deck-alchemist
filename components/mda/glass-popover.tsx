import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MdaGlassPopoverProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Extra classes on the frosted surface (padding, etc.). */
  panelClassName?: string;
  /**
   * The preview's positioning layer is translated, which traps a child's
   * backdrop-filter. Pass false when the blur has to live on that ancestor.
   */
  blur?: boolean;
};

const GLASS_STYLE: CSSProperties = {
  WebkitBackdropFilter: "blur(12px) saturate(160%)",
  backdropFilter: "blur(12px) saturate(160%)",
};

/**
 * Frosted popover shell for the card preview, archive actions, and user menu.
 * The fill stays translucent, and thick enough that #0c0e12 text clears
 * WCAG AA over black. The #5b6369 stroke is the edge: it stays above the
 * 3:1 boundary contrast on both the light sheet and the dark chassis.
 * Host Tooltip/Popover/portal must stay `bg-transparent`.
 */
export function MdaGlassPopover({
  children,
  className,
  panelClassName,
  blur = true,
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
          "relative border border-[#5b6369] bg-[rgba(247,251,253,0.72)] text-[#0c0e12] shadow-mda-lift",
          blur && "backdrop-blur-[12px] backdrop-saturate-[1.6]",
          panelClassName,
        )}
        style={{ ...(blur ? GLASS_STYLE : null), ...style }}
        data-mda-glass-surface
      >
        {children}
      </div>
    </div>
  );
}
