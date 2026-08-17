import type { ReactNode } from "react";
import Image from "next/image";

/**
 * Alt2 landing backdrop: circuit fill + a shared CONSTRUCT/Blocks stage.
 *
 * CONSTRUCT and Blocks live in one stage so their overlap stays locked while
 * the stage scales with min(82vw, 95vh, 1100px). Layer positions inside the
 * stage use % of the stage — not independent viewport rules.
 *
 * Layer order (bottom → top):
 * 1. Edge fill (#eef8f9)
 * 2. Circuit field — MDA_Landing_BG_minimalist.svg
 * 3. Shared stage → CONSTRUCT (Space Armor SVG) → Blocks SVG
 *
 * Decorative only — no hover effects (Blocks sit above CONSTRUCT).
 */
export function LandingBackground(): ReactNode {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#eef8f9]" />

      <div className="absolute inset-0 bg-[url('/images/MDA_Landing_BG_minimalist.svg')] bg-cover bg-center bg-no-repeat" />

      {/*
        Shared stage: one scale + origin for CONSTRUCT and Blocks.
        Width is width- and height-aware so short viewports shrink the pair
        together instead of letting them drift apart.
      */}
      <div className="absolute left-1/2 top-[28%] w-[min(82vw,95vh,1100px)] -translate-x-1/2 -translate-y-1/2">
        <svg
          className="relative z-0 h-auto w-full overflow-visible"
          viewBox="0 0 1000 220"
          xmlns="http://www.w3.org/2000/svg"
        >
          <text
            x="500"
            y="155"
            textAnchor="middle"
            fill="#5c819e"
            fontFamily='"Space Armor", sans-serif'
            fontSize="84"
            letterSpacing="4"
          >
            CONSTRUCT
          </text>
        </svg>

        <div className="absolute left-1/2 top-[160%] z-10 aspect-square w-[62%] -translate-x-1/2 -translate-y-1/2">
          <Image
            src="/images/MDA_Landing_Blocks.svg"
            alt=""
            fill
            priority
            unoptimized
            className="object-contain object-center"
            sizes="(max-width: 640px) 70vw, 1100px"
          />
        </div>
      </div>
    </div>
  );
}
