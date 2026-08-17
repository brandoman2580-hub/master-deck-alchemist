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

/**
 * Alt2 v2 Login CTA — header is outline; hero remains solid cyan.
 */
export function LandingLoginButton({
  onClick,
  size = "header",
  className,
  hidden = false,
}: LandingLoginButtonProps): ReactNode {
  if (hidden) return null;

  const isHero = size === "hero";

  return (
    <button
      type="button"
      onClick={onClick}
      data-magnetic
      aria-label="Open login"
      className={cn(
        "inline-flex items-center transition-[background-color,color,border-color,filter,transform] duration-200 ease-in-out active:scale-[0.98]",
        isHero
          ? "gap-2.5 bg-[#7ee8ff] px-[30px] py-1.5 text-black hover:brightness-110"
          : "gap-2.5 border-2 border-[#7ee8ff] bg-transparent px-[17px] py-1.5 text-[#7ee8ff] hover:bg-[#7ee8ff] hover:text-black",
        className,
      )}
    >
      <span
        className={cn(
          "font-anton uppercase leading-none tracking-wide",
          isHero ? "text-[36px]" : "text-2xl",
        )}
      >
        Login
      </span>
      <ArrowUpRight
        className={cn(isHero ? "size-[50px]" : "size-6")}
        strokeWidth={2}
        aria-hidden
      />
    </button>
  );
}
