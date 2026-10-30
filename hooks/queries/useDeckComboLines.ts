"use client";

import { useEffect, useRef, useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  blankDeckComboGraph,
  graphFromTemplate,
  graphSaveError,
  type DeckComboGraph,
  type DeckComboLineRecord,
} from "@/lib/combos/deck-combo-graph";
import {
  createDeckComboLine,
  deleteDeckComboLine,
  listDeckComboLines,
  renameDeckComboLine,
  saveDeckComboGraph,
} from "@/lib/data/deck-combo-lines";
import { loadComboTemplates } from "@/lib/engine/combo-templates";
import { selectTemplatesForArchetype, type DeckCardRef } from "@/lib/engine/combos";
import type { EngineFormat } from "@/lib/engine/types";

export const deckComboLineKeys = {
  all: ["deck-combo-lines"] as const,
  list: (deckId: string) => ["deck-combo-lines", deckId] as const,
};

export function deckComboLinesQueryOptions(deckId: string) {
  return queryOptions({
    queryKey: deckComboLineKeys.list(deckId),
    queryFn: () => listDeckComboLines(deckId),
    staleTime: 30_000,
  });
}

export type ComboSaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 500;

export interface DeckComboLineContext {
  format: EngineFormat;
  archetype: string | null;
  deckCards: DeckCardRef[];
  /** Full card records so a saved flow document can store image URLs. */
  cardsById?: ReadonlyMap<number, { card_images?: { image_url_small?: string; image_url?: string }[] }>;
}

function persistGraph(lineId: string, graph: DeckComboGraph) {
  return saveDeckComboGraph(lineId, graph);
}

/**
 * Loads and writes the signed-in player's combo boards for one deck.
 * Graph edits update the cache immediately and reach the database after a short pause.
 * Ash warnings are not part of this cache.
 */
export function useDeckComboLines(deckId: string | null, context: DeckComboLineContext) {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...deckComboLinesQueryOptions(deckId ?? "none"),
    enabled: Boolean(deckId),
  });
  const [saveState, setSaveState] = useState<ComboSaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;
  const timers = useRef<Map<string, number>>(new Map());
  const pending = useRef<Map<string, DeckComboGraph>>(new Map());

  const key = deckComboLineKeys.list(deckId ?? "none");

  const replaceLine = (id: string, graph: DeckComboGraph) => {
    queryClient.setQueryData<DeckComboLineRecord[]>(key, (current) =>
      (current ?? []).map((line) => (line.id === id ? { ...line, graph } : line)),
    );
  };

  useEffect(() => {
    const pendingGraphs = pending.current;
    const pendingTimers = timers.current;
    return () => {
      for (const timer of pendingTimers.values()) window.clearTimeout(timer);
      pendingTimers.clear();
      for (const [id, graph] of pendingGraphs) {
        if (deckId) void persistGraph(id, graph).catch(() => undefined);
      }
      pendingGraphs.clear();
    };
  }, [deckId]);

  const createMutation = useMutation({
    mutationFn: (input: { name: string; graph: DeckComboGraph }) => {
      if (!deckId) throw new Error("Save this deck before storing a combo board.");
      return createDeckComboLine({ deckId, name: input.name, graph: input.graph });
    },
    onSuccess: (record) => {
      queryClient.setQueryData<DeckComboLineRecord[]>(key, (current) => [...(current ?? []), record]);
      setSaveState("saved");
      setSaveError(null);
    },
    onError: (error: Error) => {
      setSaveState("error");
      setSaveError(error.message);
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameDeckComboLine(id, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error: Error) => {
      setSaveState("error");
      setSaveError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDeckComboLine(id),
    onSuccess: async (_result, id) => {
      const timer = timers.current.get(id);
      if (timer != null) window.clearTimeout(timer);
      timers.current.delete(id);
      pending.current.delete(id);
      queryClient.setQueryData<DeckComboLineRecord[]>(key, (current) =>
        (current ?? []).filter((line) => line.id !== id),
      );
    },
    onError: (error: Error) => {
      setSaveState("error");
      setSaveError(error.message);
    },
  });

  const changeGraph = (id: string, graph: DeckComboGraph) => {
    replaceLine(id, graph);
    const deckCardIds = new Set(contextRef.current.deckCards.map((card) => card.id));
    const invalid = graphSaveError(graph, deckCardIds);
    const existing = timers.current.get(id);
    if (existing != null) window.clearTimeout(existing);
    if (invalid) {
      timers.current.delete(id);
      pending.current.delete(id);
      setSaveState("error");
      setSaveError(invalid);
      return;
    }
    pending.current.set(id, graph);
    setSaveState("saving");
    setSaveError(null);
    const timer = window.setTimeout(() => {
      timers.current.delete(id);
      pending.current.delete(id);
      if (!deckId) return;
      void persistGraph(id, graph)
        .then(() => {
          setSaveState("saved");
        })
        .catch((error: Error) => {
          setSaveState("error");
          setSaveError(error.message || "The combo board could not be saved.");
        });
    }, SAVE_DELAY_MS);
    timers.current.set(id, timer);
  };

  const startFromTemplate = () => {
    if (!deckId) {
      setSaveState("error");
      setSaveError("Save this deck before storing a combo board.");
      return;
    }
    const snapshot = contextRef.current;
    setSaveState("saving");
    setSaveError(null);
    void (async () => {
      const templates = await loadComboTemplates(snapshot.format, snapshot.archetype);
      const picked = selectTemplatesForArchetype(templates, snapshot.archetype, snapshot.format);
      for (const template of picked) {
        const graph = graphFromTemplate(template, snapshot.deckCards);
        if (!graph) continue;
        const deckCardIds = new Set(snapshot.deckCards.map((card) => card.id));
        if (graphSaveError(graph, deckCardIds)) continue;
        createMutation.mutate({ name: template.name, graph });
        return;
      }
      setSaveState("error");
      setSaveError("No curated line matches the cards in this deck.");
    })().catch((error: Error) => {
      setSaveState("error");
      setSaveError(error.message || "The template could not be copied.");
    });
  };

  return {
    lines: deckId ? (query.data ?? []) : [],
    loading: Boolean(deckId) && query.isLoading,
    error: query.isError ? "Combo boards could not be loaded." : null,
    saveState,
    saveError,
    createLine: (name: string, graph: DeckComboGraph = blankDeckComboGraph()) => {
      createMutation.mutate({ name, graph });
    },
    renameLine: (id: string, name: string) => renameMutation.mutate({ id, name }),
    deleteLine: (id: string) => deleteMutation.mutate(id),
    changeGraph,
    startFromTemplate,
  };
}
