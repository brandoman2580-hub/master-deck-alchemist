"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  deleteDeck,
  getUserDecks,
  saveDeck,
  toggleDeckPin,
} from "@/lib/supabaseDecks";
import type { DeckMode, DeckType } from "@/types/types";

export const deckKeys = {
  all: ["decks"] as const,
  user: (userId: string) => ["decks", "user", userId] as const,
};

type DeckRow = {
  id: string;
  name: string;
  cards?: {
    main?: DeckType["mainDeck"];
    extra?: DeckType["extraDeck"];
    side?: DeckType["sideDeck"];
  };
  updated_at?: string;
  mode?: DeckMode;
  is_pinned?: boolean;
};

export function mapDeckRows(rows: unknown[]): DeckType[] {
  return rows.map((row) => {
    const deck = row as DeckRow;
    return {
      id: deck.id,
      name: deck.name,
      mainDeck: deck.cards?.main ?? [],
      extraDeck: deck.cards?.extra ?? [],
      sideDeck: deck.cards?.side ?? [],
      updated_at: deck.updated_at,
      mode: deck.mode ?? "Master Duel",
      isPinned: deck.is_pinned ?? false,
    };
  });
}

export async function fetchUserDecks(userId: string): Promise<DeckType[]> {
  const rows = await getUserDecks(userId);
  return mapDeckRows(rows as unknown[]);
}

/** Invalidate cached archives after any deck record mutation. */
export async function invalidateUserDecks(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: deckKeys.user(userId) });
}

export function useUserDecksQuery(
  userId: string | undefined,
): UseQueryResult<DeckType[], Error> {
  return useQuery({
    queryKey: deckKeys.user(userId ?? "anonymous"),
    queryFn: () => fetchUserDecks(userId as string),
    enabled: Boolean(userId),
  });
}

export function useToggleDeckPinMutation(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      deckId,
      pinned,
    }: {
      deckId: string;
      pinned: boolean;
    }) => {
      if (!userId) throw new Error("Auth required");
      await toggleDeckPin(deckId, userId, pinned);
    },
    onSuccess: async () => {
      if (userId) await invalidateUserDecks(queryClient, userId);
    },
  });
}

export function useSaveDeckMutation(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deck: DeckType) => {
      if (!userId) throw new Error("Auth required");
      await saveDeck(deck, userId);
    },
    onSuccess: async () => {
      if (userId) await invalidateUserDecks(queryClient, userId);
    },
  });
}

export function useDeleteDeckMutation(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      if (!userId) throw new Error("Auth required");
      await deleteDeck(deckId, userId);
    },
    onSuccess: async () => {
      if (userId) await invalidateUserDecks(queryClient, userId);
    },
  });
}
