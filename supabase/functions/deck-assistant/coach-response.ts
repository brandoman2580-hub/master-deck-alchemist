/**
 * Groq coach: structured DeckCoachResponse from FactsEnvelope + mode attachments.
 * Actionable tuning/synergies are server-clamped after inference.
 */

import { callGroqChatJson } from "../_shared/groq-client.ts";
import { resolveGroqModel } from "../_shared/groq-model.ts";
import {
  buildCoachSystemPrompt,
  formatFactsForPrompt,
} from "../_shared/engine/coaching.ts";
import type { FactsEnvelope } from "../_shared/engine/types.ts";
import {
  EvidenceIds,
  evidenceHintsForQaFocus,
  parseDeckCoachResponse,
  type DeckCoachResponse,
  type IntentClassification,
  type ResolvedAssistantMode,
  type SynergyCandidate,
} from "./assistant-contract.ts";
import {
  buildSynergyFitSummary,
  type EngineCondition,
} from "./engine-conditions.ts";
import type { CopyVariant } from "./tune-variants.ts";
import type { Card } from "./types.ts";
import {
  clampCoachActionables,
  collectAllowedEvidenceIds,
  sanitizeCoachEvidence,
} from "./coach-guardrails.ts";
import {
  formatConsistencyPlayerBlurb,
  formatTuneFallbackAnswer,
} from "./player-voice.ts";
import {
  buildSlangHintBlock,
  formatSlangDictionaryForPrompt,
  stripEngineerMetrics,
} from "./yugioh-slang.ts";

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RetrievedSynergyCard {
  card: Card;
  condition: EngineCondition;
  conditionFit: number;
  overlapPenalty: number;
}

const RETRIEVED_DESC_CAP = 160;

const BASE_COACH_PROMPT = `You are Master Deck Alchemist's Master Rank Deck Coach. Narrate validated facts in competitive Yu-Gi-Oh slang. You are not a rules engine, simulator, or free-form combo generator.

VOICE RULES (critical):
- Speak like a Master Rank coach: brick, choke, pitch, engine, package, hand trap, board breaker, garnet, going first/second.
- NEVER print raw Δstarter/Δbrick/Δsurvive, starterAccess≈, brickRate≈, passcode-only citations, "FactsEnvelope", "Monte Carlo", or evidence ID strings in answer/tradeoffs/changeReason.
- Lead with the call (first cut, choke, lock conflict). Rank options in plain language.
- Prefer glossary terms when facts support them; never invent garnet/choke/lock claims without VALIDATED FACTS support.

ALLOWED FACTUAL PATTERNS:
1. Structural rates present in VALIDATED_FACTS (translate to slang, do not dump decimals).
2. Exact effect texts / names in RETRIEVED_CARDS.
3. Pre-calculated SERVER_VARIANTS (narrate rank + why, not raw deltas).
4. Mechanical ENGINE_CONDITIONS / restrictions extracted from the user's deck.
5. SIDE_DECK / MATCHUP attachments when present.

ENFORCEMENT RULES:
- Trace every recommendation via evidenceIds in the JSON evidence array only — not in answer prose.
- Never state a percentage shift or win rate alteration not explicitly given in VALIDATED_FACTS or SERVER_VARIANTS.
- If the envelope does not contain the answer, declare data insufficiency in limitations and lower confidence.
- When qa_focus=play_line and combos are empty/insufficient for the asked hand, say you lack a validated line — do not invent Soul Resonator scripts.
- When qa_focus=anti_synergy, use summon/ED locks and PACKAGE_LOCK_CONFLICT collisions in player language.
- When qa_focus=meta_matchup or side_plan, only use attached matchups / side list; if thin, say so.
- Respond with a single JSON object matching the DeckCoachResponse schema.
- Do not invent cardIds. tuning and synergies arrays are filled server-side — focus answer/evidence/limitations on narration.

JSON SCHEMA:
{
  "mode": "qa" | "tune_copies" | "discover_synergy",
  "answer": string (1-2400 chars, player slang),
  "confidence": "high" | "medium" | "low",
  "limitations": string[],
  "evidence": [{ "claim": string, "evidenceIds": string[] }],
  "tuning": optional (server-filled for tune_copies),
  "synergies": optional (server-filled for discover_synergy)
}

Mode-specific rules:
- qa: explain using consistency, combos, matchups, locks, role coverage in slang. play_line → facts.combos only.
- tune_copies: Rank SERVER_VARIANTS cuts/adds in slang (trim to 40, barely hurts openers, less brick). Prefer Main toward 40.
- discover_synergy: Narrate RETRIEVED_CARDS + ENGINE_CONDITIONS; do not invent cardIds.

${formatSlangDictionaryForPrompt()}`;

