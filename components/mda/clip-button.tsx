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
 * Hover: darken / invert with ease in-out (app-wide button behavior).
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
        "relative inline-flex items-center justify-center gap-2 border-0 font-mda font-black uppercase tracking-wide transition-[background-color,color,filter,transform] duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--mda-cyan)] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
        size === "sm" && "h-10 px-4 text-sm",
        size === "md" && "h-12 px-6 text-lg",
        size === "lg" && "h-[71px] min-w-[200px] px-8 text-2xl",
        variant === "filled" &&
          "bg-[color:var(--mda-cyan)] text-[color:var(--mda-bg-deep)] hover:bg-[color:var(--mda-bg-deep)] hover:text-[color:var(--mda-cyan)]",
        variant === "ghost" &&
          "bg-white/10 text-white hover:bg-white hover:text-[color:var(--mda-bg-deep)]",
        variant === "surface" &&
          "bg-[color:var(--mda-surface-raised)] text-white hover:bg-white hover:text-[color:var(--mda-bg-deep)]",
        variant === "heroLogin" &&
          "bg-[rgba(126,232,255,0.25)] text-white hover:bg-[color:var(--mda-cyan)] hover:text-[color:var(--mda-bg-deep)]",
        variant === "heroPreview" &&
          "bg-[rgba(183,183,183,0.6)] text-white hover:bg-white hover:text-[#45474b]",
        variant === "headerLogin" &&
          "bg-[#7ee8ff] text-[#eaf7ff] shadow-[0_0_16px_2px_rgba(126,232,255,0.55),0_0_32px_4px_rgba(56,214,255,0.35)] hover:bg-[#1a1d22] hover:text-[#7ee8ff] hover:shadow-[0_0_20px_4px_rgba(126,232,255,0.7),0_0_40px_8px_rgba(56,214,255,0.45)]",
        variant === "authSubmit" &&
          "bg-[#c8f0ff] text-[#4d6676] hover:bg-[#4d6676] hover:text-[#c8f0ff]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
