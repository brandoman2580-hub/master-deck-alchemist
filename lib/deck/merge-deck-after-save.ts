import type { ClientDeck } from "@/types/deck";

/**
 * After a successful persist, merge save metadata into live deck state
 * without replacing main/extra/side arrays.
 *
 * Autosave is async: if the user adds a card while a save of an older
 * snapshot is in flight, spreading `validatedDeck` over `prev` would
 * wipe those newer copies (card appears, then vanishes ~1s later).
 */
export function mergeDeckAfterSave(
  prev: ClientDeck,
  saved: Pick<ClientDeck, "id" | "name" | "deckFormat"> & {
    updated_at?: string;
  },
): ClientDeck {
  return {
    ...prev,
    id: saved.id || prev.id,
    // Prefer live local name/format in case the user edited during the save.
    name: prev.name || saved.name,
    deckFormat: prev.deckFormat || saved.deckFormat,
    updated_at: saved.updated_at ?? new Date().toISOString(),
  };
}
