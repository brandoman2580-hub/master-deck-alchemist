"use client";

import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";
import type { FactsEnvelope } from "@/lib/engine";
import { currentStoredDecks, scoreDeck, type DeckScore } from "@/lib/meta/deck-score";
import type { MetaGateBands, StoredDeckScore } from "@/lib/meta/gate-bands";
import type { UserCardRef } from "@/lib/meta/matchup-plan";

type Tier = 1 | 2 | 3;

type ScoreKey = "composite" | "consistency" | "resilience" | "interaction" | "ceiling" | "outing";

const ROWS: Array<{ key: ScoreKey; label: string; hint: string }> = [
  { key: "composite", label: "Score", hint: "Weighted grade" },
  { key: "consistency", label: "Consistency", hint: "Starter in the opening five" },
  { key: "resilience", label: "Resilience", hint: "Still playing after one stop" },
  { key: "interaction", label: "Interaction", hint: "A stop in the opening five" },
  { key: "ceiling", label: "Ceiling", hint: "End board, or a floodgate" },
  { key: "outing", label: "Outing", hint: "A clear in the opening five" },
];

const TIERS: Tier[] = [1, 2, 3];
const COLUMN_SCROLL_PX = 144;
const KEYBOARD_RING = "focus-visible:shadow-[0_0_0_2px_#eef3f6,0_0_0_4px_#0c0e12]";

export type WorkshopMatchupsPaneProps = {
  facts: FactsEnvelope | null;
  loading: boolean;
  error?: string | null;
  referenceBands?: MetaGateBands | null;
  bandsLoading?: boolean;
  bandsError?: string | null;
  userCards?: UserCardRef[];
  deckFormat?: "Master Duel" | "TCG";
};

function GapMark({ theirs, yours }: { theirs: number; yours: number }): ReactNode {
  const gap = theirs - yours;
  if (gap === 0) {
    return (
      <span className="mt-1 inline-flex items-center text-xs font-semibold text-[#0c0e12]">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Same as this list</span>
      </span>
    );
  }
  const higher = gap > 0;
  const amount = Math.abs(gap);
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-[#0c0e12]">
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth="1.5"
      >
        {higher ? (
          <>
            <path d="M6 10V2" />
            <path d="M3 5 6 2l3 3" />
          </>
        ) : (
          <>
            <path d="M6 2v8" />
            <path d="M3 7 6 10l3-3" />
          </>
        )}
      </svg>
      <span aria-hidden="true">{amount}</span>
      <span className="sr-only">{`${amount} ${higher ? "higher" : "lower"} than this list`}</span>
    </span>
  );
}

function scoreForFacts(
  facts: FactsEnvelope,
  userCards: UserCardRef[],
  format: "Master Duel" | "TCG",
): DeckScore | null {
  if (facts.consistency.n <= 0) return null;
  const mainSize = userCards.filter((card) => card.zone === "main").length;
  return scoreDeck({
    format,
    mainSize,
    starterAccess: facts.consistency.starterAccess,
    oneInterruptionSurvival: facts.consistency.oneInterruptionSurvival,
    endboardPieces: facts.diagnostics.roleCoverage.endboardPieces,
    cards: userCards,
  });
}

function valueOf(score: DeckScore | StoredDeckScore, key: ScoreKey): number {
  return score[key];
}

