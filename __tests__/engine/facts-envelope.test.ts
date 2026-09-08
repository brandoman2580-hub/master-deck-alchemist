import { FACTS_SCHEMA_VERSION } from "@/lib/engine/types";
import type { FactsEnvelope } from "@/lib/engine/types";

/**
 * Proves the Phase 0 FactsEnvelope shape is constructible with empty
 * projections so later phases can fill diagnostics/consistency without
 * breaking consumers that expect the full contract.
 */
function emptyFacts(overrides: Partial<FactsEnvelope> = {}): FactsEnvelope {
  return {
    schemaVersion: FACTS_SCHEMA_VERSION,
    deckId: "00000000-0000-0000-0000-000000000000",
    deckHash: "deadbeef",
    format: "MASTER_DUEL",
    legality: { ok: false, errors: ["Deck not validated"] },
    diagnostics: {
      collisions: [],
      roleCoverage: {
        starters: 0,
        extenders: 0,
        handTraps: 0,
        boardBreakers: 0,
        endboardPieces: 0,
        locks: 0,
      },
      strategyFit: {
        primaryArchetype: null,
        primaryStrategy: null,
        secondaryStrategy: null,
        fitScore: 0,
        notes: [],
      },
      bosses: [],
    },
    consistency: {
      n: 0,
      starterAccess: 0,
      brickRate: 0,
      oneInterruptionSurvival: 0,
    },
    matchups: [],
    combos: { lines: [], source: "empty" },
    grade: {
      consistency: 0,
      power: 0,
      resilience: 0,
      disruption: 0,
      letter: "F",
    },
    ...overrides,
  };
}

describe("FactsEnvelope contract", () => {
  it("exports a pinned schema version for cache compatibility checks", () => {
    expect(FACTS_SCHEMA_VERSION).toBe("0.1.0");
  });

  it("marks illegal decks as not ok while still returning a full envelope", () => {
    const facts = emptyFacts({
      legality: {
        ok: false,
        errors: ["Main deck must have at least 40 cards"],
      },
    });
    expect(facts.legality.ok).toBe(false);
    expect(facts.legality.errors).toContain(
      "Main deck must have at least 40 cards",
    );
    expect(facts.combos.source).toBe("empty");
    expect(facts.matchups).toEqual([]);
  });

  it("supports TCG format envelopes independently of Master Duel", () => {
    const facts = emptyFacts({ format: "TCG", legality: { ok: true, errors: [] } });
    expect(facts.format).toBe("TCG");
    expect(facts.legality.ok).toBe(true);
  });
});
