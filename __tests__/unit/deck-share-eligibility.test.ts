import { describe, expect, it } from "@jest/globals";
import { isDeckLegalForShare } from "@/lib/validation/deck-validator";

function makeCards(count: number, idBase = 1000) {
  return Array.from({ length: count }, (_, i) => ({
    id: idBase + (i % 20),
    name: `Card ${i}`,
  }));
}

describe("isDeckLegalForShare", () => {
  it("accepts a legal 40-card main deck", () => {
    expect(
      isDeckLegalForShare({
        mainDeck: makeCards(40),
        extraDeck: [],
        sideDeck: [],
      }),
    ).toBe(true);
  });

  it("rejects incomplete main decks", () => {
    expect(
      isDeckLegalForShare({
        mainDeck: makeCards(39),
        extraDeck: [],
        sideDeck: [],
      }),
    ).toBe(false);
  });

  it("rejects more than 3 copies of a card", () => {
    expect(
      isDeckLegalForShare({
        mainDeck: Array.from({ length: 40 }, () => ({
          id: 89631139,
          name: "Blue-Eyes",
        })),
        extraDeck: [],
        sideDeck: [],
      }),
    ).toBe(false);
  });
});
