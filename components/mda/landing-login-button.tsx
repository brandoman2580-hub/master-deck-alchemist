"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type LandingLoginButtonProps = {
  onClick: () => void;
  size?: "header" | "hero";
  className?: string;
  hidden?: boolean;
};

function LoginBracket({
  side,
}: {
  side: "left" | "right";
}): ReactNode {
  const isLeft = side === "left";
  // Arms wrap onto the fill: left opens right `[`, right opens left `]`
  const d = isLeft ? "M8 1H1V59H8" : "M0 1H7V59H0";

  return (
    <svg
      aria-hidden
      width={9}
      height={60}
      viewBox="0 0 9 60"
      fill="none"
      className={cn(
        "pointer-events-none absolute top-px z-20 overflow-visible",
        isLeft ? "left-0" : "right-0",
      )}
    >
      <path d={d} stroke="var(--mda-ink-soft)" strokeWidth={2} strokeLinecap="square" />
    </svg>
  );
}

/**
 * Alt4 v2 Login CTA.
 * Hero: fill edge-to-edge; C-brackets overlay the left/right edges (Figma).
 */
export function LandingLoginButton({
  onClick,
  size = "header",
  className,
  hidden = false,
}: LandingLoginButtonProps): ReactNode {
  if (hidden) return null;

  const isHero = size === "hero";

  if (isHero) {
    return (
      <div className={cn("relative h-[61px] w-[232px]", className)}>
        <button
          type="button"
          onClick={onClick}
          data-magnetic
          aria-label="Open login"
          className="absolute inset-0 z-0 flex items-center gap-2.5 bg-black/15 pl-[30px] pr-4 text-mda-ink transition-[background-color,transform] duration-200 ease-in-out hover:bg-black/25 active:scale-[0.98]"
        >
          <span className="font-display text-[36px] font-semibold uppercase leading-none tracking-wide">
            Login
          </span>
          <ArrowUpRight className="size-[50px]" strokeWidth={2} aria-hidden />
        </button>
        <LoginBracket side="left" />
        <LoginBracket side="right" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-magnetic
      aria-label="Open login"
      className={cn(
        "inline-flex items-center gap-2.5 px-[17px] py-1.5 text-mda-ink transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-mda-cyan-soft/40 active:scale-[0.98]",
        className,
      )}
    >
      <span className="font-display text-2xl font-semibold uppercase leading-none tracking-wide">
        Login
      </span>
      <ArrowUpRight className="size-6" strokeWidth={2} aria-hidden />
    </button>
  );
}
