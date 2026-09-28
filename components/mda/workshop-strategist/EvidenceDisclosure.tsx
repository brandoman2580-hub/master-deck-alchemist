"use client";

import type { EvidenceClaim } from "@/lib/engine/assistant-contract";

interface EvidenceDisclosureProps {
  limitations?: string[];
  evidence?: EvidenceClaim[];
}

/**
 * Why-I'm-saying-this disclosure — player claims only (no internal IDs).
 */
export function EvidenceDisclosure({
  limitations = [],
  evidence = [],
}: EvidenceDisclosureProps) {
  if (limitations.length === 0 && evidence.length === 0) {
    return null;
  }

  return (
    <details className="border border-mda-chrome/40 bg-mda-surface/40 px-2 py-1.5">
      <summary className="cursor-pointer font-mda text-[11px] font-semibold uppercase tracking-wide text-mda-ink-muted">
        Why I&apos;m saying this
      </summary>
      <div className="mt-2 space-y-2 font-open-sans text-xs text-mda-ink">
        {limitations.length > 0 ? (
          <div>
            <p className="font-mda text-[10px] uppercase tracking-wide text-mda-ink-muted">
              Caveats
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {evidence.length > 0 ? (
          <div>
            <p className="font-mda text-[10px] uppercase tracking-wide text-mda-ink-muted">
              Grounding
            </p>
            <ul className="mt-1 space-y-1">
              {evidence.map((item) => (
                <li key={`${item.claim}-${item.evidenceIds.join(",")}`}>
                  <span>{item.claim}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
