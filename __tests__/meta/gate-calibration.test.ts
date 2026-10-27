import { DECK_SCORE_VERSION } from "@/lib/meta/deck-score";
import { banlistFingerprint } from "@/lib/meta/banlist-fingerprint";
import {
  bandsFromScoredLists,
  markAgainstTier1,
} from "@/lib/meta/gate-bands";
import { firstBanlistViolation, normalizeCardName } from "@/lib/meta/list-legality";
import { tierFromRepresentation } from "@/lib/meta/representation-tier";

describe("meta tier assignment", () => {
  it("keeps tiers 1, 2, and 3 and drops representation under 2%", () => {
    expect(tierFromRepresentation(16.39)).toBe(1);
    expect(tierFromRepresentation(10)).toBe(2);
    expect(tierFromRepresentation(7.38)).toBe(2);
    expect(tierFromRepresentation(5)).toBe(2);
    expect(tierFromRepresentation(4.92)).toBe(3);
    expect(tierFromRepresentation(2)).toBe(3);
    expect(tierFromRepresentation(1.9)).toBeNull();
  });
});

describe("banlist legality", () => {
  const banlist = {
    "Maxx C": "Limited",
    "Smoke Grenade of the Thief": "Forbidden",
    Ash: "Semi-Limited",
  };

  it("matches angled catalog names to the plain meta-list name", () => {
    expect(normalizeCardName("Maliss <P> Chessy Cat")).toBe(
      normalizeCardName("Maliss P Chessy Cat"),
    );
  });

  it("rejects a forbidden card and a limited card played twice", () => {
    expect(
      firstBanlistViolation(
        [
          ["Smoke Grenade of the Thief", 1],
          ["Maxx C", 1],
        ],
        banlist,
      ),
    ).toBe("Smoke Grenade of the Thief");
    expect(firstBanlistViolation([["maxx c", 2]], banlist)).toBe("maxx c");
    expect(firstBanlistViolation([["Ash", 2]], banlist)).toBeNull();
    expect(firstBanlistViolation([["Ash", 3]], banlist)).toBe("Ash");
  });

  it("changes the fingerprint when the live banlist changes", () => {
    const current = banlistFingerprint(banlist);
    const afterHit = banlistFingerprint({
      ...banlist,
      "Called by the Grave": "Limited",
    });
    expect(current).not.toBe(afterHit);
    expect(current.length).toBeGreaterThan(0);
  });
});

describe("gate marks", () => {
  const lists = [
    {
      tier: 1 as const,
      endboardPieces: 8,
      oneInterruptionSurvival: 0.7,
      starterAccess: 0.9,
      nonEngineCopies: 14,
    },
    {
      tier: 1 as const,
      endboardPieces: 6,
      oneInterruptionSurvival: 0.62,
      starterAccess: 0.8,
      nonEngineCopies: 12,
    },
    {
      tier: 2 as const,
      endboardPieces: 4,
      oneInterruptionSurvival: 0.5,
      starterAccess: 0.7,
      nonEngineCopies: 9,
    },
    {
      tier: 3 as const,
      endboardPieces: 3,
      oneInterruptionSurvival: 0.4,
      starterAccess: 0.6,
      nonEngineCopies: 8,
    },
  ];

  it("uses the tier-1 minimum as the ready line and still stores tier 2 and 3", () => {
    const bands = bandsFromScoredLists(lists, 3000);
    expect(bands.ceiling).toEqual({ tier1: 6, tier2: 4, tier3: 3 });
    expect(bands.openPlay).toEqual({ tier1: 0.8, tier2: 0.7, tier3: 0.6 });
    expect(bands.scoreVersion).toBe(DECK_SCORE_VERSION);
    expect(bands.decks).toEqual([]);
    expect(bands.nonEngine.tier2).toBe(9);
    expect(bands.listCounts).toEqual({ 1: 2, 2: 1, 3: 1 });
    expect(markAgainstTier1(6, bands.ceiling)).toBe("ready");
    expect(markAgainstTier1(5, bands.ceiling)).toBe("struggling");
  });

  it("stays unconfirmed when no tier-1 list scored the gate", () => {
    const bands = bandsFromScoredLists(
      lists.filter((list) => list.tier !== 1),
      3000,
    );
    expect(bands.ceiling.tier1).toBeNull();
    expect(bands.ceiling.tier2).toBe(4);
    expect(markAgainstTier1(12, bands.ceiling)).toBe("unconfirmed");
    expect(markAgainstTier1(null, bands.floor)).toBe("unconfirmed");
  });
});
