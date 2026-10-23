import { deckRowTypeChips, masterDuelRarityLabel } from "@/lib/workshop/deck-row-meta";
import type { Card } from "@/types/card";

function card(partial: Partial<Card>): Card {
  return {
    id: 1,
    deckInstanceId: "a",
    name: "Ash Blossom & Joyous Spring",
    type: "Effect Monster",
    desc: "",
    race: "Zombie",
    misc_info: [{ md_rarity: "UR" }],
    card_sets: {
      set_name: "",
      set_code: "",
      set_rarity: "",
      set_rarity_code: "",
      set_price: "",
    },
    card_images: [],
    card_prices: [],
    ...partial,
  };
}

describe("deck row meta", () => {
  it("keeps short Master Duel rarity codes and maps long names", () => {
    expect(masterDuelRarityLabel(card({ misc_info: [{ md_rarity: "sr" }] }))).toBe("SR");
    expect(masterDuelRarityLabel(card({ misc_info: [{ md_rarity: "Ultra Rare" }] }))).toBe("UR");
    expect(masterDuelRarityLabel(card({ misc_info: [{ md_rarity: "" }] }))).toBeNull();
  });

  it("splits monster, spell, and extra-deck frames into separate chips", () => {
    expect(deckRowTypeChips(card({ type: "Tuner Effect Monster", race: "Zombie" }))).toEqual([
      "ZOMBIE",
      "TUNER",
      "EFFECT",
    ]);
    expect(deckRowTypeChips(card({ type: "Normal Spell", race: "Spell" }))).toEqual([
      "SPELL",
      "NORMAL",
    ]);
    expect(
      deckRowTypeChips(card({ type: "Fusion Effect Monster", race: "Wyrm" })),
    ).toEqual(["WYRM", "FUSION", "EFFECT"]);
  });
});
