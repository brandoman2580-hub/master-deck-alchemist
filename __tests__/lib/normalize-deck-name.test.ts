import { normalizeDeckName } from "@/lib/deck/normalize-deck-name";

describe("normalizeDeckName", () => {
  it("trims and rejects blanks", () => {
    expect(normalizeDeckName("  Branded  ")).toBe("Branded");
    expect(normalizeDeckName("   ")).toBeNull();
    expect(normalizeDeckName("")).toBeNull();
  });

  it("caps length at 80", () => {
    const long = "x".repeat(100);
    expect(normalizeDeckName(long)?.length).toBe(80);
  });
});
