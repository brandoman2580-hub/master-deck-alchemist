"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Card } from "../types/card";
import type {
  BanStatus,
  ClientDeck,
  Deck,
  DeckFormat,
  DeckSection,
} from "@/types/deck";
import { supabase } from "../lib/supabaseClient";
import {
  deleteDeck as deleteDeckFromSupabase,
  loadDeck as loadDeckFromSupabase,
  saveDeck as saveDeckToSupabase,
} from "@/lib/data/decks";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateAllUserDecks, useUserDecks } from "@/hooks/useUserDecks";
import { useLiveDeckStore } from "@/store/liveDeckStore";
import { useCardLibrary } from "@/hooks/queries/useCardLibrary";
import { useUserStore } from "@/store/useUserStore";
import {
  clearLiveDeckSession,
  isBrandNewEmptyDeck,
  readLiveDeckSession,
  writeLiveDeckSession,
} from "@/lib/deck/live-deck-session";

interface DeckContextType {
  currentDeck: ClientDeck;
  setCurrentDeck: Dispatch<SetStateAction<ClientDeck>>;
  /** Query-backed alias — not a Context-owned copy. */
  savedDecks: Deck[];
  banlist: Record<string, BanStatus>;
  addCardToDeck: (card: Card, deckType: DeckSection) => void;
  removeCardFromDeck: (cardId: string, deckType: DeckSection) => void;
  clearDeck: (deckFormat?: DeckFormat) => void;
  saveDeck: (deckData?: ClientDeck) => Promise<void>;
  loadDeck: (id: string) => Promise<void>;
  copyDeck: (
    sourceDeck: ClientDeck,
    options?: { targetFormat?: DeckFormat; name?: string },
  ) => void;
  deleteDeck: (id: string) => Promise<void>;
  getUserDecks: () => Promise<void>;
  exportDeck: () => string;
  importDeck: (jsonData: string) => void;
  renameDeck: (name: string) => void;
  updateDeckFormat: (deckFormat: DeckFormat) => void;
  /** @deprecated Use `updateDeckFormat` */
  updateDeckMode: (mode: DeckFormat) => void;
  getDeckStats: () => {
    mainCount: number;
    extraCount: number;
    sideCount: number;
    monsterCount: number;
    spellCount: number;
    trapCount: number;
  };
  getSynergyTips: () => string[];
  loading: boolean;
  error: string | null;
  isDirty: boolean;
}

const DeckContext = createContext<DeckContextType | undefined>(undefined);

/**
 * Thin compatibility shim over Zustand liveDeck + TanStack Query archives.
 * Zero duplicated deck card arrays after Phase 1b.
 */
