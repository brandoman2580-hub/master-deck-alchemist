"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type LandingFeatureRowProps = {
  icon: LucideIcon;
  label: string;
  className?: string;
};

export function LandingFeatureRow({
  icon: Icon,
  label,
  className,
}: LandingFeatureRowProps): ReactNode {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2.5 overflow-hidden p-2.5",
        className,
      )}
    >
      <Icon
        className="size-[50px] shrink-0 text-[#7ee8ff] drop-shadow-[0_0_10px_rgba(126,232,255,0.65)]"
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="font-open-sans text-xl font-normal uppercase leading-6 text-white">
        {label}
      </p>
    </div>
  );
}
