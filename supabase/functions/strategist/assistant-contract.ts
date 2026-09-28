/**
 * Deck Assistant contracts (Deno mirror of lib/engine/assistant-contract.ts).
 */

import { z } from "zod";

export const ASSISTANT_MODES = [
  "auto",
  "qa",
  "tune_copies",
  "discover_synergy",
  "optimize",
] as const;

export const RESOLVED_ASSISTANT_MODES = [
  "qa",
  "tune_copies",
  "discover_synergy",
  "optimize",
] as const;

export type AssistantMode = (typeof ASSISTANT_MODES)[number];
export type ResolvedAssistantMode = (typeof RESOLVED_ASSISTANT_MODES)[number];

/** Sub-focus for qa mode — maps to FactsEnvelope evidence priority. */
export const QA_FOCUS_VALUES = [
  "consistency",
  "resilience",
  "construction",
  "play_line",
  "anti_synergy",
  "meta_matchup",
  "side_plan",
  "general",
] as const;

export const OPTIMIZATION_TARGET_VALUES = [
  "brick_rate",
  "starter_access",
  "resilience",
  "main_size",
  "generic",
] as const;

export const OOB_REASON_VALUES = [
  "freeform_build",
  "meta_tier",
  "rules_judge",
  "image_or_unsaved",
  "off_domain",
  "other",
] as const;

/** Fixed Strategist refusal when the ask is outside deck + card library. */
export const OFF_DOMAIN_REFUSAL_MESSAGE =
  "I'm afraid I can't answer that because I am limited to information your deck and the card database";

export const REDIRECT_HINT_VALUES = [
  "meta_panel",
  "save_deck",
  "rules_docs",
  "workshop_matchups",
  "workshop_combos",
] as const;

export type QaFocus = (typeof QA_FOCUS_VALUES)[number];
export type OptimizationTarget = (typeof OPTIMIZATION_TARGET_VALUES)[number];
export type OobReason = (typeof OOB_REASON_VALUES)[number];
export type RedirectHint = (typeof REDIRECT_HINT_VALUES)[number];

const OOB_REDIRECT_HINTS = new Set<RedirectHint>([
  "meta_panel",
  "save_deck",
  "rules_docs",
]);

/**
 * Server-owned Workshop tab soft-CTA hint.
 * Only when Facts has rows to show; never invents matchup/combo content.
 */
export function resolveWorkshopTabRedirect(args: {
  mode?: ResolvedAssistantMode | AssistantMode;
  qaFocus?: QaFocus | null;
  playLineAsk?: boolean;
  matchupCount: number;
  comboLineCount: number;
}): RedirectHint | undefined {
  const mode = args.mode ?? "qa";
  if (mode !== "qa" && mode !== "auto") return undefined;

  if (
    (args.qaFocus === "meta_matchup" || args.qaFocus === "side_plan") &&
    args.matchupCount > 0
  ) {
    return "workshop_matchups";
  }

  const playLine =
    args.qaFocus === "play_line" ||
    (Boolean(args.playLineAsk) &&
      (args.qaFocus == null || args.qaFocus === "general"));
  if (playLine && args.comboLineCount > 0) {
    return "workshop_combos";
  }

  return undefined;
}

export function mergeCoachRedirectHint(args: {
  existing?: RedirectHint | null;
  workshopHint?: RedirectHint | null;
}): RedirectHint | undefined {
  if (args.workshopHint) return args.workshopHint;
  if (args.existing && OOB_REDIRECT_HINTS.has(args.existing)) {
    return args.existing;
  }
  return undefined;
}

/**
 * Structured NLP intent from Groq classifier or heuristic fallback.
 * Used when request mode is `auto`.
 */
