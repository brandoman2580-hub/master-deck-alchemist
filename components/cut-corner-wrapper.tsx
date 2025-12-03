// components/CutCornerWrapper.tsx
"use client";

import React from "react";

type Size = "sm" | "md" | "lg";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  size?: Size; // affects corner inset
  stroke?: string; // stroke color (CSS value)
  strokeWidth?: number; // stroke width in px
  fill?: string; // fill color (CSS value)
  padding?: string; // CSS padding for inner content
  hoverHighlight?: boolean; // apply hover highlight class
  preserveClipFallback?: boolean; // keep existing clip-path fallback
}

/**
 * CutCornerWrapper
 * Wrap any content to render a cut-corner SVG background with stroke.
 * - Keeps children accessible and interactive (SVG uses pointer-events:none)
 * - Use CSS variables to theme colors or pass props
 */
export default function CutCornerWrapper({
  children,
  size = "md",
  stroke = "rgba(20,239,255,0.38)",
  strokeWidth = 2,
  fill = "rgba(10,20,30,0.02)",
  padding,
  hoverHighlight = false,
  preserveClipFallback = true,
  className = "",
  ...rest
}: Props) {
  // corner inset values mapped by size (px). These control the SVG path points.
  // More shallow cuts as shown in the reference image
  const insetMap = { sm: 4, md: 6, lg: 8 };
  const inset = insetMap[size] ?? 6;

  // SVG viewBox: we'll use 100 x 100 units and scale via preserveAspectRatio
  // path uses the inset to create cut corners.
  // Path scaled to 100x100 space => convert inset px to percentage is unnecessary, but path is scalable.
  // We'll draw a generic polygon that approximates cut corners.
  const pathD = `
    M ${inset} 0
    L 100 0
    L 100 ${100 - inset}
    L ${100 - inset} 100
    L 0 100
    L 0 ${inset}
    Z
  `.replace(/\s+/g, " ");

  // CSS variables so callers can override via style or external CSS
  const styleVars: React.CSSProperties = {
    ["--cut-corner-stroke" as any]: stroke,
    ["--cut-corner-stroke-width" as any]: `${strokeWidth}`,
    ["--cut-corner-fill" as any]: fill,
    ["--cut-corner-padding" as any]: padding ?? (size === "sm" ? "0.35rem" : size === "lg" ? "0.85rem" : "0.55rem"),
  };

  const { style: restStyle, ...restProps } = rest;
  
  return (
    <div
      className={`cut-corner-wrapper ${hoverHighlight ? "hover-highlight" : ""} ${className}`}
      style={{
        ...styleVars,
        background: restStyle?.background || "transparent",
        backdropFilter: restStyle?.backdropFilter || "none",
        WebkitBackdropFilter: restStyle?.WebkitBackdropFilter || "none",
        boxShadow: restStyle?.boxShadow || "none",
        ...restStyle,
      }}
      {...restProps}
    >
      {/* Inline SVG background: scaled to cover the container */}
      <svg
        className="cut-corner-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        role="presentation"
      >
        <path
          d={pathD}
          fill="var(--cut-corner-fill)"
          stroke="var(--cut-corner-stroke)"
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      </svg>

      {/* Content wrapper — content sits above the SVG */}
      <div 
        className="cut-corner-content" 
        style={{ 
          padding: styleVars["--cut-corner-padding"] as string,
          height: "100%",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
      {/* Optionally preserve clip-path fallback if callers relied on cut-corner-* classes */}
      {preserveClipFallback ? null : null}
    </div>
  );
}

