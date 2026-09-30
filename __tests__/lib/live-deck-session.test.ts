import {
  clearLiveDeckSession,
  isBrandNewEmptyDeck,
  readLiveDeckSession,
  shouldPersistLiveDeck,
  writeLiveDeckSession,
} from "@/lib/deck/live-deck-session";
import type { ClientDeck } from "@/types/deck";

const sampleDeck = (overrides?: Partial<ClientDeck>): ClientDeck => ({
  id: "deck-1",
  name: "Pure Darkness",
  mainDeck: [],
  extraDeck: [],
  sideDeck: [],
  deckFormat: "Master Duel",
  ...overrides,
});

describe("live-deck-session", () => {
  beforeEach(() => {
    clearLiveDeckSession();
  });

  it("treats empty New Deck as brand-new", () => {
    expect(isBrandNewEmptyDeck(sampleDeck({ name: "New Deck" }))).toBe(true);
    expect(
      isBrandNewEmptyDeck(
        sampleDeck({
          name: "New Deck",
          mainDeck: [{ id: 1, name: "Ash", deckInstanceId: "a" } as never],
        }),
      ),
    ).toBe(false);
  });

  it("persists and restores a named deck", () => {
    const deck = sampleDeck();
    writeLiveDeckSession(deck, false);
    const session = readLiveDeckSession();
    expect(session?.currentDeck.name).toBe("Pure Darkness");
    expect(session?.isDirty).toBe(false);
  });

  it("does not persist empty New Deck drafts", () => {
    expect(shouldPersistLiveDeck(sampleDeck({ name: "New Deck" }))).toBe(
      false,
    );
    writeLiveDeckSession(sampleDeck({ name: "New Deck" }), true);
    expect(readLiveDeckSession()).toBeNull();
  });
});
