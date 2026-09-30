"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDeck } from "@/context/deck-context";
import { getFacts, type FactsEnvelope } from "@/lib/engine";
import { computeDeckHash } from "@/lib/engine/deck-hash";

export function workshopFactsQueryKey(
  deckHash: string,
  deckFormat: string,
  banlistEpoch: string,
): readonly ["workshop-facts", string, string, string] {
  return ["workshop-facts", deckHash, deckFormat, banlistEpoch];
}

/**
 * Workshop Facts Brain — TanStack Query SSoT keyed by deckHash.
 * Matchups + Combos + Grade share this cache; invalidate when the hash changes.
 */
export function useWorkshopFacts(): {
  facts: FactsEnvelope | null;
  loading: boolean;
  error: string | null;
} {
  const { currentDeck, banlist, savedDecks } = useDeck();

  const deckHash = useMemo(() => computeDeckHash(currentDeck), [currentDeck]);
  const savedDeckIds = useMemo(
    () => new Set(savedDecks.map((d) => d.id)),
    [savedDecks],
  );
  const banlistEpoch = useMemo(
    () => String(Object.keys(banlist).length),
    [banlist],
  );

  const enabled = currentDeck.mainDeck.length >= 40;

  const query = useQuery({
    queryKey: workshopFactsQueryKey(
      deckHash,
      currentDeck.deckFormat,
      banlistEpoch,
    ),
    queryFn: async (): Promise<FactsEnvelope> => {
      const facts = await getFacts(currentDeck, {
        banlist,
        savedDeckIds,
        writeCache: true,
        readCache: true,
        requirePersisted: false,
      });
      if (!facts) {
        throw new Error("Facts unavailable for this deck");
      }
      return facts;
    },
    enabled,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const errorMessage =
    query.error instanceof Error
      ? query.error.message
      : query.error
        ? "Failed to compute facts"
        : null;

  return {
    facts: enabled ? (query.data ?? null) : null,
    loading: enabled && query.isLoading,
    error: errorMessage,
  };
}
