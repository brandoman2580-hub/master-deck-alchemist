"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteDeck as deleteDeckFromSupabase,
  saveDeck as saveDeckToSupabase,
} from "@/lib/data/decks";
import { invalidateAllUserDecks } from "@/hooks/useUserDecks";
import { useLiveDeckStore } from "@/store/liveDeckStore";
import type { ClientDeck } from "@/types/deck";
import { isDeckCapExceededError } from "@/lib/deck/deck-caps";

type SaveVars = {
  deck: ClientDeck;
  userId: string;
};

type DeleteVars = {
  id: string;
  userId: string;
};

/**
 * Deck persist mutations with onMutate loading snapshots.
 * Live card arrays are never optimistically replaced — merge-after-save
 * runs on success via liveDeckStore.applyMergeAfterSave.
 */
export function useDeckMutations() {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async ({ deck, userId }: SaveVars) => {
      await saveDeckToSupabase(deck, userId);
      return deck;
    },
    onMutate: async () => {
      useLiveDeckStore.getState().setLoading(true);
      useLiveDeckStore.getState().setError(null);
    },
    onError: (err) => {
      const message = isDeckCapExceededError(err)
        ? err instanceof Error
          ? err.message
          : "Deck limit reached"
        : err instanceof Error
          ? err.message
          : "Failed to save deck";
      useLiveDeckStore.getState().setError(message);
      useLiveDeckStore.getState().setLoading(false);
    },
    onSuccess: (saved) => {
      useLiveDeckStore.getState().applyMergeAfterSave({
        id: saved.id,
        name: saved.name,
        deckFormat: saved.deckFormat,
        updated_at: new Date().toISOString(),
      });
      useLiveDeckStore.getState().setLoading(false);
      void invalidateAllUserDecks(queryClient);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, userId }: DeleteVars) => {
      await deleteDeckFromSupabase(id, userId);
      return id;
    },
    onMutate: async () => {
      useLiveDeckStore.getState().setLoading(true);
      useLiveDeckStore.getState().setError(null);
    },
    onError: (err) => {
      useLiveDeckStore.getState().setError(
        err instanceof Error ? err.message : "Failed to delete deck",
      );
      useLiveDeckStore.getState().setLoading(false);
    },
    onSuccess: () => {
      useLiveDeckStore.getState().setLoading(false);
      void invalidateAllUserDecks(queryClient);
    },
  });

  return {
    saveMutation,
    deleteMutation,
  };
}
