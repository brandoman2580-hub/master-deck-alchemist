import { describe, expect, it } from "@jest/globals";
import { normalizeShareDeckCards } from "@/lib/api/deckShare";

describe("normalizeShareDeckCards", () => {
  it("maps archived deck `id` to API `cardId`", () => {
    const result = normalizeShareDeckCards([
      {
        id: 89631139,
        deckInstanceId: "11111111-1111-1111-1111-111111111111",
        name: "Blue-Eyes White Dragon",
        type: "Normal Monster",
        desc: "A legendary dragon.",
      },
    ]);

    expect(result).toEqual([
      {
        cardId: 89631139,
        deckInstanceId: "11111111-1111-1111-1111-111111111111",
        name: "Blue-Eyes White Dragon",
        type: "Normal Monster",
        desc: "A legendary dragon.",
      },
    ]);
  });

  it("keeps an existing cardId and drops invalid deckInstanceId", () => {
    const result = normalizeShareDeckCards([
      {
        cardId: 23995346,
        deckInstanceId: "not-a-uuid",
        name: "Blue-Eyes Ultimate Dragon",
      },
    ]);

    expect(result).toEqual([
      {
        cardId: 23995346,
        name: "Blue-Eyes Ultimate Dragon",
      },
    ]);
  });

  it("throws when neither id nor cardId is present", () => {
    expect(() =>
      normalizeShareDeckCards([{ name: "Broken Card" }]),
    ).toThrow(/missing a valid id/i);
  });
});
