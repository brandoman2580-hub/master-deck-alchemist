"use client";

import type { ReactNode } from "react";
import type { AssistantMode } from "@/lib/engine/assistant-contract";
import "./strategist-welcome.css";

export type StrategistStarter = {
  label: string;
  prompt: string;
  mode: AssistantMode;
};

type StrategistEmptyStateProps = {
  deckName: string;
  shortPillar?: string | null;
  onStarter: (prompt: string, mode: AssistantMode) => void;
};

function startersFor(shortPillar: string | null | undefined): StrategistStarter[] {
  const gradePrompt = shortPillar
    ? `Why is ${shortPillar} the lowest score?`
    : "Ask about this deck list";
  return [
    { label: gradePrompt, prompt: gradePrompt, mode: "qa" },
    {
      label: "Trim the main deck for consistency",
      prompt: "Trim the main deck for consistency",
      mode: "tune_copies",
    },
    {
      label: "Find a card this deck list is missing",
      prompt: "Find a card this deck list is missing",
      mode: "discover_synergy",
    },
  ];
}

function CrucibleMark(): ReactNode {
  const vessel = "M12.24 7.24H51.66L38.35 56.7H25.55Z";
  return (
    <svg
      aria-hidden="true"
      data-testid="strategist-crucible"
      viewBox="0 0 64 64"
      className="h-40 w-40"
    >
      <defs>
        <clipPath id="strategist-crucible-clip">
          <path d={vessel} />
        </clipPath>
      </defs>
      <path
        d={vessel}
        fill="none"
        stroke="#14181f"
        strokeWidth="2"
        strokeLinejoin="miter"
      />
      <g clipPath="url(#strategist-crucible-clip)">
        <path
          d="M12.24 7.24L31.95 21.98L51.66 7.24"
          fill="none"
          stroke="#14181f"
          strokeWidth="2"
          strokeLinejoin="miter"
        />
        <path d="M31.95 21.98V56.7" fill="none" stroke="#14181f" strokeWidth="2" />
      </g>
    </svg>
  );
}

/**
 * Empty Strategist thread: crucible mark, deck-specific scope, and three starters.
 */
export function StrategistEmptyState({
  deckName,
  shortPillar = null,
  onStarter,
}: StrategistEmptyStateProps): ReactNode {
  const name = deckName.trim() || "This deck";
  const starters = startersFor(shortPillar);

  return (
    <div
      className="strategist-welcome-in flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-8 text-center"
      data-testid="strategist-empty-state"
    >
      <CrucibleMark />
      <div className="flex max-w-sm flex-col items-center gap-1.5">
        <h2 className="text-2xl font-semibold uppercase leading-none tracking-[0.16em] text-[#14181f]">
          Strategist
          <span className="px-2" aria-hidden="true">
            ·
          </span>
          Online
        </h2>
        <p className="text-[15px] leading-6 text-[#0c0e12]">
          <span className="text-[#5b6369]">Deck list: </span>
          <span className="font-semibold">{name}</span>
        </p>
        <p className="text-[15px] leading-6 text-[#0c0e12]">
          Ask about this deck list, tune copies, or find a card that fits.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        {starters.map((starter) => (
          <button
            key={starter.mode}
            type="button"
            onClick={() => onStarter(starter.prompt, starter.mode)}
            className="border border-[#28303b] bg-white px-3 py-2 text-left text-[13px] text-[#0c0e12] transition-colors hover:border-[#14181f] hover:bg-[#14181f] hover:text-[#e2e8f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3]"
          >
            {starter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