export function DeckProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { decks: queryDecks, invalidate } = useUserDecks();
  // Hydrate catalog Query → cardStore mirror for Workshop consumers.
  useCardLibrary();

  const currentDeck = useLiveDeckStore((s) => s.currentDeck);
  const banlist = useLiveDeckStore((s) => s.banlist);
  const loading = useLiveDeckStore((s) => s.loading);
  const error = useLiveDeckStore((s) => s.error);
  const isDirty = useLiveDeckStore((s) => s.isDirty);

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const pendingResaveRef = useRef(false);
  const currentDeckRef = useRef(currentDeck);
  currentDeckRef.current = currentDeck;
  /** Deck ids known to exist in Supabase — skip existence probe on updates. */
  const knownPersistedIdsRef = useRef<Set<string>>(new Set());
  /** Last list-visible meta we invalidated for — avoid archives refetch on card-only autosaves. */
  const lastInvalidatedMetaRef = useRef<{
    id: string;
    name: string;
    deckFormat: DeckFormat;
  } | null>(null);
  const didHydrateSessionRef = useRef(false);

  // Restore last workshop deck after refresh (skip empty "New Deck" drafts).
  useEffect(() => {
    if (didHydrateSessionRef.current) return;
    didHydrateSessionRef.current = true;
    const session = readLiveDeckSession();
    if (!session) return;
    const current = useLiveDeckStore.getState().currentDeck;
    if (!isBrandNewEmptyDeck(current)) return;
    useLiveDeckStore.getState().hydrateDeck(session.currentDeck, {
      isDirty: session.isDirty,
    });
    knownPersistedIdsRef.current.add(session.currentDeck.id);
    lastInvalidatedMetaRef.current = {
      id: session.currentDeck.id,
      name: session.currentDeck.name,
      deckFormat: session.currentDeck.deckFormat,
    };
  }, []);

  // Persist live deck for refresh restore (debounced).
  useEffect(() => {
    const timer = setTimeout(() => {
      writeLiveDeckSession(currentDeck, isDirty);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentDeck, isDirty]);

  // Banlist follows live deck format (SSoT).
  useEffect(() => {
    let cancelled = false;
    const loadBanlist = async (): Promise<void> => {
      try {
        const { getMasterDuelBanlist, getTCGBanlist } = await import(
          "../lib/data/cards"
        );
        const banlistData =
          currentDeck.deckFormat === "TCG"
            ? await getTCGBanlist()
            : await getMasterDuelBanlist();
        if (!cancelled) {
          useLiveDeckStore.getState().setBanlist(banlistData);
        }
      } catch {
        if (!cancelled) {
          useLiveDeckStore.getState().setBanlist({});
        }
      }
    };
    void loadBanlist();
    return () => {
      cancelled = true;
    };
  }, [currentDeck.deckFormat]);

  const setCurrentDeck = useCallback<Dispatch<SetStateAction<ClientDeck>>>(
    (value) => {
      useLiveDeckStore.getState().setCurrentDeck(value);
    },
    [],
  );

  const addCardToDeck = useCallback((card: Card, deckType: DeckSection) => {
    useLiveDeckStore.getState().addCardToDeck(card, deckType);
  }, []);

  const removeCardFromDeck = useCallback(
    (deckInstanceId: string, deckType: DeckSection) => {
      useLiveDeckStore.getState().removeCardFromDeck(deckInstanceId, deckType);
    },
    [],
  );

  const clearDeck = useCallback((deckFormat: DeckFormat = "Master Duel") => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    useLiveDeckStore.getState().clearDeck(deckFormat);
    currentDeckRef.current = useLiveDeckStore.getState().currentDeck;
    clearLiveDeckSession();
    lastInvalidatedMetaRef.current = null;
  }, []);

  const getUserDecks = useCallback(async () => {
    await invalidate();
  }, [invalidate]);

  const saveDeck = useCallback(
    async (deckData?: ClientDeck) => {
      if (saveInFlightRef.current) {
        pendingResaveRef.current = true;
        return;
      }

      const store = useLiveDeckStore.getState();
      store.setLoading(true);
      store.setError(null);
      saveInFlightRef.current = true;

      try {
        // Prefer synced Zustand user — avoid auth/v1/user on every autosave.
        let userId = useUserStore.getState().user?.id ?? null;
        if (!userId) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          userId = user?.id ?? null;
        }
        if (!userId) throw new Error("User not authenticated");

        let overrideDeck = deckData;
        let iterations = 0;
        do {
          pendingResaveRef.current = false;
          iterations += 1;
          const generationAtStart =
            useLiveDeckStore.getState().editGeneration;
          const deckToSave = overrideDeck ?? currentDeckRef.current;
          overrideDeck = undefined;

          if (deckToSave.name === "New Deck") {
            store.setError("Please rename your deck before saving.");
            break;
          }

          if (!deckToSave.id || !deckToSave.name) {
            throw new Error("Invalid deck data: missing id or name");
          }

          const validatedDeck: ClientDeck = {
            ...deckToSave,
            mainDeck: deckToSave.mainDeck || [],
            extraDeck: deckToSave.extraDeck || [],
            sideDeck: deckToSave.sideDeck || [],
            deckFormat: deckToSave.deckFormat || "Master Duel",
          };

          const isNewDeckId = !knownPersistedIdsRef.current.has(
            validatedDeck.id,
          );

          await saveDeckToSupabase(validatedDeck, userId, { isNewDeckId });
          knownPersistedIdsRef.current.add(validatedDeck.id);

          // Never replace main/extra/side from the save payload — a newer local
          // add can land while this request is in flight (merge-after-save).
          useLiveDeckStore.getState().applyMergeAfterSave(
            {
              id: validatedDeck.id,
              name: validatedDeck.name,
              deckFormat: validatedDeck.deckFormat,
              updated_at: new Date().toISOString(),
            },
            generationAtStart,
          );

          // Archives list only needs a refetch when list-visible fields change.
          const prevMeta = lastInvalidatedMetaRef.current;
          const metaChanged =
            !prevMeta ||
            prevMeta.id !== validatedDeck.id ||
            prevMeta.name !== validatedDeck.name ||
            prevMeta.deckFormat !== validatedDeck.deckFormat;

          if (metaChanged || isNewDeckId) {
            lastInvalidatedMetaRef.current = {
              id: validatedDeck.id,
              name: validatedDeck.name,
              deckFormat: validatedDeck.deckFormat,
            };
            await invalidateAllUserDecks(queryClient);
          }
        } while (pendingResaveRef.current && iterations < 5);

        // Mid-flight edits that flipped dirty after the last merge: debounce again.
        if (
          useLiveDeckStore.getState().isDirty &&
          currentDeckRef.current.name !== "New Deck"
        ) {
          if (saveTimeout.current) clearTimeout(saveTimeout.current);
          saveTimeout.current = setTimeout(() => {
            void saveDeck(currentDeckRef.current);
          }, 1000);
        }
      } catch (err: unknown) {
        // Do not roll back live card arrays on save failure — that would wipe
        // cards added while the request was in flight. Surface error only.
        const errorMessage =
          err instanceof Error
            ? err.message
            : typeof err === "object" &&
                err &&
                "message" in err &&
                typeof (err as { message: unknown }).message === "string"
              ? (err as { message: string }).message
              : "Failed to save deck";
        useLiveDeckStore.getState().setError(errorMessage);
      } finally {
        saveInFlightRef.current = false;
        useLiveDeckStore.getState().setLoading(false);
      }
    },
    [queryClient],
  );

  const copyDeck = useCallback(
    (
      sourceDeck: ClientDeck,
      options?: { targetFormat?: DeckFormat; name?: string },
    ) => {
      useLiveDeckStore.getState().copyDeck(sourceDeck, options);
    },
    [],
  );

  const loadDeck = useCallback(async (id: string) => {
    const store = useLiveDeckStore.getState();
    store.setLoading(true);
    store.setError(null);
    try {
      let userId = useUserStore.getState().user?.id ?? null;
      if (!userId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      }
      if (!userId) throw new Error("User not authenticated");

      const deck = await loadDeckFromSupabase(id, userId);
      store.hydrateDeck(deck, { isDirty: false });
      knownPersistedIdsRef.current.add(deck.id);
      lastInvalidatedMetaRef.current = {
        id: deck.id,
        name: deck.name,
        deckFormat: deck.deckFormat,
      };
    } catch (err: unknown) {
      store.setError(
        err instanceof Error ? err.message : "Failed to load deck",
      );
    } finally {
      store.setLoading(false);
    }
  }, []);

  const deleteDeck = useCallback(
    async (id: string) => {
      const store = useLiveDeckStore.getState();
      store.setLoading(true);
      store.setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        await deleteDeckFromSupabase(id, user.id);
        await invalidateAllUserDecks(queryClient);
      } catch (err: unknown) {
        store.setError(
          err instanceof Error ? err.message : "Failed to delete deck",
        );
      } finally {
        store.setLoading(false);
      }
    },
    [queryClient],
  );

  // Debounced auto-save — only when dirty (prevents merge-after-save → loop).
  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    if (!isDirty) return;
    if (currentDeck.name === "New Deck") return;
    if (!useUserStore.getState().user?.id) return;

    saveTimeout.current = setTimeout(() => {
      void saveDeck(currentDeckRef.current);
    }, 1000);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [isDirty, currentDeck, saveDeck]);

  const renameDeck = useCallback((name: string) => {
    useLiveDeckStore.getState().renameDeck(name);
  }, []);

  const updateDeckFormat = useCallback((deckFormat: DeckFormat) => {
    useLiveDeckStore.getState().updateDeckFormat(deckFormat);
  }, []);

  const exportDeck = useCallback(
    () => useLiveDeckStore.getState().exportDeck(),
    [],
  );

  const importDeck = useCallback((jsonData: string) => {
    useLiveDeckStore.getState().importDeck(jsonData);
  }, []);

  const getDeckStats = useCallback(
    () => useLiveDeckStore.getState().getDeckStats(),
    [],
  );

  const getSynergyTips = useCallback(
    () => useLiveDeckStore.getState().getSynergyTips(),
    [],
  );

  const savedDecks = useMemo((): Deck[] => {
    return queryDecks.map((d) => ({
      id: d.id,
      name: d.name,
      mainDeck: d.mainDeck,
      extraDeck: d.extraDeck,
      sideDeck: d.sideDeck,
      created_at: d.updated_at ?? "",
      updated_at: d.updated_at ?? "",
      is_pinned: d.isPinned,
      deckFormat: d.deckFormat,
    }));
  }, [queryDecks]);

  const value: DeckContextType = {
    currentDeck,
    setCurrentDeck,
    savedDecks,
    banlist,
    addCardToDeck,
    removeCardFromDeck,
    clearDeck,
    saveDeck,
    loadDeck,
    copyDeck,
    deleteDeck,
    getUserDecks,
    exportDeck,
    importDeck,
    renameDeck,
    updateDeckFormat,
    updateDeckMode: updateDeckFormat,
    getDeckStats,
    getSynergyTips,
    loading,
    error,
    isDirty,
  };

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck() {
  const context = useContext(DeckContext);
  if (context === undefined) {
    throw new Error("useDeck must be used within a DeckProvider");
  }
  return context;
}
