import type { BanStatus, DeckType } from "@/types/deck";
import {
  validateBanlistCompliance,
  validateDeckStructure,
} from "@/lib/validation/deck-validator";
import type { LegalityBlock } from "./types";

type NamedCard = { cardId: number; name: string };

function toNamedCards(
  cards: Array<{ id?: number; cardId?: number; name: string }>,
): NamedCard[] {
  return cards.map((card) => {
    const cardId = card.cardId ?? card.id;
    if (typeof cardId !== "number" || !Number.isFinite(cardId)) {
      return { cardId: -1, name: card.name };
    }
    return { cardId, name: card.name };
  });
}

/**
 * Whether the deck has been persisted to Supabase (not a fresh local workspace).
 */
export function isDeckPersisted(
  deck: Pick<DeckType, "id" | "updated_at" | "name">,
  savedDeckIds?: ReadonlySet<string>,
): boolean {
  if (deck.updated_at) return true;
  if (savedDeckIds?.has(deck.id)) return true;
  return false;
}

/**
 * Structural + banlist legality for Facts Brain / Assistant gates.
 * Does not require Zod-perfect shapes beyond size/copy/banlist rules.
 */
export function evaluateDeckLegality(
  deck: DeckType,
  options: {
    banlist?: Record<string, BanStatus | string>;
    isPersisted?: boolean;
    requirePersisted?: boolean;
  } = {},
): LegalityBlock {
  const errors: string[] = [];

  if (options.requirePersisted && !options.isPersisted) {
    errors.push("Deck must be saved before the AI Assistant can run.");
  }

  if (deck.name === "New Deck") {
    errors.push("Rename the deck before using the AI Assistant.");
  }

  const main = deck.mainDeck?.length ?? 0;
  const extra = deck.extraDeck?.length ?? 0;
  const side = deck.sideDeck?.length ?? 0;

  if (main < 40) errors.push("Main deck must have at least 40 cards");
  if (main > 60) errors.push("Main deck cannot exceed 60 cards");
  if (extra > 15) errors.push("Extra deck cannot exceed 15 cards");
  if (side > 15) errors.push("Side deck cannot exceed 15 cards");

  const structurePayload = {
    name: deck.name || "Deck",
    mode: deck.mode === "TCG" ? "TCG" : "Master Duel",
    mainDeck: toNamedCards(deck.mainDeck || []),
    extraDeck: toNamedCards(deck.extraDeck || []),
    sideDeck: toNamedCards(deck.sideDeck || []),
  };

  if (structurePayload.mainDeck.some((c) => c.cardId <= 0)) {
    errors.push("Deck contains cards with invalid IDs");
  }

  const structure = validateDeckStructure(structurePayload);
  if (!structure.valid) {
    for (const err of structure.errors) {
      if (!errors.includes(err)) errors.push(err);
    }
  }

  const counts = new Map<number, number>();
  for (const card of [
    ...structurePayload.mainDeck,
    ...structurePayload.extraDeck,
    ...structurePayload.sideDeck,
  ]) {
    if (card.cardId <= 0) continue;
    counts.set(card.cardId, (counts.get(card.cardId) ?? 0) + 1);
  }
  for (const [cardId, count] of counts) {
    if (count > 3) {
      errors.push(`Card ${cardId} exceeds maximum copies (3)`);
    }
  }

  if (options.banlist && Object.keys(options.banlist).length > 0) {
    const banlistRecord: Record<string, string> = {};
    for (const [name, status] of Object.entries(options.banlist)) {
      if (typeof status === "string") banlistRecord[name] = status;
    }
    const ban = validateBanlistCompliance(structurePayload, banlistRecord);
    if (!ban.valid) errors.push(...ban.errors);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Assistant-specific gate: persisted + structurally legal for the active format.
 */
export function evaluateAssistantEligibility(
  deck: DeckType,
  options: {
    banlist?: Record<string, BanStatus | string>;
    savedDeckIds?: ReadonlySet<string>;
  } = {},
): LegalityBlock {
  return evaluateDeckLegality(deck, {
    banlist: options.banlist,
    isPersisted: isDeckPersisted(deck, options.savedDeckIds),
    requirePersisted: true,
  });
}
