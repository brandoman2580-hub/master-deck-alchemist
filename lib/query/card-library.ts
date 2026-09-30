import { getCardData } from "@/lib/data/cards";
import {
  CARD_LIBRARY_CACHE_SCHEMA,
  readCardLibraryCache,
  writeCardLibraryCache,
} from "@/lib/card/library-cache";
import type { Card } from "@/types/card";

export const CARD_LIBRARY_QUERY_KEY = "card-library" as const;

export function cardLibraryQueryKey(): readonly [typeof CARD_LIBRARY_QUERY_KEY] {
  return [CARD_LIBRARY_QUERY_KEY];
}

/** Deduplicate concurrent network loads across Query + auth warm paths. */
let cardLibraryNetworkPromise: Promise<Card[]> | null = null;

async function fetchCardLibraryFromNetwork(): Promise<Card[]> {
  if (cardLibraryNetworkPromise) return cardLibraryNetworkPromise;

  cardLibraryNetworkPromise = (async (): Promise<Card[]> => {
    const results = await getCardData({
      name: "",
      sort: "name",
      sortDirection: "asc",
    });
    if (results.length > 0) {
      await writeCardLibraryCache(results);
    }
    return results;
  })().finally(() => {
    cardLibraryNetworkPromise = null;
  });

  return cardLibraryNetworkPromise;
}

/**
 * Catalog queryFn: IndexedDB (schema + 7d TTL) first, then network.
 * Query owns fetch lifecycle; IDB is the disk persist adapter.
 *
 * Invalidate / refresh: `queryClient.invalidateQueries({ queryKey: cardLibraryQueryKey() })`.
 * Schema bumps (`CARD_LIBRARY_CACHE_SCHEMA`) force a miss on next read.
 */
export async function fetchCardLibrary(): Promise<Card[]> {
  const cached = await readCardLibraryCache();
  if (cached && cached.length > 0) {
    // Background revalidate so provisional-ID cleanups land without blocking UI.
    void fetchCardLibraryFromNetwork().catch(() => {
      // Keep cached library on refresh failure.
    });
    return cached;
  }
  return fetchCardLibraryFromNetwork();
}

export { CARD_LIBRARY_CACHE_SCHEMA };
