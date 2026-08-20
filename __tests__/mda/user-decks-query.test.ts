import { mapDeckRows, userDecksQueryKey } from "@/lib/query/user-decks";

describe("user decks query helpers", () => {
  it("builds a stable query key per user", () => {
    expect(userDecksQueryKey("user-1")).toEqual(["user-decks", "user-1"]);
  });

  it("maps supabase rows into DeckType", () => {
    const decks = mapDeckRows([
      {
        id: "abc",
        name: "Tearlament",
        cards: { main: [], extra: [], side: [] },
        updated_at: "2026-01-01T00:00:00Z",
        mode: "TCG",
        is_pinned: true,
      },
    ]);

    expect(decks).toEqual([
      {
        id: "abc",
        name: "Tearlament",
        mainDeck: [],
        extraDeck: [],
        sideDeck: [],
        updated_at: "2026-01-01T00:00:00Z",
        mode: "TCG",
        isPinned: true,
      },
    ]);
  });
});
