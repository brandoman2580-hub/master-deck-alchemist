/**
 * Phase 1: Derived selectors for card pool operations
 * These selectors provide memoized, composable filtering and querying of the card pool.
 */

import { Card } from "@/types/card";
import { SearchParams } from "@/types/types";
import { getArchetypeName } from "@/lib/helpers";

/**
 * Memoized filter function for cards
 * Uses a simple cache key based on filter params
 */
const filterCache = new Map<string, Card[]>();
const CACHE_SIZE_LIMIT = 100; // Limit cache size to prevent memory issues

function getCacheKey(
  searchQuery: string,
  searchParams: SearchParams,
  cardPoolSize: number,
): string {
  return JSON.stringify({ searchQuery, searchParams, cardPoolSize });
}

function clearOldCacheEntries() {
  if (filterCache.size > CACHE_SIZE_LIMIT) {
    // Remove oldest entries (simple FIFO)
    const keysToRemove = Array.from(filterCache.keys()).slice(
      0,
      filterCache.size - CACHE_SIZE_LIMIT,
    );
    keysToRemove.forEach((key) => filterCache.delete(key));
  }
}

/**
 * Filter cards by search query (name, description, archetype)
 */
function filterBySearchQuery(cards: Card[], query: string): Card[] {
  if (!query.trim()) return cards;

  const queryLower = query.toLowerCase();
  return cards.filter((card) => {
    const nameMatch = card.name.toLowerCase().includes(queryLower);
    const descMatch = card.desc?.toLowerCase().includes(queryLower);
    const archetypeName = getArchetypeName(card);
    const archetypeMatch = archetypeName?.toLowerCase().includes(queryLower);

    return nameMatch || descMatch || archetypeMatch;
  });
}

/**
 * Filter cards by search parameters.
 * Toggle filters store multi-select as comma-separated values.
 */
