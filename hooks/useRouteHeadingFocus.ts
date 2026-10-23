"use client";

import { useLayoutEffect } from "react";
import { signalPageReady, takeRouteFocus } from "@/lib/motion/view-transition";

/**
 * Signals from the commit phase. `useEffect` runs after paint, and a view
 * transition will not paint until its update callback finishes, so waiting
 * there deadlocks and the browser aborts with a DOM-update timeout.
 */
export function useRouteHeadingFocus(): void {
  useLayoutEffect(() => {
    signalPageReady();
    if (!takeRouteFocus()) return;
    document
      .querySelector<HTMLElement>("[data-page-heading]")
      ?.focus({ preventScroll: true });
  }, []);
}
