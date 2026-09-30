"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  cardLibraryQueryKey,
  fetchCardLibrary,
} from "@/lib/query/card-library";
import { useCardStore } from "@/store/cardStore";
import { clearFilterCache } from "@/store/cardPoolSelectors";
import type { Card } from "@/types/card";

export type UseCardLibraryResult = {
  cards: Card[];
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
};

/**
 * TanStack Query SSoT for the card catalog.
 * Mirrors into `useCardStore.cardList` so existing selectors keep working until
 * post-QA retirement of the mirror (Phase 1b exit).
 */
export function useCardLibrary(): UseCardLibraryResult {
  const setCardList = useCardStore((state) => state.setCardList);
  const setLoading = useCardStore((state) => state.setLoading);

  const query = useQuery({
    queryKey: cardLibraryQueryKey(),
    queryFn: fetchCardLibrary,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    setLoading(query.isLoading || query.isFetching);
  }, [query.isFetching, query.isLoading, setLoading]);

  useEffect(() => {
    const cards = query.data;
    if (!cards || cards.length === 0) return;
    const existing = useCardStore.getState().cardList;
    if (existing === cards) return;
    clearFilterCache();
    setCardList(cards);
  }, [query.data, setCardList]);

  const errorMessage =
    query.error instanceof Error
      ? query.error.message
      : query.error
        ? "Failed to load card library"
        : null;

  return {
    cards: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: errorMessage,
  };
}
