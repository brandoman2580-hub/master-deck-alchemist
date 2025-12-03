"use client"

import * as React from "react"

import { cn } from "../../lib/utils"
import CutCornerWrapper from "../cut-corner-wrapper"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <CutCornerWrapper
        size="sm"
        padding="0"
        className="w-full"
        style={{
          ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
          ["--cut-corner-fill" as any]: "transparent",
        }}
      >
        <input
          type={type}
          className={cn(
            "flex h-9 w-full border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={ref}
          {...props}
        />
      </CutCornerWrapper>
    )
  }
)
Input.displayName = "Input"

export { Input }
