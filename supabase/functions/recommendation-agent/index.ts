import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { corsHeaders } from "../_shared/cors.ts";
import {
  analyzeQuestionForFilters,
  buildDeckContextText,
  getQueryEmbedding,
  hybridSearch,
  type CardCandidate,
} from "../_shared/cardSearch.ts";
import { generateQueryEmbedding } from "./embeddingHelper.ts";

// Type assertion to ensure correct function signature
type GenerateQueryEmbeddingFn = (
  text: string,
  supabaseUrl?: string,
  serviceRoleKey?: string,
) => Promise<number[]>;
const generateEmbedding: GenerateQueryEmbeddingFn = generateQueryEmbedding;
import { mmrSelect, type MMRCandidate } from "../_shared/mmr.ts";
import { toTOON } from "../_shared/toon.ts";
import {
  classifyIntent as classifyIntentLegacy,
} from "../_shared/prompts.ts";
import {
  classifyIntent,
  type IntentAnalysis,
} from "../_shared/intentClassifier.ts";
import { generateReasoning, type ReasoningOutput } from "./reasoningStage.ts";
import { generateRecommendations } from "./recommendationStage.ts";
//: Meta context
import { buildMetaContext, getCounterCards, getMetaTrends } from "./metaContext.ts";
//: Advanced retrieval and ranking
import { generateMultipleQueries, performMultiQueryRetrieval } from "./multiQueryRetrieval.ts";
import { expandQuery } from "./queryExpansion.ts";
import { detectNegativeFilters, applyNegativeFilters } from "./negativeFiltering.ts";
import { applySynergyScoring } from "./synergyScoring.ts";
import { applyDiminishingReturns } from "./diminishingReturns.ts";
import { applyConfidenceCalibration } from "./confidenceCalibration.ts";
import { applyExplanationEnhancement } from "./explanationEnhancer.ts";
import { orderByPriority, generatePriorityExplanation } from "./priorityOrdering.ts";
import { getCachedEmbedding, setCachedEmbedding, getCachedRetrieval, setCachedRetrieval } from "./cache.ts";
// parallelCritical and parallelOptional not currently used
// import { parallelCritical, parallelOptional } from "./parallelProcessing.ts";
import { log, logStageStart, logStageEnd, logRetrieval, logScoring, logReasoning, logRecommendations, logCache } from "./logging.ts";
//: New utilities for robust JSON extraction, flexible validation, and telemetry
import { extractJsonRobust } from "./utils/json-extraction.ts";
import { validateFlexible } from "./utils/flexible-schema.ts";
import { sanitizeRecommendations } from "./utils/sanitization.ts";
import { logPipelineStep, getPipelineDebugInfo, resetPipelineSteps } from "./utils/telemetry.ts";
import { buildSimplePrompt } from "./prompts/simple-recommendation-prompt.ts";

type Card = {
  id: number;
  name: string;
  type: string;
  desc: string;
  level?: number;
  race?: string;
  attribute?: string;
  archetype?: string | null;
  atk?: number | string;
  def?: number | string;
  card_images?: Array<{
    id: number;
    image_url: string;
    image_url_small: string;
  }>;
};

interface MasterDuelBanlistEntry {
  card_name: string;
  ban_status: string;
}

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const MODEL_NAME = Deno.env.get("MODEL_NAME") || "llama-3.3-70b-versatile";

// Configuration constants
const MAX_CANDIDATES_TO_LLM = 30; // Maximum cards to send to LLM (target < 1500 tokens)
const MMR_LAMBDA = 0.65; // MMR balance: 0.65 = 65% relevance, 35% diversity
const VECTOR_WEIGHT = 0.7; // Hybrid search: 70% vector, 30% FTS
const FTS_WEIGHT = 0.3;
const RETRIEVAL_K = 30;
const MODEL_TEMP = 0.12; // Low temperature for consistency
const MAX_OUTPUT_TOKENS = 800;
const APPLY_CONF_THRESHOLD = 0.6;
const INVESTIGATE_THRESHOLD = 0.45;
const MAX_PROMPT_CARD_SUMMARY_CHARS = 700;

//: Feature flags
//: Disabled two-stage reasoning by default for better reliability
// Two-stage adds complexity and latency without clear benefit after Phase 1 fixes
// Can be re-enabled by setting ENABLE_TWO_STAGE=true environment variable
const ENABLE_TWO_STAGE = Deno.env.get("ENABLE_TWO_STAGE") === "true"; // Default: false
const MAX_STAGE_TIMEOUT_SECONDS = parseInt(Deno.env.get("MAX_STAGE_TIMEOUT_SECONDS") || "20", 10);

//: A/B Testing for Simplified Prompt
// Use simplified prompt for a percentage of requests (0.0-1.0)
// Set USE_SIMPLE_PROMPT=1.0 to use simplified prompt for all requests
// Set USE_SIMPLE_PROMPT=0.0 to use original prompt for all requests
// Set USE_SIMPLE_PROMPT=0.5 to use simplified prompt for 50% of requests
const SIMPLE_PROMPT_ROLLOUT = parseFloat(Deno.env.get("USE_SIMPLE_PROMPT") || "0.0"); // Default: 0% (disabled)

// ============================================================================
// Zod Schemas (matching types/recommender.ts)
// ============================================================================

const DeckCardZ = z.object({
  cardId: z.number(),
  count: z.number().min(0),
});

const DeckZ = z.object({
  main: z.array(DeckCardZ),
  extra: z.array(DeckCardZ).optional().default([]),
  side: z.array(DeckCardZ).optional().default([]),
});

const UserPrefsZ = z
  .object({
    playstyle: z.enum(["aggro", "control", "combo", "stall", "hybrid"]).optional(),
    budget: z.enum(["low", "mid", "high"]).optional(),
  })
  .optional();

const NumberConstraintZ = z
  .object({
    exact: z.number().min(1).max(20).optional(),
    min: z.number().min(1).max(20).optional(),
    max: z.number().min(1).max(20).optional(),
  })
  .optional();


//: Conversation context (multi-turn memory) passed from client
const ConversationFeedbackItemZ = z.object({
  cardId: z.string(),
  accepted: z.boolean(),
  // Optional structured reason for accept/reject (phase 5+)
  reason: z.string().optional(),
});

const DeckSnapshotZ = z.object({
  timestamp: z.string(),
  deckFingerprint: z.string().optional(),
  mainCount: z.number().optional(),
  extraCount: z.number().optional(),
  sideCount: z.number().optional(),
});

const ConversationContextZ = z.object({
  previousRecommendations: z.array(z.string()).optional().default([]),
  userFeedback: z.array(ConversationFeedbackItemZ).optional().default([]),
  deckEvolution: z.array(DeckSnapshotZ).optional().default([]),
  userGoals: z.array(z.string()).optional().default([]),
});
const EnhancedDeckAnalysisZ = z.object({
  playstyle: z.enum(["Combo", "Midrange", "Control", "Stun", "Beatdown", "Balanced"]),
  tier: z.number().nullable(),
  deckSize: z.number(),
  mainDeckSize: z.number(),
  extraDeckSize: z.number(),
  sideDeckSize: z.number(),
  ratios: z.object({
    monsters: z.number(),
    spells: z.number(),
    traps: z.number(),
    monstersPercent: z.number(),
    spellsPercent: z.number(),
    trapsPercent: z.number(),
  }),
  archetypes: z.array(z.object({
    name: z.string(),
    count: z.number(),
    percentage: z.number(),
  })),
  primaryArchetype: z.string().nullable(),
  cardRoles: z.object({
    starters: z.number(),
    extenders: z.number(),
    interruptions: z.number(),
    boardBreakers: z.number(),
    endBoardPieces: z.number(),
  }),
  winCondition: z.enum(["OTK", "Control", "Grind", "Lock", "Burn", "Unknown"]),
  estimatedBrickRate: z.number(),
  missingStaples: z.array(z.object({
    cardName: z.string(),
    reason: z.string(),
  })),
}).optional();

const RecommendationRequestZ = z.object({
  question: z.string().optional(),
  current_deck: DeckZ.optional(),
  format: z.enum(["MASTER_DUEL", "TCG"]).default("MASTER_DUEL"),
  recommendation_type: z
    .enum(["personalized", "archetype", "engine", "tech", "simple"])
    .optional(),
  use_hybrid_search: z.boolean().optional().default(true),
  explainTo: z.enum(["novice", "intermediate", "advanced"]).optional().default("novice"),
  userPrefs: UserPrefsZ,
  conversationContext: ConversationContextZ.optional(),
  maxOutputTokens: z.number().optional().default(MAX_OUTPUT_TOKENS),
  numberConstraint: NumberConstraintZ,
  deckAnalysis: EnhancedDeckAnalysisZ, // NEW: Enhanced deck analysis from client
});

const CardDocZ = z.object({
  id: z.number(),
  name: z.string(),
  desc: z.string().optional().default(""),
  archetype: z.string().nullable().optional(),
  ban_tcg: z.string().nullable().optional(),
  master_duel_banned: z.boolean().optional().default(false),
  imageurl: z.string().optional().nullable(),
  type: z.string().optional(), // Card type (Monster, Spell, Trap, etc.)
});

const RecoItemZ = z.object({
  cardId: z.string(),
  cardName: z.string().optional(),
  action: z.enum(["add", "remove", "replace", "tech", "note"]),
  reason: z.string(),
  impactEst: z.number().min(-1).max(1),
  synergyScore: z.number().min(0).max(1).optional(),
  evidence: z.array(z.string()),
  banned: z.boolean().optional(),
});

const UIBlockContentZ = z.union([
  z.string(),
  z.array(z.string()),
  z.record(z.string(), z.any()),
]);

const UIBlockZ = z.object({
  id: z.string(),
  type: z.enum(["text", "list", "card", "table", "suggestion"]),
  content: UIBlockContentZ,
});

const ReasoningZ = z.object({
  userIntent: z.string(),
  deckWeaknesses: z.string(),
  strategicConsiderations: z.string(),
  metaContext: z.string().optional(),
  candidateEvaluation: z.string().optional(),
});

const RecommenderZ = z.object({
  schemaVersion: z.string(),
  confidence: z.number().min(0).max(1),
  explainTo: z.enum(["novice", "intermediate", "advanced"]),
  reasoning: ReasoningZ, // NEW: Reasoning field (required)
  summary: z.string().optional(),
  recommendations: z.array(RecoItemZ),
  ui: z.array(UIBlockZ),
  actions: z.record(z.string(), z.any()).optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

// ============================================================================
// Strict JSON-Only System Prompt
// ============================================================================

const STRICT_SYSTEM_PROMPT = `You are an expert Yu-Gi-Oh! deck builder analyzing a player's deck and providing strategic recommendations.

DECK ANALYSIS PROVIDED:
- Archetype: {primaryArchetype}
- Playstyle: {playstyle}
- Deck Size: {deckSize} cards (Main: {mainDeckSize}, Extra: {extraDeckSize})
- Ratios: {monsters}M / {spells}S / {traps}T ({monstersPercent}% / {spellsPercent}% / {trapsPercent}%)
- Win Condition: {winCondition}
- Estimated Brick Rate: {estimatedBrickRate}%
- Card Roles: {starters} starters, {extenders} extenders, {interruptions} interruptions
- Missing Staples: {missingStaples}

INTENT DETECTED: {intentPrimary} (confidence: {intentConfidence})
SEARCH STRATEGY: {searchStrategy}
USER REQUEST: "{question}"

CONVERSATION CONTEXT (optional):
- Provided in the user JSON field "conversationContext"
- Use it to avoid repeating rejected cards, keep continuity across turns, and align with user goals (competitive/casual/budget).

CANDIDATE CARDS AVAILABLE:
{toonTable}

INSTRUCTIONS:

First, provide detailed REASONING in the "reasoning" object:
- Analyze the user's intent
- Identify deck weaknesses related to their request
- Consider how playstyle/deck size affects recommendations
- Note any meta considerations
- Explain your candidate evaluation approach

Then, provide RECOMMENDATIONS:
- Recommend 3-8 cards that best address the user's request
- Each recommendation MUST reference exact cardIds from the candidate pool
- Provide detailed rationale explaining HOW the card addresses the specific weakness
- Assign appropriate deckRole and priority
- Explain synergy with the deck's archetype and strategy
- Consider the deck's current state (e.g., don't recommend cards that duplicate existing roles)

CRITICAL RULES:

- NEVER invent card names or IDs - only use cards from the provided candidate pool
- Confidence scores must reflect how well the card addresses the specific request (0.0-1.0)
- If asking for "consistency," prioritize cards with draw/search effects
- If asking for "interaction," prioritize disruption/negation
- If asking for "power," prioritize combo enablers and boss monsters
- If asking for "tech," avoid generic staples - find specific counters
- For 60-card decks, recommend MORE starters/extenders than for 40-card decks
- For Combo decks, prioritize starters and extenders
- For Control decks, prioritize interruptions and grind game cards
- Always explain synergy with the deck's archetype

OUTPUT FORMAT: Strict JSON only, no markdown, no comments. Follow the schema exactly.

RECOMMENDER_SCHEMA:

{
  "schemaVersion": "string",
  "confidence": number,
  "explainTo": "novice"|"intermediate"|"advanced",
  "reasoning": {
    "userIntent": "string",
    "deckWeaknesses": "string",
    "strategicConsiderations": "string",
    "metaContext": "string (optional)",
    "candidateEvaluation": "string (optional)"
  },
  "summary": "string",
  "recommendations": [
    {
      "cardId": "string",
      "cardName": "string",
      "action": "add"|"remove"|"replace"|"tech"|"note",
      "reason": "string",
      "impactEst": number,
      "synergyScore": number,
      "evidence": ["string"],
      "banned": boolean (optional)
    }
  ],
  "ui": [
    {"id":"string","type":"text"|"list"|"card"|"table"|"suggestion","content": string | string[] | object}
  ],
  "actions": object,
  "meta": object
}

FAIL-FAST: If you are missing required data to make a safe recommendation, return confidence:0 and an "investigate" UI block.`;

// Helper: safely extract archetype as string
function getArchetypeNameServer(card: { archetype?: any }): string {
  const raw = card?.archetype;
  if (!raw) return "";
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "[object Object]") return "";
    return trimmed;
  }
  if (typeof raw === "object" && typeof raw.name === "string") {
    const name = raw.name.trim();
    if (name === "[object Object]") return "";
    return name;
  }
  return "";
}


