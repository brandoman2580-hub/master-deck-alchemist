"use client";

import { usePathname } from "next/navigation";

/**
 * SkipLink: Provides keyboard-accessible skip navigation to main content.
 * WCAG 2.4.1 (Bypass Blocks)
 *
 * Hidden by default, becomes visible on focus.
 * The landing page owns its own main landmark, so skip past the product header.
 */

export function SkipLink() {
  const pathname = usePathname() ?? "/";
  const href = pathname === "/" ? "#landing-main" : "#main-content";

  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-white focus:rounded focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950"
    >
      Skip to main content
    </a>
  );
}
