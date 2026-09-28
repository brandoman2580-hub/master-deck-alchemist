/**
 * Mode router (client mirror of edge mode-router.ts).
 * Explicit modes win; auto uses NLP classification when provided, else heuristics.
 */

import type {
  AssistantMode,
  IntentClassification,
  OobReason,
  OptimizationTarget,
  QaFocus,
  ResolvedAssistantMode,
} from "./assistant-contract.ts";
import { slangIntentTagsFromQuestion } from "./yugioh-slang.ts";

/** Copy / ratio change language → tune_copies (not mere "brick" diagnostics). */
const COPY_CHANGE_PATTERNS =
  /\b(ratio|ratios|copies|copy|cut|cuts|trim|tune|tuning|pitch|pitches|shave|fat|how many|3[- ]of|2[- ]of|1[- ]of|one[- ]of|two[- ]of|three[- ]of|play\s+\d|drop\s+to|max\s+out|maxing|weird\s+2|squeeze\s+in|scale\s+down|change\s+budget|main\s*deck\s*size|40\s*cards?|optimize|optimisation)\b/i;

const SYNERGY_PATTERNS =
  /\b(synergy|synergies|tech|package|splash|hidden|generic\s+(level|rank|link|extender|trap|monster)|outside\s+(my\s+)?(engine|archetype)|off[- ]archetype|cross[- ]archetype|what\s+else|recommend\s+cards?|add\s+cards?|show\s+me|find\s+me|suggest|suggestion|what\s+cards?|which\s+cards?|cards?\s+that|searcher|searchers|tutor|board\s+breaker|discard\s+outlet|floodgate|stun\s+piece|tribute|lair|rank\s*\d|level\s*\d|link\s*\d|xyz|super\s+poly|enemy\s+controller)\b/i;

/** Explicit card-discovery asks — must not be demoted to qa by a weak classifier. */
const CARD_DISCOVERY_ASK =
  /\b(show\s+me|find\s+me|suggest|recommend|what\s+cards?|which\s+cards?|cards?\s+that|add\s+cards?|searcher|searchers|tutor|tech|splash|board\s+breaker|floodgate)\b/i;

const QA_PATTERNS =
  /\b(how\s+(do|should)\s+i\s+play|line|combo|choke|chokepoint|end\s*board|going\s+first|going\s+second|matchup|priority|explain|why|what\s+does|brick|bricking|unplayable|odds\s+of|starter|hand\s+trap|interruption|collision|normal\s+summon|dead\s+card|stranded|survive|resilience|garnet|anti[- ]?synergy|lock|side\s+deck|worst\s+matchup)\b/i;

const CONSISTENCY_FOCUS =
  /\b(brick|bricking|unplayable|odds\s+of|opening|starter\s+access|engine\s+requirement|consistency|gas)\b/i;

const RESILIENCE_FOCUS =
  /\b(hand\s+trap|interruption|choke|chokepoint|negate|destroyed|survival|resilience|play\s+through)\b/i;

const CONSTRUCTION_FOCUS =
  /\b(collision|clashing|fighting|normal\s+summon\s+slot|ratio\s+of\s+starters|dead\s+card|stranded|engine\s+package|garnet)\b/i;

const ANTI_SYNERGY_FOCUS =
  /\b(anti[- ]?synergy|lock|locks|locked|blocked\s+if|fighting\s+(each\s+other|the\s+engine)|package\s+conflict|cannot\s+special\s+summon)\b/i;

const META_MATCHUP_FOCUS =
  /\b(matchup|worst\s+matchup|going\s+first|going\s+second|meta|tier\s*1|disruption\s+priorit|board\s+breaker)\b/i;

const SIDE_PLAN_FOCUS =
  /\b(side\s+deck|side\s+plan|side\s+vs|siding|boarding)\b/i;

const OOB_FREEFORM_BUILD =
  /\b(from\s+scratch|build\s+(me\s+)?(a\s+|an\s+)?(competitive\s+)?.{0,48}deck|how\s+do\s+i\s+build)\b/i;

const OOB_META_TIER =
  /\b(best\s+deck|tier\s*list|meta\s+(right\s+now|tier|deck)|absolute\s+best)\b/i;

const OOB_RULES_JUDGE =
  /\b(damage\s+step|can\s+(my|the)\s+opponent\s+chain|judge\s+call|rules\s+question|during\s+the\s+damage\s+step)\b/i;

const OOB_IMAGE =
  /\b(screenshot|screenshotted|look\s+at\s+this\s+(random\s+)?card|image\s+I|photo\s+of)\b/i;

