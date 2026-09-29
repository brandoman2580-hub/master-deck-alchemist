"use client";

import type { ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Card } from "@/types/card";
import { CardImage } from "@/components/ui/card-image";
import { getArchetypeName } from "@/lib/deck/import";
import { MdaFrameCorners } from "@/components/mda/frame-corners";

export type MdaCardPreviewProps = {
  card: Card;
  children: React.ReactNode;
};

/**
 * Hover card popover for MDA Workshop / Archives.
 *
 * Important: the Tooltip trigger is always a plain DOM node. Passing
 * `asChild` directly onto a Framer Motion node (or other gesture wrapper)
 * swallows Radix pointer handlers and the popover never opens.
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
    <Tooltip.Provider delayDuration={150} disableHoverableContent>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className="inline-block max-w-full">{children}</div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-[300] w-[min(440px,calc(100vw-2rem))] border-0 bg-transparent p-0 shadow-none pointer-events-none"
            side="right"
            sideOffset={12}
            align="center"
            collisionPadding={16}
            avoidCollisions
          >
            {/* Transparent frame so L-brackets read as separate from the glass panel */}
            <div className="relative bg-transparent p-2">
              <MdaFrameCorners
                sizeClassName="h-4 w-4"
                thicknessClassName="border-[3px]"
              />
              <div
                className="relative bg-[rgba(245,247,248,0.72)] p-3 shadow-mda-lift backdrop-blur-md backdrop-saturate-150"
                style={{
                  WebkitBackdropFilter: "blur(12px) saturate(150%)",
                }}
              >
                <div className="flex items-start gap-3 font-medium text-mda-ink">
                  <div className="relative h-[160px] w-[116px] shrink-0 overflow-hidden bg-mda-deep shadow-mda-soft">
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
                    <h3 className="font-mda text-base font-semibold uppercase leading-tight text-mda-ink-strong">
                      {card.name}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="bg-mda-panel/80 px-2 py-0.5 font-mda text-[10px] font-medium uppercase text-mda-ink">
                        {card.type}
                      </span>
                      {card.attribute ? (
                        <span className="bg-mda-panel/80 px-2 py-0.5 font-mda text-[10px] font-medium uppercase text-mda-ink">
                          {card.attribute}
                        </span>
                      ) : null}
                      {card.race ? (
                        <span className="bg-mda-panel/80 px-2 py-0.5 font-mda text-[10px] font-medium uppercase text-mda-ink">
                          {card.race}
                        </span>
                      ) : null}
                    </div>
                    {showStats ? (
                      <p className="mt-2 font-mda text-xs font-medium text-mda-ink">
                        {card.level !== undefined ? (
                          <span className="mr-2">Lv {card.level}</span>
                        ) : null}
                        {card.atk !== undefined ? (
                          <span className="mr-2">ATK {card.atk}</span>
                        ) : null}
                        {card.def !== undefined ? (
                          <span>DEF {card.def}</span>
                        ) : null}
                      </p>
                    ) : null}
                    {archetype ? (
                      <p className="mt-1 font-mda text-xs font-medium uppercase text-mda-sky-strong">
                        {archetype}
                      </p>
                    ) : null}
                    <p className="mt-2 font-open-sans text-sm font-medium leading-relaxed text-mda-ink-strong">
                      {card.desc}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <Tooltip.Arrow className="fill-[rgba(245,247,248,0.72)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
