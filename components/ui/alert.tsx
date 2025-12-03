"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"
import CutCornerWrapper from "../cut-corner-wrapper"

const alertVariants = cva(
  "relative w-full border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <CutCornerWrapper
    size="md"
    hoverHighlight
    style={{
      ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
      ["--cut-corner-stroke-hover" as any]: "rgba(20,239,255,0.52)",
      ["--cut-corner-fill" as any]: "transparent",
    }}
  >
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  </CutCornerWrapper>
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
