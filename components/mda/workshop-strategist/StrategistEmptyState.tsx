"use client";

import Image from "next/image";

/**
 * Empty state — logo + prompt to ask about the current deck.
 */
export function StrategistEmptyState() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center"
      data-testid="strategist-empty-state"
    >
      <Image
        src="/images/ai_strategist_logo.png"
        alt="Strategist logo"
        width={120}
        height={120}
        className="h-[120px] w-[120px] object-contain"
        priority
      />
      <p className="max-w-[240px] font-open-sans text-sm leading-relaxed text-mda-ink">
        Ask about your current deck — consistency, ratios, or card suggestions
        from the library.
      </p>
    </div>
  );
}
