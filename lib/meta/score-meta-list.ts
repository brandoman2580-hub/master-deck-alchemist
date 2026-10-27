import { buildDiagnostics } from "@/lib/engine/diagnostics";
import { simulateConsistency } from "@/lib/engine/consistency";
import { tagMainDeckForConsistency } from "@/lib/engine/tag-main-deck";
import type { EngineFormat } from "@/lib/engine/types";
import type { Card } from "@/types/card";
import type { DeckType } from "@/types/deck";
import { scoreDeck } from "./deck-score";
import type { ScoredMetaList } from "./gate-bands";
import type { MetaTier } from "./representation-tier";

export interface MetaListCardRef {
  card: Card;
  copies: number;
  zone: "main" | "extra" | "side";
}

function expand(cards: MetaListCardRef[], zone: MetaListCardRef["zone"]): Card[] {
  const expanded: Card[] = [];
  for (const entry of cards) {
    if (entry.zone !== zone) continue;
    for (let copy = 0; copy < entry.copies; copy += 1) {
      expanded.push(entry.card);
    }
  }
  return expanded;
}

/**
 * Score one legal meta list with the same diagnostics and Monte Carlo
 * the Workshop uses. The caller chooses the iteration count and stores it
 * on the snapshot so the sheet can name the sample.
 */
export function scoreMetaList(input: {
  tier: MetaTier;
  name?: string;
  cards: MetaListCardRef[];
  format: EngineFormat;
  iterations: number;
}): ScoredMetaList {
  const mainDeck = expand(input.cards, "main");
  const extraDeck = expand(input.cards, "extra");
  const sideDeck = expand(input.cards, "side");
  const deck = {
    mainDeck,
    extraDeck,
    sideDeck,
    deckFormat: input.format === "TCG" ? "TCG" : "Master Duel",
  } as DeckType;

  const diagnostics = buildDiagnostics(deck, input.format);
  const tagged = tagMainDeckForConsistency(mainDeck, input.format);
  const consistency = simulateConsistency(tagged, {
    iterations: input.iterations,
  });
  const roles = diagnostics.roleCoverage;
  const formatLabel = input.format === "TCG" ? "TCG" : "Master Duel";
  const score = scoreDeck({
    format: formatLabel,
    mainSize: mainDeck.length,
    starterAccess: consistency.starterAccess,
    oneInterruptionSurvival: consistency.oneInterruptionSurvival,
    endboardPieces: roles.endboardPieces,
    cards: input.cards.map((entry) => ({
      name: entry.card.name,
      zone: entry.zone,
      copies: entry.copies,
    })),
  });

  return {
    tier: input.tier,
    name: input.name,
    endboardPieces: roles.endboardPieces,
    oneInterruptionSurvival: consistency.oneInterruptionSurvival,
    starterAccess: consistency.starterAccess,
    nonEngineCopies: roles.handTraps + roles.boardBreakers,
    score,
  };
}
