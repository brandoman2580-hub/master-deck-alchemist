/**
 * Deno unit tests for deck-assistant mode router + legality + intent.
 */
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildOutOfBoundsCoachResponse,
  parseIntentClassification,
} from "../assistant-contract.ts";
import {
  classifyIntentHeuristic,
  classifyOutOfBoundsHeuristic,
  resolveAssistantMode,
  resolveCardEntitiesFromNames,
} from "../mode-router.ts";
import { evaluateStructuralLegality } from "../get-facts-edge.ts";
import { extractEngineConditions } from "../engine-conditions.ts";
import {
  rankConditionsForQuestion,
  buildSynergyFitSummary,
} from "../engine-conditions.ts";
import type { Card, Deck } from "../types.ts";

Deno.test("resolveAssistantMode honors explicit modes", () => {
  assertEquals(
    resolveAssistantMode("discover_synergy", "tune my ratios please"),
    "discover_synergy",
  );
});

Deno.test("resolveAssistantMode auto routes ratio to tune_copies", () => {
  assertEquals(
    resolveAssistantMode("auto", "optimize my card copies for brick rate"),
    "tune_copies",
  );
});

Deno.test("brick diagnostics route to qa not tune", () => {
  assertEquals(
    resolveAssistantMode("auto", "Why is my deck bricking so much lately?"),
    "qa",
  );
  const intent = classifyIntentHeuristic(
    "Why is my deck bricking so much lately?",
  );
  assertEquals(intent.inferred_mode, "qa");
  assertEquals(intent.qa_focus, "consistency");
});

Deno.test("brick + max out routes to tune_copies", () => {
  assertEquals(
    resolveAssistantMode(
      "auto",
      "What happens to my brick rate if I max out on Ash Blossom?",
    ),
    "tune_copies",
  );
});

Deno.test("classification overrides heuristics for auto", () => {
  assertEquals(
    resolveAssistantMode("auto", "hello", {
      inferred_mode: "discover_synergy",
      target_card_entities: [],
      is_out_of_bounds: false,
      oob_reason: null,
      confidence: "high",
    }),
    "discover_synergy",
  );
});

Deno.test("OOB heuristics catch freeform and rules", () => {
  assertEquals(
    classifyOutOfBoundsHeuristic(
      "How do I build a competitive Snake-Eye deck from scratch?",
    ).reason,
    "freeform_build",
  );
  assertEquals(
    classifyOutOfBoundsHeuristic(
      "can my opponent chain during the Damage Step?",
    ).reason,
    "rules_judge",
  );
});

Deno.test("parseIntentClassification accepts classifier JSON", () => {
  const parsed = parseIntentClassification({
    inferred_mode: "qa",
    qa_focus: "resilience",
    target_card_entities: [],
    is_out_of_bounds: false,
    oob_reason: null,
    confidence: "medium",
  });
  assertEquals(parsed?.qa_focus, "resilience");
});

Deno.test("buildOutOfBoundsCoachResponse cites coach.scope", () => {
  const coach = buildOutOfBoundsCoachResponse({
    oob_reason: "freeform_build",
    confidence: "high",
  });
  assertEquals(coach.redirectHint, "save_deck");
  assertEquals(coach.evidence[0]?.evidenceIds[0], "coach.scope");
});

Deno.test("resolveCardEntitiesFromNames fuzzy-matches deck cards", () => {
  const ids = resolveCardEntitiesFromNames(["Ash Blossom"], [
    { id: 14558127, name: "Ash Blossom & Joyous Spring" },
  ]);
  assertEquals(ids, ["14558127"]);
});

Deno.test("evaluateStructuralLegality rejects tiny mains", () => {
  const deck: Deck = {
    mainDeck: [{ cardId: 1, count: 3 }],
    extraDeck: [],
    sideDeck: [],
  };
  const result = evaluateStructuralLegality(deck);
  assertEquals(result.ok, false);
  assertStringIncludes(result.errors[0]!, "at least 40");
});

Deno.test("extractEngineConditions finds Lair of Darkness", () => {
  const deck: Deck = {
    mainDeck: [
      { cardId: 1, count: 3 },
      { cardId: 2, count: 1 },
    ],
    extraDeck: [],
    sideDeck: [],
  };
  const cards: Card[] = [
    {
      id: 1,
      name: "Red Resonator",
      type: "Monster",
      desc: "When Normal Summoned: Special Summon 1 Level 4 or lower from hand.",
      archetype: "Resonator",
    },
    {
      id: 2,
      name: "Lair of Darkness",
      type: "Spell",
      desc: "All monsters become DARK. Tribute 1 DARK monster to destroy a card.",
      archetype: null,
    },
  ];
  const conditions = extractEngineConditions(deck, cards);
  assertEquals(
    conditions.some((c) => c.slug === "tribute_opponent_for_cost"),
    true,
  );
});

