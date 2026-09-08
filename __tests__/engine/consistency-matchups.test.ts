import {
  classifyOpeningHand,
  fisherYatesShuffle,
  simulateConsistency,
  type TaggedMainCard,
} from "@/lib/engine/consistency";
import {
  readinessToDisplayWinRate,
  scoreMatchupReadiness,
} from "@/lib/engine/matchups";
import { gradeFromFacts } from "@/lib/engine/grade";
import { buildFactsEnvelope } from "@/lib/engine/build-facts";
import type { DiagnosticsBlock } from "@/lib/engine/types";

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deckOf(
  starters: number,
  extenders: number,
  fillers: number,
): TaggedMainCard[] {
  const cards: TaggedMainCard[] = [];
  for (let i = 0; i < starters; i += 1) {
    cards.push({
      id: 1000 + i,
      isStarter: true,
      isExtender: false,
      isHandTrap: false,
    });
  }
  for (let i = 0; i < extenders; i += 1) {
    cards.push({
      id: 2000 + i,
      isStarter: false,
      isExtender: true,
      isHandTrap: false,
    });
  }
  for (let i = 0; i < fillers; i += 1) {
    cards.push({
      id: 3000 + i,
      isStarter: false,
      isExtender: false,
      isHandTrap: false,
    });
  }
  return cards;
}

const emptyDiagnostics = (): DiagnosticsBlock => ({
  collisions: [],
  roleCoverage: {
    starters: 9,
    extenders: 6,
    handTraps: 9,
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
  bosses: [{ cardId: 1, name: "Boss", zone: "extra" }],
});

describe("fisherYatesShuffle + classifyOpeningHand", () => {
  it("preserves multiset length after shuffle", () => {
    const input = deckOf(3, 3, 4);
    const copy = input.slice();
    fisherYatesShuffle(copy, mulberry32(42));
    expect(copy).toHaveLength(input.length);
    expect(copy.map((c) => c.id).sort()).toEqual(
      input.map((c) => c.id).sort(),
    );
  });

  it("marks hands with no starter/extender as bricks", () => {
    const hand = deckOf(0, 0, 5);
    const outcome = classifyOpeningHand(hand);
    expect(outcome.hasStarter).toBe(false);
    expect(outcome.isBrick).toBe(true);
    expect(outcome.survivesOneInterruption).toBe(false);
  });

  it("marks starter+extender hands as one-interruption survivors", () => {
    const hand: TaggedMainCard[] = [
      { id: 1, isStarter: true, isExtender: false, isHandTrap: false },
      { id: 2, isStarter: false, isExtender: true, isHandTrap: false },
      { id: 3, isStarter: false, isExtender: false, isHandTrap: true },
      { id: 4, isStarter: false, isExtender: false, isHandTrap: false },
      { id: 5, isStarter: false, isExtender: false, isHandTrap: false },
    ];
    const outcome = classifyOpeningHand(hand);
    expect(outcome.hasStarter).toBe(true);
    expect(outcome.survivesOneInterruption).toBe(true);
  });
});

describe("simulateConsistency", () => {
  it("returns higher starter access for starter-dense decks than brick piles", () => {
    const good = simulateConsistency(deckOf(12, 8, 20), {
      iterations: 800,
      random: mulberry32(7),
    });
    const bad = simulateConsistency(deckOf(0, 0, 40), {
      iterations: 800,
      random: mulberry32(7),
    });
    expect(good.n).toBe(800);
    expect(good.starterAccess).toBeGreaterThan(bad.starterAccess);
    expect(bad.brickRate).toBeGreaterThan(good.brickRate);
  });
});

describe("scoreMatchupReadiness + grade", () => {
  it("scores combo metas with disruption notes when HT density is low", () => {
    const consistency = simulateConsistency(deckOf(10, 6, 24), {
      iterations: 500,
      random: mulberry32(1),
    });
    const diagnostics = emptyDiagnostics();
    diagnostics.roleCoverage.handTraps = 0;
    diagnostics.roleCoverage.boardBreakers = 0;

    const matchups = scoreMatchupReadiness({
      diagnostics,
      consistency,
      templates: [
        {
          name: "Tearlaments",
          opponentArchetype: "Tearlaments",
          tier: "1",
          metaShare: 12,
          strategy: "Combo",
        },
      ],
    });

    expect(matchups).toHaveLength(1);
    expect(matchups[0]!.notes.some((n) => /hand-trap/i.test(n))).toBe(true);
    expect(readinessToDisplayWinRate(matchups[0]!.tagAdvantage)).toBeGreaterThanOrEqual(
      28,
    );
    expect(readinessToDisplayWinRate(matchups[0]!.tagAdvantage)).toBeLessThanOrEqual(
      72,
    );
  });

  it("builds facts envelope grade from consistency + matchups", () => {
    const consistency = {
      n: 1000,
      starterAccess: 0.82,
      brickRate: 0.08,
      oneInterruptionSurvival: 0.55,
    };
    const diagnostics = emptyDiagnostics();
    const matchups = scoreMatchupReadiness({
      diagnostics,
      consistency,
      templates: [
        {
          name: "Labrynth",
          opponentArchetype: "Labrynth",
          tier: "2",
          metaShare: 6,
          strategy: "Control",
        },
      ],
    });

    const facts = buildFactsEnvelope(
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Test",
        mode: "Master Duel",
        updated_at: "2026-09-08T00:00:00.000Z",
        mainDeck: Array.from({ length: 40 }, (_, i) => ({
          id: 4000 + i,
          deckInstanceId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          name: `M${i}`,
          type: "Effect Monster",
          desc: "Add 1 card from your Deck to your hand.",
          race: "Warrior",
          misc_info: [{ md_rarity: "N" }],
          card_sets: {
            set_name: "x",
            set_code: "x",
            set_rarity: "x",
            set_rarity_code: "x",
            set_price: "0",
          },
          card_images: [],
          card_prices: [],
        })) as never,
        extraDeck: [],
        sideDeck: [],
      },
      { consistency, matchups },
    );

    expect(facts.consistency.n).toBe(1000);
    expect(facts.matchups).toHaveLength(1);
    expect(facts.grade.consistency).toBeGreaterThan(50);
    expect(["S", "A", "B", "C", "D", "F"]).toContain(facts.grade.letter);

    const axes = gradeFromFacts({
      consistency: facts.consistency,
      diagnostics: facts.diagnostics,
      matchups: facts.matchups,
    });
    expect(axes.letter).toBe(facts.grade.letter);
  });
});
