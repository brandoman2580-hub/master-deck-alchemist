import type { DeckType } from "@/types/deck";

/**
 * After a successful persist, merge save metadata into live deck state
 * without replacing main/extra/side arrays.
 *
 * Autosave is async: if the user adds a card while a save of an older
 * snapshot is in flight, spreading `validatedDeck` over `prev` would
 * wipe those newer copies (card appears, then vanishes ~1s later).
 */
export function mergeDeckAfterSave(
  prev: DeckType,
  saved: Pick<DeckType, "id" | "name" | "mode"> & {
    updated_at?: string;
  },
): DeckType {
  return {
    ...prev,
    id: saved.id || prev.id,
    // Prefer live local name/mode in case the user edited during the save.
    name: prev.name || saved.name,
    mode: prev.mode || saved.mode,
    updated_at: saved.updated_at ?? new Date().toISOString(),
  };
}
