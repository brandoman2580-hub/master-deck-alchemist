import { Suspense, type ReactNode } from "react";
import WorkshopPage from "./workshop-client";

export default function WorkshopRoute(): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[color:var(--mda-bg)] font-mda text-white">
          Loading workshop…
        </div>
      }
    >
      <WorkshopPage />
    </Suspense>
  );
}