const BEAT_FRIEND_COMBO =
  /\b(step[- ]by[- ]step\s+combo\s+to\s+beat|beat\s+my\s+friend'?s?\s+deck)\b/i;

function normalizeCardKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Cheap out-of-bounds gate for free-form strategy / rules / images.
 */
export function classifyOutOfBoundsHeuristic(question: string): {
  isOutOfBounds: boolean;
  reason: OobReason | null;
} {
  const q = question.trim();
  if (OOB_FREEFORM_BUILD.test(q) || BEAT_FRIEND_COMBO.test(q)) {
    return { isOutOfBounds: true, reason: "freeform_build" };
  }
  if (OOB_META_TIER.test(q)) {
    return { isOutOfBounds: true, reason: "meta_tier" };
  }
  if (OOB_RULES_JUDGE.test(q)) {
    return { isOutOfBounds: true, reason: "rules_judge" };
  }
  if (OOB_IMAGE.test(q)) {
    return { isOutOfBounds: true, reason: "image_or_unsaved" };
  }
  return { isOutOfBounds: false, reason: null };
}

function inferQaFocus(question: string): QaFocus {
  const slang = slangIntentTagsFromQuestion(question);
  if (ANTI_SYNERGY_FOCUS.test(question) || slang.includes("anti_synergy")) {
    return "anti_synergy";
  }
  if (SIDE_PLAN_FOCUS.test(question) || slang.includes("side_plan")) {
    return "side_plan";
  }
  if (
    (META_MATCHUP_FOCUS.test(question) || slang.includes("meta_matchup")) &&
    !COPY_CHANGE_PATTERNS.test(question)
  ) {
    return "meta_matchup";
  }
  if (CONSTRUCTION_FOCUS.test(question)) return "construction";
  if (RESILIENCE_FOCUS.test(question) || slang.includes("resilience")) {
    return "resilience";
  }
  if (CONSISTENCY_FOCUS.test(question) || slang.includes("consistency")) {
    return "consistency";
  }
  if (
    /\b(how\s+(do|should)\s+i\s+play|line|combo|going\s+first|going\s+second)\b/i.test(
      question,
    ) ||
    slang.includes("play_line")
  ) {
    return "play_line";
  }
  return "general";
}

function inferOptimizationTarget(question: string): OptimizationTarget | null {
  if (/\b(brick|bricking|brick\s+rate)\b/i.test(question)) return "brick_rate";
  if (/\bstarter\b/i.test(question)) return "starter_access";
  if (/\b(hand\s+trap|interruption|resilience|survive)\b/i.test(question)) {
    return "resilience";
  }
  if (/\b(40\s*cards?|main\s*deck\s*size)\b/i.test(question)) return "main_size";
  return "generic";
}

function resolveModeFromHeuristics(question: string): ResolvedAssistantMode {
  const q = question.trim();
  const slang = slangIntentTagsFromQuestion(q);
  // Lock / anti-synergy diagnostics are qa, even if "Lair" also matches synergy keywords.
  if (ANTI_SYNERGY_FOCUS.test(q) || slang.includes("anti_synergy")) {
    return "qa";
  }
  const copyChange =
    COPY_CHANGE_PATTERNS.test(q) || slang.includes("tune_copies");
  const synergy =
    SYNERGY_PATTERNS.test(q) || slang.includes("discover_synergy");
  const qa = QA_PATTERNS.test(q);

  if (copyChange && !synergy) return "tune_copies";
  if (synergy && !copyChange) return "discover_synergy";
  if (copyChange && synergy) {
    if (/\b(copies|ratio|cut|pitch|trim|shave|how many)\b/i.test(q)) {
      return "tune_copies";
    }
    return "discover_synergy";
  }
  if (qa) return "qa";
  return "qa";
}

/**
 * Full heuristic IntentClassification for Auto when Groq classifier fails.
 */
export function classifyIntentHeuristic(
  question: string,
): IntentClassification {
  const oob = classifyOutOfBoundsHeuristic(question);
  if (oob.isOutOfBounds) {
    return {
      inferred_mode: "qa",
      target_card_entities: [],
      is_out_of_bounds: true,
      oob_reason: oob.reason,
      confidence: "high",
    };
  }

  const inferred_mode = resolveModeFromHeuristics(question);
  return {
    inferred_mode,
    qa_focus: inferred_mode === "qa" ? inferQaFocus(question) : undefined,
    target_card_entities: [],
    optimization_target:
      inferred_mode === "tune_copies"
        ? inferOptimizationTarget(question)
        : null,
    is_out_of_bounds: false,
    oob_reason: null,
    confidence: "medium",
  };
}

/**
 * Resolve named card entities against a deck's card list (normalized match).
 */
export function resolveCardEntitiesFromNames(
  names: string[],
  cards: Array<{ id: number | string; name: string }>,
): string[] {
  const resolved: string[] = [];
  for (const name of names) {
    const needle = normalizeCardKey(name);
    if (!needle || needle.length < 3) continue;
    let best: { id: string; score: number } | null = null;
    for (const card of cards) {
      const hay = normalizeCardKey(card.name);
      if (!hay) continue;
      let score = 0;
      if (hay === needle) {
        score = 1;
      } else if (hay.startsWith(needle) || needle.startsWith(hay)) {
        score = 0.9;
      } else if (hay.includes(needle) || needle.includes(hay)) {
        score =
          Math.min(needle.length, hay.length) /
          Math.max(needle.length, hay.length);
        if (score < 0.55 && Math.min(needle.length, hay.length) >= 6) {
          score = 0.7;
        }
      }
      if (score >= 0.55 && (!best || score > best.score)) {
        best = { id: String(card.id), score };
      }
    }
    if (best) resolved.push(best.id);
  }
  return [...new Set(resolved)];
}

/**
 * Resolve assistant mode. Explicit non-auto modes win; auto uses
 * classification when provided, otherwise heuristics.
 * Strong card-discovery language wins over a classifier that wrongly returns qa.
 */
export function resolveAssistantMode(
  mode: AssistantMode | undefined,
  question: string,
  classification?: IntentClassification | null,
): ResolvedAssistantMode {
  if (mode && mode !== "auto") {
    return mode;
  }
  const heuristic = resolveModeFromHeuristics(question);
  if (classification && !classification.is_out_of_bounds) {
    if (
      heuristic === "discover_synergy" &&
      classification.inferred_mode === "qa" &&
      CARD_DISCOVERY_ASK.test(question)
    ) {
      return "discover_synergy";
    }
    return classification.inferred_mode;
  }
  return heuristic;
}
