/**
 * Strategist Facts Brain — off-domain gate, optimize routing, grounding tools.
 * All Supabase/banlist interactions are mocked fixtures (no live network).
 */
import {
  buildOutOfBoundsCoachResponse,
  OFF_DOMAIN_REFUSAL_MESSAGE,
  parseDeckCoachResponse,
} from "@/lib/engine/assistant-contract";
import {
  classifyIntentHeuristic,
  classifyOutOfBoundsHeuristic,
  isDeckOrCardDomainRelevant,
  resolveAssistantMode,
} from "@/lib/engine/mode-router";
import {
  banStatusAgainstMap,
  verifyCardNamesAgainstLibrary,
} from "@/lib/engine/verify-cards";

describe("Strategist domain gate (Phase C)", () => {
  it("weather / off-domain → OFF_DOMAIN_REFUSAL_MESSAGE via heuristic + builder", () => {
    const oob = classifyOutOfBoundsHeuristic("What's the weather today?");
    expect(oob.isOutOfBounds).toBe(true);
    expect(oob.reason).toBe("off_domain");

    const coach = buildOutOfBoundsCoachResponse({
      oob_reason: "off_domain",
      confidence: "high",
    });
    expect(coach.answer).toBe(OFF_DOMAIN_REFUSAL_MESSAGE);
    expect(coach.evidence[0]?.evidenceIds).toContain("coach.scope");
  });

  it("domain-relevant deck asks are NOT out of bounds", () => {
    const asks = [
      "Why is my deck bricking?",
      "Show me DARK Fiend searchers for this list",
      "Convert Lair into RDA",
      "What should I pitch from my Resonator package?",
    ];
    for (const q of asks) {
      expect(isDeckOrCardDomainRelevant(q)).toBe(true);
      expect(classifyOutOfBoundsHeuristic(q).isOutOfBounds).toBe(false);
    }
  });
});

describe("optimize mode routing (Phase B)", () => {
  it("routes bridge/rework/optimize-deck asks to optimize", () => {
    expect(resolveAssistantMode("auto", "convert Lair into RDA")).toBe(
      "optimize",
    );
    expect(
      resolveAssistantMode("auto", "Optimize this deck for going second"),
    ).toBe("optimize");
    expect(resolveAssistantMode("auto", "rework this deck toward Resonator")).toBe(
      "optimize",
    );
    expect(classifyIntentHeuristic("convert Lair into RDA").inferred_mode).toBe(
      "optimize",
    );
  });

  it("keeps ratio-only optimize language on tune_copies", () => {
    expect(
      resolveAssistantMode("auto", "optimize my card copies for brick rate"),
    ).toBe("tune_copies");
  });
});

describe("grounding tools fixtures (Lair→RDA eval stubs)", () => {
  const library = [
    { id: 8492961, name: "Lair of Darkness" },
    { id: 13708425, name: "Red Resonator" },
    { id: 70902743, name: "Red Dragon Archfiend" },
    { id: 14558127, name: "Ash Blossom & Joyous Spring" },
  ];

  const banlistFixture: Record<string, string> = {
    "Maxx \"C\"": "Forbidden",
    "Dimension Shifter": "Limited",
    "Called by the Grave": "Semi-Limited",
    // Calamity-style forbidden ED piece when listed
    "Hot Red Dragon Archfiend King Calamity": "Forbidden",
  };

  it("verifyCardNamesAgainstLibrary rejects invented names", () => {
    const result = verifyCardNamesAgainstLibrary(
      [
        "Lair of Darkness",
        "Mystic Tomahawk Ultra Neo",
        "Fake Resonator Deluxe",
        "Red Resonator",
      ],
      library,
    );
    expect(result.found.map((c) => c.name)).toEqual([
      "Lair of Darkness",
      "Red Resonator",
    ]);
    expect(result.notFound).toEqual([
      "Mystic Tomahawk Ultra Neo",
      "Fake Resonator Deluxe",
    ]);
  });

  it("banStatusAgainstMap marks Calamity forbidden when fixture lists it", () => {
    const statuses = banStatusAgainstMap(
      [
        { id: 1, name: "Hot Red Dragon Archfiend King Calamity" },
        { id: 14558127, name: "Ash Blossom & Joyous Spring" },
        { id: null, name: "Mystic Tomahawk Ultra Neo" },
      ],
      banlistFixture,
    );
    const calamity = statuses.find((s) =>
      s.name.includes("Calamity")
    );
    expect(calamity?.status).toBe("forbidden");
    expect(calamity?.maxCopies).toBe(0);

    const ash = statuses.find((s) => s.name.includes("Ash"));
    expect(ash?.status).toBe("unlimited");
    expect(ash?.maxCopies).toBe(3);
  });

  it("DeckCoachResponse schema accepts optimize + optional recommendation cards", () => {
    const parsed = parseDeckCoachResponse({
      mode: "optimize",
      answer: "Cut fat Resonators, bridge with verified techs, respect banlist.",
      confidence: "medium",
      limitations: ["Sim + retrieval compose — not a full rebuild."],
      evidence: [
        {
          claim: "Opening consistency from your saved list",
          evidenceIds: ["facts.consistency"],
        },
      ],
      recommendations: [
        {
          cardId: "13708425",
          title: "Red Resonator",
          roleTag: "Extender",
          effectLines: ["When Normal Summoned: Special Summon 1 Level 4 or lower."],
        },
      ],
    });
    expect(parsed?.mode).toBe("optimize");
    expect(parsed?.recommendations?.[0]?.title).toBe("Red Resonator");
  });
});
