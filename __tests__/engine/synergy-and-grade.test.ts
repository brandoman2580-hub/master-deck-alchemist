import {
  computePrimaryArchetypeShare,
  computeSynergyModifier,
} from "@/lib/engine/synergy-modifier";
import { gradeFromFacts } from "@/lib/engine/grade";
import type { DiagnosticsBlock } from "@/lib/engine/types";

function baseDiagnostics(
  overrides: Partial<DiagnosticsBlock> = {},
): DiagnosticsBlock {
  return {
    collisions: [],
    roleCoverage: {
      starters: 9,
      extenders: 8,
      handTraps: 6,
      boardBreakers: 3,
      endboardPieces: 4,
      locks: 0,
    },
    strategyFit: {
      primaryArchetype: "Snake-Eye",
      primaryStrategy: "Combo",
      secondaryStrategy: null,
      fitScore: 80,
      notes: [],
    },
    bosses: [
      { cardId: 1, name: "Boss A", zone: "extra" },
      { cardId: 2, name: "Boss B", zone: "extra" },
    ],
    restrictions: [],
    ...overrides,
  };
}

describe("synergy modifier", () => {
  it("boosts factor for strong fit + template combos + healthy engine density", () => {
    const result = computeSynergyModifier({
      strategyFit: {
        primaryArchetype: "Snake-Eye",
        primaryStrategy: "Combo",
        secondaryStrategy: null,
        fitScore: 80,
        notes: [],
      },
      primaryArchetypeShare: 0.5,
      combos: {
        source: "template",
        lines: [
          {
            id: "1",
            name: "Line",
            nodes: [],
            edges: [],
            killers: [],
            endboardSummary: "x",
          },
        ],
      },
      collisions: [],
    });
    expect(result.factor).toBeGreaterThan(1);
    expect(result.factor).toBeLessThanOrEqual(1.15);
  });

  it("penalizes error collisions", () => {
    const result = computeSynergyModifier({
      strategyFit: {
        primaryArchetype: null,
        primaryStrategy: null,
        secondaryStrategy: null,
        fitScore: 50,
        notes: [],
      },
      primaryArchetypeShare: 0.4,
      combos: { lines: [], source: "empty" },
      collisions: [
        {
          code: "LOCK",
          severity: "error",
          message: "Package conflict",
        },
      ],
    });
    expect(result.factor).toBeLessThan(1);
  });

  it("computes primary archetype share from card metadata", () => {
    expect(
      computePrimaryArchetypeShare(
        [
          { archetype: "Snake-Eye" },
          { archetype: "Snake-Eye" },
          { archetype: "Fiendsmith" },
          { archetype: null },
        ],
        "Snake-Eye",
      ),
    ).toBe(0.5);
  });
});

describe("gradeFromFacts format divergence", () => {
  const consistency = {
    n: 1000,
    starterAccess: 0.75,
    brickRate: 0.2,
    oneInterruptionSurvival: 0.55,
  };

  it("scores MD lower Resilience when Maxx is legal and outs are zero", () => {
    const diagnostics = baseDiagnostics();
    const tcg = gradeFromFacts({
      consistency,
      diagnostics,
      format: "TCG",
      banlist: { 'Maxx "C"': "Forbidden" },
      mainDeckCardNames: [],
    });
    const md = gradeFromFacts({
      consistency,
      diagnostics,
      format: "MASTER_DUEL",
      banlist: { 'Maxx "C"': "Unlimited" },
      mainDeckCardNames: [],
    });
    expect(tcg.formatRulePack).toBe("tcgTournament");
    expect(md.formatRulePack).toBe("masterDuelMaxxC");
    expect(md.resilience).toBeLessThan(tcg.resilience);
    expect(md.breakdown.formatPackNotes.some((n) => /Maxx/i.test(n))).toBe(
      true,
    );
    expect(md.synergyFactor).toBeGreaterThan(0);
  });

  it("applies synergy only as Consistency/Power multiplier metadata", () => {
    const axes = gradeFromFacts({
      consistency,
      diagnostics: baseDiagnostics(),
      format: "TCG",
      combos: { lines: [], source: "empty" },
    });
    expect(axes.breakdown.synergyNotes.length).toBeGreaterThan(0);
    expect(axes.breakdown.consistency.some((c) => c.key === "synergyFactor")).toBe(
      true,
    );
    // Synergy is not a fifth chrome axis
    expect(Object.keys(axes)).not.toContain("synergy");
  });
});
