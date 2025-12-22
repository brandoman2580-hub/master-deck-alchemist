"use client";

import * as React from "react";
import { motion } from "framer-motion";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "../../lib/utils";
import { SPRING_CONFIG } from "@/lib/animations";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className,
    )}
    {...props}
  >
    <motion.div
      className="h-full w-full flex-1 bg-primary rounded-full"
      initial={{ scaleX: 0, transformOrigin: "left" }}
      animate={{
        scaleX: (value || 0) / 100,
      }}
      transition={{
        type: "spring",
        stiffness: SPRING_CONFIG.gentle.tension,
        damping: SPRING_CONFIG.gentle.friction,
      }}
      style={{ transformOrigin: "left" }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
