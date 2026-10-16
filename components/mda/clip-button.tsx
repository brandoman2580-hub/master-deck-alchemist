"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ClipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?:
    | "filled"
    | "ghost"
    | "surface"
    | "heroLogin"
    | "heroPreview"
    | "headerLogin"
    | "authSubmit"
    | "hazard";
  size?: "sm" | "md" | "lg";
  /** Notched tech-cut corners via clip-path. */
  techCut?: boolean;
};

/**
 * Square CTA (matches landing Login corners).
 * Primary filled = sky (New Deck / DETAILS style).
 * Use `techCut` for moodboard notched corners; `hazard` for warning CTAs.
 */
export function ClipButton({
  children,
  className,
  variant = "filled",
  size = "md",
  techCut = false,
  type = "button",
  ...props
}: ClipButtonProps): ReactNode {
  return (
    <button
      type={type}
      data-magnetic
      className={cn(
        "relative inline-flex items-center justify-center gap-2 border-0 font-mda font-black uppercase tracking-wide transition-[background-color,color,filter,transform] duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-focus disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
        size === "sm" && "h-11 px-4 text-sm",
        size === "md" && "h-12 px-6 text-lg",
        size === "lg" && "h-[71px] min-w-[200px] px-8 text-2xl",
        techCut &&
          "[clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%-10px))]",
        variant === "filled" &&
          "bg-mda-sky text-mda-cta-ink hover:bg-mda-sky-strong",
        variant === "ghost" &&
          "bg-mda-ink/10 text-mda-ink hover:bg-mda-ink hover:text-mda-inverse-text",
        variant === "surface" &&
          "bg-mda-sky text-mda-cta-ink hover:bg-mda-sky-strong",
        variant === "heroLogin" &&
          "bg-mda-cyan-muted text-mda-ink hover:bg-mda-sky hover:text-mda-cta-ink",
        variant === "heroPreview" &&
          "bg-mda-panel text-mda-ink hover:bg-mda-chrome hover:text-mda-inverse-text",
        variant === "headerLogin" &&
          "bg-mda-sky text-mda-cta-ink hover:bg-mda-sky-strong",
        variant === "authSubmit" &&
          "bg-mda-sky text-mda-cta-ink hover:bg-mda-sky-strong",
        variant === "hazard" &&
          "bg-mda-hazard-text text-mda-inverse-text hover:bg-mda-hazard",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
