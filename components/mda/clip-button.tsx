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
    | "authSubmit";
  size?: "sm" | "md" | "lg";
};

/**
 * Square CTA (matches landing Login corners).
 * Primary filled = sky (New Deck / DETAILS style).
 */
export function ClipButton({
  children,
  className,
  variant = "filled",
  size = "md",
  type = "button",
  ...props
}: ClipButtonProps): ReactNode {
  return (
    <button
      type={type}
      data-magnetic
      className={cn(
        "relative inline-flex items-center justify-center gap-2 border-0 font-mda font-black uppercase tracking-wide transition-[background-color,color,filter,transform] duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-cyan disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
        size === "sm" && "h-10 px-4 text-sm",
        size === "md" && "h-12 px-6 text-lg",
        size === "lg" && "h-[71px] min-w-[200px] px-8 text-2xl",
        variant === "filled" &&
          "bg-mda-sky text-white hover:bg-mda-sky-strong",
        variant === "ghost" &&
          "bg-mda-ink/10 text-mda-ink hover:bg-mda-ink hover:text-mda-inverse-text",
        variant === "surface" &&
          "bg-mda-sky text-white hover:bg-mda-sky-strong",
        variant === "heroLogin" &&
          "bg-mda-cyan-muted text-mda-ink hover:bg-mda-sky hover:text-white",
        variant === "heroPreview" &&
          "bg-mda-panel text-mda-ink hover:bg-mda-chrome hover:text-mda-inverse-text",
        variant === "headerLogin" &&
          "bg-mda-sky text-white hover:bg-mda-sky-strong",
        variant === "authSubmit" &&
          "bg-mda-sky text-white hover:bg-mda-sky-strong",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
