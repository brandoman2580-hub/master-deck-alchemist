/**
 * Zod-backed Groq intent classifier for Auto mode.
 * Maps informal Yu-Gi-Oh slang into qa | tune_copies | discover_synergy (+ OOB).
 */

import { callGroqChatJson } from "../_shared/groq-client.ts";
import { resolveGroqModel } from "../_shared/groq-model.ts";
import {
  parseIntentClassification,
  type IntentClassification,
} from "./assistant-contract.ts";
import { classifyIntentHeuristic } from "./mode-router.ts";

const CLASSIFIER_TIMEOUT_MS = 2500;

const INTENT_SYSTEM_PROMPT = `You are Master Deck Alchemist's intent classifier.
Map the user question to a strict JSON IntentClassification. Do not answer the question.

MODES:
- "qa": information-seeking about THIS saved deck (consistency/brick odds, choke points, hand-trap survival, engine collisions, play lines, locks/anti-synergy, matchups, side plan). Slang: brick, gas, choke, garnet, pitch (without cut), unplayable hand.
- "tune_copies": user wants to change copy counts / ratios / cuts / trim / pitch / shave / max out a card / squeeze hand traps / hit 40 cards. Must imply a ratio change, not just diagnose brick rate. "what should I pitch?" = tune_copies. "optimize my card copies" = tune_copies.
- "discover_synergy": search for cards outside the named engine (generic Level/Rank/Link, board breakers, discard outlets, floodgates, tribute tech, Lair synergies, Super Poly, Enemy Controller, attribute/race searchers like DARK Fiend tutors, "show me X cards", "suggest cards").
- "optimize": bridge / convert / rework the list toward another engine or goal in one turn (e.g. "convert Lair into RDA", "optimize this deck for going second"). Combines ratios + techs + combo graph — not ratio-only.

QA_FOCUS (when inferred_mode=qa):
- consistency | resilience | construction | play_line | anti_synergy | meta_matchup | side_plan | general

OUT OF BOUNDS (is_out_of_bounds=true) — do not invent strategy:
- freeform_build: build a deck from scratch / step-by-step beat a friend's deck
- meta_tier: best deck / tier list / format meta rankings
- rules_judge: Damage Step / chain timing / judge calls
- image_or_unsaved: screenshot or random card image fitting
- off_domain: weather, news, homework, jokes — anything outside deck + card library
- other: anything else outside saved-deck coaching

RULES:
- "Why is my deck bricking?" → qa, qa_focus=consistency, is_out_of_bounds=false
- "I keep bricking on my Lair package, what should I pitch?" → tune_copies, optimization_target=brick_rate
- "What happens to brick rate if I max out Ash Blossom?" → tune_copies, target_card_entities=["Ash Blossom & Joyous Spring"], optimization_target=brick_rate
- "Where's the choke if they Ash?" → qa, qa_focus=play_line or resilience
- "Is this a garnet?" → qa, qa_focus=construction
- "Need more board breakers going second" → discover_synergy
- "Show me DARK fiend searcher cards" → discover_synergy
- "Find Fiend searchers for this list" → discover_synergy
- "Crimson Resonator lock vs Lair" → qa, qa_focus=anti_synergy
- "Worst matchups going first" → qa, qa_focus=meta_matchup
- "What do I side vs backrow?" → qa, qa_focus=side_plan
- "Find generic Level 4 extenders" → discover_synergy
- "Convert Lair into RDA" → optimize
- "Optimize this deck for going second" → optimize
- "What's the weather today?" → is_out_of_bounds=true, oob_reason=off_domain
- "How do I build competitive Snake-Eye from scratch?" → is_out_of_bounds=true, oob_reason=freeform_build

Return ONLY JSON:
{
  "inferred_mode": "qa" | "tune_copies" | "discover_synergy" | "optimize",
  "qa_focus": "consistency" | "resilience" | "construction" | "play_line" | "anti_synergy" | "meta_matchup" | "side_plan" | "general" (optional; for qa),
  "target_card_entities": string[] (card names mentioned, max 5),
  "optimization_target": "brick_rate" | "starter_access" | "resilience" | "main_size" | "generic" | null,
  "is_out_of_bounds": boolean,
  "oob_reason": "freeform_build" | "meta_tier" | "rules_judge" | "image_or_unsaved" | "off_domain" | "other" | null,
  "confidence": "high" | "medium" | "low"
}`;

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

/**
 * Classify Auto-mode intent via Groq JSON; fall back to heuristics on failure/timeout.
 */
export async function classifyIntent(args: {
  question: string;
  apiKey: string;
  modelName?: string;
  timeoutMs?: number;
}): Promise<IntentClassification> {
  const {
    question,
    apiKey,
    modelName = resolveGroqModel(),
    timeoutMs = CLASSIFIER_TIMEOUT_MS,
  } = args;

  // Cheap OOB gate before spending a Groq round-trip
  const earlyOob = classifyIntentHeuristic(question);
  if (earlyOob.is_out_of_bounds) {
    return earlyOob;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { content } = await callGroqChatJson({
      apiKey,
      modelName,
      messages: [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user", content: question.slice(0, 1200) },
      ],
      temperature: 0.1,
      maxTokens: 350,
      signal: controller.signal,
    });
    const classified = parseIntentClassification(extractJson(content));
    if (classified) return classified;
  } catch (err) {
    console.warn("Intent classifier failed; using heuristics:", err);
  } finally {
    clearTimeout(timer);
  }

  return earlyOob;
}
