"use client";

import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";

export default function Loading(): React.ReactNode {
  return <MdaLoadingScreen open status="Loading deck builder…" />;
}
