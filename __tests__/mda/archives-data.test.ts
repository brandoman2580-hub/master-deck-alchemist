import { countsLabel, editorialDeckCost, formatUsd, mostRecentlyUpdated, shareBlockers, tcgUnitPrice } from "@/app/deck-archives/archives-data";
import type { ClientDeck, DeckCard } from "@/types/deck";

function card(id: number, name: string, price = ""): DeckCard {
  return {
    id,
    deckInstanceId: `instance-${id}-${name}`,
    name,
    type: "Effect Monster",
    desc: "",
    race: "Spellcaster",
    attribute: "DARK",
    misc_info: [{ md_rarity: "UR" }],
    card_sets: {
      set_name: "",
      set_code: "",
      set_rarity: "",
      set_rarity_code: "",
      set_price: "",
    },
    card_images: [],
    card_prices: [
      {
        cardmarket_price: "",
        tcgplayer_price: price,
        ebay_price: "",
        amazon_price: "",
      },
    ],
  };
}

function deck(cards: DeckCard[]): ClientDeck {
  return {
    id: "deck-1",
    name: "Branded",
    mainDeck: cards,
    extraDeck: [],
    sideDeck: [],
    deckFormat: "Master Duel",
  };
}

describe("archives data helpers", () => {
  it("formats live deck counts and omits the side deck for Master Duel", () => {
    const masterDuel = deck([card(1, "Aluber")]);
    masterDuel.sideDeck = [card(2, "Called by the Grave")];
    expect(countsLabel(masterDuel)).toBe("MAIN 1 · EXTRA 0");
    expect(countsLabel({ ...masterDuel, deckFormat: "TCG" })).toBe("MAIN 1 · EXTRA 0 · SIDE 1");
  });

  it("reads a TCGplayer price and ignores a blank price", () => {
    expect(tcgUnitPrice(card(1, "Aluber", "4.5"))).toBe(4.5);
    expect(tcgUnitPrice(card(1, "Aluber"))).toBeNull();
    expect(formatUsd(4.5)).toBe("$4.50");
  });

  it("picks the newest dated deck and treats a missing timestamp as oldest", () => {
    const older = { ...deck([card(1, "Older")]), id: "older", updated_at: "2026-01-01T00:00:00.000Z" };
    const newer = { ...deck([card(2, "Newer")]), id: "newer", updated_at: "2026-10-01T00:00:00.000Z" };
    const undated = { ...deck([card(3, "Undated")]), id: "undated", updated_at: undefined };
    expect(mostRecentlyUpdated([older, undated, newer])?.id).toBe("newer");
    expect(mostRecentlyUpdated([])).toBeNull();
  });

  it("reports a fourth copy of the same card id", () => {
    const branded = card(1, "Branded Fusion");
    const issues = shareBlockers(
      deck([branded, { ...branded, deckInstanceId: "a" }, { ...branded, deckInstanceId: "b" }, { ...branded, deckInstanceId: "c" }]),
    );
    expect(issues).toContain("Branded: Branded Fusion, copy limit exceeded");
  });

  it("reports a card id the share validator would reject", () => {
    const broken = { ...card(1, "Missing Id"), id: 0 };
    expect(shareBlockers(deck([broken]))).toContain("Branded: a card is missing a valid id");
  });

  it("prices TCG copies and counts Master Duel craft points without the side deck", () => {
    const priced = card(1, "Aluber", "4.50");
    const tcg = {
      ...deck([priced, { ...priced, deckInstanceId: "copy-2" }]),
      deckFormat: "TCG" as const,
    };
    expect(editorialDeckCost(tcg)).toMatchObject({ format: "TCG", usd: 9, priced: 2, copies: 2 });

    const masterDuel = deck([card(1, "Aluber")]);
    masterDuel.extraDeck = [card(2, "Accesscode")];
    masterDuel.sideDeck = [card(3, "Called by the Grave"), card(4, "Ash")];
    const cost = editorialDeckCost(masterDuel);
    expect(cost).toMatchObject({ format: "Master Duel", totalCP: 60 });
  });

  it("allows three copies of one card", () => {
    const branded = card(1, "Branded Fusion");
    const issues = shareBlockers(
      deck([branded, { ...branded, deckInstanceId: "a" }, { ...branded, deckInstanceId: "b" }]),
    );
    expect(issues.some((issue) => issue.includes("copy limit"))).toBe(false);
  });
});
