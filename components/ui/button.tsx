"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";
import { SCALE, ANIMATION_DURATION, EASING } from "@/lib/animations";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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
    Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"
    >,
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
      disabled,
      onClick,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const prefersReducedMotion = useReducedMotion();
    const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([]);
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const removeRipple = React.useCallback((id: number) => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, []);

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || prefersReducedMotion) {
          onClick?.(e);
          return;
        }

        const button = buttonRef.current || (ref as React.RefObject<HTMLButtonElement>)?.current;
        if (button) {
          const rect = button.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const id = Date.now();

          setRipples((prev) => [...prev, { id, x, y }]);
        }

        onClick?.(e);
      },
      [disabled, prefersReducedMotion, onClick, ref],
    );

    const content = (
      <span className="inline-flex items-center justify-center gap-2 relative z-10">
        {startIcon && <span className="flex items-center">{startIcon}</span>}
        {children}
        {endIcon && <span className="flex items-center">{endIcon}</span>}
      </span>
    );

    // Square-shaped buttons (no cut corners)
    if (asChild || prefersReducedMotion || disabled) {
      return (
        <Comp
          className={cn(
            buttonVariants({ variant, size, className }),
          )}
          ref={ref}
          disabled={disabled}
          onClick={onClick}
          {...props}
        >
          {asChild ? <span>{content}</span> : content}
        </Comp>
      );
    }

    return (
      <motion.button
        ref={(node) => {
          buttonRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
          }
        }}
        className={cn(buttonVariants({ variant, size, className }), "relative overflow-hidden")}
        disabled={disabled}
        whileHover={{
          scale: SCALE.hover,
          transition: {
            duration: ANIMATION_DURATION.fast,
            ease: EASING.smooth,
          },
        }}
        whileTap={{
          scale: SCALE.active,
          transition: {
            duration: ANIMATION_DURATION.instant,
          },
        }}
        onClick={handleClick}
        {...(props as any)}
      >
        <AnimatePresence>
          {ripples.map((ripple) => (
            <motion.span
              key={ripple.id}
              className="absolute rounded-full bg-white/30 pointer-events-none"
              initial={{
                x: ripple.x,
                y: ripple.y,
                width: 0,
                height: 0,
                opacity: 0.6,
              }}
              animate={{
                width: 200,
                height: 200,
                x: ripple.x - 100,
                y: ripple.y - 100,
                opacity: 0,
              }}
              onAnimationComplete={() => removeRipple(ripple.id)}
              transition={{
                duration: 0.6,
                ease: EASING.smooth,
              }}
            />
          ))}
        </AnimatePresence>
        {content}
      </motion.button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
