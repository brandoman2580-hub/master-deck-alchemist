"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  buildMatchupPlans,
  type MetaListRef,
  type UserCardRef,
} from "@/lib/meta/matchup-plan";

type Tier = 1 | 2 | 3;

export type NamedMatchupPlansProps = {
  lists: MetaListRef[];
  userCards?: UserCardRef[];
  deckFormat?: "Master Duel" | "TCG";
};

export function NamedMatchupPlans({
  lists,
  userCards = [],
  deckFormat = "Master Duel",
}: NamedMatchupPlansProps): ReactNode {
  const [tiers, setTiers] = useState<Record<Tier, boolean>>({
    1: true,
    2: true,
    3: true,
  });

  const plans = useMemo(
    () =>
      buildMatchupPlans(lists, userCards, deckFormat).filter(
        (plan) => tiers[plan.tier],
      ),
    [deckFormat, lists, tiers, userCards],
  );

  if (lists.length === 0) return null;

  return (
    <section className="col-span-full border-t border-mda-ink/15 pt-4 font-mda text-mda-ink">
      <h3 className="mb-3 text-2xl font-semibold uppercase tracking-wide">
        Against these decks
      </h3>
      <fieldset className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-mda-ink-muted">
          Show
        </legend>
        {([1, 2, 3] as Tier[]).map((tier) => (
          <label
            key={tier}
            className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]"
          >
            <input
              type="checkbox"
              checked={tiers[tier]}
              onChange={() =>
                setTiers((prev) => ({ ...prev, [tier]: !prev[tier] }))
              }
              className="size-4 shrink-0 accent-mda-ink"
              aria-label={`Show Tier ${tier}`}
            />
            Tier {tier}
          </label>
        ))}
      </fieldset>
      {plans.length === 0 ? (
        <p className="text-base text-mda-ink-muted">No decks in the selected tiers.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {plans.map((plan) => (
            <article key={`${plan.tier}-${plan.name}`} className="border-t border-mda-ink/15 pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-lg font-semibold uppercase tracking-wide">{plan.name}</h4>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mda-ink-muted">
                  Tier {plan.tier}
                </p>
              </div>
              <p className="mt-2 text-base leading-snug">{plan.aim}</p>
              <p className="mt-2 text-base leading-snug">
                <span className="font-semibold">Going second. </span>
                {plan.goingSecond}
              </p>
              <p className="mt-2 text-base leading-snug">
                <span className="font-semibold">Going first. </span>
                {plan.goingFirst}
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-mda-ink-muted">
                  Their list and your cards
                </summary>
                <div className="mt-2 grid gap-3 text-base sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mda-ink-muted">
                      Their main deck
                    </p>
                    <ul className="mt-1 space-y-1">
                      {plan.theirMain.map((card, index) => (
                        <li key={`${card}-${index}`}>{card}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mda-ink-muted">
                      Their extra deck
                    </p>
                    <ul className="mt-1 space-y-1">
                      {plan.theirExtra.map((card, index) => (
                        <li key={`${card}-${index}`}>{card}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {plan.yourCards.length > 0 ? (
                  <p className="mt-3 text-base">Your cards: {plan.yourCards.join(", ")}.</p>
                ) : (
                  <p className="mt-3 text-base">
                    None of your cards match a checked stop for this deck.
                  </p>
                )}
                {plan.sideNote ? <p className="mt-2 text-base">{plan.sideNote}</p> : null}
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
