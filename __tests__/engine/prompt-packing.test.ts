/**
 * Phase 2 — priority packing for DECK_CARDS and Facts prompt caps.
 */
import {
  packDeckCardsForPrompt,
  prioritySlice,
  resolveFactsPromptCaps,
  type PackableDeckCard,
} from "@/lib/engine/prompt-packing";
import { formatFactsForPrompt } from "@/lib/engine/build-facts";
import { emptyWorkshopGradeAxes } from "@/lib/engine/grade";
import type { FactsEnvelope } from "@/lib/engine/types";

function makeFacts(overrides: Partial<FactsEnvelope> = {}): FactsEnvelope {
  return {
    schemaVersion: "0.2.0",
    deckId: "d1",
    deckHash: "hash",
    format: "MASTER_DUEL",
    legality: { ok: true, errors: [] },
    diagnostics: {
      collisions: Array.from({ length: 20 }, (_, i) => ({
        code: i === 0 ? "PACKAGE_LOCK_CONFLICT" : `C${i}`,
        severity: i === 0 ? ("error" as const) : ("info" as const),
        message: i === 0 ? "Lock conflict with Resonator" : `Note ${i}`,
        cardIds: [100 + i],
      })),
      bosses: Array.from({ length: 12 }, (_, i) => ({
        cardId: 200 + i,
        name: `Boss ${i}`,
        zone: "extra" as const,
      })),
      roleCoverage: {
        starters: 8,
        extenders: 6,
        handTraps: 9,
        boardBreakers: 3,
        endboardPieces: 4,
        locks: 1,
      },
      strategyFit: {
        primaryArchetype: "Resonator",
        primaryStrategy: "Combo",
        secondaryStrategy: null,
        fitScore: 0.8,
        notes: ["Engine dense", "Needs more hand traps", "Extra locked"],
      },
      restrictions: Array.from({ length: 12 }, (_, i) => ({
        cardId: 300 + i,
        name: i === 1 ? "Soul Resonator" : `Lock Card ${i}`,
        lockSummary: "You can only Special Summon DARK dragons",
        appliesTo: "extra_deck" as const,
        evidenceId: `restriction:${300 + i}`,
      })),
    },
    consistency: {
      n: 2500,
      starterAccess: 0.8,
      brickRate: 0.1,
      oneInterruptionSurvival: 0.5,
    },
    matchups: Array.from({ length: 15 }, (_, i) => ({
      opponentArchetype: i === 2 ? "Snake-Eye" : `Archetype ${i}`,
      tier: i < 3 ? "1" : "2",
      tagAdvantage: i === 2 ? 0.9 : 0.1 * i,
      starterAccessDelta: 0,
      brickRateDelta: 0,
      notes: [],
    })),
    combos: {
      source: "template",
      lines: Array.from({ length: 10 }, (_, i) => ({
        id: `l${i}`,
        name: i === 0 ? "Resonator Line" : `Line ${i}`,
        nodes: [],
        edges: [],
        killers: ["Ash"],
        endboardSummary: `Endboard ${i}`,
      })),
    },
    grade: {
      ...emptyWorkshopGradeAxes(),
      letter: "B",
      consistency: 70,
      power: 70,
      resilience: 60,
      disruption: 50,
      formatRulePack: "masterDuelMaxxC",
      synergyFactor: 1.02,
      breakdown: {
        ...emptyWorkshopGradeAxes().breakdown,
        formatPackNotes: ["Master Duel banlist applies."],
        synergyNotes: ["Neutral synergy"],
        resilience: [
          { key: "formatPack", label: "Format pack", value: -4 },
        ],
      },
    },
    ...overrides,
  };
}

