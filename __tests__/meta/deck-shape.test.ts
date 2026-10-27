import {
  FORMAT_EMPHASIS,
  buildDeckShapeLines,
  closestComparison,
  countNamedCopies,
  namedCopyCatalogs,
} from "@/lib/meta/deck-shape";
import type { FactsEnvelope } from "@/lib/engine";
import { FACTS_SCHEMA_VERSION, emptyWorkshopGradeAxes } from "@/lib/engine";
import type { MetaListRef } from "@/lib/meta/matchup-plan";

function facts(endboard: number): FactsEnvelope {
  return {
    schemaVersion: FACTS_SCHEMA_VERSION,
    deckId: "11111111-1111-1111-1111-111111111111",
    deckHash: "abcd",
    format: "MASTER_DUEL",
    legality: { ok: true, errors: [] },
    diagnostics: {
      collisions: [],
      roleCoverage: {
        starters: 8,
        extenders: 4,
        handTraps: 40,
        boardBreakers: 14,
        endboardPieces: endboard,
        locks: 0,
      },
      strategyFit: {
        primaryArchetype: "Test",
        primaryStrategy: "Combo",
        secondaryStrategy: null,
        fitScore: 1,
        notes: [],
      },
      bosses: [],
      restrictions: [],
    },
    consistency: {
      n: 3000,
      starterAccess: 0.85,
      brickRate: 0.06,
      oneInterruptionSurvival: 0.83,
    },
    matchups: [],
    combos: { lines: [], source: "empty" },
    grade: emptyWorkshopGradeAxes(),
  };
}

const lists: MetaListRef[] = [
  {
    name: "Elfnote",
    tier: 1,
    cards: [
      { name: "Ash Blossom & Joyous Spring", copies: 3, zone: "main" },
      { name: "Forbidden Droplet", copies: 1, zone: "main" },
      { name: "Maxx \"C\"", copies: 2, zone: "main" },
    ],
  },
  {
    name: "Invoked",
    tier: 2,
    cards: [
      { name: "Ash Blossom & Joyous Spring", copies: 1, zone: "main" },
      { name: "Effect Veiler", copies: 1, zone: "main" },
    ],
  },
];

describe("deck shape", () => {
  it("keeps format weights as one table that sums to 100", () => {
    for (const table of Object.values(FORMAT_EMPHASIS)) {
      const sum = Object.values(table).reduce((total, weight) => total + weight, 0);
      expect(sum).toBe(100);
    }
    expect(closestComparison("Master Duel")).toBe("open");
    expect(closestComparison("TCG")).toBe("afterStop");
  });

  it("counts stops and board clears by name and leaves draw cards out", () => {
    const catalogs = namedCopyCatalogs();
    const cards = [
      { name: "Ash Blossom & Joyous Spring", zone: "main" as const },
      { name: "Ash Blossom & Joyous Spring", zone: "main" as const },
      { name: "Maxx \"C\"", zone: "main" as const },
      { name: "Mulcharmy Fuwalos", zone: "main" as const },
      { name: "Forbidden Droplet", zone: "main" as const },
      { name: "Super Starslayer TY-PHON - Sky Crisis", zone: "extra" as const },
      { name: "Ash Blossom & Joyous Spring", zone: "side" as const },
    ];

    expect(countNamedCopies(cards, catalogs.stop, "Master Duel")).toBe(2);
    expect(countNamedCopies(cards, catalogs.stop, "TCG")).toBe(3);
    expect(countNamedCopies(cards, catalogs.clear, "Master Duel")).toBe(2);
    expect(catalogs.stop.has("maxx \"c\"")).toBe(false);
  });

  it("does not add floodgates onto an end board, and does not blend a total", () => {
    const lines = buildDeckShapeLines({
      facts: facts(2),
      lists,
      bands: {
        ceiling: { tier1: 8, tier2: 4, tier3: 2 },
        floor: { tier1: 0.9, tier2: 0.7, tier3: 0.5 },
        nonEngine: { tier1: 54, tier2: 20, tier3: 10 },
        openPlay: { tier1: 0.8, tier2: 0.7, tier3: 0.6 },
        sampleIterations: 3000,
        listCounts: { 1: 1, 2: 1, 3: 0 },
      },
      userCards: [
        { name: "Skill Drain", zone: "main" },
        { name: "Skill Drain", zone: "main" },
        { name: "There Can Be Only One", zone: "main" },
        { name: "Ash Blossom & Joyous Spring", zone: "side" },
      ],
      format: "Master Duel",
    });

    expect(lines.map((line) => line.id)).toEqual([
      "open",
      "afterStop",
      "stop",
      "clear",
      "pressure",
    ]);
    expect(lines.find((line) => line.id === "pressure")).toMatchObject({
      title: "This deck stops the opponent from playing",
      value: 3,
    });
    expect(lines.find((line) => line.id === "stop")).toMatchObject({
      value: 0,
      detail: expect.stringContaining("side deck"),
    });
    expect(lines.find((line) => line.id === "open")?.floors.tier1).toBe(0.8);
    expect(lines.find((line) => line.id === "stop")?.floors).toEqual({
      tier1: 3,
      tier2: 2,
      tier3: null,
    });
    expect(JSON.stringify(lines)).not.toMatch(/deck score/i);
  });

  it("uses the end-board count when floodgates do not outnumber it", () => {
    const lines = buildDeckShapeLines({
      facts: facts(5),
      lists: [],
      bands: null,
      userCards: [{ name: "Skill Drain", zone: "main" }],
      format: "Master Duel",
    });
    const pressure = lines.find((line) => line.id === "pressure");
    expect(pressure?.title).toBe("This deck ends on several cards");
    expect(pressure?.value).toBe(5);
    expect(pressure?.floors.tier1).toBeNull();
    expect(lines.find((line) => line.id === "open")?.value).toBe(0.85);
  });

  it("says when a tier-1 list plays none of a counted card", () => {
    const lines = buildDeckShapeLines({
      facts: facts(1),
      lists: [
        {
          name: "Elfnote",
          tier: 1,
          cards: [{ name: "Ash Blossom & Joyous Spring", copies: 3, zone: "main" }],
        },
      ],
      bands: null,
      userCards: [{ name: "Forbidden Droplet", zone: "main" }],
      format: "Master Duel",
    });
    expect(lines.find((line) => line.id === "clear")?.floors.tier1).toBe(0);
    expect(lines.find((line) => line.id === "clear")?.detail).toContain(
      "Tier 1 lists play none of these, so the floor is zero.",
    );
  });
});
