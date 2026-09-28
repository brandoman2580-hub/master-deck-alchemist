import {
  DeckAssistantRequestSchema,
  DeckCoachResponseSchema,
  EvidenceIds,
  IntentClassificationSchema,
  buildOutOfBoundsCoachResponse,
  evidenceHintsForQaFocus,
  parseDeckCoachResponse,
  parseIntentClassification,
} from "@/lib/engine/assistant-contract";
import {
  classifyIntentHeuristic,
  classifyOutOfBoundsHeuristic,
  resolveAssistantMode,
  resolveCardEntitiesFromNames,
} from "@/lib/engine/mode-router";
import {
  extractEngineConditions,
  scoreConditionFit,
  rankConditionsForQuestion,
  buildSynergyFitSummary,
  archetypeOverlapPenalty,
  synergyFamilyKey,
  diversifyByFamily,
  parseDiscoveryFilters,
  discoveryFilterBoost,
} from "@/lib/engine/engine-conditions";
import {
  consistencyDelta,
  scoreCopyVariant,
} from "@/lib/engine/tune-variants";
import {
  canAddCardUnderBanlist,
  maxCopiesForBanStatus,
} from "@/lib/engine/synergy-eligibility";

describe("Deck Assistant contracts", () => {
  it("parses a valid coach request with default mode auto", () => {
    const parsed = DeckAssistantRequestSchema.parse({
      deckId: "550e8400-e29b-41d4-a716-446655440000",
      question: "How should I play this going first?",
    });
    expect(parsed.mode).toBe("auto");
    expect(parsed.question.length).toBeGreaterThan(2);
  });

  it("rejects empty questions", () => {
    const result = DeckAssistantRequestSchema.safeParse({
      deckId: "550e8400-e29b-41d4-a716-446655440000",
      question: " ",
    });
    expect(result.success).toBe(false);
  });

  it("parses DeckCoachResponse with evidence IDs", () => {
    const raw = {
      mode: "qa",
      answer: "Open on your starters; watch Ash on the search.",
      confidence: "high",
      limitations: ["Not a full sim."],
      evidence: [
        {
          claim: "Starter access is strong",
          evidenceIds: [EvidenceIds.consistency],
        },
      ],
    };
    const coach = parseDeckCoachResponse(raw);
    expect(coach).not.toBeNull();
    expect(coach?.evidence[0]?.evidenceIds[0]).toBe("facts.consistency");
  });

  it("rejects coach responses without evidence", () => {
    const result = DeckCoachResponseSchema.safeParse({
      mode: "qa",
      answer: "Hello",
      confidence: "low",
      limitations: [],
      evidence: [],
    });
    expect(result.success).toBe(false);
  });

  it("parses IntentClassification JSON from classifier", () => {
    const intent = parseIntentClassification({
      inferred_mode: "tune_copies",
      target_card_entities: ["Ash Blossom & Joyous Spring"],
      optimization_target: "brick_rate",
      is_out_of_bounds: false,
      oob_reason: null,
      confidence: "high",
    });
    expect(intent?.inferred_mode).toBe("tune_copies");
    expect(intent?.target_card_entities).toHaveLength(1);
  });

  it("rejects invalid IntentClassification modes", () => {
    const result = IntentClassificationSchema.safeParse({
      inferred_mode: "auto",
      is_out_of_bounds: false,
      confidence: "high",
    });
    expect(result.success).toBe(false);
  });

  it("builds OOB coach responses with coach.scope evidence", () => {
    const coach = buildOutOfBoundsCoachResponse({
      oob_reason: "meta_tier",
      confidence: "high",
    });
    expect(coach.redirectHint).toBe("meta_panel");
    expect(coach.evidence[0]?.evidenceIds).toContain(EvidenceIds.coachScope);
    expect(coach.confidence).toBe("low");
  });

  it("maps qa_focus to preferred evidence IDs", () => {
    expect(evidenceHintsForQaFocus("consistency")).toContain(
      EvidenceIds.consistency,
    );
    expect(evidenceHintsForQaFocus("construction")).toContain(
      EvidenceIds.collisions,
    );
  });
});

