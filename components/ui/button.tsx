"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-300 focus-visible:outline-none focus:outline-none disabled:pointer-events-none disabled:opacity-50 overflow-hidden [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:inline-block btn-cyber",
  {
    variants: {
      variant: {
        // HUD primary button: Low-opacity gradient panel that fills on hover
        default:
          "bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 hover:bg-[rgba(20,239,255,0.08)] hover:outline hover:outline-[1px] hover:outline-[rgba(20,239,255,0.35)] hover:shadow-[0_0_12px_rgba(20,239,255,0.20)] text-cyan-100 hover:text-white uppercase tracking-wider font-heading border border-cyan-500/30 hover:border-cyan-400/50 backdrop-blur-sm shadow-[0_0_20px_rgba(56,189,248,0.15)] focus-visible:ring-0 focus:ring-0 ring-2 ring-cyan-400/40",
        // HUD destructive: Red gradient with glow
        destructive:
          "bg-gradient-to-b from-red-500/20 via-red-600/15 to-red-700/5 hover:bg-[rgba(239,68,68,0.08)] hover:outline hover:outline-[1px] hover:outline-[rgba(239,68,68,0.35)] hover:shadow-[0_0_12px_rgba(239,68,68,0.20)] text-red-100 hover:text-white uppercase tracking-wider font-heading border border-red-500/30 hover:border-red-400/50 backdrop-blur-sm shadow-[0_0_20px_rgba(239,68,68,0.2)] focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        // HUD outline: Transparent with glowing cyan border, subtle gradient fill on hover
        outline:
          "border border-cyan-500/50 hover:border-cyan-400 bg-transparent hover:bg-[rgba(20,239,255,0.08)] hover:outline hover:outline-[1px] hover:outline-[rgba(20,239,255,0.35)] hover:shadow-[0_0_12px_rgba(20,239,255,0.20)] text-cyan-400 hover:text-cyan-300 uppercase tracking-wider font-heading backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        // HUD secondary: Dark surface matching Features section styling
        secondary:
          "bg-slate-900/60 hover:bg-[rgba(20,239,255,0.08)] hover:outline hover:outline-[1px] hover:outline-[rgba(20,239,255,0.35)] hover:shadow-[0_0_12px_rgba(20,239,255,0.20)] text-cyan-400 hover:text-cyan-300 uppercase tracking-wider font-heading border border-cyan-500/15 hover:border-cyan-400/40 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        // HUD ghost: Minimal, text-only with subtle hover
        ghost:
          "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 uppercase tracking-wider font-heading focus-visible:ring-0 focus:ring-0",
        // HUD link: Underlined with cyan accent
        link: "text-cyan-400 hover:text-cyan-300 underline-offset-4 hover:underline font-heading focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-12 px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      startIcon,
      endIcon,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const content = (
      <span className="inline-flex items-center justify-center gap-2">
        {startIcon && <span className="flex items-center">{startIcon}</span>}
        {children}
        {endIcon && <span className="flex items-center">{endIcon}</span>}
      </span>
    );

    // Square-shaped buttons (no cut corners)
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          // Square shape - no skew or clip-path
        )}
        ref={ref}
        {...props}
      >
        {asChild ? <span>{content}</span> : content}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
