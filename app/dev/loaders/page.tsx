import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DevLoadersGalleryClient } from "./gallery-client";

/**
 * Temporary Phase 2a A/B gallery. Production returns 404.
 */
export default function DevLoadersGalleryPage(): ReactNode {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <DevLoadersGalleryClient />;
}
