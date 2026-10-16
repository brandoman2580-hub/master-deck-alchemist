import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MdaStatusChipTone =
  | "ink"
  | "hazard"
  | "danger"
  | "success"
  | "cyan";

export type MdaStatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: MdaStatusChipTone;
};

const TONE_CLASS: Record<MdaStatusChipTone, string> = {
  ink: "bg-mda-chrome text-mda-inverse-text",
  hazard: "bg-mda-hazard-text text-mda-inverse-text",
  danger: "bg-mda-danger-text text-mda-inverse-text",
  success: "bg-mda-success-text text-mda-inverse-text",
  cyan: "bg-mda-cyan text-mda-cta-ink",
};

/**
 * Solid MODEL-tag style status chip (caps, deck status, warnings).
 */
export function MdaStatusChip({
  children,
  tone = "ink",
  className,
  ...props
}: MdaStatusChipProps): ReactNode {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 font-mda text-xs font-bold uppercase tracking-[0.1em]",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