function ComparisonTable({
  tier,
  yours,
  decks,
}: {
  tier: Tier;
  yours: DeckScore;
  decks: StoredDeckScore[];
}): ReactNode {
  return (
    <div
      className={`overflow-x-auto ${KEYBOARD_RING}`}
      tabIndex={0}
      aria-label={
        decks.length > 0
          ? `Tier ${tier} scores. Scroll sideways for more decks.`
          : "Scores for this list"
      }
      onKeyDown={(event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        event.currentTarget.scrollBy({
          left: event.key === "ArrowRight" ? COLUMN_SCROLL_PX : -COLUMN_SCROLL_PX,
        });
      }}
    >
      <table className="w-max table-fixed border-separate border-spacing-0 text-left">
        <caption className="sr-only">
          {decks.length > 0
            ? `Tier ${tier} scores compared with this list`
            : "Scores for this list"}
        </caption>
        <colgroup>
          <col className="w-48" />
          <col className="w-36" />
          {decks.map((deck) => (
            <col key={deck.name} className="w-36" />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-20 w-48 min-w-48 max-w-48 bg-[#eef3f6] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4754]"
            >
              Metric
            </th>
            <th
              scope="col"
              className="sticky left-48 z-20 w-36 min-w-36 border-b-2 border-[#0c0e12] bg-[#dce6ee] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
            >
              Your deck
            </th>
            {decks.map((deck) => (
              <th
                key={deck.name}
                scope="col"
                className="min-w-36 border-b border-[#28303b] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                {deck.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key}>
              <th
                scope="row"
                className="sticky left-0 z-10 w-48 min-w-48 max-w-48 border-t border-[#28303b] bg-[#eef3f6] px-3 py-3 align-top"
              >
                <span className="block text-sm font-semibold">{row.label}</span>
                <span className="mt-1 block text-xs font-normal text-[#3d4754]">{row.hint}</span>
              </th>
              <td className="sticky left-48 z-10 w-36 min-w-36 border-t border-[#28303b] bg-[#dce6ee] px-3 py-3 align-top">
                <span className="block text-lg font-semibold tabular-nums">
                  {valueOf(yours, row.key)}
                </span>
                <span className="mt-1 inline-flex items-center text-xs font-semibold text-[#0c0e12]">
                  <span aria-hidden="true">—</span>
                </span>
              </td>
              {decks.map((deck) => {
                const theirs = valueOf(deck, row.key);
                return (
                  <td
                    key={`${deck.name}-${row.key}`}
                    className="border-t border-[#28303b] px-3 py-3 align-top"
                  >
                    <span className="block text-lg font-semibold tabular-nums">{theirs}</span>
                    <GapMark theirs={theirs} yours={valueOf(yours, row.key)} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WorkshopMatchupsPane({
  facts,
  loading,
  error = null,
  referenceBands = null,
  bandsLoading = false,
  bandsError = null,
  userCards = [],
  deckFormat = "Master Duel",
}: WorkshopMatchupsPaneProps): ReactNode {
  const tablistId = useId();
  const [tier, setTier] = useState<Tier>(1);
  const yours = useMemo(
    () => (facts ? scoreForFacts(facts, userCards, deckFormat) : null),
    [deckFormat, facts, userCards],
  );
  const decks = useMemo(() => currentStoredDecks(referenceBands ?? null), [referenceBands]);
  const visible = useMemo(
    () => decks.filter((deck) => deck.tier === tier).sort((a, b) => a.name.localeCompare(b.name)),
    [decks, tier],
  );
  const needsDeck = !loading && !facts;

  const onTierKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: Tier) => {
    const index = TIERS.indexOf(current);
    const next =
      event.key === "ArrowRight"
        ? TIERS[(index + 1) % TIERS.length]
        : event.key === "ArrowLeft"
          ? TIERS[(index - 1 + TIERS.length) % TIERS.length]
          : event.key === "Home"
            ? TIERS[0]
            : event.key === "End"
              ? TIERS[TIERS.length - 1]
              : null;
    if (next == null) return;
    event.preventDefault();
    setTier(next);
    document.getElementById(`${tablistId}-tier-${next}`)?.focus();
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden font-spaceGrotesk text-[#0c0e12]">
      <MdaLoadingScreen
        open={loading}
        scoped
        status="Computing matchup readiness…"
      />

      {needsDeck ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="text-xl font-semibold uppercase tracking-wide">
            Build a 40+ card main deck
          </p>
          <p className="max-w-md text-sm text-[#3d4754]">
            Matchups compare this list with the stored scores of legal tier decks.
          </p>
          {error ? (
            <p className="text-sm text-[#8f2d2d]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {error ? (
            <p className="text-sm text-[#8f2d2d]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide">Matchups</h2>
              <p className="mt-1 text-sm text-[#3d4754]">
                {deckFormat}. The same five measures on this list and each legal tier list.
              </p>
            </div>
          </div>

          {decks.length === 0 ? (
            bandsLoading ? (
              <p className="text-sm text-[#3d4754]">Loading stored meta scores.</p>
            ) : bandsError ? (
              <p className="text-sm text-[#8f2d2d]" role="alert">
                {bandsError}
              </p>
            ) : (
              <p className="text-sm text-[#3d4754]">
                Stored meta scores are not current for this banlist.
              </p>
            )
          ) : (
            <div role="tablist" aria-label="Tier" className="flex flex-wrap gap-2">
              {TIERS.map((item) => {
                const selected = item === tier;
                const count = decks.filter((deck) => deck.tier === item).length;
                return (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    id={`${tablistId}-tier-${item}`}
                    aria-selected={selected}
                    aria-controls={`${tablistId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setTier(item)}
                    onKeyDown={(event) => onTierKeyDown(event, item)}
                    className={
                      selected
                        ? `border border-[#0c0e12] bg-[#0c0e12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#f7fcff] ${KEYBOARD_RING}`
                        : `border border-[#28303b] bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e12] ${KEYBOARD_RING}`
                    }
                  >
                    Tier {item}
                    <span className="sr-only">
                      {`, ${count} ${count === 1 ? "deck" : "decks"}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {yours || decks.length > 0 ? (
            <div
              role={decks.length > 0 ? "tabpanel" : undefined}
              id={decks.length > 0 ? `${tablistId}-panel` : undefined}
              aria-labelledby={decks.length > 0 ? `${tablistId}-tier-${tier}` : undefined}
            >
              {yours ? (
                decks.length > 0 && visible.length === 0 ? (
                  <p className="text-sm text-[#3d4754]">No stored decks in tier {tier}.</p>
                ) : (
                  <ComparisonTable tier={tier} yours={yours} decks={visible} />
                )
              ) : (
                <p className="text-sm text-[#3d4754]">This list has not been sampled yet.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#3d4754]">This list has not been sampled yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
