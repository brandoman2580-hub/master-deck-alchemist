/**
 * Unit tests for card pricing utilities
 */

import {
  getCardTCGPrices,
  getMasterDuelCPBreakdown,
  getTCGDeckTotals,
  getDeckCostSummary,
  normalizeRarity,
  getCardMdRarity,
  MASTER_DUEL_CP_PER_CARD,
} from "@/lib/card/pricing";
import type { Card } from "@/types/card";
import type { DeckType } from "@/types/deck";

const createCard = (overrides: Partial<Card> = {}): Card =>
  ({
    id: 1,
    deckInstanceId: "",
    name: "Test Card",
    type: "Effect Monster",
    desc: "Test",
    race: "Spellcaster",
    misc_info: [{ md_rarity: "" }],
    card_sets: { set_name: "", set_code: "", set_rarity: "", set_rarity_code: "", set_price: "" },
    card_images: [],
    card_prices: [],
    ...overrides,
  }) as Card;

describe("cardPricing", () => {
  describe("getCardTCGPrices", () => {
    it("returns empty when no prices", () => {
      expect(getCardTCGPrices(createCard())).toEqual({});
    });

    it("returns TCGPlayer when tcgplayer_price present", () => {
      const card = createCard({
        card_prices: [{ tcgplayer_price: "2.50", cardmarket_price: "0", ebay_price: "0", amazon_price: "0" }],
      });
      const result = getCardTCGPrices(card);
      expect(result.tcgplayer).toEqual({
        value: 2.5,
        label: "TCGPlayer",
        formatted: "$2.50",
      });
    });

    it("returns Cardmarket when cardmarket_price present", () => {
      const card = createCard({
        card_prices: [{ tcgplayer_price: "0", cardmarket_price: "1.80", ebay_price: "0", amazon_price: "0" }],
      });
      const result = getCardTCGPrices(card);
      expect(result.cardmarket).toEqual({
        value: 1.8,
        label: "Cardmarket",
        formatted: "€1.80",
      });
    });

    it("returns both when both present", () => {
      const card = createCard({
        card_prices: [{ tcgplayer_price: "2.50", cardmarket_price: "1.80", ebay_price: "0", amazon_price: "0" }],
      });
      const result = getCardTCGPrices(card);
      expect(result.tcgplayer?.formatted).toBe("$2.50");
      expect(result.cardmarket?.formatted).toBe("€1.80");
    });

    it("returns Amazon and eBay when present", () => {
      const card = createCard({
        card_prices: [
          {
            tcgplayer_price: "0",
            cardmarket_price: "0",
            amazon_price: "5.99",
            ebay_price: "4.50",
          },
        ],
      });
      const result = getCardTCGPrices(card);
      expect(result.amazon).toEqual({
        value: 5.99,
        label: "Amazon",
        formatted: "$5.99",
      });
      expect(result.ebay).toEqual({
        value: 4.5,
        label: "eBay",
        formatted: "$4.50",
      });
    });
  });

  describe("normalizeRarity", () => {
    it("maps N/NORMAL/C/Common to N", () => {
      expect(normalizeRarity("N")).toBe("N");
      expect(normalizeRarity("Normal")).toBe("N");
      expect(normalizeRarity("NORMAL")).toBe("N");
      expect(normalizeRarity("C")).toBe("N");
      expect(normalizeRarity("Common")).toBe("N");
      expect(normalizeRarity("COMMON")).toBe("N");
    });

    it("maps R/Rare to R", () => {
      expect(normalizeRarity("R")).toBe("R");
      expect(normalizeRarity("Rare")).toBe("R");
    });

    it("maps SR/Super Rare to SR", () => {
      expect(normalizeRarity("SR")).toBe("SR");
      expect(normalizeRarity("Super Rare")).toBe("SR");
    });

    it("maps UR/Ultra Rare to UR", () => {
      expect(normalizeRarity("UR")).toBe("UR");
      expect(normalizeRarity("Ultra Rare")).toBe("UR");
    });

    it("returns UNKNOWN for empty or invalid", () => {
      expect(normalizeRarity("")).toBe("UNKNOWN");
      expect(normalizeRarity(undefined)).toBe("UNKNOWN");
      expect(normalizeRarity(null)).toBe("UNKNOWN");
    });
  });

  describe("getCardMdRarity", () => {
    it("returns override when provided", () => {
      const card = createCard({ misc_info: [{ md_rarity: "UR" }] });
      expect(getCardMdRarity(card, "SR")).toBe("SR");
    });

    it("falls back to misc_info when no override", () => {
      const card = createCard({ misc_info: [{ md_rarity: "UR" }] });
      expect(getCardMdRarity(card)).toBe("UR");
    });

    it("returns undefined when empty", () => {
      expect(getCardMdRarity(createCard())).toBeUndefined();
    });
  });

  describe("getMasterDuelCPBreakdown", () => {
    it("uses 30 CP per card regardless of rarity", () => {
      const breakdown = getMasterDuelCPBreakdown([
        { card: createCard({ misc_info: [{ md_rarity: "UR" }] }), count: 2, mdRarity: undefined },
      ]);
      expect(breakdown.UR.count).toBe(2);
      expect(breakdown.UR.cp).toBe(2 * MASTER_DUEL_CP_PER_CARD);
      expect(breakdown.totalCP).toBe(60);
    });

    it("groups by rarity correctly", () => {
      const breakdown = getMasterDuelCPBreakdown([
        { card: createCard({ id: 1 }), count: 1, mdRarity: "UR" },
        { card: createCard({ id: 2 }), count: 2, mdRarity: "SR" },
        { card: createCard({ id: 3 }), count: 1, mdRarity: "N" },
      ]);
      expect(breakdown.UR.count).toBe(1);
      expect(breakdown.UR.cp).toBe(30);
      expect(breakdown.SR.count).toBe(2);
      expect(breakdown.SR.cp).toBe(60);
      expect(breakdown.N.count).toBe(1);
      expect(breakdown.N.cp).toBe(30);
      expect(breakdown.totalCards).toBe(4);
      expect(breakdown.totalCP).toBe(120);
    });
  });

  describe("getTCGDeckTotals", () => {
    it("sums TCGPlayer and Cardmarket by quantity", () => {
      const { totalTcgplayer, totalCardmarket } = getTCGDeckTotals([
        {
          card: createCard({
            card_prices: [{ tcgplayer_price: "1.00", cardmarket_price: "0.80", ebay_price: "0", amazon_price: "0" }],
          }),
          count: 3,
        },
      ]);
      expect(totalTcgplayer).toBe(3);
      expect(totalCardmarket).toBeCloseTo(2.4, 2);
    });

    it("sums Amazon and eBay when present", () => {
      const { totalAmazon, totalEbay } = getTCGDeckTotals([
        {
          card: createCard({
            card_prices: [
              { tcgplayer_price: "0", cardmarket_price: "0", amazon_price: "2.00", ebay_price: "1.50" },
            ],
          }),
          count: 2,
        },
      ]);
      expect(totalAmazon).toBe(4);
      expect(totalEbay).toBe(3);
    });
  });

  describe("getDeckCostSummary", () => {
    it("returns TCG summary with both sources", () => {
      const deck: DeckType = {
        id: "1",
        name: "Test",
        deckFormat: "TCG",
        mainDeck: [
          createCard({
            id: 1,
            card_prices: [{ tcgplayer_price: "1.00", cardmarket_price: "0.80", ebay_price: "0", amazon_price: "0" }],
          }),
        ],
        extraDeck: [],
        sideDeck: [],
      };
      const summary = getDeckCostSummary(deck, "TCG");
      expect(summary.format).toBe("TCG");
      expect(summary.tcg?.totalTcgplayer).toBe(1);
      expect(summary.tcg?.totalCardmarket).toBe(0.8);
    });

    it("includes main, extra, and side deck in totals", () => {
      const deck: DeckType = {
        id: "1",
        name: "Test",
        deckFormat: "Master Duel",
        mainDeck: [
          createCard({ id: 1, misc_info: [{ md_rarity: "N" }] }),
          createCard({ id: 2, misc_info: [{ md_rarity: "N" }] }),
        ],
        extraDeck: [
          createCard({ id: 3, misc_info: [{ md_rarity: "N" }] }),
        ],
        sideDeck: [
          createCard({ id: 4, misc_info: [{ md_rarity: "N" }] }),
        ],
      };
      const summary = getDeckCostSummary(deck, "Master Duel");
      expect(summary.masterDuel?.N.count).toBe(4);
      expect(summary.masterDuel?.N.cp).toBe(120);
      expect(summary.masterDuel?.totalCP).toBe(120);
    });

    it("returns Master Duel summary with per-rarity CP", () => {
      const deck: DeckType = {
        id: "1",
        name: "Test",
        deckFormat: "Master Duel",
        mainDeck: [
          createCard({ id: 1, misc_info: [{ md_rarity: "UR" }] }),
          createCard({ id: 2, misc_info: [{ md_rarity: "UR" }] }),
          createCard({ id: 3, misc_info: [{ md_rarity: "SR" }] }),
        ],
        extraDeck: [],
        sideDeck: [],
      };
      const summary = getDeckCostSummary(deck, "Master Duel");
      expect(summary.format).toBe("Master Duel");
      expect(summary.masterDuel?.UR.count).toBe(2);
      expect(summary.masterDuel?.UR.cp).toBe(60);
      expect(summary.masterDuel?.SR.count).toBe(1);
      expect(summary.masterDuel?.SR.cp).toBe(30);
      expect(summary.masterDuel?.totalCP).toBe(90);
    });
  });
});
