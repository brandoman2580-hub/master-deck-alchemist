/**
 * Card pool selector behavior — multi-select filters and cache identity.
 */

import type { Card } from "@/types/card";
import {
  clearFilterCache,
  selectFilteredCards,
} from "@/store/cardPoolSelectors";

function makeCard(
  overrides: Partial<Card> & Pick<Card, "id" | "name" | "type">,
): Card {
  return {
    race: "Spellcaster",
    attribute: "DARK",
    level: 4,
    atk: 1000,
    def: 1000,
    desc: "Test card",
    deckInstanceId: "",
    card_images: [],
    card_sets: [],
    card_prices: [],
    misc_info: [],
    ...overrides,
  } as Card;
}

describe("selectFilteredCards", () => {
  beforeEach(() => {
    clearFilterCache();
  });

  const pool = [
    makeCard({ id: 1, name: "Alpha Dragon", type: "Effect Monster" }),
    makeCard({ id: 2, name: "Beta Magician", type: "Normal Monster" }),
    makeCard({ id: 3, name: "Gamma Trap", type: "Trap Card", race: "Normal" }),
    makeCard({
      id: 4,
      name: "Delta Spell",
      type: "Spell Card",
      race: "Normal",
      attribute: undefined,
      level: undefined,
      atk: undefined,
      def: undefined,
    }),
  ];

  it("returns the full pool when no filters or search are applied", () => {
    const result = selectFilteredCards(pool, "", {
      sort: "name",
      sortDirection: "asc",
    });
    expect(result).toHaveLength(4);
    expect(result.map((card) => card.name)).toEqual([
      "Alpha Dragon",
      "Beta Magician",
      "Delta Spell",
      "Gamma Trap",
    ]);
  });

  it("matches any selected type when multi-select values are comma-joined", () => {
    const result = selectFilteredCards(pool, "", {
      type: "Effect Monster,Trap Card",
      sort: "name",
      sortDirection: "asc",
    });
    expect(result.map((card) => card.name)).toEqual([
      "Alpha Dragon",
      "Gamma Trap",
    ]);
  });

  it("does not reuse an empty cached result after the pool loads", () => {
    const empty = selectFilteredCards([], "", {
      sort: "name",
      sortDirection: "asc",
    });
    expect(empty).toHaveLength(0);

    const loaded = selectFilteredCards(pool, "", {
      sort: "name",
      sortDirection: "asc",
    });
    expect(loaded).toHaveLength(4);
  });
});
