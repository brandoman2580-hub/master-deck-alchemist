/**
 * Sort utilities for deck cards (main, extra, side).
 * Reuses the same sort logic as card pool but operates on deck card arrays.
 */

import type { Card } from "@/types/card";

/**
 * Master Duel rarity sort order.
 * Higher number = higher rarity. N=0, R=1, SR=2, UR=3.
 * Check most specific strings first to avoid "R" matching "Super Rare" or "Ultra Rare".
 */
function getRaritySortValue(rarity: string | undefined): number {
  if (!rarity?.trim()) return 999;
  const upper = rarity.toUpperCase().trim();

  // Order matters: check UR/SR before R to avoid false matches
  if (upper === "UR" || upper.includes("ULTRA RARE") || upper.includes("ULTRARARE")) {
    return 3;
  }
  if (upper === "SR" || upper.includes("SUPER RARE") || upper.includes("SUPERRARE")) {
    return 2;
  }
  if (
    upper === "R" ||
    (upper.includes("RARE") && !upper.includes("SUPER") && !upper.includes("ULTRA") && !upper.includes("SECRET"))
  ) {
    return 1;
  }
  if (upper === "N" || upper === "C" || upper.includes("NORMAL") || upper.includes("COMMON")) {
    return 0;
  }
  return 999;
}

function getNumericStat(val: number | string | undefined): number {
  if (typeof val === "number") return val;
  if (val === "?") return -1;
  return 0;
}

type CardWithLink = Card & { linkval?: number };

/**
 * Sort deck cards by given criteria.
 * Works with DeckCard[] (cards with deckInstanceId).
 * @param mdRarityMap - Optional map of card id -> Master Duel rarity for accurate rarity sorting
 */
export function sortDeckCards(
  cards: Card[],
  sortKey: string,
  sortDirection: "asc" | "desc" = "asc",
  mdRarityMap?: Map<number, string>,
): Card[] {
  const sorted = [...cards];
  const mult = sortDirection === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    let cmp = 0;

    switch (sortKey) {
      case "name": {
        const aVal = a.name.toLowerCase();
        const bVal = b.name.toLowerCase();
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        break;
      }
      case "id": {
        cmp = a.id - b.id;
        break;
      }
      case "type": {
        const aVal = a.type ?? "";
        const bVal = b.type ?? "";
        cmp = aVal.localeCompare(bVal);
        break;
      }
      case "level": {
        const aVal = a.level ?? 0;
        const bVal = b.level ?? 0;
        cmp = aVal - bVal;
        break;
      }
      case "atk": {
        const aVal = getNumericStat(a.atk);
        const bVal = getNumericStat(b.atk);
        cmp = aVal - bVal;
        break;
      }
      case "def": {
        const aVal = getNumericStat(a.def);
        const bVal = getNumericStat(b.def);
        cmp = aVal - bVal;
        break;
      }
      case "md_rarity": {
        const aRarity = mdRarityMap?.get(a.id) ?? a.misc_info?.[0]?.md_rarity;
        const bRarity = mdRarityMap?.get(b.id) ?? b.misc_info?.[0]?.md_rarity;
        const aVal = getRaritySortValue(aRarity);
        const bVal = getRaritySortValue(bRarity);
        cmp = aVal - bVal;
        if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
        break;
      }
      case "attribute": {
        const aVal = a.attribute ?? "";
        const bVal = b.attribute ?? "";
        cmp = aVal.localeCompare(bVal);
        if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
        break;
      }
      case "race": {
        const aVal = a.race ?? "";
        const bVal = b.race ?? "";
        cmp = aVal.localeCompare(bVal);
        if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
        break;
      }
      case "archetype": {
        const aVal = (a.archetype ?? "").toLowerCase();
        const bVal = (b.archetype ?? "").toLowerCase();
        cmp = aVal.localeCompare(bVal);
        if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
        break;
      }
      case "link_rating": {
        const aVal = (a as CardWithLink).linkval ?? 0;
        const bVal = (b as CardWithLink).linkval ?? 0;
        cmp = aVal - bVal;
        break;
      }
      default:
        return 0;
    }

    return cmp * mult;
  });

  return sorted;
}
