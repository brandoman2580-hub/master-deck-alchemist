import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MdaHazardStripeProps = HTMLAttributes<HTMLDivElement> & {
  /** Visible label beside/over the stripe (required for WCAG when stripe is decorative). */
  label?: ReactNode;
  /** Stripe band height. */
  size?: "sm" | "md";
};

/**
 * Diagonal hazard stripe band for status headers only — never wallpaper or card cells.
 */
export function MdaHazardStripe({
  label,
  size = "sm",
  className,
  children,
  ...props
}: MdaHazardStripeProps): ReactNode {
  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden border border-mda-bezel/40",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className={cn(
          "mda-hazard-stripe shrink-0",
          size === "sm" ? "w-3" : "w-5",
        )}
      />
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center bg-mda-surface px-3 font-mda text-xs font-bold uppercase tracking-[0.08em] text-mda-hazard-text",
          size === "sm" ? "min-h-8 py-1.5" : "min-h-10 py-2",
        )}
      >
        {label ?? children}
      </div>
    </div>
  );
}
