import {
  DECK_CAP_HARD,
  DECK_CAP_SOFT,
  deckCapExceededMessage,
  getDeckCapStatus,
  wouldExceedDeckHardCap,
} from "@/lib/deck/deck-caps";

describe("deck caps", () => {
  it("reports soft exceeded at 60 and hard at 75", () => {
    expect(getDeckCapStatus(59).softExceeded).toBe(false);
    expect(getDeckCapStatus(DECK_CAP_SOFT).softExceeded).toBe(true);
    expect(getDeckCapStatus(DECK_CAP_SOFT).hardExceeded).toBe(false);
    expect(getDeckCapStatus(DECK_CAP_HARD).hardExceeded).toBe(true);
    expect(getDeckCapStatus(DECK_CAP_HARD).remainingUntilHard).toBe(0);
  });

  it("only blocks new deck ids at the hard cap", () => {
    expect(wouldExceedDeckHardCap(74, true)).toBe(false);
    expect(wouldExceedDeckHardCap(75, true)).toBe(true);
    expect(wouldExceedDeckHardCap(100, false)).toBe(false);
  });

  it("formats a clear hard-cap message", () => {
    expect(deckCapExceededMessage(75)).toContain("75");
    expect(deckCapExceededMessage(75)).toMatch(/Archives/i);
  });
});
