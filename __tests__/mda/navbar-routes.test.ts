import { PRIMARY_NAV_ITEMS } from "@/components/navbar";

/**
 * Deck Tester was removed in Facts Brain Phase 0. Matchups and Combos
 * live under Workshop — nav must not resurrect the legacy route.
 */
describe("PRIMARY_NAV_ITEMS", () => {
  it("includes Workshop and Deck Archives only", () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/workshop",
      "/deck-archives",
    ]);
  });

  it("does not expose the removed Deck Tester route", () => {
    const hrefs = PRIMARY_NAV_ITEMS.map((item) => item.href);
    expect(hrefs).not.toContain("/deck-tester");
    expect(
      PRIMARY_NAV_ITEMS.some((item) => item.name === "Deck Tester"),
    ).toBe(false);
  });
});
