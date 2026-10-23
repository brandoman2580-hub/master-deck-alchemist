import type { Card } from "@/types/card";

const SHORT_RARITY = new Set(["N", "R", "SR", "UR"]);

/**
 * Master Duel rarity chip. Returns null when the card has no usable rarity.
 * TCG decks should not call this.
 */
export function masterDuelRarityLabel(card: Card): string | null {
  const raw = card.misc_info?.[0]?.md_rarity?.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (SHORT_RARITY.has(upper)) return upper;
  if (upper.includes("ULTRA")) return "UR";
  if (upper.includes("SUPER")) return "SR";
  if (
    upper === "RARE" ||
    (upper.endsWith(" RARE") && !upper.includes("SUPER") && !upper.includes("ULTRA"))
  ) {
    return "R";
  }
  if (upper.includes("COMMON") || upper === "NORMAL") return "N";
  return null;
}

/**
 * Inventory-row type chips. Race first for monsters, then frame words.
 * Spell and Trap rows skip race and use the card frame instead.
 */
export function deckRowTypeChips(card: Pick<Card, "type" | "race">): string[] {
  const type = card.type ?? "";
  const chips: string[] = [];
  const spellOrTrap = /spell|trap/i.test(type);

  if (!spellOrTrap && card.race?.trim()) {
    chips.push(card.race.trim().toUpperCase());
  }
  if (/spell/i.test(type)) chips.push("SPELL");
  if (/trap/i.test(type)) chips.push("TRAP");
  if (/fusion/i.test(type)) chips.push("FUSION");
  if (/synchro/i.test(type)) chips.push("SYNCHRO");
  if (/xyz/i.test(type)) chips.push("XYZ");
  if (/link/i.test(type)) chips.push("LINK");
  if (/ritual/i.test(type)) chips.push("RITUAL");
  if (/pendulum/i.test(type)) chips.push("PENDULUM");
  if (/tuner/i.test(type)) chips.push("TUNER");
  if (/normal/i.test(type)) chips.push("NORMAL");
  if (/effect/i.test(type)) chips.push("EFFECT");

  return chips;
}