describe("resolveAssistantMode + Gemini taxonomy heuristics", () => {
  it("honors explicit tune_copies over question text", () => {
    expect(
      resolveAssistantMode("tune_copies", "how should I play this combo"),
    ).toBe("tune_copies");
  });

  it("routes ratio language to tune_copies in auto", () => {
    expect(
      resolveAssistantMode("auto", "What ratios should I run for consistency?"),
    ).toBe("tune_copies");
  });

  it("routes Lair / tribute synergy language to discover_synergy", () => {
    expect(
      resolveAssistantMode(
        "auto",
        "What hidden synergies work with Lair of Darkness?",
      ),
    ).toBe("discover_synergy");
  });

  it("routes how-to-play questions to qa", () => {
    expect(
      resolveAssistantMode("auto", "How should I play this going first?"),
    ).toBe("qa");
  });

  it("routes brick diagnostics to qa (not tune)", () => {
    expect(
      resolveAssistantMode("auto", "Why is my deck bricking so much lately?"),
    ).toBe("qa");
    const intent = classifyIntentHeuristic(
      "Why is my deck bricking so much lately?",
    );
    expect(intent.inferred_mode).toBe("qa");
    expect(intent.qa_focus).toBe("consistency");
    expect(intent.is_out_of_bounds).toBe(false);
  });

  it("routes brick+max-out copy change to tune_copies", () => {
    expect(
      resolveAssistantMode(
        "auto",
        "What happens to my brick rate if I max out on Ash Blossom?",
      ),
    ).toBe("tune_copies");
  });

  it("prefers NLP classification over heuristics when provided", () => {
    expect(
      resolveAssistantMode("auto", "random text without keywords", {
        inferred_mode: "discover_synergy",
        target_card_entities: [],
        is_out_of_bounds: false,
        oob_reason: null,
        confidence: "high",
      }),
    ).toBe("discover_synergy");
  });

  it("routes DARK fiend searcher asks to discover_synergy", () => {
    expect(
      resolveAssistantMode("auto", "Show me DARK fiend searcher cards"),
    ).toBe("discover_synergy");
  });

  it("does not let a qa classifier demote card-discovery asks", () => {
    expect(
      resolveAssistantMode("auto", "Show me DARK fiend searcher cards", {
        inferred_mode: "qa",
        qa_focus: "play_line",
        target_card_entities: [],
        is_out_of_bounds: false,
        oob_reason: null,
        confidence: "medium",
      }),
    ).toBe("discover_synergy");
  });

  it("routes generic Level/Rank asks to discover_synergy", () => {
    expect(
      resolveAssistantMode(
        "auto",
        "What are some generic Level 4 monsters that can special summon themselves?",
      ),
    ).toBe("discover_synergy");
  });

  it("flags freeform build / meta / rules / screenshot as OOB", () => {
    expect(
      classifyOutOfBoundsHeuristic(
        "How do I build a competitive Snake-Eye deck from scratch?",
      ).reason,
    ).toBe("freeform_build");
    expect(
      classifyOutOfBoundsHeuristic(
        "What is the absolute best deck in the TCG format right now?",
      ).reason,
    ).toBe("meta_tier");
    expect(
      classifyOutOfBoundsHeuristic(
        "If I activate this card, can my opponent chain their trap during the Damage Step?",
      ).reason,
    ).toBe("rules_judge");
    expect(
      classifyOutOfBoundsHeuristic(
        "Look at this random card I screenshotted and tell me if it fits my deck.",
      ).reason,
    ).toBe("image_or_unsaved");
  });

  it("routes Lair→RDA bridge asks to optimize", () => {
    expect(
      resolveAssistantMode(
        "auto",
        "Convert this Lair of Darkness list into an RDA / Resonator bridge",
      ),
    ).toBe("optimize");
    expect(
      resolveAssistantMode("auto", "optimize my card copies for brick rate"),
    ).toBe("tune_copies");
  });

  it("refuses off-domain weather asks with fixed Strategist copy", () => {
    const oob = classifyOutOfBoundsHeuristic(
      "What's the weather supposed to be in my area today?",
    );
    expect(oob.isOutOfBounds).toBe(true);
    expect(oob.reason).toBe("off_domain");
    const coach = buildOutOfBoundsCoachResponse({
      oob_reason: "off_domain",
      confidence: "high",
    });
    expect(coach.answer).toBe(
      "I'm afraid I can't answer that because I am limited to information your deck and the card database",
    );
  });

  it("keeps deck and card-library asks in bounds", () => {
    expect(
      classifyOutOfBoundsHeuristic(
        "Show me DARK fiend searcher cards for this deck",
      ).isOutOfBounds,
    ).toBe(false);
    expect(
      classifyOutOfBoundsHeuristic(
        "How should I play this going first?",
      ).isOutOfBounds,
    ).toBe(false);
  });

  it("resolves card entity names against deck cards", () => {
    const ids = resolveCardEntitiesFromNames(
      ["Ash Blossom", "Not A Real Card"],
      [
        { id: 14558127, name: "Ash Blossom & Joyous Spring" },
        { id: 1, name: "Effect Veiler" },
      ],
    );
    expect(ids).toEqual(["14558127"]);
  });
});

