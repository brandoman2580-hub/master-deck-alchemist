import { validateDeckStructure } from "@/lib/validation/deck-validator";

describe("validateDeckStructure prototype guards", () => {
  it("accepts normal card objects without false-positive proto checks", () => {
    const result = validateDeckStructure({
      name: "Safe Deck",
      mode: "Master Duel",
      mainDeck: Array.from({ length: 40 }, (_, i) => ({
        cardId: 1000 + i,
        name: `Monster ${i}`,
      })),
      extraDeck: [],
      sideDeck: [],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
