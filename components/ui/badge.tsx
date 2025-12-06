"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";
import CutCornerWrapper from "../cut-corner-wrapper";

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
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
    <CutCornerWrapper
      size="sm"
      className="inline-block"
      padding="0"
      style={{
        ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
        ["--cut-corner-fill" as any]: "transparent",
      }}
    >
      <div className={cn(badgeVariants({ variant }), className)} {...props} />
    </CutCornerWrapper>
  );
}

export { Badge, badgeVariants };
