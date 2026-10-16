import { sortArchiveDecks } from "@/lib/deck/sort-archive-decks";
import type { ClientDeck } from "@/types/deck";

function deck(
  partial: Pick<ClientDeck, "id" | "name" | "deckFormat"> &
    Partial<Pick<ClientDeck, "updated_at" | "isPinned">>,
): ClientDeck {
  return {
    mainDeck: [],
    extraDeck: [],
    sideDeck: [],
    updated_at: "2026-01-01T00:00:00.000Z",
    isPinned: false,
    ...partial,
  };
}

const library: ClientDeck[] = [
  deck({
    id: "md-new",
    name: "Snake-Eye",
    deckFormat: "Master Duel",
    updated_at: "2026-03-01T00:00:00.000Z",
  }),
  deck({
    id: "tcg-old",
    name: "Blue-Eyes",
    deckFormat: "TCG",
    updated_at: "2025-01-01T00:00:00.000Z",
  }),
  deck({
    id: "pin-old",
    name: "Zoodiac",
    deckFormat: "TCG",
    updated_at: "2024-06-01T00:00:00.000Z",
    isPinned: true,
  }),
  deck({
    id: "md-old",
    name: "Branded",
    deckFormat: "Master Duel",
    updated_at: "2025-06-01T00:00:00.000Z",
  }),
  deck({
    id: "tcg-new",
    name: "Yubel",
    deckFormat: "TCG",
    updated_at: "2026-05-01T00:00:00.000Z",
  }),
  deck({
    id: "pin-new",
    name: "Aleister",
    deckFormat: "Master Duel",
    updated_at: "2026-04-01T00:00:00.000Z",
    isPinned: true,
  }),
];

describe("sortArchiveDecks", () => {
  it("keeps pinned decks first and defaults to newest-oldest", () => {
    const sorted = sortArchiveDecks(library);
    expect(sorted.map((item) => item.id)).toEqual([
      "pin-new",
      "pin-old",
      "tcg-new",
      "md-new",
      "md-old",
      "tcg-old",
    ]);
  });

  it("sorts oldest-newest inside the pinned group and the rest", () => {
    const sorted = sortArchiveDecks(library, "oldest");
    expect(sorted.map((item) => item.id)).toEqual([
      "pin-old",
      "pin-new",
      "tcg-old",
      "md-old",
      "md-new",
      "tcg-new",
    ]);
  });

  it("sorts a-z and z-a by name with pins still first", () => {
    expect(sortArchiveDecks(library, "az").map((item) => item.name)).toEqual([
      "Aleister",
      "Zoodiac",
      "Blue-Eyes",
      "Branded",
      "Snake-Eye",
      "Yubel",
    ]);
    expect(sortArchiveDecks(library, "za").map((item) => item.name)).toEqual([
      "Zoodiac",
      "Aleister",
      "Yubel",
      "Snake-Eye",
      "Branded",
      "Blue-Eyes",
    ]);
  });

  it("groups by format after pins, newest first within a format", () => {
    const sorted = sortArchiveDecks(library, "format");
    expect(sorted.map((item) => item.id)).toEqual([
      "pin-new",
      "pin-old",
      "md-new",
      "md-old",
      "tcg-new",
      "tcg-old",
    ]);
  });

  it("does not mutate the source list", () => {
    const snapshot = library.map((item) => item.id);
    sortArchiveDecks(library, "az");
    expect(library.map((item) => item.id)).toEqual(snapshot);
  });
});