describe("engine conditions (LoD-style mechanical synergy)", () => {
  const lod = {
    id: 8492961,
    name: "Lair of Darkness",
    desc:
      "All face-up monsters on the field become DARK. Once per turn, you can Tribute 1 DARK monster, then target 1 card on the field; destroy it. Your opponent takes any effect damage you would take.",
    archetype: null,
  };

  const resonator = {
    id: 13708425,
    name: "Red Resonator",
    desc: "When this card is Normal Summoned: You can Special Summon 1 Level 4 or lower monster from your hand.",
    archetype: "Resonator",
  };

  it("penalizes primary-archetype overlap for synergy ranking", () => {
    expect(archetypeOverlapPenalty(resonator, "Resonator")).toBe(0.55);
    expect(archetypeOverlapPenalty(resonator, "Branded")).toBe(0);
    expect(archetypeOverlapPenalty({ archetype: null }, "Resonator")).toBe(0);
  });

  const foolish = {
    id: 81439173,
    name: "Foolish Burial",
    desc: "Send 1 monster from your Deck to the GY.",
    archetype: null,
  };

  it("detects tribute_opponent condition when Lair of Darkness is present", () => {
    const conditions = extractEngineConditions([resonator, lod]);
    const tribute = conditions.find(
      (c) => c.slug === "tribute_opponent_for_cost",
    );
    expect(tribute).toBeDefined();
    expect(tribute?.satisfiedByDeck).toContain("Lair of Darkness");
    expect(tribute?.evidenceId).toBe("condition:tribute_opponent_for_cost");
  });

  it("does not invent LoD condition for Resonator-only lists", () => {
    const conditions = extractEngineConditions([resonator]);
    expect(
      conditions.find((c) => c.slug === "tribute_opponent_for_cost"),
    ).toBeUndefined();
  });

  it("scores tribute-opponent tech cards with condition fit", () => {
    const conditions = extractEngineConditions([lod]);
    const condition = conditions[0]!;
    const tech = {
      id: 1,
      name: "Enemy Controller",
      desc:
        "Tribute 1 monster, then target 1 face-up monster your opponent controls; take control of it until the End Phase.",
    };
    expect(scoreConditionFit(tech, condition)).toBeGreaterThan(0);
    expect(scoreConditionFit(resonator, condition)).toBe(0);
  });

  it("ranks Lair tribute questions onto tribute_opponent over mill", () => {
    const conditions = extractEngineConditions([lod, foolish]);
    expect(conditions.map((c) => c.slug)).toEqual(
      expect.arrayContaining([
        "tribute_opponent_for_cost",
        "send_from_deck_to_gy",
      ]),
    );
    const ranked = rankConditionsForQuestion(
      conditions,
      "What cards improve Lair of Darkness tribute effect?",
    );
    expect(ranked[0]?.slug).toBe("tribute_opponent_for_cost");
    expect(ranked.every((c) => c.slug !== "send_from_deck_to_gy")).toBe(true);
  });

  it("open-ended synergy asks keep multiple Lair conditions including dark payoffs", () => {
    const conditions = extractEngineConditions([lod, foolish]);
    const ranked = rankConditionsForQuestion(
      conditions,
      "What cards synergize with this deck?",
    );
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    expect(ranked.map((c) => c.slug)).toEqual(
      expect.arrayContaining([
        "tribute_opponent_for_cost",
        "dark_field_wide_payoff",
      ]),
    );
  });

  it("does not bake Enemy Controller into the tribute retrieval query", () => {
    const conditions = extractEngineConditions([lod]);
    const tribute = conditions.find(
      (c) => c.slug === "tribute_opponent_for_cost",
    );
    expect(tribute?.retrievalQuery.toLowerCase()).not.toContain(
      "enemy controller",
    );
  });

  it("soft-scores Lair DARK payoffs that do not say tribute opponent", () => {
    const conditions = extractEngineConditions([lod]);
    const dark = conditions.find((c) => c.slug === "dark_field_wide_payoff")!;
    const lilith = {
      id: 9,
      name: "Lilith, Lady of Lament",
      desc: "You can Tribute 1 DARK monster, then target 1 Normal Trap in your GY; Set that target.",
    };
    expect(scoreConditionFit(lilith, dark)).toBeGreaterThan(0);
  });

  it("diversifies Kaiju-family clones so other techs can surface", () => {
    const ranked = [
      { card: { id: 1, name: "Gameciel, the Sea Turtle Kaiju" } },
      { card: { id: 2, name: "Kumongous, the Sticky String Kaiju" } },
      { card: { id: 3, name: "Santa Claws" } },
      { card: { id: 4, name: "Lilith, Lady of Lament" } },
    ];
    expect(synergyFamilyKey(ranked[0]!.card)).toBe("family:kaiju");
    expect(synergyFamilyKey(ranked[1]!.card)).toBe("family:kaiju");
    const diverse = diversifyByFamily(ranked, 5);
    expect(diverse.map((d) => d.card.name)).toEqual([
      "Gameciel, the Sea Turtle Kaiju",
      "Santa Claws",
      "Lilith, Lady of Lament",
    ]);
  });

  it("parses DARK Fiend searcher discovery filters and boosts matches", () => {
    const filters = parseDiscoveryFilters("Show me DARK fiend searcher cards");
    expect(filters).toEqual({
      attributes: ["DARK"],
      races: ["Fiend"],
      wantsSearcher: true,
    });
    expect(
      discoveryFilterBoost(
        {
          name: "Tour Guide From the Underworld",
          attribute: "DARK",
          race: "Fiend",
          desc: "You can Special Summon 1 Level 3 Fiend from your hand or Deck.",
        },
        filters,
      ),
    ).toBeGreaterThanOrEqual(0.7);
    expect(
      discoveryFilterBoost(
        {
          name: "Random Warrior",
          attribute: "EARTH",
          race: "Warrior",
          desc: "A normal monster.",
        },
        filters,
      ),
    ).toBe(0);
  });

  it("builds unique fit summaries from card effect text", () => {
    const conditions = extractEngineConditions([lod]);
    const condition = conditions[0]!;
    const a = buildSynergyFitSummary(
      {
        name: "Kaiju",
        desc: "You can Special Summon this card from your hand to your opponent's field by Tributing 1 monster they control.",
      },
      condition,
    );
    const b = buildSynergyFitSummary(
      {
        name: "Santa Claws",
        desc: "You can Special Summon this card from your hand to your opponent's field in Defense Position by Tributing 1 monster they control.",
      },
      condition,
    );
    expect(a).not.toBe(b);
    expect(a).toContain("Lair of Darkness");
    expect(a).toContain("Tributing");
    expect(a).not.toBe(condition.genericCondition);
  });
});

