"use client";

import { useState, useEffect, useMemo } from "react";
import { getMasterDuelRarityMap } from "@/lib/api";

/**
 * Fetches Master Duel rarity map (card_id -> md_rarity) for given card IDs.
 * Only fetches when deckMode is Master Duel and cardIds is non-empty.
 */
export function useMasterDuelRarity(
  cardIds: number[],
  deckMode: "Master Duel" | "TCG",
): Map<number, string> {
  const [rarityMap, setRarityMap] = useState<Map<number, string>>(new Map());

  const idsKey = useMemo(() => {
    const seen = new Set<number>();
    const unique = cardIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return unique.sort((a, b) => a - b).join(",");
  }, [cardIds]);

  const uniqueIds = useMemo(
    () => (idsKey ? idsKey.split(",").map(Number) : []),
    [idsKey],
  );

  useEffect(() => {
    if (deckMode !== "Master Duel" || uniqueIds.length === 0) {
      setRarityMap(new Map());
      return;
    }

    let cancelled = false;

    getMasterDuelRarityMap(uniqueIds).then((map) => {
      if (!cancelled) {
        setRarityMap(map);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [deckMode, idsKey]);

  return rarityMap;
}