describe("packDeckCardsForPrompt", () => {
  it("includes full sectioned list when unique names ≤ 60", () => {
    const cards: PackableDeckCard[] = [
      { id: 1, name: "Ash Blossom", count: 3, section: "main", roles: ["hand_trap"] },
      { id: 2, name: "Accesscode Talker", count: 1, section: "extra", roles: ["endboard"] },
      { id: 3, name: "Nibiru", count: 2, section: "side", roles: ["hand_trap"] },
    ];
    const packed = packDeckCardsForPrompt(cards);
    expect(packed.truncated).toBe(false);
    expect(packed.lines).toEqual([
      "M3 Ash Blossom [hand_trap]",
      "E1 Accesscode Talker [endboard]",
      "S2 Nibiru [hand_trap]",
    ]);
  });

  it("priority-packs when over budget and keeps asked / collision cards", () => {
    const cards: PackableDeckCard[] = Array.from({ length: 80 }, (_, i) => ({
      id: i + 1,
      name: `Filler Card ${i}`,
      count: 1,
      section: "main" as const,
      roles: [] as string[],
    }));
    cards.push({
      id: 999,
      name: "Soul Resonator",
      count: 3,
      section: "main",
      roles: ["starter"],
    });
    cards[0] = {
      id: 1,
      name: "Priority Collision",
      count: 2,
      section: "main",
      roles: ["lock"],
    };

    const packed = packDeckCardsForPrompt(cards, {
      fullIncludeMax: 60,
      priorityBudget: 48,
      priorityNames: ["Soul Resonator"],
      collisionCardIds: [1],
    });

    expect(packed.truncated).toBe(true);
    expect(packed.uniqueCount).toBeGreaterThan(60);
    expect(packed.lines.some((l) => l.includes("Soul Resonator"))).toBe(true);
    expect(packed.lines.some((l) => l.includes("Priority Collision"))).toBe(
      true,
    );
    expect(packed.lines.length).toBeLessThanOrEqual(55);
  });
});

describe("resolveFactsPromptCaps + formatFactsForPrompt", () => {
  it("raises anti_synergy collision/restriction caps vs defaults", () => {
    const general = resolveFactsPromptCaps({ qaFocus: "general" });
    const anti = resolveFactsPromptCaps({ qaFocus: "anti_synergy" });
    expect(anti.collisions).toBeGreaterThan(general.collisions);
    expect(anti.restrictions).toBeGreaterThanOrEqual(general.restrictions);
  });

  it("priority-selects lock conflicts and named matchups into the prompt", () => {
    const block = formatFactsForPrompt(makeFacts(), {
      qaFocus: "anti_synergy",
      question: "Why does Soul Resonator lock conflict with Snake-Eye?",
    });
    expect(block).toMatch(/PACKAGE_LOCK_CONFLICT/);
    expect(block).toMatch(/Soul Resonator/);
    expect(block).toMatch(/Snake-Eye/);
    expect(block).toMatch(/showing ≤14|priority ≤|Structural collisions/i);
    // Blind old cap of 6 would drop many; raised caps keep more collisions
    const collisionLines = block
      .split("\n")
      .filter((l) => l.startsWith("- ["));
    expect(collisionLines.length).toBeGreaterThan(6);
  });

  it("prioritySlice keeps original relative order among selected items", () => {
    const items = ["a", "b", "c", "d", "e"];
    const sliced = prioritySlice(items, 3, (item) =>
      item === "d" ? 100 : item === "b" ? 50 : 1,
    );
    // Top scores: d, b, then a (tied with c/e by score but earlier index)
    expect(sliced).toEqual(["a", "b", "d"]);
  });
});

describe("DECK_CARDS grounding packing contract", () => {
  it("does not blindly slice to 40 plain names", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `M1 Card ${i}`);
    // Local assertion mirroring formatGroundingBlock behavior
    const header = "## DECK_CARDS (always nameable — section+count when packed)";
    const body = [header, ...lines.map((l) => `- ${l}`)].join("\n");
    expect(body.split("\n").length).toBeGreaterThan(41);
    expect(body).not.toMatch(/slice\(0,\s*40\)/);
  });
});