describe("synergy eligibility (banlist + max copies)", () => {
  it("forbids Catapult Turtle / Cannon Soldier style Forbidden statuses", () => {
    expect(maxCopiesForBanStatus("Forbidden")).toBe(0);
    expect(
      canAddCardUnderBanlist({
        cardId: 1,
        cardName: "Catapult Turtle",
        copiesInDeck: 0,
        banlist: { "Catapult Turtle": "Forbidden" },
      }),
    ).toBe(false);
  });

  it("blocks cards already at max legal copies", () => {
    expect(
      canAddCardUnderBanlist({
        cardId: 14558127,
        cardName: "Ash Blossom & Joyous Spring",
        copiesInDeck: 3,
        banlist: {},
      }),
    ).toBe(false);
    expect(
      canAddCardUnderBanlist({
        cardId: 14558127,
        cardName: "Ash Blossom & Joyous Spring",
        copiesInDeck: 2,
        banlist: {},
      }),
    ).toBe(true);
    expect(
      canAddCardUnderBanlist({
        cardId: 2,
        cardName: "Called by the Grave",
        copiesInDeck: 1,
        banlist: { "Called by the Grave": "Limited" },
      }),
    ).toBe(false);
  });
});

describe("copy variant scoring", () => {
  it("prefers brick-rate improvements and cuts toward 40", () => {
    const baseline = {
      starterAccess: 0.7,
      brickRate: 0.22,
      oneInterruptionSurvival: 0.4,
    };
    const improved = {
      starterAccess: 0.74,
      brickRate: 0.18,
      oneInterruptionSurvival: 0.42,
    };
    const delta = consistencyDelta(baseline, improved);
    const cutScore = scoreCopyVariant({
      delta,
      fromCopies: 3,
      toCopies: 2,
      sizeBefore: 42,
      sizeAfter: 41,
    });
    const worseDelta = consistencyDelta(baseline, {
      starterAccess: 0.65,
      brickRate: 0.28,
      oneInterruptionSurvival: 0.35,
    });
    const worseScore = scoreCopyVariant({
      delta: worseDelta,
      fromCopies: 2,
      toCopies: 3,
      sizeBefore: 40,
      sizeAfter: 41,
    });
    expect(cutScore).toBeGreaterThan(worseScore);
  });
});