Deno.test("rankConditionsForQuestion prefers Lair tribute over mill", () => {
  const deck: Deck = {
    mainDeck: [
      { cardId: 2, count: 1 },
      { cardId: 3, count: 1 },
    ],
    extraDeck: [],
    sideDeck: [],
  };
  const cards: Card[] = [
    {
      id: 2,
      name: "Lair of Darkness",
      type: "Spell",
      desc: "Tribute 1 DARK monster your opponent controls to destroy a card.",
      archetype: null,
    },
    {
      id: 3,
      name: "Foolish Burial",
      type: "Spell",
      desc: "Send 1 monster from your Deck to the GY.",
      archetype: null,
    },
  ];
  const conditions = extractEngineConditions(deck, cards);
  const ranked = rankConditionsForQuestion(
    conditions,
    "Improve Lair of Darkness tribute usage",
  );
  assertEquals(ranked[0]?.slug, "tribute_opponent_for_cost");
  assertEquals(
    ranked.some((c) => c.slug === "send_from_deck_to_gy"),
    false,
  );
});

Deno.test("tribute retrieval query is not Enemy Controller biased", () => {
  const deck: Deck = {
    mainDeck: [{ cardId: 2, count: 1 }],
    extraDeck: [],
    sideDeck: [],
  };
  const cards: Card[] = [
    {
      id: 2,
      name: "Lair of Darkness",
      type: "Spell",
      desc: "All monsters become DARK. Tribute 1 DARK monster to destroy a card.",
      archetype: null,
    },
  ];
  const conditions = extractEngineConditions(deck, cards);
  const tribute = conditions.find((c) => c.slug === "tribute_opponent_for_cost");
  assertEquals(
    (tribute?.retrievalQuery ?? "").toLowerCase().includes("enemy controller"),
    false,
  );
});

Deno.test("buildSynergyFitSummary is card-specific", () => {
  const condition = {
    slug: "tribute_opponent_for_cost",
    label: "Tribute opponent monsters",
    genericCondition: "Shared generic blurb",
    retrievalQuery: "tribute",
    satisfiedByDeck: ["Lair of Darkness"],
    evidenceId: "condition:tribute_opponent_for_cost",
  };
  const a = buildSynergyFitSummary(
    { name: "A", desc: "Tribute a monster your opponent controls." },
    condition,
  );
  const b = buildSynergyFitSummary(
    { name: "B", desc: "Take control then Tribute opponent's monster." },
    condition,
  );
  assertEquals(a === b, false);
  assertEquals(a === condition.genericCondition, false);
});

Deno.test("buildTuningFromVariants and evidence allowlist", async () => {
  const { EvidenceIds } = await import("../assistant-contract.ts");
  const {
    buildTuningFromVariants,
    collectAllowedEvidenceIds,
    isTuningRowInVariants,
    sanitizeCoachEvidence,
  } = await import("../coach-guardrails.ts");

  const variants = [
    {
      cardId: "10",
      cardName: "Ash",
      fromCopies: 3,
      toCopies: 2,
      factsDelta: {
        starterAccess: 0.01,
        brickRate: -0.02,
        oneInterruptionSurvival: 0,
      },
      mainDeckSizeAfter: 41,
      evidenceId: EvidenceIds.variant(10, 3, 2),
      score: 1,
    },
  ];
  const tuning = buildTuningFromVariants(variants);
  assertEquals(tuning.recommendation.length, 1);
  assertEquals(
    isTuningRowInVariants(tuning.recommendation[0]!, variants),
    true,
  );
  assertEquals(
    /Δstarter|Validated Δ/.test(tuning.recommendation[0]!.changeReason),
    false,
  );

  const facts = {
    schemaVersion: "0.1.0",
    deckId: "d",
    deckHash: "h",
    format: "MASTER_DUEL" as const,
    computedAt: new Date().toISOString(),
    legality: { ok: true, errors: [] },
    diagnostics: {
      collisions: [],
      roleCoverage: {
        starters: 1,
        extenders: 1,
        handTraps: 1,
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
      restrictions: [],
    },
    consistency: {
      n: 100,
      starterAccess: 0.7,
      brickRate: 0.2,
      oneInterruptionSurvival: 0.4,
    },
    matchups: [],
    combos: { source: "empty" as const, lines: [] },
    grade: {
      letter: "B" as const,
      consistency: 70,
      power: 60,
      resilience: 50,
      disruption: 50,
      synergyFactor: 1,
      formatRulePack: "masterDuelMaxxC" as const,
      breakdown: {
        consistency: [],
        power: [],
        resilience: [],
        disruption: [],
        synergyNotes: [],
        formatPackNotes: [],
      },
    },
  };

  const allowed = collectAllowedEvidenceIds({
    facts,
    variants,
    conditions: [],
    retrieved: [],
  });
  const scrubbed = sanitizeCoachEvidence(
    {
      mode: "qa",
      answer: "ok",
      confidence: "high",
      limitations: [],
      evidence: [
        {
          claim: "bad",
          evidenceIds: ["facts.fakeWinRate"],
        },
        {
          claim: "good",
          evidenceIds: [EvidenceIds.consistency],
        },
      ],
    },
    allowed,
  );
  assertEquals(scrubbed.evidence.length, 1);
  assertEquals(scrubbed.confidence, "medium");
});
