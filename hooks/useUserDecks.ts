"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useUserStore } from "@/store/useUserStore";
import {
  fetchUserDecks,
  USER_DECKS_QUERY_KEY,
  userDecksQueryKey,
} from "@/lib/query/user-decks";
import type { DeckType } from "@/types/types";

export type UseUserDecksResult = {
  decks: DeckType[];
  isLoading: boolean;
  error: string | null;
  invalidate: () => Promise<void>;
};

/**
 * Cached user-deck list. First visit shows a loading state; later visits
 * (including tab focus) reuse cache until a mutation invalidates it.
 */
export function useUserDecks(): UseUserDecksResult {
  const user = useUserStore((state) => state.user);
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: userDecksQueryKey(userId ?? ""),
    queryFn: () => fetchUserDecks(userId as string),
    enabled: Boolean(userId),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const invalidate = useCallback(async (): Promise<void> => {
    if (!userId) return;
    await queryClient.invalidateQueries({
      queryKey: userDecksQueryKey(userId),
    });
  }, [queryClient, userId]);

  const errorMessage =
    query.error instanceof Error
      ? query.error.message
      : query.error
        ? "Failed to load decks"
        : null;

  return {
    decks: query.data ?? [],
    isLoading: query.isLoading,
    error: errorMessage,
    invalidate,
  };
}

export function invalidateAllUserDecks(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: [USER_DECKS_QUERY_KEY] });
}
