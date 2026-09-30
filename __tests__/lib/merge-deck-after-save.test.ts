import { mergeDeckAfterSave } from "@/lib/deck/merge-deck-after-save";
import type { DeckType } from "@/types/deck";

describe("mergeDeckAfterSave", () => {
  const base: DeckType = {
    id: "deck-1",
    name: "Pure Darkness",
    deckFormat: "Master Duel",
    mainDeck: [
      {
        id: 1,
        name: "Old Card",
        type: "Effect Monster",
        desc: "",
        race: "Fiend",
        deckInstanceId: "a",
        misc_info: [{ md_rarity: "N" }],
        card_sets: {
          set_name: "",
          set_code: "",
          set_rarity: "",
          set_rarity_code: "",
          set_price: "",
        },
        card_images: [],
        card_prices: [],
      } as DeckType["mainDeck"][number],
    ],
    extraDeck: [],
    sideDeck: [],
  };

  it("keeps newer local main deck copies when save payload is stale", () => {
    const live: DeckType = {
      ...base,
      mainDeck: [
        ...base.mainDeck,
        {
          ...base.mainDeck[0],
          id: 99,
          name: "Enemy Controller",
          deckInstanceId: "new-copy",
        } as DeckType["mainDeck"][number],
      ],
    };

    const staleSave = {
      id: "deck-1",
      name: "Pure Darkness",
      deckFormat: "Master Duel" as const,
      mainDeck: base.mainDeck,
      extraDeck: [],
      sideDeck: [],
    };

    const merged = mergeDeckAfterSave(live, {
      ...staleSave,
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    expect(merged.mainDeck).toHaveLength(2);
    expect(merged.mainDeck.some((c) => c.name === "Enemy Controller")).toBe(
      true,
    );
    expect(merged.updated_at).toBe("2026-01-01T00:00:00.000Z");
  });
});
