"use client";

/**
 * FocusManager: Handles focus management after Next.js client-side navigation.
 *
 * Behavior:
 * - Focuses <main> element only after route changes (not initial load)
 * - Only focuses if current focus is on <body> (avoids stealing focus from modals/overlays)
 * - Skips focus when modals or overlays are open (detected via data attributes)
 *
 * Usage: Add <FocusManager /> to app/layout.tsx inside <body>
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function FocusManager() {
  const pathname = usePathname();

  useEffect(() => {
    // Skip on initial mount (server-side render)
    if (typeof window === "undefined") return;

    // Check if a modal or overlay is open
    // Radix UI dialogs set data-state="open" on DialogContent
    const hasOpenModal = document.querySelector(
      '[role="dialog"][data-state="open"]',
    );
    const hasOpenOverlay = document.querySelector(
      '[data-state="open"]:not([role="dialog"])',
    );

    if (hasOpenModal || hasOpenOverlay) {
      // Don't steal focus from modals/overlays
      return;
    }

    // Only focus <main> if current focus is on <body> (no other element has focus)
    // This prevents stealing focus from interactive elements that may have been focused
    // programmatically (e.g., skip links, form inputs)
    const activeElement = document.activeElement;
    const isBodyFocused =
      activeElement === document.body ||
      activeElement === document.documentElement;

    if (!isBodyFocused) {
      // Something else has focus, don't interfere
      return;
    }

    // Find main content region
    const main =
      document.querySelector('main[id="main-content"]') ||
      document.querySelector("main");

    if (main && main instanceof HTMLElement) {
      // Set tabindex to make it focusable, then focus
      // Remove tabindex after focus to avoid it appearing in tab order
      main.setAttribute("tabindex", "-1");
      main.focus();

      // Clean up tabindex after a short delay to avoid it appearing in tab order
      // but keep it long enough for screen readers to announce
      const timeoutId = setTimeout(() => {
        main.removeAttribute("tabindex");
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [pathname]);

  // This component doesn't render anything
  return null;
}
