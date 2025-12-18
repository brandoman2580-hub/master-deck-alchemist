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

function getCacheKey(searchQuery: string, searchParams: SearchParams): string {
  return JSON.stringify({ searchQuery, searchParams });
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
 * Filter cards by search parameters
 */
function filterBySearchParams(cards: Card[], params: SearchParams): Card[] {
  let filtered = cards;

  // Only apply filters if they have non-empty values
  if (params.type && params.type.trim()) {
    filtered = filtered.filter((card) => card.type === params.type);
  }

  if (params.race && params.race.trim()) {
    filtered = filtered.filter((card) => card.race === params.race);
  }

  if (params.attribute && params.attribute.trim()) {
    filtered = filtered.filter((card) => card.attribute === params.attribute);
  }

  if (params.level && params.level.trim()) {
    filtered = filtered.filter((card) => card.level === Number(params.level));
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
    filtered = filtered.filter((card) => {
      const archetypeName = getArchetypeName(card);
      return archetypeName?.toLowerCase().includes(params.archetype!.toLowerCase());
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
    filtered = filtered.filter((card) => {
      const rarity = card.misc_info?.[0]?.md_rarity;
      return rarity?.toLowerCase().includes(params.rarity!.toLowerCase());
    });
  }

  return filtered;
}

/**
 * Sort cards by given criteria
 */
function sortCards(
  cards: Card[],
  sortKey: string,
  sortDirection: "asc" | "desc" = "asc",
): Card[] {
  const sorted = [...cards];

  sorted.sort((a, b) => {
    let aValue: string | number | undefined;
    let bValue: string | number | undefined;

    switch (sortKey) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "atk":
        aValue =
          typeof a.atk === "number" ? a.atk : a.atk === "?" ? -1 : 0;
        bValue =
          typeof b.atk === "number" ? b.atk : b.atk === "?" ? -1 : 0;
        break;
      case "def":
        aValue =
          typeof a.def === "number" ? a.def : a.def === "?" ? -1 : 0;
        bValue =
          typeof b.def === "number" ? b.def : b.def === "?" ? -1 : 0;
        break;
      case "level":
        aValue = a.level ?? 0;
        bValue = b.level ?? 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
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
  const cacheKey = getCacheKey(searchQuery, searchParams);

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

