"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-300 focus-visible:outline-none focus:outline-none disabled:pointer-events-none disabled:opacity-50 overflow-hidden [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:inline-block rounded-lg",
  {
    variants: {
      variant: {
        // Glassmorphic primary: Translucent white/cyan background with blur
        default:
          "bg-white/10 hover:bg-white/15 text-white border border-white/20 hover:border-white/30 backdrop-blur-md shadow-lg hover:shadow-xl focus-visible:outline-none",
        // Glassmorphic destructive: Translucent red background
        destructive:
          "bg-red-500/10 hover:bg-red-500/15 text-red-100 border border-red-500/20 hover:border-red-500/30 backdrop-blur-md shadow-lg hover:shadow-xl focus-visible:outline-none",
        // Glassmorphic outline: Transparent with subtle border
        outline:
          "border border-white/20 hover:border-white/30 bg-transparent hover:bg-white/5 text-white hover:text-white backdrop-blur-sm focus-visible:outline-none",
        // Glassmorphic secondary: Darker translucent background
        secondary:
          "bg-slate-800/40 hover:bg-slate-800/50 text-white border border-white/10 hover:border-white/20 backdrop-blur-md shadow-lg hover:shadow-xl focus-visible:outline-none",
        // Glassmorphic ghost: Minimal with subtle hover
        ghost:
          "text-white/80 hover:text-white hover:bg-white/5 focus-visible:outline-none",
        // Glassmorphic link: Underlined with white accent
        link: "text-white/80 hover:text-white underline-offset-4 hover:underline focus-visible:outline-none",
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
