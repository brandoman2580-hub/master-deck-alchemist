import {
  getDeckShareFullUrl,
  mapDeckCardToSharePayload,
  toDeckShareRequest,
} from "@/lib/api/deckShare";
import type { DeckType } from "@/types/types";

describe("deck share payload", () => {
  it("maps deck cards to cardId payloads expected by create-deck-share", () => {
    const card = {
      id: 89631139,
      deckInstanceId: "11111111-1111-4111-8111-111111111111",
      name: "Blue-Eyes White Dragon",
      type: "Normal Monster",
      desc: "Test",
      race: "Dragon",
      misc_info: [{ md_rarity: "Ultra Rare" }],
      card_sets: {
        set_name: "Legend of Blue Eyes White Dragon",
        set_code: "LOB",
        set_rarity: "Ultra Rare",
        set_rarity_code: "UR",
        set_price: "0",
      },
      card_images: [],
      card_prices: [],
    };

    expect(mapDeckCardToSharePayload(card)).toEqual({
      cardId: 89631139,
      deckInstanceId: "11111111-1111-4111-8111-111111111111",
      name: "Blue-Eyes White Dragon",
      type: "Normal Monster",
      desc: "Test",
    });
  });

  it("builds a share request without raw DeckCard id fields", () => {
    const deck: DeckType = {
      id: "deck-1",
      name: "Test Deck",
      mode: "Master Duel",
      mainDeck: [
        {
          id: 123,
          deckInstanceId: "22222222-2222-4222-8222-222222222222",
          name: "Card A",
          type: "Spell Card",
          desc: "A",
          race: "Spell",
          misc_info: [{ md_rarity: "Common" }],
          card_sets: {
            set_name: "Set",
            set_code: "SET",
            set_rarity: "Common",
            set_rarity_code: "C",
            set_price: "0",
          },
          card_images: [],
          card_prices: [],
        },
      ],
      extraDeck: [],
      sideDeck: [],
    };

    const payload = toDeckShareRequest(deck);
    expect(payload.mainDeck[0]).toEqual({
      cardId: 123,
      deckInstanceId: "22222222-2222-4222-8222-222222222222",
      name: "Card A",
      type: "Spell Card",
      desc: "A",
    });
    expect(payload.mainDeck[0]).not.toHaveProperty("id");
  });

  it("builds absolute share URLs from relative paths", () => {
    expect(getDeckShareFullUrl("https://example.com/share/abc")).toBe(
      "https://example.com/share/abc",
    );
    expect(getDeckShareFullUrl("/share/abc")).toMatch(/\/share\/abc$/);
  });
});
