"use client";

import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";

/**
 * Route-level loading UI — MDA loader (replaces legacy cyberpunk LoaderFullScreen).
 */
export default function Loading(): React.ReactNode {
  return <MdaLoadingScreen open status="Loading…" />;
}
