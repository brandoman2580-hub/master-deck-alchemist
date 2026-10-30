import type { ComboFlowPayload, DeckComboGraph, DeckComboLineRecord } from "@/lib/combos/deck-combo-graph";
import { comboFlowPayload, parseDeckComboGraph, storedBoardGraph } from "@/lib/combos/deck-combo-graph";
import { supabase } from "@/lib/supabaseClient";

interface DeckComboLineRow {
  id: string;
  deck_id: string;
  name: string;
  graph: unknown;
  position: number;
  updated_at: string;
}

function raiseBoardError(error: { message?: string; code?: string } | null, fallback: string): never {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "42P01" || /does not exist|deck_combo_lines/i.test(message)) {
    throw new Error("Combo boards could not be loaded.");
  }
  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    throw new Error("Sign in to save combo boards.");
  }
  throw new Error(fallback);
}

function toRecord(row: DeckComboLineRow): DeckComboLineRecord {
  return {
    id: row.id,
    deckId: row.deck_id,
    name: row.name,
    graph: parseDeckComboGraph(row.graph),
    position: row.position,
    updatedAt: row.updated_at,
  };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Sign in to save combo boards.");
  }
  return data.user.id;
}

/** Lines for one deck, in the order the player arranged them. */
export async function listDeckComboLines(deckId: string): Promise<DeckComboLineRecord[]> {
  const { data, error } = await supabase
    .from("deck_combo_lines")
    .select("id, deck_id, name, graph, position, updated_at")
    .eq("deck_id", deckId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) raiseBoardError(error, "Combo boards could not be loaded.");
  return ((data ?? []) as DeckComboLineRow[]).map(toRecord);
}

export async function createDeckComboLine(input: {
  deckId: string;
  name: string;
  graph: DeckComboGraph;
}): Promise<DeckComboLineRecord> {
  const name = input.name.trim();
  if (!name) throw new Error("Name the combo board.");
  const userId = await currentUserId();
  const { data: existing, error: countError } = await supabase
    .from("deck_combo_lines")
    .select("position")
    .eq("deck_id", input.deckId)
    .order("position", { ascending: false })
    .limit(1);
  if (countError) raiseBoardError(countError, "The combo board could not be saved.");
  const position = ((existing?.[0] as { position: number } | undefined)?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("deck_combo_lines")
    .insert({
      deck_id: input.deckId,
      user_id: userId,
      name,
      graph: storedBoardGraph(input.graph),
      position,
    })
    .select("id, deck_id, name, graph, position, updated_at")
    .single();
  if (error) raiseBoardError(error, "The combo board could not be saved.");
  return toRecord(data as DeckComboLineRow);
}

export async function renameDeckComboLine(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name the combo board.");
  const { error } = await supabase
    .from("deck_combo_lines")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) raiseBoardError(error, "The combo board could not be renamed.");
}

export async function saveDeckComboGraph(id: string, graph: DeckComboGraph): Promise<void> {
  const { error } = await supabase
    .from("deck_combo_lines")
    .update({ graph: storedBoardGraph(graph), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) raiseBoardError(error, "The combo board could not be saved.");
}

/**
 * Writes the board document. Image URLs and Ash warnings are not stored.
 */
export async function saveComboToDeck(
  deckId: string,
  lineId: string,
  graph: DeckComboGraph,
  cardsById: ReadonlyMap<number, { card_images?: { image_url_small?: string; image_url?: string }[] }> = new Map(),
  remainingFor: (cardId: number) => number = () => 0,
): Promise<ComboFlowPayload> {
  const flow = comboFlowPayload(graph, cardsById, remainingFor);
  const { error } = await supabase
    .from("deck_combo_lines")
    .update({ graph: storedBoardGraph(graph), updated_at: new Date().toISOString() })
    .eq("id", lineId)
    .eq("deck_id", deckId);
  if (error) raiseBoardError(error, "The combo board could not be saved.");
  return flow;
}

export async function deleteDeckComboLine(id: string): Promise<void> {
  const { error } = await supabase.from("deck_combo_lines").delete().eq("id", id);
  if (error) raiseBoardError(error, "The combo board could not be deleted.");
}