export const IntentClassificationSchema = z.object({
  inferred_mode: z.enum(RESOLVED_ASSISTANT_MODES),
  qa_focus: z.enum(QA_FOCUS_VALUES).optional(),
  target_card_entities: z.array(z.string().min(1).max(120)).max(5).default([]),
  optimization_target: z.enum(OPTIMIZATION_TARGET_VALUES).nullable().optional(),
  is_out_of_bounds: z.boolean(),
  oob_reason: z.enum(OOB_REASON_VALUES).nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

/**
 * Soft-parse intent JSON from Groq; returns null when structurally invalid.
 */
export function parseIntentClassification(
  raw: unknown,
): IntentClassification | null {
  const result = IntentClassificationSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export const EngineFormatSchema = z.enum(["TCG", "MASTER_DUEL"]);

export const DeckAssistantRequestSchema = z.object({
  deckId: z.string().uuid(),
  format: EngineFormatSchema.optional(),
  question: z.string().trim().min(2).max(1200),
  mode: z.enum(ASSISTANT_MODES).default("auto"),
  conversationId: z.string().uuid().optional(),
});

export type DeckAssistantRequest = z.infer<typeof DeckAssistantRequestSchema>;

export const EvidenceClaimSchema = z.object({
  claim: z.string().min(1).max(500),
  evidenceIds: z.array(z.string().min(1)).min(1).max(6),
});

export const TuningRecommendationSchema = z.object({
  cardId: z.string().min(1),
  fromCopies: z.number().int().min(0).max(3),
  toCopies: z.number().int().min(0).max(3),
  changeReason: z.string().min(1).max(600),
  evidenceIds: z.array(z.string().min(1)).min(1),
});

export const TuningBlockSchema = z.object({
  recommendation: z.array(TuningRecommendationSchema).max(8),
  tradeoffs: z.array(z.string().max(400)).max(8),
});

export const SynergyCandidateSchema = z.object({
  cardId: z.string().min(1),
  title: z.string().min(1).max(200),
  fitSummary: z.string().min(1).max(800),
  genericCondition: z.string().min(1).max(400),
  satisfiedByDeck: z.array(z.string()).max(12),
  roleFit: z.array(z.string()).max(8),
  risks: z.array(z.string()).max(6),
  status: z.enum([
    "legal_candidate",
    "engine_verified_eligibility",
    "validated_combo_support",
  ]),
  evidenceIds: z.array(z.string().min(1)).min(2).max(8),
});

/** Optional UI recommendation card fields (optimize / synergy presentation). */
export const CoachRecommendationCardSchema = z.object({
  cardId: z.string().min(1),
  title: z.string().min(1).max(200),
  roleTag: z.string().max(80).optional(),
  effectLines: z.array(z.string().max(400)).max(4).optional(),
});

export const DeckCoachResponseSchema = z.object({
  mode: z.enum(RESOLVED_ASSISTANT_MODES),
  answer: z.string().min(1).max(2400),
  confidence: z.enum(["high", "medium", "low"]),
  limitations: z.array(z.string().max(300)).max(5),
  evidence: z.array(EvidenceClaimSchema).min(1).max(12),
  tuning: TuningBlockSchema.optional(),
  synergies: z.array(SynergyCandidateSchema).max(10).optional(),
  /** Structured recommendation cards; backward compatible when omitted. */
  recommendations: z.array(CoachRecommendationCardSchema).max(10).optional(),
  /** Soft UI redirect when intent is out of coach scope. */
  redirectHint: z.enum(REDIRECT_HINT_VALUES).optional(),
});

export type DeckCoachResponse = z.infer<typeof DeckCoachResponseSchema>;
export type EvidenceClaim = z.infer<typeof EvidenceClaimSchema>;
export type TuningRecommendation = z.infer<typeof TuningRecommendationSchema>;
export type TuningBlock = z.infer<typeof TuningBlockSchema>;
export type SynergyCandidate = z.infer<typeof SynergyCandidateSchema>;
export type CoachRecommendationCard = z.infer<
  typeof CoachRecommendationCardSchema
>;

export const EvidenceIds = {
  consistency: "facts.consistency",
  roleCoverage: "facts.diagnostics.roleCoverage",
  strategyFit: "facts.diagnostics.strategyFit",
  collisions: "facts.diagnostics.collisions",
  bosses: "facts.diagnostics.bosses",
  matchups: "facts.matchups",
  combos: "facts.combos",
  grade: "facts.grade",
  gradeBreakdown: "facts.grade.breakdown",
  formatRulePack: "facts.formatRulePack",
  legality: "facts.legality",
  mainDeckSize: "facts.mainDeckSize",
  coachScope: "coach.scope",
  card: (cardId: string | number) => `card:${cardId}`,
  condition: (slug: string) => `condition:${slug}`,
  variant: (cardId: string | number, from: number, to: number) =>
    `variant:${cardId}:${from}->${to}`,
  restrictions: "facts.diagnostics.restrictions",
  restriction: (cardId: string | number) => `restriction:${cardId}`,
} as const;

/** Evidence IDs to prioritize in the coach prompt for a given qa_focus. */
export function evidenceHintsForQaFocus(
  focus:
    | "consistency"
    | "resilience"
    | "construction"
    | "play_line"
    | "anti_synergy"
    | "meta_matchup"
    | "side_plan"
    | "general"
    | undefined,
): string[] {
  switch (focus) {
    case "consistency":
      return [EvidenceIds.consistency, EvidenceIds.roleCoverage];
    case "resilience":
      return [
        EvidenceIds.consistency,
        EvidenceIds.gradeBreakdown,
        EvidenceIds.formatRulePack,
        EvidenceIds.collisions,
        EvidenceIds.combos,
      ];
    case "construction":
      return [
        EvidenceIds.collisions,
        EvidenceIds.roleCoverage,
        EvidenceIds.strategyFit,
      ];
    case "play_line":
      return [EvidenceIds.combos, EvidenceIds.matchups, EvidenceIds.bosses];
    case "anti_synergy":
      return [
        EvidenceIds.restrictions,
        EvidenceIds.collisions,
        EvidenceIds.strategyFit,
      ];
    case "meta_matchup":
      return [EvidenceIds.matchups, EvidenceIds.combos, EvidenceIds.grade];
    case "side_plan":
      return [EvidenceIds.matchups, EvidenceIds.legality, EvidenceIds.roleCoverage];
    case "general":
    default:
      return [EvidenceIds.grade, EvidenceIds.consistency];
  }
}

/**
 * Deterministic out-of-bounds coach reply (no FactsEnvelope required).
 */
export function buildOutOfBoundsCoachResponse(
  classification: Pick<
    IntentClassification,
    "oob_reason" | "confidence"
  >,
): DeckCoachResponse {
  const reason = classification.oob_reason ?? "other";
  let answer: string;
  let redirectHint: RedirectHint | undefined;
  let limitation: string;

  switch (reason) {
    case "freeform_build":
      answer =
        "I can only review a legal deck list you already have — I cannot design a competitive deck from scratch. Save a legal list in Workshop, then ask about consistency, ratios, or synergies for that list.";
      redirectHint = "save_deck";
      limitation =
        "Free-form deck building is out of scope; start a list in Workshop or Meta, then ask again.";
      break;
    case "meta_tier":
      answer =
        "I do not invent format tier lists. Check the Meta / Tier List panel for rankings, then open your deck here for list-specific advice.";
      redirectHint = "meta_panel";
      limitation = "Format rankings belong in the Meta panel, not Strategist.";
      break;
    case "rules_judge":
      answer =
        "I am a deck advisor, not a real-time rules judge. For chain timing and Damage Step disputes, consult official rules docs — then ask me about your deck's consistency, choke points, or tech choices.";
      redirectHint = "rules_docs";
      limitation = "Rules adjudication is outside Strategist scope.";
      break;
    case "image_or_unsaved":
      answer =
        "I cannot parse screenshots or unsaved card picks. Add cards to a saved legal deck in Workshop, then ask again.";
      redirectHint = "save_deck";
      limitation = "Screenshots and unsaved picks are not supported.";
      break;
    case "off_domain":
      answer = OFF_DOMAIN_REFUSAL_MESSAGE;
      limitation =
        "Only questions about your deck and the card library are in scope.";
      break;
    default:
      answer =
        "That request is outside what I can answer from your deck and the card library. Ask about this list's consistency, copy ratios, or mechanical synergies.";
      limitation = "Question is outside Strategist scope.";
  }

  return {
    mode: "qa",
    answer,
    confidence: "low",
    limitations: [limitation],
    evidence: [
      {
        claim: "Request is outside deck and card-library coaching scope",
        evidenceIds: [EvidenceIds.coachScope],
      },
    ],
    redirectHint,
  };
}

export function parseDeckCoachResponse(
  raw: unknown,
): DeckCoachResponse | null {
  const result = DeckCoachResponseSchema.safeParse(raw);
  return result.success ? result.data : null;
}
