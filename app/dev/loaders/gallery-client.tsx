"use client";

import { useState, type ReactNode } from "react";
import { MdaCropFrame } from "@/components/mda/crop-frame";
import { MdaHazardStripe } from "@/components/mda/hazard-stripe";
import { MdaSegmentedBar } from "@/components/mda/segmented-bar";
import { MdaStatusChip } from "@/components/mda/status-chip";
import { MdaCallout } from "@/components/mda/callout";
import { MdaFrameCorners } from "@/components/mda/frame-corners";
import { ClipButton } from "@/components/mda/clip-button";
import {
  MdaLoaderMark,
  MdaLoadingScreen,
  type MdaLoaderVariant,
} from "@/components/mda/mda-loading-screen";

const LOADER_VARIANTS: MdaLoaderVariant[] = ["legacy", "quad", "waveform"];

export function DevLoadersGalleryClient(): ReactNode {
  const [overlayVariant, setOverlayVariant] = useState<MdaLoaderVariant | null>(
    null,
  );

  return (
    <main className="min-h-screen bg-mda-bg text-mda-ink">
      <MdaCropFrame grid className="mx-auto max-w-5xl py-8">
        <header className="mb-8 space-y-3">
          <MdaStatusChip tone="cyan">Phase 2a · Dev only</MdaStatusChip>
          <h1 className="font-mda text-2xl font-black uppercase tracking-wide text-mda-ink-strong">
            Loader & atom gallery
          </h1>
          <p className="max-w-2xl font-mda text-sm text-mda-ink-muted">
            Compare legacy / quad / waveform. Production default is{" "}
            <span className="font-bold text-mda-ink">quad</span>; legacy and
            waveform remain available for A/B in Storybook.
          </p>
        </header>

        <section className="mb-10 space-y-4" aria-labelledby="loaders-heading">
          <h2
            id="loaders-heading"
            className="font-mda text-sm font-bold uppercase tracking-[0.12em] text-mda-ink-strong"
          >
            Loaders
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {LOADER_VARIANTS.map((variant) => (
              <div
                key={variant}
                className="relative border border-mda-bezel/30 bg-mda-surface p-4"
              >
                <MdaFrameCorners variant="quiet" />
                <p className="mb-3 font-mda text-xs font-bold uppercase tracking-wider">
                  {variant}
                </p>
                <MdaLoaderMark variant={variant} />
                <ClipButton
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => setOverlayVariant(variant)}
                >
                  Preview overlay
                </ClipButton>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10 space-y-4" aria-labelledby="atoms-heading">
          <h2
            id="atoms-heading"
            className="font-mda text-sm font-bold uppercase tracking-[0.12em] text-mda-ink-strong"
          >
            Foundation atoms
          </h2>
          <MdaHazardStripe label="Banlist advisory · limited cards present" />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 border border-mda-bezel/30 bg-mda-surface p-4">
              <p className="font-mda text-xs uppercase tracking-wider text-mda-ink-muted">
                Segmented bar
              </p>
              <MdaSegmentedBar label="Consistency axis" value={7} segments={10} />
              <MdaSegmentedBar
                label="Quota remaining"
                value={3}
                segments={8}
                tone="hazard"
              />
            </div>
            <div className="space-y-3 border border-mda-bezel/30 bg-mda-surface p-4">
              <div className="flex flex-wrap gap-2">
                <MdaStatusChip>Soft cap</MdaStatusChip>
                <MdaStatusChip tone="hazard">Near hard cap</MdaStatusChip>
                <MdaStatusChip tone="success">Legal</MdaStatusChip>
              </div>
              <ClipButton techCut>Tech-cut CTA</ClipButton>
              <ClipButton variant="hazard" techCut size="sm">
                Hazard CTA
              </ClipButton>
            </div>
          </div>
          <div className="relative min-h-[120px] border border-mda-bezel/30 bg-mda-surface p-6">
            <MdaFrameCorners variant="command" />
            <MdaCallout
              label="Landing / Share only"
              description="Callout leaders stay off the Workshop binder grid."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(["quiet", "selected", "command"] as const).map((variant) => (
              <div
                key={variant}
                className="relative h-24 border border-mda-panel bg-mda-raised p-4"
              >
                <MdaFrameCorners variant={variant} />
                <p className="font-mda text-xs uppercase tracking-wider">
                  Bezel · {variant}
                </p>
              </div>
            ))}
          </div>
        </section>
      </MdaCropFrame>

      <MdaLoadingScreen
        open={overlayVariant !== null}
        variant={overlayVariant ?? "quad"}
        status={`Previewing ${overlayVariant ?? "quad"} loader…`}
      />
      {overlayVariant ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <ClipButton size="sm" onClick={() => setOverlayVariant(null)}>
            Dismiss overlay
          </ClipButton>
        </div>
      ) : null}
    </main>
  );
}
