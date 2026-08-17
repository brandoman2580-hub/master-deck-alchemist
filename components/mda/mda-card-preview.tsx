"use client";

import type { ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Card } from "@/types/card";
import { CardImage } from "@/components/ui/card-image";
import { getArchetypeName } from "@/lib/helpers";

export type MdaCardPreviewProps = {
  card: Card;
  children: React.ReactNode;
};

/**
 * Hover card preview styled for the MDA Workshop / Archives UI.
 * Height hugs content (no internal scroll) so the full text is visible on hover.
 */
export function MdaCardPreview({
  card,
  children,
}: MdaCardPreviewProps): ReactNode {
  const archetype = getArchetypeName(card);
  const showStats =
    (card.atk !== undefined ||
      card.def !== undefined ||
      card.level !== undefined) &&
    card.type !== "Spell Card" &&
    card.type !== "Trap Card";

  return (
    <Tooltip.Provider delayDuration={120} disableHoverableContent>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-[60] w-[min(440px,calc(100vw-2rem))] border border-white/15 bg-[color:var(--mda-surface)] p-3 shadow-2xl pointer-events-none"
            side="right"
            sideOffset={12}
            align="center"
            collisionPadding={16}
            avoidCollisions
          >
            <div className="flex items-start gap-3">
              <div className="relative h-[160px] w-[116px] shrink-0 overflow-hidden bg-[color:var(--mda-bg-deep)]">
                <CardImage
                  card={card}
                  preferSmall={false}
                  fill
                  alt={card.name}
                  className="object-cover object-center"
                  sizes="116px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-mda text-base font-bold uppercase leading-tight text-white">
                  {card.name}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded bg-white/15 px-2 py-0.5 font-mda text-[10px] uppercase text-white/90">
                    {card.type}
                  </span>
                  {card.attribute ? (
                    <span className="rounded bg-white/15 px-2 py-0.5 font-mda text-[10px] uppercase text-white/90">
                      {card.attribute}
                    </span>
                  ) : null}
                  {card.race ? (
                    <span className="rounded bg-white/15 px-2 py-0.5 font-mda text-[10px] uppercase text-white/90">
                      {card.race}
                    </span>
                  ) : null}
                </div>
                {showStats ? (
                  <p className="mt-2 font-mda text-xs text-white/75">
                    {card.level !== undefined ? (
                      <span className="mr-2">Lv {card.level}</span>
                    ) : null}
                    {card.atk !== undefined ? (
                      <span className="mr-2">ATK {card.atk}</span>
                    ) : null}
                    {card.def !== undefined ? <span>DEF {card.def}</span> : null}
                  </p>
                ) : null}
                {archetype ? (
                  <p className="mt-1 font-mda text-xs uppercase text-[color:var(--mda-cyan-soft)]">
                    {archetype}
                  </p>
                ) : null}
                <p className="mt-2 font-mda text-xs leading-relaxed text-white/80">
                  {card.desc}
                </p>
              </div>
            </div>
            <Tooltip.Arrow className="fill-[color:var(--mda-surface)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
