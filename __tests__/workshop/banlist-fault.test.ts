import { deckHasBanlistFault } from "@/lib/workshop/banlist-fault";

const empty = { mainDeck: [], extraDeck: [], sideDeck: [] };

describe("deckHasBanlistFault", () => {
  it("stays quiet while the banlist is empty or still loading", () => {
    const deck = {
      deckFormat: "TCG" as const,
      ...empty,
      mainDeck: [{ id: 1, name: "Pot of Greed" }],
    };
    expect(deckHasBanlistFault(deck, {})).toBe(false);
    expect(deckHasBanlistFault(deck, { "Pot of Greed": undefined })).toBe(false);
  });

  it("flags a copy over the allowed count and ignores unlimited cards", () => {
    const deck = {
      deckFormat: "TCG" as const,
      mainDeck: [
        { id: 1, name: "Called by the Grave" },
        { id: 1, name: "Called by the Grave" },
        { id: 2, name: "Ash Blossom & Joyous Spring" },
      ],
      extraDeck: [],
      sideDeck: [],
    };
    expect(deckHasBanlistFault(deck, { "Called by the Grave": "Limited" })).toBe(true);
    expect(deckHasBanlistFault(deck, { "Ash Blossom & Joyous Spring": "Unlimited" })).toBe(false);
  });

  it("counts the side deck in TCG and ignores it in Master Duel", () => {
    const sideOnly = {
      mainDeck: [],
      extraDeck: [],
      sideDeck: [{ id: 3, name: "Pot of Greed" }],
    };
    const banlist = { "Pot of Greed": "Forbidden" as const };
    expect(deckHasBanlistFault({ deckFormat: "TCG", ...sideOnly }, banlist)).toBe(true);
    expect(deckHasBanlistFault({ deckFormat: "Master Duel", ...sideOnly }, banlist)).toBe(false);
  });
});
