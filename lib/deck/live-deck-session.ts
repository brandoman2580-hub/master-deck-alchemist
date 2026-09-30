import type { ClientDeck, DeckFormat } from "@/types/deck";

const STORAGE_KEY = "mda.live-deck.v1";
const SESSION_VERSION = 1 as const;

export type LiveDeckSessionPayload = {
  version: typeof SESSION_VERSION;
  currentDeck: ClientDeck;
  isDirty: boolean;
};

function isClientDeck(value: unknown): value is ClientDeck {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<ClientDeck> & { mode?: DeckFormat };
  return (
    typeof deck.id === "string" &&
    typeof deck.name === "string" &&
    Array.isArray(deck.mainDeck) &&
    Array.isArray(deck.extraDeck) &&
    Array.isArray(deck.sideDeck) &&
    (typeof deck.deckFormat === "string" || typeof deck.mode === "string")
  );
}

/** Empty untitled draft — do not restore or persist these. */
export function isBrandNewEmptyDeck(deck: ClientDeck): boolean {
  if (deck.name !== "New Deck") return false;
  return (
    deck.mainDeck.length === 0 &&
    deck.extraDeck.length === 0 &&
    deck.sideDeck.length === 0
  );
}

/** Persist named decks, or untitled drafts that already have cards. */
export function shouldPersistLiveDeck(deck: ClientDeck): boolean {
  if (deck.name.trim() === "") return false;
  if (deck.name !== "New Deck") return true;
  return (
    deck.mainDeck.length > 0 ||
    deck.extraDeck.length > 0 ||
    deck.sideDeck.length > 0
  );
}

export function readLiveDeckSession(): LiveDeckSessionPayload | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveDeckSessionPayload> & {
      currentDeck?: ClientDeck & { mode?: DeckFormat };
    };
    if (parsed.version !== SESSION_VERSION) return null;
    if (!isClientDeck(parsed.currentDeck)) return null;
    const deck = parsed.currentDeck;
    const normalized: ClientDeck = {
      ...deck,
      deckFormat: deck.deckFormat ?? deck.mode ?? "Master Duel",
      mainDeck: deck.mainDeck ?? [],
      extraDeck: deck.extraDeck ?? [],
      sideDeck: deck.sideDeck ?? [],
    };
    if (isBrandNewEmptyDeck(normalized)) return null;
    return {
      version: SESSION_VERSION,
      currentDeck: normalized,
      isDirty: Boolean(parsed.isDirty),
    };
  } catch {
    return null;
  }
}

export function writeLiveDeckSession(
  deck: ClientDeck,
  isDirty: boolean,
): void {
  if (typeof sessionStorage === "undefined") return;
  if (!shouldPersistLiveDeck(deck)) {
    clearLiveDeckSession();
    return;
  }
  try {
    const payload: LiveDeckSessionPayload = {
      version: SESSION_VERSION,
      currentDeck: deck,
      isDirty,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — best-effort only.
  }
}

export function clearLiveDeckSession(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
