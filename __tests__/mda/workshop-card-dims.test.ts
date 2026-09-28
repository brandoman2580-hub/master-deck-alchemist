import {
  WORKSHOP_CARD_TILE,
  workshopCardTileHeightPx,
  workshopCardTileWidthPx,
} from "@/components/mda/workshop-card-dims";

describe("workshop-card-dims", () => {
  it("locks desktop tiles to 104px to match the deck builder", () => {
    expect(workshopCardTileWidthPx(1280)).toBe(104);
    expect(workshopCardTileHeightPx(104)).toBe(Math.round(104 * (86 / 59)));
    expect(WORKSHOP_CARD_TILE).toContain("sm:w-[104px]");
    expect(WORKSHOP_CARD_TILE).toContain("aspect-[59/86]");
  });

  it("clamps mobile tiles between 72px and 104px at 20vw", () => {
    expect(workshopCardTileWidthPx(400)).toBe(80);
    expect(workshopCardTileWidthPx(300)).toBe(72);
  });
});
