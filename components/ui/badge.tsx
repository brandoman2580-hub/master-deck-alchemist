"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border rounded-md px-2.5 py-0.5 text-xs font-semibold focus:outline-none backdrop-blur-sm",
  {
    variants: {
      variant: {
        default:
          "bg-white/10 border-white/20 text-white shadow",
        secondary:
          "bg-white/10 border-white/20 text-white/80",
        destructive:
          "bg-red-500/20 border-red-500/30 text-red-300 shadow",
        outline: "bg-white/5 border-white/20 text-white/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
      <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
