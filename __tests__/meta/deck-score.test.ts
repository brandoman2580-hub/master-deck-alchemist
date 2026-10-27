import {
  DECK_SCORE_VERSION,
  GATE_WEIGHTS,
  chanceToOpenAtLeastOne,
  currentStoredDecks,
  letterFromComposite,
  scoreDeck,
} from "@/lib/meta/deck-score";

describe("deck score", () => {
  it("keeps format weights on one 100-point table", () => {
    for (const table of Object.values(GATE_WEIGHTS)) {
      const sum = Object.values(table).reduce((total, weight) => total + weight, 0);
      expect(sum).toBe(100);
    }
    expect(GATE_WEIGHTS["Master Duel"]).toEqual({
      consistency: 35,
      resilience: 15,
      interaction: 25,
      ceiling: 15,
      outing: 10,
    });
    expect(GATE_WEIGHTS.TCG).toEqual({
      consistency: 20,
      resilience: 25,
      interaction: 20,
      ceiling: 20,
      outing: 15,
    });
    expect(DECK_SCORE_VERSION).toBe(2);
  });

  it("scores interaction from the chance to open a named stop", () => {
    const cards = Array.from({ length: 3 }, () => ({
      name: "Ash Blossom & Joyous Spring",
      zone: "main" as const,
    }));
    cards.push({ name: "Maxx \"C\"", zone: "main" });
    const score = scoreDeck({
      format: "Master Duel",
      mainSize: 40,
      starterAccess: 0.85,
      oneInterruptionSurvival: 0.83,
      endboardPieces: 5,
      cards,
    });
    expect(score.consistency).toBe(85);
    expect(score.resilience).toBe(83);
    expect(score.interaction).toBe(Math.round(chanceToOpenAtLeastOne(40, 4) * 100));
    expect(score.ceiling).toBe(100);
    expect(score.ceilingMode).toBe("endboard");
    expect(score.letter).toBe(letterFromComposite(score.composite));
  });

  it("adds extra-deck generics to outing and prefers floodgates when they score higher", () => {
    const score = scoreDeck({
      format: "Master Duel",
      mainSize: 40,
      starterAccess: 0.5,
      oneInterruptionSurvival: 0.4,
      endboardPieces: 1,
      cards: [
        ...Array.from({ length: 9 }, () => ({
          name: "Skill Drain",
          zone: "main" as const,
        })),
        { name: "Super Starslayer TY-PHON - Sky Crisis", zone: "extra" },
        { name: "Ash Blossom & Joyous Spring", zone: "side" },
      ],
    });
    expect(score.ceilingMode).toBe("lock");
    expect(score.ceiling).toBe(Math.round(chanceToOpenAtLeastOne(40, 9) * 100));
    expect(score.outing).toBe(25);
    expect(score.interaction).toBe(0);
  });

  it("keeps Maxx \"C\" out of the TCG interaction count", () => {
    const score = scoreDeck({
      format: "TCG",
      mainSize: 40,
      starterAccess: 0.5,
      oneInterruptionSurvival: 0.4,
      endboardPieces: 0,
      cards: [{ name: "Maxx \"C\"", zone: "main" }],
    });
    expect(score.interaction).toBe(0);
    expect(score.ceiling).toBe(0);
  });

  it("hides stored rows from an older score version", () => {
    expect(
      currentStoredDecks({
        ceiling: { tier1: 1, tier2: null, tier3: null },
        floor: { tier1: 1, tier2: null, tier3: null },
        nonEngine: { tier1: 1, tier2: null, tier3: null },
        sampleIterations: 3000,
        listCounts: { 1: 1, 2: 0, 3: 0 },
        scoreVersion: 0,
        decks: [
          {
            name: "Elfnote",
            tier: 1,
            consistency: 1,
            resilience: 1,
            interaction: 1,
            ceiling: 1,
            outing: 1,
            composite: 1,
            ceilingMode: "endboard",
            letter: "F",
          },
        ],
      }),
    ).toEqual([]);
  });

  it("drops a stored row whose metrics are not finite numbers", () => {
    const kept = {
      name: "Elfnote",
      tier: 1 as const,
      consistency: 100,
      resilience: 100,
      interaction: 85,
      ceiling: 100,
      outing: 0,
      composite: 86,
      ceilingMode: "endboard" as const,
      letter: "A",
    };
    expect(
      currentStoredDecks({
        ceiling: { tier1: 1, tier2: null, tier3: null },
        floor: { tier1: 1, tier2: null, tier3: null },
        nonEngine: { tier1: 1, tier2: null, tier3: null },
        sampleIterations: 3000,
        listCounts: { 1: 2, 2: 0, 3: 0 },
        scoreVersion: DECK_SCORE_VERSION,
        decks: [kept, { ...kept, name: "Broken", outing: Number.NaN }],
      }).map((deck) => deck.name),
    ).toEqual(["Elfnote"]);
  });
});
