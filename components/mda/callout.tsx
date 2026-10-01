import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MdaCalloutProps = HTMLAttributes<HTMLDivElement> & {
  /** Short callout label (e.g. feature name). */
  label: ReactNode;
  /** Supporting sentence. */
  description?: ReactNode;
  /** Leader line side relative to content. */
  side?: "left" | "right";
};

/**
 * Thin callout leader for Landing / Share only — not Workshop card grids.
 */
export function MdaCallout({
  label,
  description,
  side = "left",
  className,
  ...props
}: MdaCalloutProps): ReactNode {
  const isLeft = side === "left";

  return (
    <div
      className={cn(
        "relative flex max-w-sm gap-3",
        isLeft ? "flex-row" : "flex-row-reverse text-right",
        className,
      )}
      {...props}
    >
      <div aria-hidden className="relative mt-2 w-10 shrink-0">
        <span
          className={cn(
            "absolute top-0 h-px w-full bg-mda-bezel",
            isLeft ? "left-0" : "right-0",
          )}
        />
        <span
          className={cn(
            "absolute top-0 h-2 w-2 -translate-y-1/2 rounded-full border border-mda-bezel bg-mda-surface",
            isLeft ? "left-0" : "right-0",
          )}
        />
        <span
          className={cn(
            "absolute top-0 h-8 w-px bg-mda-bezel",
            isLeft ? "right-0" : "left-0",
          )}
        />
      </div>
      <div className="min-w-0">
        <p className="font-mda text-xs font-bold uppercase tracking-[0.1em] text-mda-ink-strong">
          {label}
        </p>
        {description ? (
          <p className="mt-1 font-mda text-sm text-mda-ink-muted">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
