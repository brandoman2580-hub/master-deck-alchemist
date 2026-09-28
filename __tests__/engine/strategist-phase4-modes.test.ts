/**
 * Phase 4 — tune targeting, synergy ask boosts, bridge archetype resolution.
 * Pure fixtures only (no live Supabase / Groq).
 */
import {
  askIntentBoost,
  collectDeckArchetypes,
  extractTowardPhrases,
  rankConditionsForQuestion,
  resolveBridgeArchetypes,
  scoreCopyVariant,
  selectTuneCandidateIds,
  type EngineCondition,
} from "@/lib/engine";

function stubCondition(
  slug: string,
  satisfiedByDeck: string[] = [],
): EngineCondition {
  return {
    slug,
    label: slug,
    genericCondition: slug,
    retrievalQuery: slug,
    satisfiedByDeck,
    evidenceId: `condition.${slug}`,
  };
}

describe("tune_copies scoring (Main toward 40 + preferred entities)", () => {
  const neutralDelta = {
    starterAccess: 0.01,
    brickRate: -0.01,
    oneInterruptionSurvival: 0,
  };

  it("boosts cuts that shrink an oversized Main toward 40", () => {
    const cutScore = scoreCopyVariant({
      delta: neutralDelta,
      fromCopies: 3,
      toCopies: 2,
      sizeBefore: 45,
      sizeAfter: 44,
      isStarter: false,
    });
    const addScore = scoreCopyVariant({
      delta: neutralDelta,
      fromCopies: 2,
      toCopies: 3,
      sizeBefore: 45,
      sizeAfter: 46,
      isStarter: false,
    });
    expect(cutScore).toBeGreaterThan(addScore);
  });

  it("applies preferred-entity bonus so mentioned cards surface", () => {
    const preferred = scoreCopyVariant({
      delta: neutralDelta,
      fromCopies: 2,
      toCopies: 3,
      sizeBefore: 40,
      sizeAfter: 41,
      preferred: true,
    });
    const plain = scoreCopyVariant({
      delta: neutralDelta,
      fromCopies: 2,
      toCopies: 3,
      sizeBefore: 40,
      sizeAfter: 41,
      preferred: false,
    });
    expect(preferred - plain).toBeCloseTo(0.45, 5);
  });

  it("selectTuneCandidateIds puts preferCardIds first and expands cap", () => {
    const mainDeck = [
      { cardId: 1, count: 3 },
      { cardId: 2, count: 3 },
      { cardId: 99, count: 1 },
      { cardId: 3, count: 2 },
    ];
    const ordered = selectTuneCandidateIds({
      mainDeck,
      preferCardIds: ["99"],
      sizeBefore: 42,
      candidateCap: 3,
    });
    expect(ordered[0]).toBe(99);
    expect(ordered).toHaveLength(3);
  });
});

describe("discover_synergy askIntentBoost + condition ranking", () => {
  it("boosts board breakers on going-second asks", () => {
    const breaker = askIntentBoost(
      {
        name: "Lightning Storm",
        type: "Spell Card",
        desc: "Destroy all Attack Position monsters your opponent controls.",
      },
      "need board breakers for going second",
    );
    const vanilla = askIntentBoost(
      {
        name: "Blue Eyes White Dragon",
        type: "Normal Monster",
        desc: "This legendary dragon is a powerful engine of destruction.",
      },
      "need board breakers for going second",
    );
    expect(breaker).toBeGreaterThan(vanilla);
    expect(breaker).toBeGreaterThanOrEqual(0.4);
  });

  it("boosts hand-trap-shaped text on interaction asks", () => {
    const ash = askIntentBoost(
      {
        name: "Ash Blossom & Joyous Spring",
        type: "Tuner Monster",
        desc: "(Quick Effect): You can discard this card; negate the activation.",
      },
      "more hand trap interaction",
    );
    expect(ash).toBeGreaterThanOrEqual(0.4);
  });

  it("ranks going-second asks toward tribute / fusion / banish conditions", () => {
    const conditions = [
      stubCondition("send_from_deck_to_gy"),
      stubCondition("tribute_opponent_for_cost"),
      stubCondition("dark_field_wide_payoff"),
      stubCondition("fusion_material_steal"),
    ];
    const ranked = rankConditionsForQuestion(
      conditions,
      "going second board breaker package",
    );
    expect(ranked[0]?.slug).toMatch(
      /tribute_opponent_for_cost|fusion_material_steal/,
    );
  });
});

describe("optimize bridge archetype resolution", () => {
  it("extractTowardPhrases pulls convert/splash targets", () => {
    expect(extractTowardPhrases("convert Lair into RDA")).toEqual(
      expect.arrayContaining([expect.stringMatching(/RDA/i)]),
    );
    expect(extractTowardPhrases("rework this deck toward Fiendsmith")).toEqual(
      ["Fiendsmith"],
    );
  });

  it("resolves aliases + toward phrases against known templates", () => {
    const bridges = resolveBridgeArchetypes({
      question: "Convert this list into RDA / Resonator",
      deckArchetypes: ["Lair of Darkness"],
      knownTemplateArchetypes: ["Resonator", "Branded", "Snake-Eye"],
      max: 4,
    });
    expect(bridges).toContain("Resonator");
  });

  it("matches free-form toward phrases to template names", () => {
    const bridges = resolveBridgeArchetypes({
      question: "bridge into Yummy Cooky package",
      deckArchetypes: ["Labrynth"],
      knownTemplateArchetypes: ["Yummy", "Labrynth"],
      max: 4,
    });
    expect(bridges.some((b) => /yummy/i.test(b))).toBe(true);
  });

  it("collectDeckArchetypes ranks by frequency and pins primary first", () => {
    const ranked = collectDeckArchetypes(
      [
        { archetype: "Lair of Darkness" },
        { archetype: "Lair of Darkness" },
        { archetype: "Resonator" },
        { archetype: null },
      ],
      "Resonator",
    );
    expect(ranked[0]).toBe("Resonator");
    expect(ranked).toContain("Lair of Darkness");
  });

  it("splash without target offers secondary deck archetypes", () => {
    const bridges = resolveBridgeArchetypes({
      question: "What splash engine package should I add?",
      deckArchetypes: ["Lair of Darkness", "Resonator", "Bystial"],
      knownTemplateArchetypes: [],
      max: 4,
    });
    expect(bridges).toEqual(
      expect.arrayContaining(["Resonator"]),
    );
  });
});
