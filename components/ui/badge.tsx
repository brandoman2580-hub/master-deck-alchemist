"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";
import { ANIMATION_DURATION, EASING } from "@/lib/animations";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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
    Omit<
      React.HTMLAttributes<HTMLDivElement>,
      "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"
    >,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  const prefersReducedMotion = useReducedMotion();
  const hasAnimatedRef = React.useRef(false);

  // Only animate on initial mount, not on every render
  // This prevents infinite loops in virtualized lists
  // Mark as animated immediately to prevent re-animation on re-renders
  const shouldAnimate = !hasAnimatedRef.current && !prefersReducedMotion;
  if (shouldAnimate) {
    hasAnimatedRef.current = true;
  }

  return (
    <motion.div
      className={cn(badgeVariants({ variant }), className)}
      initial={shouldAnimate ? { scale: 0.9, opacity: 0.8 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        duration: ANIMATION_DURATION.fast,
        ease: EASING.bounce,
      }}
      {...(props as any)}
    />
  );
}

export { Badge, badgeVariants };
