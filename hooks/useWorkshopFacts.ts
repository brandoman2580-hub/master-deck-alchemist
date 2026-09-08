"use client";

import { useEffect, useMemo, useState } from "react";
import { useDeck } from "@/context/deck-context";
import { getFacts, type FactsEnvelope } from "@/lib/engine";
import { computeDeckHash } from "@/lib/engine/deck-hash";

/**
 * Workshop Facts Brain hook — delegates to shared getFacts pipeline.
 * Assistant deeper wiring remains capped on a separate branch.
 */
export function useWorkshopFacts(): {
  facts: FactsEnvelope | null;
  loading: boolean;
  error: string | null;
} {
  const { currentDeck, banlist, savedDecks } = useDeck();
  const [facts, setFacts] = useState<FactsEnvelope | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deckHash = useMemo(() => computeDeckHash(currentDeck), [currentDeck]);
  const savedDeckIds = useMemo(
    () => new Set(savedDecks.map((d) => d.id)),
    [savedDecks],
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (currentDeck.mainDeck.length < 40) {
        setFacts(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const next = await getFacts(currentDeck, {
          banlist,
          savedDeckIds,
          writeCache: true,
          readCache: true,
          requirePersisted: false,
        });
        if (!cancelled) setFacts(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to compute facts");
          setFacts(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [banlist, currentDeck, deckHash, savedDeckIds]);

  return { facts, loading, error };
}