// Load Master Duel banlist from Supabase
async function loadMasterDuelBanlist(
  supabaseClient: any,
): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabaseClient
      .from("master_duel_banlist")
      .select("card_name, ban_status");

    if (error) {
      console.error("Error loading Master Duel banlist:", error);
      return {};
    }

    if (!data || data.length === 0) {
      return {};
    }

    const banlist: Record<string, string> = {};
    for (const entry of data as MasterDuelBanlistEntry[]) {
      if (entry.card_name && entry.ban_status) {
        banlist[entry.card_name] = entry.ban_status;
      }
    }
    return banlist;
  } catch (err) {
    console.error("Error loading Master Duel banlist:", err);
    return {};
  }
}

// Analyze user's deck history to build profile
async function analyzeUserProfile(
  supabaseClient: any,
  userId: string,
  format: "MASTER_DUEL" | "TCG",
): Promise<{
  preferredArchetypes: string[];
  playstylePattern:
    | "control"
    | "aggro"
    | "combo"
    | "midrange"
    | "stun"
    | "mixed";
  skillLevel: "beginner" | "intermediate" | "advanced";
  frequentlyUsedCards: string[];
  averageDeckComplexity: number;
  deckCount: number;
}> {
  try {
    const { data: decks, error } = await supabaseClient
      .from("decks")
      .select("cards, mode, name")
      .eq("user_id", userId)
      .eq("mode", format === "MASTER_DUEL" ? "Master Duel" : "TCG")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error || !decks || decks.length === 0) {
      return {
        preferredArchetypes: [],
        playstylePattern: "mixed",
        skillLevel: "beginner",
        frequentlyUsedCards: [],
        averageDeckComplexity: 50,
        deckCount: 0,
      };
    }

    const archetypeCounts = new Map<string, number>();
    const cardCounts = new Map<string, number>();
    let totalComplexity = 0;

    for (const deck of decks) {
      const allCards = [
        ...(deck.cards?.main || []),
        ...(deck.cards?.extra || []),
        ...(deck.cards?.side || []),
      ];

      // Count archetypes
      allCards.forEach((card: Card) => {
        const arch = getArchetypeNameServer(card);
        if (arch) {
          archetypeCounts.set(arch, (archetypeCounts.get(arch) || 0) + 1);
        }
        // Count cards
        if (card.name) {
          cardCounts.set(card.name, (cardCounts.get(card.name) || 0) + 1);
        }
      });

      // Estimate complexity
      const complexity = Math.min(100, (allCards.length / 60) * 100);
      totalComplexity += complexity;
    }

    const preferredArchetypes = Array.from(archetypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([arch]) => arch);

    const frequentlyUsedCards = Array.from(cardCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    const averageDeckComplexity =
      decks.length > 0 ? totalComplexity / decks.length : 50;

    let skillLevel: "beginner" | "intermediate" | "advanced" = "beginner";
    if (averageDeckComplexity > 70) {
      skillLevel = "advanced";
    } else if (averageDeckComplexity > 40) {
      skillLevel = "intermediate";
    }

    return {
      preferredArchetypes,
      playstylePattern: "mixed",
      skillLevel,
      frequentlyUsedCards,
      averageDeckComplexity,
      deckCount: decks.length,
    };
  } catch (err) {
    console.error("Error analyzing user profile:", err);
    return {
      preferredArchetypes: [],
      playstylePattern: "mixed",
      skillLevel: "beginner",
      frequentlyUsedCards: [],
      averageDeckComplexity: 50,
      deckCount: 0,
    };
  }
}

// Find cards by archetype (case-insensitive, supports partial matches)
async function findCardsByArchetype(
  supabaseClient: any,
  archetype: string,
  excludeIds: number[] = [],
): Promise<Card[]> {
  if (!archetype) return [];

  // Try exact match first, then case-insensitive match
  // Use case-insensitive search to catch "Toy" regardless of case
  let query = supabaseClient
    .from("cards")
    .select(
      "id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg",
    )
    .ilike("archetype", archetype); // Case-insensitive exact match

  // Apply exclusion filter if needed
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  let { data, error } = await query.limit(50);

  // If no exact match, try partial match
  if ((!data || data.length === 0) && !error) {
    let partialQuery = supabaseClient
      .from("cards")
      .select(
        "id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg",
      )
      .ilike("archetype", `%${archetype}%`);

    if (excludeIds.length > 0) {
      partialQuery = partialQuery.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data: partialData, error: partialError } =
      await partialQuery.limit(50);

    if (!partialError && partialData && partialData.length > 0) {
      data = partialData;
      error = null;
    } else if (partialError) {
      error = partialError;
    }
  }

  // If still no results, try archetype_normalized column if it exists
  if ((!data || data.length === 0) && !error) {
    try {
      let normalizedQuery = supabaseClient
        .from("cards")
        .select(
          "id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg",
        )
        .ilike("archetype_normalized", `%${archetype.toLowerCase()}%`);

      if (excludeIds.length > 0) {
        normalizedQuery = normalizedQuery.not(
          "id",
          "in",
          `(${excludeIds.join(",")})`,
        );
      }

      const { data: normalizedData, error: normalizedError } =
        await normalizedQuery.limit(50);

      if (!normalizedError && normalizedData && normalizedData.length > 0) {
        data = normalizedData;
        error = null;
        console.log(
          `  Found ${normalizedData.length} cards using archetype_normalized column`,
        );
      }
    } catch (_err) {
      // archetype_normalized might not exist, ignore error
      console.log("  Note: archetype_normalized column not available");
    }
  }

  if (error) {
    console.error("Error finding cards by archetype:", error);
    return [];
  }

  const results = (data || []).map((card: Card) => ({
    ...card,
    archetype: getArchetypeNameServer(card),
  }));

  console.log(`  Found ${results.length} cards for archetype "${archetype}"`);
  if (results.length > 0) {
    console.log(
      `  Sample: ${results
        .slice(0, 3)
        .map((c: Card) => c.name)
        .join(", ")}`,
    );
  }

  return results;
}

// ============================================================================
//: Intent-Based Retrieval Functions
// ============================================================================

/**
 * Score a card based on intent analysis and deck analysis
 */
function scoreCardByIntent(
  card: CardCandidate & { metadata?: any },
  intentAnalysis: IntentAnalysis,
  deckAnalysis?: z.infer<typeof EnhancedDeckAnalysisZ>
): number {
  // Start with base similarity score
  const baseScore = card.vector_sim || card.hybrid_score || 0.5;
  let score = baseScore;

  // Get metadata scores
  const metadata = card.metadata || {};
  const consistencyScore = metadata.consistency_score || 0;
  const interactionScore = metadata.interaction_score || 0;
  const powerCeiling = metadata.power_ceiling || 0;
  const metaRelevance = metadata.meta_relevance || 0;
  const isStaple = metadata.is_staple || false;

  // Apply intent-specific boosts
  switch (intentAnalysis.primary) {
    case 'consistency':
      score *= (1 + consistencyScore);
      break;
    case 'interaction':
      score *= (1 + interactionScore);
      break;
    case 'power':
      score *= (1 + powerCeiling);
      break;
    case 'meta':
      //: Enhanced meta boosting (1 + meta_relevance * 3)
      score *= (1 + metaRelevance * 3);
      break;
    case 'tech':
      // Penalize staples for tech requests
      if (isStaple) {
        score *= 0.3;
      }
      break;
    case 'archetype_support':
      // Boost if archetype matches
      if (deckAnalysis?.primaryArchetype && card.archetype) {
        const cardArch = getArchetypeNameServer({ archetype: card.archetype });
        if (cardArch.toLowerCase().includes(deckAnalysis.primaryArchetype.toLowerCase()) ||
            deckAnalysis.primaryArchetype.toLowerCase().includes(cardArch.toLowerCase())) {
          score *= 1.5;
        }
      }
      break;
  }

  // Apply archetype-specific boost if strategy requires it
  if (intentAnalysis.searchStrategy.archetypeSpecific && deckAnalysis?.primaryArchetype && card.archetype) {
    const cardArch = getArchetypeNameServer({ archetype: card.archetype });
    if (cardArch.toLowerCase().includes(deckAnalysis.primaryArchetype.toLowerCase()) ||
        deckAnalysis.primaryArchetype.toLowerCase().includes(cardArch.toLowerCase())) {
      score *= 1.2;
    }
  }

  //: Slight boost for high meta_relevance cards even for non-meta intents
  if (intentAnalysis.primary !== 'meta' && metaRelevance > 0.5) {
    score *= 1.1;
  }

  return score;
}

/**
 * Perform intent-based retrieval using hybrid_card_search_with_metadata RPC
 */
async function performIntentBasedRetrieval(
  queryEmbedding: number[],
  queryText: string,
  excludeIds: number[],
  format: "MASTER_DUEL" | "TCG",
  intentAnalysis: IntentAnalysis,
  supabaseClient: any,
  deckAnalysis?: z.infer<typeof EnhancedDeckAnalysisZ>
): Promise<(CardCandidate & { metadata?: any; intentScore?: number })[]> {
  // Call the new hybrid_card_search_with_metadata RPC function
  const { data, error } = await supabaseClient.rpc(
    'hybrid_card_search_with_metadata',
    {
      query_embedding: queryEmbedding,
      query_text: queryText,
      exclude_ids: excludeIds,
      format_filter: format,
      intent_type: intentAnalysis.primary,
      exclude_staples: intentAnalysis.searchStrategy.excludeStaples,
      match_count: 200, // Get 200 candidates for MMR reranking
    }
  );

  if (error) {
    console.error('❌ Intent-based retrieval error:', error);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn('⚠️ Intent-based retrieval returned no results');
    return [];
  }

  //: Meta-specific filtering
  const metaRelevanceThreshold = 0.3;
  const isMetaIntent = intentAnalysis.primary === 'meta';
  const targetDeck = (intentAnalysis as any).targetDeck; //: targetDeck may not be in type yet

  // Map results and add intent scores
  const candidates = data.map((row: any): CardCandidate & { metadata?: any; intentScore?: number } => {
    const candidate: CardCandidate & { metadata?: any; intentScore?: number } = {
      id: Number(row.id),
      name: String(row.name),
      archetype: row.archetype ?? null,
      type: row.type ?? null,
      desc: row.desc ?? null,
      race: row.race ?? null,
      attribute: row.attribute ?? null,
      level: row.level ?? null,
      vector_sim: row.vector_similarity || row.similarity,
      hybrid_score: row.similarity,
      metadata: row.metadata,
    };

    // Score by intent
    candidate.intentScore = scoreCardByIntent(candidate, intentAnalysis, deckAnalysis);

    return candidate;
  });

  //: Apply meta-specific filtering
  let filteredCandidates = candidates;
  if (isMetaIntent) {
    if (targetDeck) {
      // Filter for counter cards when target deck is specified
      // This would ideally use counter card detection, but for now we keep all candidates
      // and boost them in scoring
      console.log(`🎯 Meta intent with target deck: ${targetDeck}`);
    } else {
      // Filter to cards with meta_relevance > threshold
      filteredCandidates = candidates.filter((c: CardCandidate & { metadata?: any; intentScore?: number }) => {
        const metaRelevance = (c.metadata as any)?.meta_relevance || 0;
        return metaRelevance > metaRelevanceThreshold;
      });
      if (filteredCandidates.length === 0) {
        // Fallback: keep all if filtering removes everything
        filteredCandidates = candidates;
      }
    }
  }

  // Sort by intent score
  type CandidateWithScore = CardCandidate & { metadata?: any; intentScore?: number };
  filteredCandidates.sort((a: CandidateWithScore, b: CandidateWithScore) => 
    (b.intentScore || 0) - (a.intentScore || 0)
  );

  console.log(`✅ Intent-based retrieval: ${filteredCandidates.length} candidates, top 5 scores:`, 
    filteredCandidates.slice(0, 5).map((c: CandidateWithScore) => ({ 
      name: c.name, 
      score: c.intentScore?.toFixed(3),
      metaRelevance: (c.metadata as any)?.meta_relevance?.toFixed(3) || '0'
    }))
  );

  return filteredCandidates;
}