function extractJson(response: string): unknown {
  let cleaned = response.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Lean retrieved-card block for Groq (id, name, condition, short desc). */
export function formatRetrievedCards(cards: RetrievedSynergyCard[]): string {
  if (cards.length === 0) {
    return "# RETRIEVED_CARDS\nNone";
  }
  const lines = cards.slice(0, 10).map((c) => {
    const desc = (c.card.desc || "").replace(/\s+/g, " ").trim().slice(
      0,
      RETRIEVED_DESC_CAP,
    );
    return `- card:${c.card.id} | ${c.card.name} | condition=${c.condition.slug} fit=${c.conditionFit.toFixed(2)} | ${desc}`;
  });
  return `# RETRIEVED_CARDS\n${lines.join("\n")}`;
}

/**
 * Deterministic synergy rows from retrieval — SoT for Add buttons.
 */
export function buildSynergyCandidatesFromRetrieval(
  synergies: RetrievedSynergyCard[],
  limit = 5,
): SynergyCandidate[] {
  return synergies.slice(0, limit).map((s) => ({
    cardId: String(s.card.id),
    title: s.card.name,
    fitSummary: buildSynergyFitSummary(s.card, s.condition),
    genericCondition: s.condition.genericCondition,
    satisfiedByDeck: s.condition.satisfiedByDeck,
    roleFit: [],
    risks: ["Verify banlist and brick cost before adding."],
    status: "engine_verified_eligibility" as const,
    evidenceIds: [EvidenceIds.card(s.card.id), s.condition.evidenceId],
  }));
}

function fallbackCoachResponse(
  mode: ResolvedAssistantMode,
  facts: FactsEnvelope,
  question: string,
  variants: CopyVariant[],
  synergies: RetrievedSynergyCard[],
  conditions: EngineCondition[],
  intent?: IntentClassification | null,
  mainDeckSize?: number,
): DeckCoachResponse {
  const c = facts.consistency;
  const consistencyBlurb = formatConsistencyPlayerBlurb(c);
  const baseEvidence = [
    {
      claim: consistencyBlurb,
      evidenceIds: [EvidenceIds.consistency],
    },
  ];

  if (mode === "tune_copies") {
    const top = variants.slice(0, 5);
    return {
      mode,
      answer: formatTuneFallbackAnswer(
        top.map((v) => ({
          cardName: v.cardName,
          fromCopies: v.fromCopies,
          toCopies: v.toCopies,
          factsDelta: v.factsDelta,
        })),
        mainDeckSize,
      ),
      confidence: top.length ? "medium" : "low",
      limitations: [
        "Copy suggestions come from opening-hand sims, not match win rates.",
        "Confirm banlist before you lock the cuts.",
      ],
      evidence: baseEvidence,
    };
  }

  if (mode === "discover_synergy") {
    const top = synergies.slice(0, 5);
    const conditionLabels = [
      ...new Set(top.map((s) => s.condition.label)),
    ];
    return {
      mode,
      answer:
        top.length > 0
          ? `Off-engine techs that fit ${conditionLabels.join(" / ")}: ${top
            .map((s) => s.card.name)
            .join(", ")}. Each one mechanically matches engines already in your list (${
            [...new Set(top.flatMap((s) => s.condition.satisfiedByDeck))]
              .slice(0, 4)
              .join(", ")
          }).`
          : conditions.length === 0
          ? "No mechanical engine conditions popped on this list, so I won't invent splash packages."
          : "Engine conditions are there, but retrieval didn't find strong mechanical fits.",
      confidence: top.length ? "medium" : "low",
      limitations: [
        "Capability matching is rule-parser based until curated capabilities land.",
        "Candidates are eligibility hints, not full combo proofs.",
      ],
      evidence: [
        ...baseEvidence,
        ...conditions.slice(0, 3).map((cond) => ({
          claim: cond.genericCondition,
          evidenceIds: [cond.evidenceId],
        })),
      ],
    };
  }

  const playLine =
    intent?.qa_focus === "play_line" ||
    /\b(combo|choke|chokepoint|line|how\s+(do|should)\s+i\s+play|going\s+first|going\s+second)\b/i
      .test(question);
  const antiSynergy =
    intent?.qa_focus === "anti_synergy" ||
    /\b(anti[- ]?synergy|lock|package\s+conflict)\b/i.test(question);
  const lines = facts.combos.lines.slice(0, playLine ? 2 : 1);
  const primary = lines[0];
  const restrictions = facts.diagnostics.restrictions ?? [];

  if (antiSynergy && restrictions.length > 0) {
    const locks = restrictions
      .slice(0, 3)
      .map((r) => r.lockSummary)
      .join(" ");
    const conflict = facts.diagnostics.collisions.find(
      (c) => c.code === "PACKAGE_LOCK_CONFLICT",
    );
    return {
      mode: "qa",
      answer: stripEngineerMetrics(
        `${locks}${
          conflict ? ` Also: ${conflict.message}` : ""
        } Don't force both packages on the same turn if the lock soft-bricks the line.`,
      ),
      confidence: "high",
      limitations: [
        "Lock reads come from effect-text extraction — verify the live card text.",
      ],
      evidence: [
        ...baseEvidence,
        {
          claim: restrictions[0]!.lockSummary,
          evidenceIds: [restrictions[0]!.evidenceId, EvidenceIds.restrictions],
        },
      ],
    };
  }

  if (playLine && !primary) {
    return {
      mode: "qa",
      answer:
        "I don't have a validated combo template for that hand/line on this saved list, so I won't invent a Soul Resonator script. Ask about ratios, choke points on a known line, or save a list that matches a curated hybrid template.",
      confidence: "low",
      limitations: [
        "Play-line coaching is limited to curated combo templates — no free-form sequencer.",
      ],
      evidence: baseEvidence,
    };
  }

  if (playLine && primary) {
    const killerText = primary.killers.slice(0, 4).join(", ") || "see template killers";
    const fallback = primary.fallbackSummary
      ? ` If they hit the choke: ${primary.fallbackSummary}`
      : "";
    const second = lines[1];
    return {
      mode: "qa",
      answer: second
        ? `Validated lines: (1) ${primary.name} → ${primary.endboardSummary}. Choke: ${killerText}.${fallback} (2) ${second.name} → ${second.endboardSummary}.`
        : `Primary line: ${primary.name} → ${primary.endboardSummary}. Watch the choke (${killerText}).${fallback} ${consistencyBlurb}`,
      confidence: c.n > 0 ? "high" : "medium",
      limitations: [
        "Combo narration is limited to curated template lines — not a free-form sequencer.",
      ],
      evidence: [
        ...baseEvidence,
        {
          claim: `Combo line ${primary.name}`,
          evidenceIds: [EvidenceIds.combos],
        },
        {
          claim: `Grade ${facts.grade.letter}`,
          evidenceIds: [EvidenceIds.grade],
        },
      ],
    };
  }

  if (intent?.qa_focus === "meta_matchup") {
    const top = facts.matchups.slice(0, 3);
    return {
      mode: "qa",
      answer:
        top.length > 0
          ? `Worst tagged matchups on this list: ${top
            .map(
              (m) =>
                `${m.opponentArchetype}${m.tier ? ` (T${m.tier})` : ""}`,
            )
            .join(", ")}. Lean on your hand traps and breakers accordingly — I won't invent a live meta tier beyond these snapshots.`
          : "Matchup tags are thin for this list. Check the Meta panel for tier snapshots, then ask again with a saved legal deck.",
      confidence: top.length ? "medium" : "low",
      limitations: [
        "Matchups are tag-readiness scores, not full BO3 side plans.",
      ],
      evidence: [
        ...baseEvidence,
        { claim: "Matchup readiness", evidenceIds: [EvidenceIds.matchups] },
      ],
    };
  }

  return {
    mode: "qa",
    answer: primary
      ? `Grade ${facts.grade.letter}. ${consistencyBlurb} Primary line: ${primary.name} → ${primary.endboardSummary}. Choke watch: ${
        primary.killers.slice(0, 3).join(", ") || "see template"
      }.`
      : `Grade ${facts.grade.letter}. ${consistencyBlurb} Ask about ratios, choke points, or hidden engines for mode-specific coaching.`,
    confidence: c.n > 0 ? "high" : "low",
    limitations: [
      "Advice is grounded in your saved-list facts, not full multi-turn simulation.",
    ],
    evidence: [
      ...baseEvidence,
      {
        claim: `Grade ${facts.grade.letter}`,
        evidenceIds: [EvidenceIds.grade],
      },
      ...(primary
        ? [{
          claim: `Combo line ${primary.name}`,
          evidenceIds: [EvidenceIds.combos],
        }]
        : []),
    ],
  };
}

function formatIntentBlock(args: {
  mode: ResolvedAssistantMode;
  intent?: IntentClassification | null;
  resolvedTargetCardIds?: string[];
  question?: string;
}): string {
  const { mode, intent, resolvedTargetCardIds = [], question = "" } = args;
  const slang = question ? buildSlangHintBlock(question) : "";
  if (!intent) {
    return `# INTENT\nmode=${mode}\n${slang}`.trim();
  }
  const hints = evidenceHintsForQaFocus(intent.qa_focus);
  return `# INTENT
mode=${mode}
qa_focus=${intent.qa_focus ?? "n/a"}
optimization_target=${intent.optimization_target ?? "n/a"}
target_card_entities=${JSON.stringify(intent.target_card_entities ?? [])}
resolved_target_card_ids=${JSON.stringify(resolvedTargetCardIds)}
preferred_evidence_ids=${JSON.stringify(hints)}
classifier_confidence=${intent.confidence}
${slang}`.trim();
}

function finalizeCoach(args: {
  coach: DeckCoachResponse;
  mode: ResolvedAssistantMode;
  facts: FactsEnvelope;
  variants: CopyVariant[];
  conditions: EngineCondition[];
  retrieved: RetrievedSynergyCard[];
}): DeckCoachResponse {
  const clamped = clampCoachActionables({
    coach: args.coach,
    mode: args.mode,
    variants: args.variants,
    synergiesBuilder: () =>
      buildSynergyCandidatesFromRetrieval(args.retrieved),
  });
  const allowed = collectAllowedEvidenceIds({
    facts: args.facts,
    variants: args.variants,
    conditions: args.conditions,
    retrieved: args.retrieved,
  });
  return sanitizeCoachEvidence(clamped, allowed);
}

export async function generateCoachResponse(args: {
  question: string;
  mode: ResolvedAssistantMode;
  facts: FactsEnvelope;
  conversationHistory: CoachMessage[];
  apiKey: string;
  modelName?: string;
  variantsBlock?: string;
  variants?: CopyVariant[];
  conditionsBlock?: string;
  conditions?: EngineCondition[];
  retrievedBlock?: string;
  retrieved?: RetrievedSynergyCard[];
  mainDeckSize?: number;
  intent?: IntentClassification | null;
  resolvedTargetCardIds?: string[];
  sideDeckBlock?: string;
  matchupBlock?: string;
}): Promise<DeckCoachResponse> {
  const {
    question,
    mode,
    facts,
    conversationHistory,
    apiKey,
    variantsBlock = "",
    variants = [],
    conditionsBlock = "",
    conditions = [],
    retrieved = [],
    mainDeckSize,
    intent = null,
    resolvedTargetCardIds = [],
  } = args;

  const retrievedBlock =
    args.retrievedBlock?.trim() || formatRetrievedCards(retrieved);

  const modelName = args.modelName?.trim() || resolveGroqModel();
  const factsPrompt = formatFactsForPrompt(facts);
  const mainSizeLine =
    typeof mainDeckSize === "number"
      ? `\n**Main deck size:** ${mainDeckSize} (evidence: ${EvidenceIds.mainDeckSize})\n`
      : "";
  const intentBlock = formatIntentBlock({
    mode,
    intent,
    resolvedTargetCardIds,
    question,
  });

  const sideBlock = args.sideDeckBlock?.trim() ? `\n${args.sideDeckBlock.trim()}\n` : "";
  const matchupExtra = args.matchupBlock?.trim()
    ? `\n${args.matchupBlock.trim()}\n`
    : "";

  const systemPrompt = buildCoachSystemPrompt(
    BASE_COACH_PROMPT,
    `${intentBlock}\n${factsPrompt}${mainSizeLine}${sideBlock}${matchupExtra}\n${variantsBlock}\n${conditionsBlock}\n${retrievedBlock}`,
  );

  const history = conversationHistory.slice(-8).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const userContent = `MODE: ${mode}
USER QUESTION: ${question}

Return only the DeckCoachResponse JSON for this mode. Prefer evidence IDs listed under # INTENT when present. Do not invent cardIds for tuning/synergies.`;

  try {
    const { content: raw } = await callGroqChatJson({
      apiKey,
      modelName,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userContent },
      ],
      temperature: 0.4,
      maxTokens: 2200,
    });
    const parsed = extractJson(raw);
    const coach = parseDeckCoachResponse(parsed);
    if (coach) {
      return finalizeCoach({
        coach: { ...coach, mode },
        mode,
        facts,
        variants,
        conditions,
        retrieved,
      });
    }
    if (parsed && typeof parsed === "object" && "answer" in parsed) {
      // Prefer deterministic mode-aware fallback over a hardcoded consistency stub.
      // Schema-repaired answers previously always claimed opening consistency.
      return finalizeCoach({
        coach: {
          ...fallbackCoachResponse(
            mode,
            facts,
            question,
            variants,
            retrieved,
            conditions,
            intent,
            mainDeckSize,
          ),
          answer: String((parsed as { answer: unknown }).answer).slice(0, 2400),
          limitations: [
            "Model output required schema repair.",
            ...(mode === "discover_synergy"
              ? ["Server-filled synergies remain authoritative."]
              : []),
          ],
        },
        mode,
        facts,
        variants,
        conditions,
        retrieved,
      });
    }
  } catch (err) {
    console.error("Coach Groq failed, using deterministic fallback:", err);
  }

  return finalizeCoach({
    coach: fallbackCoachResponse(
      mode,
      facts,
      question,
      variants,
      retrieved,
      conditions,
      intent,
      mainDeckSize,
    ),
    mode,
    facts,
    variants,
    conditions,
    retrieved,
  });
}