function filterBySearchParams(cards: Card[], params: SearchParams): Card[] {
  let filtered = cards;

  const selected = (raw: string | undefined): string[] =>
    (raw ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

  const typeSelected = selected(params.type);
  if (typeSelected.length > 0) {
    filtered = filtered.filter((card) => typeSelected.includes(card.type));
  }

  const raceSelected = selected(params.race);
  if (raceSelected.length > 0) {
    filtered = filtered.filter(
      (card) => card.race != null && raceSelected.includes(card.race),
    );
  }

  const attributeSelected = selected(params.attribute);
  if (attributeSelected.length > 0) {
    filtered = filtered.filter(
      (card) =>
        card.attribute != null && attributeSelected.includes(card.attribute),
    );
  }

  const levelSelected = selected(params.level);
  if (levelSelected.length > 0) {
    filtered = filtered.filter(
      (card) =>
        card.level != null && levelSelected.includes(String(card.level)),
    );
  }

  if (params.atk && params.atk.trim()) {
    filtered = filtered.filter((card) => {
      if (typeof card.atk === "number") {
        return card.atk === Number(params.atk);
      }
      return false;
    });
  }

  if (params.def && params.def.trim()) {
    filtered = filtered.filter((card) => {
      if (typeof card.def === "number") {
        return card.def === Number(params.def);
      }
      return false;
    });
  }

  if (params.archetype && params.archetype.trim()) {
    const archetypeSelected = selected(params.archetype);
    filtered = filtered.filter((card) => {
      const archetypeName = getArchetypeName(card);
      if (!archetypeName) return false;
      const lower = archetypeName.toLowerCase();
      return archetypeSelected.some((value) =>
        lower.includes(value.toLowerCase()),
      );
    });
  }

  if (params.effect && params.effect.trim()) {
    const effectLower = params.effect.toLowerCase();
    filtered = filtered.filter((card) =>
      card.desc?.toLowerCase().includes(effectLower),
    );
  }

  if (params.atkRange && params.atkRange.trim()) {
    const [min, max] = params.atkRange.split("-").map(Number);
    filtered = filtered.filter((card) => {
      if (typeof card.atk === "number") {
        return card.atk >= min && card.atk <= max;
      }
      return false;
    });
  }

  if (params.defRange && params.defRange.trim()) {
    const [min, max] = params.defRange.split("-").map(Number);
    filtered = filtered.filter((card) => {
      if (typeof card.def === "number") {
        return card.def >= min && card.def <= max;
      }
      return false;
    });
  }

  if (params.rarity && params.rarity.trim()) {
    const raritySelected = selected(params.rarity);
    filtered = filtered.filter((card) => {
      const rarity = card.misc_info?.[0]?.md_rarity;
      if (!rarity) return false;
      const lower = rarity.toLowerCase();
      return raritySelected.some((value) => lower.includes(value.toLowerCase()));
    });
  }

  return filtered;
}

/**
 * Master Duel rarity sort order.
 * Higher number = higher rarity. N=0, R=1, SR=2, UR=3.
 * Check most specific strings first to avoid "R" matching "Super Rare" or "Ultra Rare".
 */
function getRaritySortValue(rarity: string | undefined): number {
  if (!rarity?.trim()) return 999;
  const upper = rarity.toUpperCase().trim();

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

/** Extract numeric value for atk/def (handles "?" and missing) */
function getNumericStat(
  val: number | string | undefined,
): number {
  if (typeof val === "number") return val;
  if (val === "?") return -1;
  return 0;
}

/** Card with optional linkval from YGOPRODeck API */
type CardWithLink = Card & { linkval?: number };

/**
 * Sort cards by given criteria
 */
function sortCards(
  cards: Card[],
  sortKey: string,
  sortDirection: "asc" | "desc" = "asc",
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
        const aRarity = a.misc_info?.[0]?.md_rarity;
        const bRarity = b.misc_info?.[0]?.md_rarity;
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

/**
 * Main selector: Get filtered and sorted cards
 * Uses caching to avoid recomputing on every call
 */
export function selectFilteredCards(
  allCards: Card[],
  searchQuery: string,
  searchParams: SearchParams & { sort?: string; sortDirection?: "asc" | "desc" },
): Card[] {
  const cacheKey = getCacheKey(searchQuery, searchParams, allCards.length);

  // Check cache first
  if (filterCache.has(cacheKey)) {
    return filterCache.get(cacheKey)!;
  }

  // Apply filters
  let filtered = filterBySearchQuery(allCards, searchQuery);
  filtered = filterBySearchParams(filtered, searchParams);

  // Apply sorting
  if (searchParams.sort) {
    filtered = sortCards(
      filtered,
      searchParams.sort,
      searchParams.sortDirection || "asc",
    );
  }

  // Cache result
  clearOldCacheEntries();
  filterCache.set(cacheKey, filtered);

  return filtered;
}

/**
 * Clear the filter cache (useful when card pool updates)
 */
export function clearFilterCache(): void {
  filterCache.clear();
}

/**
 * Get card by ID
 */
export function selectCardById(allCards: Card[], cardId: number): Card | undefined {
  return allCards.find((card) => card.id === cardId);
}

/**
 * Get cards by name (fuzzy match)
 */
export function selectCardsByName(
  allCards: Card[],
  cardName: string,
  exact: boolean = false,
): Card[] {
  if (exact) {
    return allCards.filter((card) => card.name === cardName);
  }
  const nameLower = cardName.toLowerCase();
  return allCards.filter((card) =>
    card.name.toLowerCase().includes(nameLower),
  );
}

/**
 * Get cards by archetype
 */
export function selectCardsByArchetype(
  allCards: Card[],
  archetype: string,
): Card[] {
  const archetypeLower = archetype.toLowerCase();
  return allCards.filter((card) => {
    const cardArchetype = getArchetypeName(card);
    return cardArchetype?.toLowerCase().includes(archetypeLower);
  });
}