// ============================================================================
//: New Helper Functions for Strict Schema
// ============================================================================

/**
 * Build candidate summary for reasoning stage
 */
function buildCandidateSummary(candidates: CardCandidate[]): string {
  if (candidates.length === 0) {
    return "No candidate cards available.";
  }

  // Count by type
  const byType = new Map<string, number>();
  const byArchetype = new Map<string, number>();
  const roles = {
    consistency: 0,
    interaction: 0,
    power: 0,
    tech: 0,
  };

  candidates.forEach((c) => {
    // Count types
    const type = c.type || "Unknown";
    byType.set(type, (byType.get(type) || 0) + 1);

    // Count archetypes
    if (c.archetype) {
      byArchetype.set(c.archetype, (byArchetype.get(c.archetype) || 0) + 1);
    }

    // Estimate roles from description (simple keyword matching)
    const desc = (c.desc || "").toLowerCase();
    if (desc.includes("draw") || desc.includes("search") || desc.includes("add")) {
      roles.consistency++;
    }
    if (desc.includes("negate") || desc.includes("destroy") || desc.includes("banish") || desc.includes("hand trap")) {
      roles.interaction++;
    }
    if (desc.includes("summon") || desc.includes("attack") || desc.includes("combo")) {
      roles.power++;
    }
    if (desc.includes("counter") || desc.includes("prevent") || desc.includes("cannot")) {
      roles.tech++;
    }
  });

  const typeSummary = Array.from(byType.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");

  const archetypeSummary = Array.from(byArchetype.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([arch, count]) => `${count} ${arch}`)
    .join(", ");

  return `Available cards: ${candidates.length} total. Types: ${typeSummary}. ${archetypeSummary ? `Archetypes: ${archetypeSummary}. ` : ""}Estimated roles: ${roles.consistency} consistency tools, ${roles.interaction} interaction pieces, ${roles.power} power cards, ${roles.tech} tech options.`;
}

/**
 * Hash deck blob into SHA256 hex (for caching)
 */
async function fingerprintDeck(
  deck: unknown,
  explainTo: string,
  prefs: unknown,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = JSON.stringify({ deck, explainTo, prefs });
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build concise summary string for card for prompt
 */
function makeCardSummary(card: z.infer<typeof CardDocZ>): string {
  const desc = (card.desc || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROMPT_CARD_SUMMARY_CHARS);
  return `${card.id} | ${card.name} | archetype:${card.archetype || ""} | ban_tcg:${card.ban_tcg || ""} | master_duel_banned:${!!card.master_duel_banned} | desc: ${desc}`;
}

/**
 * Build the system+user prompt that will be sent to Groq LLM (strict JSON format)
 */
function buildStrictPrompt(
  payload: z.infer<typeof RecommendationRequestZ>,
  cardDocs: z.infer<typeof CardDocZ>[],
  intentAnalysis?: IntentAnalysis,
): Array<{ role: string; content: string }> {
  // Build system prompt with deck analysis context
  let system = STRICT_SYSTEM_PROMPT;
  
  if (payload.deckAnalysis) {
    const da = payload.deckAnalysis;
    system = system
      .replace('{primaryArchetype}', da.primaryArchetype || 'Unknown')
      .replace('{playstyle}', da.playstyle)
      .replace('{deckSize}', da.deckSize.toString())
      .replace('{mainDeckSize}', da.mainDeckSize.toString())
      .replace('{extraDeckSize}', da.extraDeckSize.toString())
      .replace('{monsters}', da.ratios.monsters.toString())
      .replace('{spells}', da.ratios.spells.toString())
      .replace('{traps}', da.ratios.traps.toString())
      .replace('{monstersPercent}', da.ratios.monstersPercent.toFixed(1))
      .replace('{spellsPercent}', da.ratios.spellsPercent.toFixed(1))
      .replace('{trapsPercent}', da.ratios.trapsPercent.toFixed(1))
      .replace('{winCondition}', da.winCondition)
      .replace('{estimatedBrickRate}', (da.estimatedBrickRate * 100).toFixed(1))
      .replace('{starters}', da.cardRoles.starters.toString())
      .replace('{extenders}', da.cardRoles.extenders.toString())
      .replace('{interruptions}', da.cardRoles.interruptions.toString())
      .replace('{missingStaples}', da.missingStaples.map(s => s.cardName).join(', ') || 'None detected');
  } else {
    // Fallback if no deck analysis provided
    system = system
      .replace('{primaryArchetype}', 'Unknown')
      .replace('{playstyle}', 'Unknown')
      .replace('{deckSize}', '0')
      .replace('{mainDeckSize}', '0')
      .replace('{extraDeckSize}', '0')
      .replace('{monsters}', '0')
      .replace('{spells}', '0')
      .replace('{traps}', '0')
      .replace('{monstersPercent}', '0')
      .replace('{spellsPercent}', '0')
      .replace('{trapsPercent}', '0')
      .replace('{winCondition}', 'Unknown')
      .replace('{estimatedBrickRate}', '0')
      .replace('{starters}', '0')
      .replace('{extenders}', '0')
      .replace('{interruptions}', '0')
      .replace('{missingStaples}', 'None detected');
  }
  
  if (intentAnalysis) {
    system = system
      .replace('{intentPrimary}', intentAnalysis.primary)
      .replace('{intentConfidence}', (intentAnalysis.confidence * 100).toFixed(0) + '%')
      .replace('{searchStrategy}', JSON.stringify(intentAnalysis.searchStrategy));
  } else {
    system = system
      .replace('{intentPrimary}', 'general')
      .replace('{intentConfidence}', '0%')
      .replace('{searchStrategy}', JSON.stringify({ boostTerms: [], excludeStaples: false, diversityLambda: 0.6, archetypeSpecific: false }));
  }
  
  system = system
    .replace('{question}', payload.question || '')
    .replace('{toonTable}', toTOON({
      name: "candidate_cards",
      items: cardDocs.map((c) => ({
        id: c.id,
        name: c.name,
        archetype: c.archetype || "",
        type: c.type || "",
        desc: (c.desc || "").slice(0, 320),
      })),
      fields: ["id", "name", "archetype", "type", "desc"],
      truncate: { desc: 320 },
    }));

  // Build number constraint instruction
  let numberConstraintInstruction = "";
  if (payload.numberConstraint) {
    if (payload.numberConstraint.exact !== undefined) {
      numberConstraintInstruction = `\n\nIMPORTANT: The user specifically requested exactly ${payload.numberConstraint.exact} card recommendation(s). Please provide exactly ${payload.numberConstraint.exact} recommendation(s) in the recommendations array. Do not provide more or fewer.`;
    } else if (
      payload.numberConstraint.min !== undefined &&
      payload.numberConstraint.max !== undefined
    ) {
      numberConstraintInstruction = `\n\nIMPORTANT: The user requested between ${payload.numberConstraint.min} and ${payload.numberConstraint.max} card recommendations. Please provide between ${payload.numberConstraint.min} and ${payload.numberConstraint.max} recommendations in the recommendations array.`;
    } else if (payload.numberConstraint.min !== undefined) {
      numberConstraintInstruction = `\n\nIMPORTANT: The user requested at least ${payload.numberConstraint.min} card recommendation(s). Please provide at least ${payload.numberConstraint.min} recommendation(s) in the recommendations array.`;
    } else if (payload.numberConstraint.max !== undefined) {
      numberConstraintInstruction = `\n\nIMPORTANT: The user requested at most ${payload.numberConstraint.max} card recommendation(s). Please provide at most ${payload.numberConstraint.max} recommendation(s) in the recommendations array.`;
    }
  }

  const userObj = {
    currentDeck: payload.current_deck || { main: [], extra: [], side: [] },
    userPrefs: payload.userPrefs || {},
    format: payload.format || "MASTER_DUEL",
    explainTo: payload.explainTo || "novice",
    maxOutputTokens: payload.maxOutputTokens || MAX_OUTPUT_TOKENS,
    numberConstraint: payload.numberConstraint || undefined,
    conversationContext: payload.conversationContext || undefined,
    cardPoolSummaries: cardDocs.map((c) => ({
      id: c.id,
      name: c.name,
      archetype: c.archetype,
      ban_tcg: c.ban_tcg,
      desc: (c.desc || "").slice(0, MAX_PROMPT_CARD_SUMMARY_CHARS),
    })),
  };

  const userContent = JSON.stringify(userObj) + numberConstraintInstruction;

  const messages = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];

  return messages;
}

/**
 * Try to parse model output strictly as JSON; if it's a string with extra text,
 * attempt to find the first JSON object substring.
 */
//: Deprecated - use extractJsonRobust from utils/json-extraction.ts instead
// Keeping for backward compatibility during transition
function extractJsonLike(text: string): any {
  return extractJsonRobust(text);
}

/**
 * Validate model output using zod; throws on invalid
 */
function validateRecommender(parsed: unknown): z.infer<typeof RecommenderZ> {
  return RecommenderZ.parse(parsed);
}

Deno.serve(async (req) => {
  //: Track which prompt type was used for A/B testing (declared early for error logging)
  let promptType: "strict" | "simple" = "strict";
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  //: Reset pipeline steps at start of each request
  resetPipelineSteps();
  const requestStartTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify Supabase connection by testing cards table access
    const { data: testCards, error: testError } = await supabase
      .from("cards")
      .select("id")
      .limit(1);
    
    if (testError) {
      console.error("❌ Cannot access cards table:", {
        error: testError.message,
        code: testError.code,
        details: testError.details,
        hint: testError.hint,
      });
    } else {
      console.log(`✅ Cards table accessible. Test query returned ${testCards?.length || 0} cards`);
    }

    // Check authentication
    const authHeader = req.headers.get("Authorization");
    console.log("🔐 Auth check:", {
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader?.length || 0,
      authHeaderPrefix: authHeader?.substring(0, 20) || "none",
    });

    if (!authHeader) {
      console.error("❌ No Authorization header provided");
      return new Response(
        JSON.stringify({
          error: "Authentication required.",
          details:
            "No Authorization header found in request. Please ensure you are logged in.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token.length === 0) {
      console.error("❌ Empty token after Bearer prefix removal");
      return new Response(
        JSON.stringify({
          error: "Invalid authentication token.",
          details: "Token is empty or malformed.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Basic JWT structure validation (should have 3 parts separated by dots)
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      console.error(
        "❌ Token doesn't appear to be a valid JWT (expected 3 parts, got",
        tokenParts.length,
        ")",
      );
      console.error("   Token preview:", token.substring(0, 50), "...");
      return new Response(
        JSON.stringify({
          error: "Invalid token format.",
          details:
            "Token does not appear to be a valid JWT. Please ensure you are using an access token, not an API key.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Try to decode the payload to check for 'sub' claim (without verification)
    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log("🔍 Token payload preview:", {
        hasSub: !!payload.sub,
        sub: payload.sub,
        exp: payload.exp,
        iat: payload.iat,
        aud: payload.aud,
      });

      if (!payload.sub) {
        console.error("❌ Token missing 'sub' claim in payload");
        return new Response(
          JSON.stringify({
            error: "Invalid token: missing user identifier.",
            details:
              "The provided token does not contain a user identifier (sub claim). This might be an API key instead of an access token. Please ensure you are logged in and using a valid access token.",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } catch (decodeErr) {
      console.error("❌ Failed to decode token payload:", decodeErr);
      // Continue anyway - let Supabase handle validation
    }

    console.log(
      "🔍 Validating token with Supabase (length:",
      token.length,
      ")",
    );
    let user;
    try {
      // Create a client with anon key for user token validation
      // The service role key can validate user tokens, but let's be explicit
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError) {
        console.error(
          "❌ Auth error:",
          authError.message,
          "Status:",
          authError.status,
        );
        console.error("   Error details:", JSON.stringify(authError));
        return new Response(
          JSON.stringify({
            error: "Authentication failed.",
            details:
              authError.message ||
              "Invalid or expired token. Please try logging in again.",
            error_code: authError.status,
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      user = authUser;
      if (!user) {
        console.error("❌ No user returned from auth.getUser()");
        return new Response(
          JSON.stringify({
            error: "User not authenticated.",
            details: "Token validation succeeded but no user found.",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.log("✅ User authenticated:", user.id);
    } catch (err) {
      console.error("❌ Exception during auth validation:", err);
      return new Response(
        JSON.stringify({
          error: "Authentication validation failed.",
          details: err instanceof Error ? err.message : "Unknown error",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Generate recommendation_id for tracking and feedback
    const recommendationId = crypto.randomUUID();
    const startTime = Date.now();

    // Parse and validate request with Zod
    const body = await req.json();
    const parsedReq = RecommendationRequestZ.safeParse(body);

    if (!parsedReq.success) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          details: parsedReq.error.format(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const reqVal = parsedReq.data;
    const {
      question,
      current_deck,
      format = "MASTER_DUEL",
      recommendation_type = "personalized",
      use_hybrid_search = true,
      explainTo = "novice",
      userPrefs,
      maxOutputTokens = MAX_OUTPUT_TOKENS,
    } = reqVal;

    //: Deck Legality Check
    const mainCount = (current_deck?.main || []).reduce(
      (s, c) => s + c.count,
      0,
    );

    if (mainCount < 40 || mainCount > 60) {
      const payload = {
        schemaVersion: "1.0.0",
        confidence: 0.0,
        explainTo: explainTo,
        summary: `Deck legality: main deck must be 40-60 cards. Current main deck size: ${mainCount}. Please adjust before applying suggestions.`,
        recommendations: [],
        ui: [
          {
            id: "legality",
            type: "text",
            content: `Deck legality issue: main deck size ${mainCount}. Fix deck to 40–60.`,
          },
          {
            id: "investigate",
            type: "suggestion",
            content: {
              suggestionId: "fix_deck_size",
              label: "Open deck editor",
              verb: "preview",
            },
          },
        ],
        actions: {},
        meta: { mainCount },
      };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!question) {
      return new Response(JSON.stringify({ error: "question is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load banlist
    const banlist =
      format === "MASTER_DUEL" ? await loadMasterDuelBanlist(supabase) : {};

    const banlistText = Object.entries(banlist)
      .filter(([, status]) => status === "Forbidden" || status === "Limited")
      .slice(0, 30)
      .map(([name, status]) => `${name}: ${status}`)
      .join("\n");

    // Get user profile for personalized recommendations
    let userProfile: any = null;
    if (recommendation_type === "personalized") {
      userProfile = await analyzeUserProfile(supabase, user.id, format);
    }

    //: Convert new deck format (main/extra/side with cardId/count) to old format for compatibility
    // First, collect all cardIds from the new format
    const deckCardIds: number[] = [];
    if (current_deck) {
      deckCardIds.push(...(current_deck.main || []).map((c) => c.cardId));
      deckCardIds.push(...(current_deck.extra || []).map((c) => c.cardId));
      deckCardIds.push(...(current_deck.side || []).map((c) => c.cardId));
    }

    // Fetch actual card data for deck cards (needed for old format compatibility)
    let allDeckCards: Card[] = [];
    if (deckCardIds.length > 0) {
      const uniqueDeckCardIds = [...new Set(deckCardIds)];
      const { data: deckCardData } = await supabase
        .from("cards")
        .select("id, name, type, desc, level, race, attribute, archetype, atk, def")
        .in("id", uniqueDeckCardIds);

      if (deckCardData) {
        allDeckCards = deckCardData.map((c: any) => ({
          ...c,
          archetype: getArchetypeNameServer(c),
        })) as Card[];
      }
    }

    const rejectedFromContext =
      reqVal.conversationContext?.userFeedback
        ?.filter((f) => f.accepted === false)
        .map((f) => Number.parseInt(f.cardId, 10))
        .filter((id) => Number.isFinite(id)) || [];

    const excludeIds = Array.from(
      new Set<number>([...allDeckCards.map((c: Card) => c.id), ...rejectedFromContext]),
    );

    // Extract archetypes from deck for exclusion
    const deckArchetypes = new Set<string>();
    allDeckCards.forEach((card: Card) => {
      const arch = getArchetypeNameServer(card);
      if (arch) deckArchetypes.add(arch);
    });
    const excludeArchetypes = Array.from(deckArchetypes);

    //: Perform intent classification if deck analysis is provided
    let intentAnalysis: IntentAnalysis | undefined;
    if (reqVal.deckAnalysis) {
      intentAnalysis = classifyIntent(question, reqVal.deckAnalysis);
      console.log("🎯 Intent classification:", {
        primary: intentAnalysis.primary,
        secondary: intentAnalysis.secondary,
        confidence: intentAnalysis.confidence,
        searchStrategy: intentAnalysis.searchStrategy,
      });
    }
    
    // Analyze question for structured filters (auto-detect)
    const questionFilters = analyzeQuestionForFilters(question);
    console.log("🔍 Question analysis:", {
      question,
      filters: questionFilters,
      detectedArchetypes: questionFilters.archetypes,
    });

    // Build deck context text for embedding (convert to old format)
    const deckForContext = allDeckCards.length > 0
      ? {
          mainDeck: allDeckCards.filter((c) =>
            (current_deck?.main || []).some((dc) => dc.cardId === c.id)
          ),
          extraDeck: allDeckCards.filter((c) =>
            (current_deck?.extra || []).some((dc) => dc.cardId === c.id)
          ),
          sideDeck: allDeckCards.filter((c) =>
            (current_deck?.side || []).some((dc) => dc.cardId === c.id)
          ),
        }
      : {};
    // Build deck context with optional analysis
    const deckAnalysisForContext = reqVal.deckAnalysis ? {
      primaryArchetype: reqVal.deckAnalysis.primaryArchetype,
      playstyle: reqVal.deckAnalysis.playstyle,
      deckSize: reqVal.deckAnalysis.deckSize,
      mainDeckSize: reqVal.deckAnalysis.mainDeckSize,
      extraDeckSize: reqVal.deckAnalysis.extraDeckSize,
      ratios: reqVal.deckAnalysis.ratios,
      cardRoles: reqVal.deckAnalysis.cardRoles,
      winCondition: reqVal.deckAnalysis.winCondition,
      estimatedBrickRate: reqVal.deckAnalysis.estimatedBrickRate,
      missingStaples: reqVal.deckAnalysis.missingStaples,
    } : undefined;
    
    const deckContextText = deckAnalysisForContext 
      ? buildDeckContextText(deckForContext, deckAnalysisForContext)
      : buildDeckContextText(deckForContext);

    //: Expand query with archetype/playstyle terms
    const expandedQuestion = expandQuery(
      question || "",
      reqVal.deckAnalysis,
      intentAnalysis?.primary,
    );
    const queryText = `${expandedQuestion}. ${deckContextText}`;

    //: Log context
    const logContext = {
      recommendationId,
      userId: user.id,
      question: question?.substring(0, 100),
      intent: intentAnalysis?.primary,
      playstyle: reqVal.deckAnalysis?.playstyle,
    };

    // Get card candidates using hybrid search
    let candidateCards: CardCandidate[] = [];

    // If archetype detected, try direct archetype search first (more reliable)
    if (questionFilters.archetypes && questionFilters.archetypes.length > 0) {
      console.log(
        `🎯 Archetype detected, searching directly for: ${questionFilters.archetypes.join(", ")}`,
      );
      for (const arch of questionFilters.archetypes) {
        try {
          const archCards = await findCardsByArchetype(
            supabase,
            arch,
            excludeIds,
          );
          console.log(
            `  Found ${archCards.length} cards for archetype "${arch}"`,
          );
          candidateCards.push(
            ...archCards.map((c) => ({
              id: c.id,
              name: c.name,
              archetype: c.archetype,
              type: c.type,
              desc: c.desc,
            })),
          );
        } catch (err) {
          console.warn(`  Error searching for archetype "${arch}":`, err);
        }
      }
      // Deduplicate by ID
      const seenIds = new Set<number>();
      candidateCards = candidateCards.filter((c) => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
      });
      console.log(
        `📊 After archetype search: ${candidateCards.length} unique candidates`,
      );
    }

    if (use_hybrid_search) {
      try {
        const retrievalStart = logStageStart("RETRIEVAL", logContext);

        //: Check cache for retrieval results
        const cacheKey = JSON.stringify({ query: expandedQuestion, intent: intentAnalysis?.primary, filters: questionFilters });
        let cachedResults = await getCachedRetrieval(expandedQuestion, intentAnalysis?.primary, questionFilters);
        
        if (cachedResults && cachedResults.length > 0) {
          logCache("hit", cacheKey, logContext);
          candidateCards = cachedResults;
          console.log(`[CACHE] Using cached retrieval results: ${cachedResults.length} candidates`);
        } else {
          logCache("miss", cacheKey, logContext);

          //: Generate multiple queries if enabled
          const queries = await generateMultipleQueries(expandedQuestion, intentAnalysis);
          
          //: Check cache for embeddings
          let queryEmbedding: number[] | null = null;
          const cachedEmbedding = await getCachedEmbedding(queryText);
          if (cachedEmbedding) {
            queryEmbedding = cachedEmbedding;
            logCache("hit", `embedding:${queryText.substring(0, 50)}`, logContext);
          } else {
            // Generate embedding for query using the embed edge function
            queryEmbedding = await generateEmbedding(queryText, supabaseUrl, supabaseServiceKey);
            await setCachedEmbedding(queryText, queryEmbedding);
            logCache("miss", `embedding:${queryText.substring(0, 50)}`, logContext);
          }
          console.log("✅ Generated/retrieved query embedding");

          //: Use multi-query retrieval if multiple queries generated
          if (queries.length > 1) {
            console.log(`[MULTI-QUERY] Using ${queries.length} queries for retrieval`);
            const multiQueryResults = await performMultiQueryRetrieval(
              queries,
              deckContextText,
              excludeIds,
              excludeArchetypes,
              format,
              supabase,
            );
            candidateCards.push(...multiQueryResults);
          } else {
            //: Use intent-based retrieval if intent analysis is available
            if (intentAnalysis && reqVal.deckAnalysis) {
              console.log("🎯 Using intent-based retrieval");
              const intentResults = await performIntentBasedRetrieval(
                queryEmbedding,
                expandedQuestion,
                excludeIds,
                format,
                intentAnalysis,
                supabase,
                reqVal.deckAnalysis
              );

              // Merge with archetype results (deduplicate)
              const existingIds = new Set(candidateCards.map((c) => c.id));
              for (const result of intentResults) {
                if (!existingIds.has(result.id)) {
                  candidateCards.push(result);
                  existingIds.add(result.id);
                }
              }
              console.log(
                `📊 Total candidates after intent-based retrieval: ${candidateCards.length}`,
              );
            } else {
              // Fallback to regular hybrid search
              const hybridResults = await hybridSearch(
                {
                  queryEmbedding,
                  queryText: expandedQuestion, // Use expanded question for FTS
                  excludeArchetypes,
                  excludeIds,
                  excludeTypes: questionFilters.excludeTypes,
                  excludeRaces: questionFilters.excludeRaces,
                  banlistFormat: format,
                      vectorWeight: VECTOR_WEIGHT,
                  ftsWeight: FTS_WEIGHT,
                  matchCount: 200, // Get 200 candidates for MMR reranking
                },
                supabase,
              );
              console.log(
                `🔎 Hybrid search found ${hybridResults.length} candidates`,
              );

              // Merge with archetype results (deduplicate)
              const existingIds = new Set(candidateCards.map((c) => c.id));
              for (const result of hybridResults) {
                if (!existingIds.has(result.id)) {
                  candidateCards.push(result);
                  existingIds.add(result.id);
                }
              }
              console.log(
                `📊 Total candidates after hybrid search: ${candidateCards.length}`,
              );
            }
          }

          //: Cache retrieval results
          if (candidateCards.length > 0) {
            await setCachedRetrieval(expandedQuestion, intentAnalysis?.primary, questionFilters, candidateCards);
          }
        }

        logStageEnd("RETRIEVAL", retrievalStart, { ...logContext, candidateCount: candidateCards.length });
      } catch (err) {
        console.error(
          "❌ Hybrid search failed, falling back to simple search:",
          err,
        );
        // Fallback: use simple archetype matching (existing logic)
        if (recommendation_type === "archetype") {
          const archetypeMatch = question.match(
            /(?:for|in|with)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i,
          );
          if (archetypeMatch) {
            const archetypeName = archetypeMatch[1].trim();
            const relatedCards = await findCardsByArchetype(
              supabase,
              archetypeName,
              excludeIds,
            );
            candidateCards = relatedCards.map((c) => ({
              id: c.id,
              name: c.name,
              archetype: c.archetype,
              type: c.type,
              desc: c.desc,
            }));
          }
        }
      }
    } else {
      // Legacy: simple archetype matching
      if (recommendation_type === "archetype") {
        const archetypeMatch = question.match(
          /(?:for|in|with)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i,
        );
        if (archetypeMatch) {
          const archetypeName = archetypeMatch[1].trim();
          const relatedCards = await findCardsByArchetype(
            supabase,
            archetypeName,
            excludeIds,
          );
          candidateCards = relatedCards.map((c) => ({
            id: c.id,
            name: c.name,
            archetype: c.archetype,
            type: c.type,
            desc: c.desc,
          }));
        }
      }
    }

    // Check if we have any candidates
    if (candidateCards.length === 0) {
      console.warn(
        "⚠️ No candidates found! Attempting fallback search with reduced restrictions...",
      );

      // Last resort: Try a very permissive search for generic terms like "engines", "tech cards", etc.
      const genericTerms = [
        "engine",
        "tech",
        "staple",
        "support",
        "combo",
        "extender",
        "searcher",
      ];
      const lowerQuestion = question.toLowerCase();
      const hasGenericTerm = genericTerms.some((term) =>
        lowerQuestion.includes(term),
      );

      if (hasGenericTerm && use_hybrid_search) {
        console.log(
          "🔄 Attempting permissive fallback search for generic term...",
        );
        try {
          // Build a more generic query based on the question
          let fallbackQuery = "useful cards for deck building";
          if (lowerQuestion.includes("engine")) {
            fallbackQuery = "cards that support deck strategy and enable combos";
          } else if (lowerQuestion.includes("tech")) {
            fallbackQuery = "versatile cards that work in many decks";
          } else if (lowerQuestion.includes("staple")) {
            fallbackQuery = "commonly used staple cards";
          } else if (lowerQuestion.includes("support")) {
            fallbackQuery = "support cards for deck strategies";
          }

          console.log(`🔄 Fallback query: "${fallbackQuery}"`);
          const fallbackEmbedding = await getQueryEmbedding(
            `${fallbackQuery}. ${deckContextText}`,
          );

          // Try with minimal exclusions (only exclude deck cards, not archetypes)
          const fallbackResults = await hybridSearch(
            {
              queryEmbedding: fallbackEmbedding,
              queryText: fallbackQuery,
              excludeArchetypes: [], // Don't exclude archetypes for generic searches
              excludeIds: excludeIds.slice(0, 20), // Only exclude first 20 deck cards
              excludeTypes: [],
              excludeRaces: [],
              banlistFormat: format,
              vectorWeight: VECTOR_WEIGHT,
              ftsWeight: FTS_WEIGHT,
              matchCount: 100, // Get fewer candidates
            },
            supabase,
          );

          if (fallbackResults.length > 0) {
            console.log(
              `✅ Fallback search found ${fallbackResults.length} candidates`,
            );
            candidateCards = fallbackResults;
          } else {
            console.warn("⚠️ Fallback search returned no results");
          }
        } catch (err) {
          console.error("❌ Fallback search also failed:", err);
        }
      }

      // If still no candidates, try one more fallback: get random popular cards
      if (candidateCards.length === 0) {
        console.warn(
          "⚠️ No candidates found after all attempts! Trying final fallback: random popular cards...",
        );
        
        try {
          // Final fallback: Get some popular/generic cards that aren't in the deck
          const { data: fallbackCards, error: fallbackError } = await supabase
            .from("cards")
            .select("id, name, type, desc, archetype, ban_tcg")
            .not("id", "in", `(${excludeIds.length > 0 ? excludeIds.slice(0, 50).join(",") : "0"})`)
            .limit(50);
          
          if (!fallbackError && fallbackCards && fallbackCards.length > 0) {
            console.log(`✅ Fallback found ${fallbackCards.length} generic cards`);
            candidateCards = fallbackCards.map((c: any) => ({
              id: c.id,
              name: c.name,
              archetype: c.archetype,
              type: c.type,
              desc: c.desc || "",
            }));
          }
        } catch (fallbackErr) {
          console.error("❌ Final fallback also failed:", fallbackErr);
        }
      }

      // If STILL no candidates after all fallbacks, return proper error response
      if (candidateCards.length === 0) {
        console.error(
          "❌ No candidates found after ALL fallback attempts! Diagnostic info:",
          {
            question,
            questionFilters,
            excludeIds: excludeIds.length,
            excludeArchetypes,
            use_hybrid_search,
            deckSize: allDeckCards.length,
          },
        );

        const fingerprint = await fingerprintDeck(
          current_deck || {},
          explainTo || "novice",
          userPrefs || {},
        );

        const errorPayload = {
          schemaVersion: "1.0.0",
          confidence: 0.0,
          explainTo: explainTo || "novice",
          summary: `I couldn't find any candidate cards matching "${question}". This might be because the search terms don't match any cards in the database, all matching cards are already in your deck, or the search functions may not be available. Try rephrasing your question.`,
          recommendations: [],
          ui: [
            {
              id: "no_candidates",
              type: "text",
              content: `I couldn't find any cards matching your request. Try rephrasing your question or being more specific. For example:
- "What archetype cards work with this deck?"
- "Recommend Spell cards for this strategy"
- "What tech cards counter [specific archetype]?"`,
            },
          ],
          actions: {
            applyAllowed: false,
            investigateRecommended: true,
          },
          meta: {
            deckFingerprint: fingerprint,
            recommendation_id: recommendationId,
            diagnostic: {
              question,
              filters: questionFilters,
              candidates_found: 0,
              exclude_ids_count: excludeIds.length,
              exclude_archetypes: excludeArchetypes,
            },
          },
        };

        return new Response(JSON.stringify(errorPayload), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
      }
    }

    //: Apply negative filtering
    if (candidateCards.length > 0 && question) {
      const negativeFilters = detectNegativeFilters(question);
      const originalCount = candidateCards.length;
      candidateCards = applyNegativeFilters(candidateCards, negativeFilters);
      if (candidateCards.length < originalCount) {
        console.log(`[NEGATIVE-FILTER] Filtered ${originalCount - candidateCards.length} cards based on negative filters`);
      }
    }

    //: Apply synergy scoring and diminishing returns before MMR
    let scoredCandidates: Array<CardCandidate & { synergyScore?: number; diminishingReturnsPenalty?: number }> = candidateCards;
    
    if (candidateCards.length > 0 && reqVal.deckAnalysis) {
      const scoringStart = logStageStart("SCORING", logContext);
      
      // Apply synergy scoring
      scoredCandidates = applySynergyScoring(
        candidateCards,
        allDeckCards,
        reqVal.deckAnalysis,
      );

      // Apply diminishing returns
      scoredCandidates = applyDiminishingReturns(
        scoredCandidates,
        reqVal.deckAnalysis,
      );

      // Combine scores for ranking (multiply base score by synergy boost and diminishing returns penalty)
      scoredCandidates = scoredCandidates.map(c => ({
        ...c,
        hybrid_score: (c.hybrid_score || c.vector_sim || 0.5) * (1 + (c.synergyScore || 0) * 0.3) * (c.diminishingReturnsPenalty || 1.0),
      }));

      // Sort by combined score
      scoredCandidates.sort((a, b) => (b.hybrid_score || 0) - (a.hybrid_score || 0));

      logScoring(
        scoredCandidates.length,
        scoredCandidates.slice(0, 5).map(c => ({ name: c.name, score: c.hybrid_score || 0 })),
        logContext,
      );
      logStageEnd("SCORING", scoringStart, logContext);
    }

    // Apply MMR reranking (enabled by default, skip for "simple" type)
    // IMPORTANT: If archetype was detected, prioritize archetype matches
    let finalCandidates: CardCandidate[] = scoredCandidates;

    // Check if we have archetype matches that should be prioritized
    const detectedArchetypes = questionFilters.archetypes || [];
    const archetypeMatches =
      detectedArchetypes.length > 0
        ? candidateCards.filter((c) =>
            detectedArchetypes.some(
              (arch) =>
                c.archetype?.toLowerCase().includes(arch.toLowerCase()) ||
                arch.toLowerCase().includes(c.archetype?.toLowerCase() || ""),
            ),
          )
        : [];

    console.log(
      `🎯 Found ${archetypeMatches.length} archetype matches out of ${candidateCards.length} total candidates`,
    );
    if (archetypeMatches.length > 0) {
      console.log(
        `   Archetype match names: ${archetypeMatches.map((c) => c.name).join(", ")}`,
      );
    }

    if (
      use_hybrid_search &&
      recommendation_type !== "simple" &&
      candidateCards.length > 0
    ) {
      try {
        // Fetch embeddings for MMR from card_embeddings table
        const candidateIds = candidateCards.map((c) => c.id);
        const { data: embRows } = await supabase
          .from("card_embeddings")
          .select("card_id, embedding")
          .in("card_id", candidateIds);

        const embMap = new Map<number, number[]>();
        for (const e of embRows || []) {
          if (e.embedding && Array.isArray(e.embedding)) {
            embMap.set(e.card_id, e.embedding);
          }
        }

        // Generate query embedding if not already done (use embed edge function)
        const queryEmbedding = await generateEmbedding(queryText, supabaseUrl, supabaseServiceKey);

        // Prepare MMR candidates
        // Boost scores for archetype matches to ensure they're included
        const archetypeMatchIds = new Set(archetypeMatches.map((c) => c.id));
        const mmrCandidates: MMRCandidate[] = candidateCards.map((c) => {
          const baseSim = c.hybrid_score ?? c.vector_sim ?? 0;
          // Boost archetype matches significantly to ensure they're selected
          const boostedSim = archetypeMatchIds.has(c.id)
            ? baseSim + 0.5
            : baseSim;
          // Use intent score if available, otherwise use boosted similarity
          const finalSim = (c as any).intentScore ?? boostedSim;
          return {
            id: c.id,
            embedding: embMap.get(c.id) ?? null,
            sim: finalSim,
            row: c,
          };
        });

        // Apply MMR reranking with intent-specific lambda if available
        const mmrLambda = intentAnalysis?.searchStrategy.diversityLambda || MMR_LAMBDA;
        const mmrSelected = mmrSelect(
          mmrCandidates,
          queryEmbedding,
          MAX_CANDIDATES_TO_LLM,
          mmrLambda,
        );
        finalCandidates = mmrSelected.map((s) => s.row);

        // Ensure archetype matches are included (add any missing ones)
        const finalIds = new Set(finalCandidates.map((c) => c.id));
        for (const archMatch of archetypeMatches) {
          if (!finalIds.has(archMatch.id)) {
            finalCandidates.push(archMatch);
            finalIds.add(archMatch.id);
            console.log(
              `  ➕ Added archetype match to final candidates: ${archMatch.name}`,
            );
          }
        }

        // Limit to MAX_CANDIDATES_TO_LLM (but keep archetype matches)
        if (finalCandidates.length > MAX_CANDIDATES_TO_LLM) {
          // Keep all archetype matches, then fill rest with top non-archetype matches
          const archetypeInFinal = finalCandidates.filter((c) =>
            archetypeMatchIds.has(c.id),
          );
          const nonArchetype = finalCandidates
            .filter((c) => !archetypeMatchIds.has(c.id))
            .sort(
              (a, b) =>
                (b.hybrid_score ?? b.vector_sim ?? 0) -
                (a.hybrid_score ?? a.vector_sim ?? 0),
            )
            .slice(0, MAX_CANDIDATES_TO_LLM - archetypeInFinal.length);
          finalCandidates = [...archetypeInFinal, ...nonArchetype];
        }

        console.log(
          `🎯 After MMR reranking: ${finalCandidates.length} final candidates`,
        );
        const archetypeInFinal = finalCandidates.filter((c) =>
          archetypeMatchIds.has(c.id),
        ).length;
        console.log(`   Includes ${archetypeInFinal} archetype matches`);
      } catch (err) {
        console.warn(
          "⚠️ MMR reranking failed, using top candidates by score:",
          err,
        );
        // Fallback: just take top candidates by hybrid_score
        finalCandidates = candidateCards
          .sort(
            (a, b) =>
              (b.hybrid_score ?? b.vector_sim ?? 0) -
              (a.hybrid_score ?? a.vector_sim ?? 0),
          )
          .slice(0, MAX_CANDIDATES_TO_LLM);
      }
    } else {
      // No MMR: just take top candidates
      finalCandidates = candidateCards
        .sort(
          (a, b) =>
            (b.hybrid_score ?? b.vector_sim ?? 0) -
            (a.hybrid_score ?? a.vector_sim ?? 0),
        )
        .slice(0, MAX_CANDIDATES_TO_LLM);
    }

    // Convert candidates to TOON format for efficient token usage
    const toonTable = toTOON({
      name: "candidate_cards",
      items: finalCandidates.map((c) => ({
        id: c.id,
        name: c.name,
        archetype: c.archetype || "",
        type: c.type || "",
        desc: (c.desc || "").slice(0, 320), // Truncate to 320 chars
      })),
      fields: ["id", "name", "archetype", "type", "desc"],
      truncate: { desc: 320 },
    });

    console.log(
      `📋 TOON table generated: ${toonTable.length} chars, ${finalCandidates.length} cards`,
    );
    console.log(
      `📝 Sample candidate names: ${finalCandidates
        .slice(0, 5)
        .map((c) => c.name)
        .join(", ")}`,
    );
    console.log(
      `📝 All candidate names: ${finalCandidates.map((c) => c.name).join(", ")}`,
    );
    console.log(
      `📝 TOON table preview (first 1000 chars):\n${toonTable.slice(0, 1000)}`,
    );

    // Check if any candidates match the question keywords
    const questionLower = question.toLowerCase();
    const matchingCandidates = finalCandidates.filter(
      (c) =>
        c.name.toLowerCase().includes(questionLower) ||
        c.archetype?.toLowerCase().includes(questionLower) ||
        c.desc?.toLowerCase().includes(questionLower),
    );
    console.log(
      `🎯 Candidates matching question keywords: ${matchingCandidates.length}`,
    );
    if (matchingCandidates.length > 0) {
      console.log(
        `   Matches: ${matchingCandidates.map((c) => c.name).join(", ")}`,
      );
    }

    const profileText = userProfile
      ? `User Profile:
- Preferred Archetypes: ${userProfile.preferredArchetypes.join(", ") || "None"}
- Playstyle Pattern: ${userProfile.playstylePattern}
- Skill Level: ${userProfile.skillLevel}
- Frequently Used Cards: ${userProfile.frequentlyUsedCards.slice(0, 5).join(", ")}
- Deck Count: ${userProfile.deckCount}`
      : "";

    const deckSummary =
      allDeckCards.length > 0
        ? `Deck contains ${allDeckCards.length} cards. Key archetypes: ${excludeArchetypes.join(", ") || "None"}.`
        : "No deck provided.";

    // Validate TOON table has content (skip for explanation questions)
    const intentClassified = classifyIntentLegacy(question);
    const isExplanation = intentClassified === "explanation";

    if ((!toonTable || toonTable.trim().length === 0) && !isExplanation) {
      console.error(
        "❌ TOON table is empty! This should not happen if finalCandidates.length > 0",
      );

      // Log error
      const { error: logError } = await supabase
        .from("recommendation_logs")
        .insert({
          recommendation_id: recommendationId,
          user_id: user.id,
          question,
          format,
          recommendation_type,
          use_hybrid_search,
          candidate_count: candidateCards.length,
          final_candidate_count: 0,
          response_version: "1.0",
          error_message: "TOON table is empty",
          //: Track prompt type even for errors
          prompt_type: promptType,
          simple_prompt_rollout: SIMPLE_PROMPT_ROLLOUT,
        });
      if (logError) {
        console.error("Failed to log error:", logError);
      }

      return new Response(
        JSON.stringify({
          answer: `Error: No candidate cards were found or formatted correctly. Please try again or rephrase your question.`,
          validated_cards: [],
          recommendation_id: recommendationId,
          response_version: "1.0",
          diagnostic: {
            question,
            finalCandidatesCount: finalCandidates.length,
            toonTableLength: toonTable?.length || 0,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // For explanation questions, allow proceeding even without candidate cards
    if (isExplanation && (!toonTable || toonTable.trim().length === 0)) {
      console.log(
        "ℹ️ Explanation question with no candidates - proceeding with deck context only",
      );
    }

    //: Convert finalCandidates to CardDoc format for strict schema (batch fetch)
    const candidateIds = finalCandidates.map((c) => c.id);
    const deckCardIdsForFetch = allDeckCards.map((c) => c.id);
    const allIdsToFetch = [...new Set([...candidateIds, ...deckCardIdsForFetch.slice(0, 10)])].slice(0, RETRIEVAL_K);

    console.log(`🔍 Fetching card data for ${allIdsToFetch.length} IDs (${candidateIds.length} candidates, ${deckCardIdsForFetch.slice(0, 10).length} deck cards)`);
    console.log(`🔍 Sample candidate IDs:`, candidateIds.slice(0, 5));
    console.log(`🔍 Sample IDs to fetch:`, allIdsToFetch.slice(0, 5));
    console.log(`🔍 All IDs to fetch (first 10):`, allIdsToFetch.slice(0, 10));
    console.log(`🔍 ID types:`, allIdsToFetch.slice(0, 5).map(id => ({ id, type: typeof id })));

    // Ensure all IDs are numbers (not strings)
    const numericIds = allIdsToFetch.map(id => {
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      if (isNaN(numId)) {
        console.warn(`⚠️ Invalid ID found: ${id} (type: ${typeof id})`);
        return null;
      }
      return numId;
    }).filter((id): id is number => id !== null);

    console.log(`🔍 After numeric conversion: ${numericIds.length} valid IDs`);

    if (numericIds.length === 0) {
      console.error("❌ No valid numeric IDs to fetch!");
      const fingerprint = await fingerprintDeck(
        current_deck || {},
        explainTo || "novice",
        userPrefs || {},
      );
      const errorPayload = {
        schemaVersion: "1.0.0",
        confidence: 0.0,
        explainTo: explainTo || "novice",
        summary: "Invalid card IDs found. Cannot fetch card data.",
        recommendations: [],
        ui: [
          {
            id: "invalid_ids",
            type: "text",
            content: "Error: Invalid card IDs detected. Please try again.",
          },
        ],
        actions: {
          applyAllowed: false,
          investigateRecommended: true,
        },
        meta: {
          deckFingerprint: fingerprint,
          recommendation_id: recommendationId,
          diagnostic: {
            candidateCount: finalCandidates.length,
            cardDocsCount: 0,
      question,
            invalidIds: allIdsToFetch.filter(id => {
              const numId = typeof id === 'string' ? parseInt(id, 10) : id;
              return isNaN(numId);
            }),
          },
        },
      };
      return new Response(JSON.stringify(errorPayload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cardDataBatch, error: cardFetchError } = await supabase
      .from("cards")
      .select("id, name, desc, archetype, ban_tcg, type")
      .in("id", numericIds);

    if (cardFetchError) {
      console.error("❌ Error fetching card data:", {
        error: cardFetchError.message,
        code: cardFetchError.code,
        details: cardFetchError.details,
        hint: cardFetchError.hint,
        idsCount: allIdsToFetch.length,
        sampleIds: allIdsToFetch.slice(0, 5),
      });
    } else {
      console.log(`✅ Card data fetch successful: ${cardDataBatch?.length || 0} cards returned`);
    }

    // Use the banlist already loaded earlier (or load it if not available)
    // Create a set of banned card names for quick lookup
    const bannedCardNames = new Set(
      format === "MASTER_DUEL" && banlist
        ? Object.entries(banlist)
            .filter(([, status]) => status === "Forbidden" || status === "Limited")
            .map(([name]) => name.toLowerCase())
        : []
    );

    const cardDocs: z.infer<typeof CardDocZ>[] = [];
    if (cardDataBatch && cardDataBatch.length > 0) {
      // Create a map for quick lookup
      const candidateMap = new Map(finalCandidates.map((c) => [c.id, c]));
      const deckCardMap = new Map(allDeckCards.map((c) => [c.id, c]));

      for (const cardData of cardDataBatch) {
        try {
          const candidate = candidateMap.get(cardData.id);
          const deckCard = deckCardMap.get(cardData.id);
          // Check if card is banned in Master Duel format
          const isMasterDuelBanned = format === "MASTER_DUEL" 
            ? bannedCardNames.has(cardData.name.toLowerCase())
            : false;
          
          const cardDoc = CardDocZ.parse({
            id: cardData.id,
            name: cardData.name,
            desc: cardData.desc || candidate?.desc || deckCard?.desc || "",
            archetype: cardData.archetype || candidate?.archetype || deckCard?.archetype || null,
            ban_tcg: cardData.ban_tcg || null,
            master_duel_banned: isMasterDuelBanned,
            imageurl: null, // imageurl column doesn't exist in cards table
            type: cardData.type || candidate?.type || deckCard?.type || "",
          });
          cardDocs.push(cardDoc);
        } catch (err) {
          console.warn(`⚠️ Failed to validate card ${cardData.id}:`, err);
        }
      }
    } else {
      console.warn(`⚠️ No card data returned from database query. Expected ${allIdsToFetch.length} cards, got ${cardDataBatch?.length || 0}`);
      // Try fetching cards one by one as a fallback to see if it's a batch size issue
      if (candidateIds.length > 0 && candidateIds.length <= 100) {
        console.log(`🔄 Attempting individual card fetches for ${candidateIds.length} candidates...`);
        const numericCandidateIds = candidateIds.map(id => {
          const numId = typeof id === 'string' ? parseInt(id, 10) : id;
          return isNaN(numId) ? null : numId;
        }).filter((id): id is number => id !== null);

        const individualFetches = await Promise.all(
          numericCandidateIds.slice(0, 30).map(async (id) => {
            const { data, error } = await supabase
              .from("cards")
              .select("id, name, desc, archetype, ban_tcg, type")
              .eq("id", id)
              .single();
            if (!error && data) {
              try {
                const candidate = finalCandidates.find((c) => c.id === id);
                // Check if card is banned in Master Duel format
                const isMasterDuelBanned = format === "MASTER_DUEL" 
                  ? bannedCardNames.has(data.name.toLowerCase())
                  : false;
                
                const cardDoc = CardDocZ.parse({
                  id: data.id,
                  name: data.name,
                  desc: data.desc || candidate?.desc || "",
                  archetype: data.archetype || candidate?.archetype || null,
                  ban_tcg: data.ban_tcg || null,
                  master_duel_banned: isMasterDuelBanned,
                  imageurl: null, // imageurl column doesn't exist in cards table
                  type: data.type || candidate?.type || "",
                });
                return cardDoc;
              } catch (parseErr) {
                console.warn(`⚠️ Failed to parse card ${id}:`, parseErr);
                return null;
              }
            } else if (error) {
              console.warn(`⚠️ Error fetching card ${id}:`, error.message);
            }
            return null;
          })
        );
        const validFetches = individualFetches.filter((c): c is z.infer<typeof CardDocZ> => c !== null);
        if (validFetches.length > 0) {
          console.log(`✅ Individual fetches found ${validFetches.length} cards`);
          cardDocs.push(...validFetches);
        } else {
          console.warn(`⚠️ Individual fetches also returned 0 cards. This suggests the card IDs don't exist in the database.`);
          // Last resort: try to get ANY cards from the database to verify it's accessible
          const { data: anyCards, error: anyError } = await supabase
            .from("cards")
            .select("id, name")
            .limit(5);
          if (anyError) {
            console.error(`❌ Cannot access cards table at all:`, anyError);
          } else {
            console.log(`ℹ️ Cards table is accessible. Found ${anyCards?.length || 0} sample cards. This suggests the candidate IDs don't match database IDs.`);
            if (anyCards && anyCards.length > 0) {
              console.log(`   Sample card IDs in DB:`, anyCards.map(c => c.id).slice(0, 5));
            }
          }
        }
      }
    }

    // Prioritize candidates over deck cards
    const candidateCardDocs = cardDocs.filter((c) => candidateIds.includes(c.id));
    const deckCardDocs = cardDocs.filter((c) => !candidateIds.includes(c.id) && deckCardIdsForFetch.includes(c.id));
    const prioritizedCardDocs = [...candidateCardDocs, ...deckCardDocs].slice(0, RETRIEVAL_K);

    console.log(`📊 Fetched ${prioritizedCardDocs.length} card docs (${candidateCardDocs.length} candidates, ${deckCardDocs.length} deck cards)`);

    //: Check if we have card data before calling LLM
    if (prioritizedCardDocs.length === 0) {
      console.warn("⚠️ No card docs available - returning error response");
      const fingerprint = await fingerprintDeck(
        current_deck || {},
        explainTo || "novice",
        userPrefs || {},
      );
      const errorPayload = {
        schemaVersion: "1.0.0",
        confidence: 0.0,
        explainTo: explainTo || "novice",
        summary: "Insufficient data to provide recommendations. No candidate cards were found matching your query.",
        recommendations: [],
        ui: [
          {
            id: "insufficient_data",
            type: "text",
            content: "I couldn't find any cards matching your request. Try rephrasing your question or being more specific about what you're looking for.",
          },
        ],
        actions: {
          applyAllowed: false,
          investigateRecommended: true,
        },
        meta: {
          deckFingerprint: fingerprint,
          recommendation_id: recommendationId,
          diagnostic: {
            candidateCount: finalCandidates.length,
            cardDocsCount: 0,
            question,
          },
        },
      };
      return new Response(JSON.stringify(errorPayload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    //: Two-Stage LLM Architecture
    let reasoning: ReasoningOutput | undefined;
    let llmResp: { content: string; raw: any };
    let stage1Duration = 0;
    let stage2Duration = 0;
    // promptType is already declared at function start

    if (ENABLE_TWO_STAGE) {
      try {
        // Stage 1: Generate reasoning
        console.log("[TWO-STAGE] Starting Stage 1: Reasoning");
        const stage1Start = Date.now();
        
        //: Fetch meta context if needed
        let metaContext: string | undefined;
        const targetDeck = (intentAnalysis as any)?.targetDeck; //: targetDeck may not be in type yet
        if (intentAnalysis?.primary === 'meta' || targetDeck) {
          try {
            console.log("[META] Fetching meta context...");
            metaContext = await buildMetaContext(format);
            
            // Only proceed if meta context was successfully fetched (non-empty)
            if (metaContext && metaContext.length > 0) {
              // If target deck specified, get counter cards info
              if (targetDeck) {
                try {
                  const counterCards = await getCounterCards(targetDeck, format);
                  if (counterCards.length > 0) {
                    metaContext += `\n\nCounter cards for ${targetDeck}:\n`;
                    counterCards.slice(0, 5).forEach(card => {
                      metaContext += `- ${card.cardName}: ${card.explanation}\n`;
                    });
                  }
                } catch (counterError) {
                  console.warn("[META] Failed to fetch counter cards:", counterError);
                  // Continue without counter cards
                }
              }
              
              // Add meta trends
              try {
                const trends = await getMetaTrends(format);
                if (trends.rising.length > 0 || trends.falling.length > 0) {
                  metaContext += `\n\nMeta Trends:\n`;
                  if (trends.rising.length > 0) {
                    metaContext += `Rising: ${trends.rising.slice(0, 3).join(", ")}\n`;
                  }
                  if (trends.falling.length > 0) {
                    metaContext += `Falling: ${trends.falling.slice(0, 3).join(", ")}\n`;
                  }
                }
              } catch (trendsError) {
                console.warn("[META] Failed to fetch meta trends:", trendsError);
                // Continue without trends
              }
            } else {
              console.log("[META] Meta context is empty, skipping meta enhancements");
              metaContext = undefined; // Don't pass empty string
            }
          } catch (error) {
            console.warn("[META] Failed to fetch meta context:", error);
            // Continue without meta context - don't set it to avoid breaking the prompt
            metaContext = undefined;
          }
        }
        
        const candidateSummary = buildCandidateSummary(finalCandidates);
        reasoning = await Promise.race([
          generateReasoning(
            question || "",
            reqVal.deckAnalysis,
            intentAnalysis,
            candidateSummary,
            metaContext,
          ),
          new Promise<ReasoningOutput>((_, reject) =>
            setTimeout(() => reject(new Error("Stage 1 timeout")), MAX_STAGE_TIMEOUT_SECONDS * 1000)
          ),
        ]);

        stage1Duration = Date.now() - stage1Start;
        console.log(`[TWO-STAGE] Stage 1 completed in ${stage1Duration}ms`);
        logReasoning(reasoning, logContext);

        // Stage 2: Generate recommendations with reasoning
        console.log("[TWO-STAGE] Starting Stage 2: Recommendations");
        const stage2Start = Date.now();

        // Convert CardCandidate to Card format for recommendation stage
        const candidateCards: Card[] = prioritizedCardDocs.map((doc) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type || "",
          desc: doc.desc || "",
          archetype: doc.archetype || null,
        }));

        llmResp = await Promise.race([
          generateRecommendations({
            reasoning,
            candidates: candidateCards,
            deckAnalysis: reqVal.deckAnalysis,
            intentAnalysis,
            question: question || "",
            userPrefs,
            explainTo: explainTo || "novice",
            format,
            banlistText,
            maxOutputTokens,
          }),
          new Promise<{ content: string; raw: any }>((_, reject) =>
            setTimeout(() => reject(new Error("Stage 2 timeout")), MAX_STAGE_TIMEOUT_SECONDS * 1000)
          ),
        ]);

        stage2Duration = Date.now() - stage2Start;
        console.log(`[TWO-STAGE] Stage 2 completed in ${stage2Duration}ms`);
      } catch (err) {
        console.error("[TWO-STAGE] Error in two-stage flow:", err);
        
        // Fallback to single-stage approach
        console.log("[TWO-STAGE] Falling back to single-stage approach");
        const messages = buildStrictPrompt(reqVal, prioritizedCardDocs, intentAnalysis);

        if (!GROQ_API_KEY) {
          return new Response(
            JSON.stringify({ error: "GROQ_API_KEY not configured." }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        try {
          const groqResponse = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: MODEL_NAME,
                messages,
                temperature: MODEL_TEMP,
                top_p: 0.8,
                max_tokens: maxOutputTokens,
                stop: ["<<END>>"],
              }),
            },
          );

          if (!groqResponse.ok) {
            const error = await groqResponse.text();
            throw new Error(`LLM call failed: ${groqResponse.status} ${groqResponse.statusText} - ${error}`);
          }

          const result = await groqResponse.json();
          const content = result.choices?.[0]?.message?.content ?? result?.output_text ?? JSON.stringify(result);
          llmResp = { content, raw: result };
        } catch (fallbackErr) {
          console.error("Fallback LLM call error:", fallbackErr);
          const payload = {
            schemaVersion: "1.0.0",
            confidence: 0.0,
            explainTo: explainTo,
            summary: "Failed to call LLM. Please try again.",
            recommendations: [],
            ui: [
              {
                id: "llm_error",
                type: "text",
                content: `LLM call failed: ${fallbackErr instanceof Error ? fallbackErr.message : "Unknown error"}`,
              },
            ],
            actions: {},
            meta: {},
          };
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      // Single-stage approach (Phase 1)
      console.log("[SINGLE-STAGE] Using single-stage approach");
      
      //: A/B Testing - Use simplified prompt based on rollout percentage
      let messages: Array<{ role: string; content: string }>;
      
      if (SIMPLE_PROMPT_ROLLOUT > 0 && Math.random() < SIMPLE_PROMPT_ROLLOUT) {
        console.log(`[PROMPT] Using simplified prompt (rollout: ${(SIMPLE_PROMPT_ROLLOUT * 100).toFixed(1)}%)`);
        promptType = "simple";
        messages = buildSimplePrompt(
          reqVal.question || "",
          reqVal.deckAnalysis || null,
          prioritizedCardDocs,
          intentAnalysis,
          reqVal.format || "MASTER_DUEL",
          reqVal.explainTo || "novice",
          reqVal.numberConstraint
        );
      } else {
        console.log("[PROMPT] Using strict prompt");
        messages = buildStrictPrompt(reqVal, prioritizedCardDocs, intentAnalysis);
      }
      
      logPipelineStep("PROMPT_BUILD", { promptType, messageCount: messages.length }, Date.now());

      if (!GROQ_API_KEY) {
        return new Response(
          JSON.stringify({ error: "GROQ_API_KEY not configured." }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      try {
        const groqResponse = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: MODEL_NAME,
              messages,
              temperature: MODEL_TEMP,
              top_p: 0.8,
              max_tokens: maxOutputTokens,
              stop: ["<<END>>"],
            }),
          },
        );

        if (!groqResponse.ok) {
          const error = await groqResponse.text();
          throw new Error(`LLM call failed: ${groqResponse.status} ${groqResponse.statusText} - ${error}`);
        }

        const result = await groqResponse.json();
        const content = result.choices?.[0]?.message?.content ?? result?.output_text ?? JSON.stringify(result);
        llmResp = { content, raw: result };
      } catch (err) {
        console.error("LLM call error:", err);
        const payload = {
          schemaVersion: "1.0.0",
          confidence: 0.0,
          explainTo: explainTo,
          summary: "Failed to call LLM. Please try again.",
          recommendations: [],
          ui: [
            {
              id: "llm_error",
              type: "text",
              content: `LLM call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          ],
          actions: {},
          meta: {},
        };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("📝 LLM raw response length:", llmResp.content.length);
      console.log(
      "📝 LLM response preview (first 500 chars):",
      llmResp.content.substring(0, 500),
    );

    //: Extract JSON from response using robust extraction
    const jsonExtractionStart = Date.now();
    let parsed = extractJsonRobust(llmResp.content);
    logPipelineStep("JSON_EXTRACTION", {
      success: !!parsed,
      responseLength: llmResp.content.length,
      preview: llmResp.content.substring(0, 200),
    }, jsonExtractionStart);
    
    // Log candidate availability for debugging
    if (cardDocs && cardDocs.length > 0) {
      console.log(`📋 Available candidates for recommendations: ${cardDocs.length} cards`);
      console.log(`📋 Sample candidate IDs: ${cardDocs.slice(0, 5).map(c => c.id).join(", ")}`);
    } else {
      console.warn("⚠️ No candidate cards available for recommendations!");
    }

    // Retry with salvage prompt if JSON extraction fails (max 1 attempt)
    if (!parsed) {
      console.log("⚠️ JSON extraction failed, attempting salvage retry...");
      const salvagePrompt = [
        {
          role: "system",
          content:
            "You must return a single JSON object matching the RECOMMENDER_SCHEMA. Output ONLY raw JSON, no markdown code blocks, no text before or after, no explanations. The JSON MUST include: schemaVersion, confidence, explainTo, reasoning (object), recommendations (array), and ui (array).",
        },
        {
          role: "user",
          content: `The previous response failed validation because it was missing required fields (recommendations array and/or ui array). Please output ONLY the raw JSON object with ALL required fields. Include empty arrays [] for recommendations and ui if you have no recommendations. Previous output: ${llmResp.content.substring(0, 1000)}`,
        },
      ];

      try {
        const salvageResponse = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: MODEL_NAME,
              messages: salvagePrompt,
              temperature: MODEL_TEMP,
              max_tokens: 400,
            }),
          },
        );

        if (salvageResponse.ok) {
          const salvageResult = await salvageResponse.json();
          const salvageContent =
            salvageResult.choices?.[0]?.message?.content ?? "";
          llmResp.content = salvageContent;
          parsed = extractJsonRobust(salvageContent);
          logPipelineStep("JSON_EXTRACTION_RETRY", {
            success: !!parsed,
          }, Date.now());
        }
      } catch (salvageErr) {
        console.error("Salvage retry failed:", salvageErr);
      }
    }

    if (!parsed) {
      const payload = {
        schemaVersion: "1.0.0",
        confidence: 0.0,
        explainTo: explainTo,
        summary: "Model output invalid. Please investigate.",
        recommendations: [],
        ui: [
          {
            id: "err",
            type: "text",
            content:
              "The recommendation engine returned an invalid response. Try again or report.",
          },
          {
            id: "retry",
            type: "suggestion",
            content: {
              suggestionId: "retry_recs",
              label: "Retry recommendation",
              verb: "preview",
            },
          },
        ],
        actions: {},
        meta: { rawModelOutput: llmResp.raw },
      };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    //: Validate parsed JSON with flexible schema
    const validationStart = Date.now();
    let validated;
    try {
      // Ensure recommendations array exists (required field)
      if (!Array.isArray(parsed.recommendations)) {
        parsed.recommendations = [];
        console.warn("⚠️ LLM response missing recommendations array, initializing as empty");
      } else if (parsed.recommendations.length === 0) {
        console.warn(`⚠️ LLM returned empty recommendations array despite having ${cardDocs.length} candidates available`);
        // Generate fallback recommendations BEFORE validation
        if (cardDocs.length > 0) {
          console.log("⚠️ Generating fallback recommendations from candidates...");
          const topCandidates = cardDocs.slice(0, Math.min(5, cardDocs.length));
          parsed.recommendations = topCandidates.map((card, idx) => ({
            cardId: String(card.id),
            cardName: card.name,
            action: "add",
            reason: `This card may help address your request. Consider adding it to test its effectiveness.`,
            impactEst: 0.5 - (idx * 0.05), // Decreasing impact for lower priority
            synergyScore: 0.5,
            evidence: [card.desc ? card.desc.substring(0, 100) : "Card effect"],
            banned: false,
          }));
          console.log(`✅ Generated ${parsed.recommendations.length} fallback recommendations`);
        }
      } else {
        console.log(`✅ LLM generated ${parsed.recommendations.length} recommendations`);
      }
      
      // Use flexible validation (handles field name variations and type coercion)
      validated = validateFlexible(parsed);
      logPipelineStep("VALIDATION", {
        success: true,
        recommendationCount: validated.recommendations.length,
      }, validationStart);
    } catch (e) {
      console.error("❌ Schema validation error:", e);
      console.error("❌ Parsed object keys:", Object.keys(parsed || {}));
      console.error("❌ Parsed recommendations count:", (parsed as any)?.recommendations?.length || 0);
      logPipelineStep("VALIDATION", {
        success: false,
        error: e instanceof Error ? e.message : String(e),
        parsedKeys: Object.keys(parsed || {}),
      }, validationStart);
      
      // If flexible validation fails, try to salvage partial data
      const recs = (parsed as any).recommendations || [];
      const allowedIds = new Set(cardDocs.map((c) => String(c.id)));
      const filteredRecs = recs.filter((r: any) =>
        allowedIds.has(String(r.cardId)),
      );
      parsed.recommendations = filteredRecs;

      // If no recommendations after filtering, but we have candidates, generate fallback recommendations
      if (parsed.recommendations.length === 0 && cardDocs.length > 0) {
        console.warn("⚠️ LLM returned no recommendations, generating fallback from candidates");
        // Generate simple fallback recommendations from top candidates
        const topCandidates = cardDocs.slice(0, Math.min(5, cardDocs.length));
        parsed.recommendations = topCandidates.map((card, idx) => ({
          cardId: String(card.id),
          cardName: card.name,
          action: "add",
          reason: `This card may help address your request. Consider adding it to test its effectiveness.`,
          impactEst: 0.5 - (idx * 0.05), // Decreasing impact for lower priority
          synergyScore: 0.5,
          evidence: [card.desc ? card.desc.substring(0, 100) : "Card effect"],
          banned: false,
        }));
        console.log(`✅ Generated ${parsed.recommendations.length} fallback recommendations`);
      }

      // Ensure reasoning is still valid
      if (!parsed.reasoning || typeof parsed.reasoning !== "object") {
        parsed.reasoning = {
          userIntent: "Analysis requested",
          deckWeaknesses: "Analysis unavailable",
          strategicConsiderations: "Consider deck composition",
          candidateEvaluation: "Select relevant cards",
        };
      } else {
        // Ensure candidateEvaluation exists in reasoning
        if (!parsed.reasoning.candidateEvaluation) {
          parsed.reasoning.candidateEvaluation = parsed.reasoning.recommendationStrategy || "Select relevant cards";
        }
        // Convert array fields to strings if needed (for backward compatibility)
        if (Array.isArray(parsed.reasoning.deckWeaknesses)) {
          parsed.reasoning.deckWeaknesses = parsed.reasoning.deckWeaknesses.join("; ");
        }
        if (Array.isArray(parsed.reasoning.strategicConsiderations)) {
          parsed.reasoning.strategicConsiderations = parsed.reasoning.strategicConsiderations.join("; ");
        }
      }
      
      // Ensure ui array exists (required field) - add default UI block if missing
      if (!Array.isArray(parsed.ui)) {
        parsed.ui = [];
      }
      
      // If ui array is empty, add a default UI block
      if (parsed.ui.length === 0) {
        parsed.ui = [
          {
            id: "recommendations",
            type: "text",
            content: parsed.recommendations.length > 0 
              ? `Found ${parsed.recommendations.length} recommendations for your deck.`
              : "Review the recommendations above.",
          },
        ];
      }

      // Try flexible validation as fallback
      try {
        validated = validateFlexible(parsed);
        console.log("✅ Schema validation passed after sanitization (flexible)");
        logPipelineStep("VALIDATION_FALLBACK", {
          success: true,
          recommendationCount: validated.recommendations.length,
        }, Date.now());
      } catch (err2) {
        console.error("❌ Schema validation failed after sanitization:", err2);
        console.error("❌ Sanitized object preview:", JSON.stringify(parsed, null, 2).substring(0, 1000));
        logPipelineStep("VALIDATION_FALLBACK", {
          success: false,
          error: err2 instanceof Error ? err2.message : String(err2),
        }, Date.now());
        
        const payload = {
          schemaVersion: "1.0.0",
          confidence: 0.0,
          explainTo: explainTo,
          summary: "Model produced invalid recommendation schema after sanitization.",
          recommendations: [],
          ui: [
            {
              id: "err2",
              type: "text",
              content: "The recommender returned an invalid schema. Please retry.",
            },
          ],
          meta: {
            originalParseError: (e as any).toString(),
            secondError: (err2 as any).toString(),
            parsedKeys: Object.keys(parsed || {}),
            recommendationsCount: (parsed as any)?.recommendations?.length || 0,
            hasReasoning: !!(parsed as any)?.reasoning,
          },
        };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    //: Server-side sanitization using new utility
    const sanitizationStart = Date.now();
    let sanitizedRecs: any[] = sanitizeRecommendations(
      validated.recommendations,
      prioritizedCardDocs,
      format,
    );
    logPipelineStep("SANITIZATION", {
      success: true,
      inputCount: validated.recommendations.length,
      outputCount: sanitizedRecs.length,
      filteredOut: validated.recommendations.length - sanitizedRecs.length,
    }, sanitizationStart);

    // If all recommendations were filtered out, generate fallbacks
    if (sanitizedRecs.length === 0 && prioritizedCardDocs.length > 0) {
      console.warn("⚠️ All recommendations filtered out, generating fallback from candidates");
      const topCandidates = prioritizedCardDocs.slice(0, Math.min(5, prioritizedCardDocs.length));
      sanitizedRecs = topCandidates.map((card, idx) => ({
        cardId: String(card.id),
        cardName: card.name,
        action: "add" as const,
        reason: `This card may help address your request. Consider adding it to test its effectiveness.`,
        impactEst: 0.5 - (idx * 0.05),
        synergyScore: 0.5,
        evidence: [card.desc ? card.desc.substring(0, 100) : "Card effect"],
        banned: false,
        card, // Include card object for compatibility
      }));
      console.log(`✅ Generated ${sanitizedRecs.length} fallback recommendations after filtering`);
      logPipelineStep("FALLBACK_GENERATION", {
        success: true,
        fallbackCount: sanitizedRecs.length,
      }, Date.now());
    }

    //: Post-process recommendations with quality enhancements
    if (sanitizedRecs.length > 0) {
      const postProcessStart = logStageStart("POST-PROCESSING", logContext);

      // Build metadata map for confidence calibration and explanation enhancement
      const cardMetadataMap = new Map<number, any>();
      const cardDescMap = new Map<number, string>();
      
      // Fetch metadata for recommended cards (if available in database)
      const recommendedCardIds = sanitizedRecs.map((r: any) => parseInt(r.cardId, 10)).filter((id: number) => !isNaN(id));
      if (recommendedCardIds.length > 0) {
        try {
          // Try to fetch metadata from card_metadata table if it exists
          const { data: metadataRows } = await supabase
            .from("card_metadata")
            .select("card_id, consistency_score, interaction_score, power_ceiling, meta_relevance, is_staple")
            .in("card_id", recommendedCardIds.slice(0, 50)); // Limit to avoid large queries

          if (metadataRows) {
            metadataRows.forEach((row: any) => {
              cardMetadataMap.set(row.card_id, {
                consistency_score: row.consistency_score,
                interaction_score: row.interaction_score,
                power_ceiling: row.power_ceiling,
                meta_relevance: row.meta_relevance,
                is_staple: row.is_staple,
              });
            });
          }
        } catch (err) {
          console.warn("[POST-PROCESSING] Could not fetch card metadata:", err);
        }
      }

      // Build card description map
      prioritizedCardDocs.forEach((doc) => {
        if (doc.desc) {
          cardDescMap.set(doc.id, doc.desc);
        }
      });

      // Apply confidence calibration
      if (intentAnalysis) {
        sanitizedRecs = applyConfidenceCalibration(
          sanitizedRecs,
          cardMetadataMap,
          intentAnalysis.primary,
          reqVal.deckAnalysis,
        );
      }

      // Apply explanation enhancement
      sanitizedRecs = applyExplanationEnhancement(
        sanitizedRecs,
        cardMetadataMap,
        reqVal.deckAnalysis,
        reasoning,
        cardDescMap,
      );

      // Apply priority ordering
      const prioritizedRecs = orderByPriority(sanitizedRecs, 8);
      sanitizedRecs = prioritizedRecs;

      // Generate priority explanation
      const priorityExplanation = generatePriorityExplanation(prioritizedRecs);
      if (priorityExplanation && (validated as any).summary) {
        (validated as any).summary = `${(validated as any).summary}\n\n${priorityExplanation}`;
      }

      logRecommendations(
        sanitizedRecs.length,
        {
          "must-have": prioritizedRecs.filter((r: any) => r.priority === "must-have").length,
          "highly-recommended": prioritizedRecs.filter((r: any) => r.priority === "highly-recommended").length,
          "good-option": prioritizedRecs.filter((r: any) => r.priority === "good-option").length,
        },
        logContext,
      );
      logStageEnd("POST-PROCESSING", postProcessStart, logContext);
    }

    //: Compute confidence gating for UI
    const confidence = (validated as any).confidence ?? 0.0;
    const actions: any = {};

    if (confidence >= APPLY_CONF_THRESHOLD) {
      actions["applyAllowed"] = true;
    } else if (confidence <= INVESTIGATE_THRESHOLD) {
      actions["applyAllowed"] = false;
      actions["investigateRecommended"] = true;
    } else {
      actions["applyAllowed"] = false;
      actions["investigateRecommended"] = false;
    }

    //: Calculate token usage (estimate for two-stage, exact for single-stage)
    let inputTokens = 0;
    let outputTokens = 0;
    if (ENABLE_TWO_STAGE && reasoning) {
      // For two-stage, estimate tokens from response length (both stages)
      // Rough estimate: reasoning stage ~500 tokens, recommendation stage ~800 tokens
      inputTokens = 2000; // Estimated input tokens for both stages
      outputTokens = Math.ceil(llmResp.content.length / 4) + 500; // Recommendation output + reasoning output estimate
    } else {
      // Single-stage: calculate from actual prompts
      const messages = buildStrictPrompt(reqVal, prioritizedCardDocs, intentAnalysis);
      const systemPrompt = messages[0].content;
      const userPrompt = messages[1].content;
      const systemTokens = Math.ceil(systemPrompt.length / 4);
      const userTokens = Math.ceil(userPrompt.length / 4);
      inputTokens = systemTokens + userTokens;
      outputTokens = Math.ceil(llmResp.content.length / 4);
    }
    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUSD = (totalTokens / 1000000) * 0.27;

    // Log token usage for monitoring
    console.log(
      `Token usage: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total (target: < 1500)`,
    );

    //: Build final payload with fingerprinting
    const fingerprint = await fingerprintDeck(
      current_deck || {},
      explainTo || "novice",
      userPrefs || {},
    );

    //: Convert reasoning to schema format if available
    let reasoningForResponse: any = undefined;
    if (reasoning) {
      reasoningForResponse = {
        userIntent: reasoning.userIntent,
        deckWeaknesses: reasoning.deckWeaknesses.join("; "),
        strategicConsiderations: reasoning.strategicConsiderations.join("; "),
        metaContext: reasoning.metaContext,
        candidateEvaluation: reasoning.recommendationStrategy,
      };
    }

    const finalPayload = {
      schemaVersion: (validated as any).schemaVersion || "1.0.0",
      confidence,
      explainTo: (validated as any).explainTo,
      summary: (validated as any).summary || "",
      reasoning: reasoningForResponse || (validated as any).reasoning || {
        userIntent: question || "Improve deck",
        deckWeaknesses: "Analysis unavailable",
        strategicConsiderations: "Consider deck composition",
        candidateEvaluation: "Select relevant cards",
      },
      recommendations: sanitizedRecs.map((r: any) => ({
        cardId: r.cardId,
        cardName: r.cardName,
        action: r.action,
        reason: r.reason,
        impactEst: r.impactEst,
        synergyScore: r.synergyScore,
        evidence: r.evidence || [],
        banned: r.banned || false,
      })),
      ui: (validated as any).ui || [
        {
          id: "summary",
          type: "text",
          content: (validated as any).summary || "See recommendations.",
        },
      ],
      actions,
      meta: {
        usedCardIds: prioritizedCardDocs.map((c) => c.id),
        deckFingerprint: fingerprint,
        recommendation_id: recommendationId,
        tokens_used: totalTokens,
        cost_usd: estimatedCostUSD,
        //: Track which prompt type was used for A/B testing
        promptType: promptType,
        simplePromptRollout: SIMPLE_PROMPT_ROLLOUT,
        //: Add timing metadata
        ...(ENABLE_TWO_STAGE && reasoning ? {
          stage1Duration,
          stage2Duration,
          totalDuration: stage1Duration + stage2Duration,
          candidateCount: finalCandidates.length,
        } : {}),
        //: Add debug info when DEBUG_MODE is enabled
        ...(Deno.env.get("DEBUG_MODE") === "true" ? {
          _debug: {
            pipeline_steps: getPipelineDebugInfo().steps,
            llm_raw_response: llmResp?.content?.substring(0, 1000),
            parsed_json_keys: parsed ? Object.keys(parsed) : [],
            validation_success: !!validated,
            final_card_ids: sanitizedRecs.map((r: any) => r.cardId),
          },
        } : {}),
      },
    };

    // Log successful recommendation
    const durationMs = Date.now() - startTime;
    const { error: logError } = await supabase
      .from("recommendation_logs")
      .insert({
        recommendation_id: recommendationId,
        user_id: user.id,
        question: question || "",
        format,
        recommendation_type: recommendation_type || "personalized",
        use_hybrid_search,
        candidate_count: finalCandidates.length,
        final_candidate_count: cardDocs.length,
        tokens_used: totalTokens,
        cost_usd: estimatedCostUSD,
        response_version: "2.0", // version
        //: Track prompt type for A/B testing analytics
        prompt_type: promptType,
        simple_prompt_rollout: SIMPLE_PROMPT_ROLLOUT,
        duration_ms: durationMs,
      });
    if (logError) {
      console.error("Failed to log recommendation:", logError);
    }

    // Structured log for observability
    console.log(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        recommendation_id: recommendationId,
        user_id: user.id,
        question: (question || "").substring(0, 100),
        candidate_count: finalCandidates.length,
        final_candidate_count: cardDocs.length,
        tokens_used: totalTokens,
        cost_usd: estimatedCostUSD,
        response_version: "2.0",
        duration_ms: durationMs,
        confidence,
      }),
    );

    return new Response(JSON.stringify(finalPayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("recommendation-agent error:", err);
    const payload = {
      schemaVersion: "1.0.0",
      confidence: 0.0,
      explainTo: "novice",
      summary: "Internal server error generating recommendations.",
      recommendations: [],
      ui: [
        {
          id: "err_generic",
          type: "text",
          content: `Internal error: ${(err && (err.message || String(err))) || "unknown"}`,
        },
      ],
    };

    return new Response(JSON.stringify(payload), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
