/**
 * Unit tests for rarity badge utilities
 */

import { getRarityBadge, getCardRarityForDisplay } from "@/lib/card/rarity";
import type { Card } from "@/types/card";

const createCard = (overrides: Partial<Card> = {}): Card =>
  ({
    id: 1,
    deckInstanceId: "",
    name: "Test",
    type: "Effect Monster",
    desc: "Test",
    race: "Spellcaster",
    misc_info: [{ md_rarity: "" }],
    card_sets: { set_name: "", set_code: "", set_rarity: "", set_rarity_code: "", set_price: "" },
    card_images: [],
    card_prices: [],
    ...overrides,
  }) as Card;

describe("rarityBadges", () => {
  describe("getRarityBadge", () => {
    it("returns null for empty or invalid rarity", () => {
      expect(getRarityBadge(undefined)).toBeNull();
      expect(getRarityBadge("")).toBeNull();
      expect(getRarityBadge(null)).toBeNull();
      expect(getRarityBadge("   ")).toBeNull();
    });

    it("returns N badge for Normal", () => {
      const result = getRarityBadge("Normal");
      expect(result).not.toBeNull();
      expect(result?.displayText).toBe("N");
      expect(result?.badgeClass).toContain("bg-gray");
    });

    it("returns R badge for Rare", () => {
      const result = getRarityBadge("Rare");
      expect(result?.displayText).toBe("R");
      expect(result?.badgeClass).toContain("bg-blue");
    });

    it("returns SR badge for Super Rare", () => {
      const result = getRarityBadge("Super Rare");
      expect(result?.displayText).toBe("SR");
    });

    it("returns UR badge for Ultra Rare", () => {
      const result = getRarityBadge("Ultra Rare");
      expect(result?.displayText).toBe("UR");
    });

    it("uses mdRarityOverride when provided", () => {
      const result = getRarityBadge("Rare", "UR");
      expect(result?.displayText).toBe("UR");
    });

    it("returns ScR for Secret Rare (TCG)", () => {
      const result = getRarityBadge("Secret Rare");
      expect(result?.displayText).toBe("ScR");
    });

    it("maps C/Common to N (Master Duel only has N, R, SR, UR)", () => {
      const result = getRarityBadge("Common");
      expect(result).not.toBeNull();
      expect(result?.displayText).toBe("N");
      expect(getRarityBadge("C")?.displayText).toBe("N");
    });

    it("returns null for U/Unknown (invalid Master Duel rarity)", () => {
      expect(getRarityBadge("U")).toBeNull();
      expect(getRarityBadge("Unknown")).toBeNull();
    });
  });

  describe("getCardRarityForDisplay", () => {
    it("returns Master Duel rarity from misc_info when format is Master Duel", () => {
      const card = createCard({ misc_info: [{ md_rarity: "UR" }] });
      expect(getCardRarityForDisplay(card, "Master Duel")).toBe("UR");
    });

    it("returns override when provided for Master Duel", () => {
      const card = createCard({ misc_info: [{ md_rarity: "UR" }] });
      expect(getCardRarityForDisplay(card, "Master Duel", "SR")).toBe("SR");
    });

    it("returns TCG rarity from card_sets when format is TCG", () => {
      const card = createCard({
        card_sets: { set_name: "Set", set_code: "X", set_rarity: "Super Rare", set_rarity_code: "", set_price: "" },
      } as Partial<Card>);
      expect(getCardRarityForDisplay(card, "TCG")).toBe("Super Rare");
    });

    it("handles card_sets as array for TCG", () => {
      const card = createCard({
        card_sets: [{ set_name: "Set", set_code: "X", set_rarity: "Ultra Rare", set_rarity_code: "", set_price: "" }] as any,
      } as Partial<Card>);
      expect(getCardRarityForDisplay(card, "TCG")).toBe("Ultra Rare");
    });
  });
});
