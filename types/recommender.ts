import { z } from "zod";

// Note: Validation helper functions are in lib/recommender-validation.ts

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Deck card schema for recommendation requests
 * Simplified structure with cardId and count
 */
export const DeckCardZ = z.object({
  cardId: z.number(),
  count: z.number().min(0),
});

export type DeckCard = z.infer<typeof DeckCardZ>;

/**
 * Deck schema for recommendation requests
 * Matches the structure expected by the recommendation agent
 */
export const DeckZ = z.object({
  main: z.array(DeckCardZ),
  extra: z.array(DeckCardZ).optional().default([]),
  side: z.array(DeckCardZ).optional().default([]),
});

export type Deck = z.infer<typeof DeckZ>;

/**
 * User preferences schema
 */
export const UserPrefsZ = z
  .object({
    playstyle: z
      .enum(["aggro", "control", "combo", "stall", "hybrid"])
      .optional(),
    budget: z.enum(["low", "mid", "high"]).optional(),
  })
  .optional();

export type UserPrefs = z.infer<typeof UserPrefsZ>;

/**
 * Recommendation request schema
 * Matches the format expected by the recommendation agent Edge Function
 */
export const RecommendationRequestZ = z.object({
  question: z.string().optional(),
  current_deck: DeckZ.optional(),
  format: z.enum(["MASTER_DUEL", "TCG"]).default("MASTER_DUEL"),
  recommendation_type: z
    .enum(["personalized", "archetype", "engine", "tech", "simple"])
    .optional(),
  use_hybrid_search: z.boolean().optional().default(true),
  explainTo: z
    .enum(["novice", "intermediate", "advanced"])
    .optional()
    .default("novice"),
  userPrefs: UserPrefsZ,
  maxOutputTokens: z.number().optional().default(800),
});

export type RecommendationRequest = z.infer<typeof RecommendationRequestZ>;

// ============================================================================
// Card Pool Schema (from database)
// ============================================================================

/**
 * Card document schema returned from database
 * Used for cardPool context in recommendations
 */
export const CardDocZ = z.object({
  id: z.number(),
  name: z.string(),
  desc: z.string().optional().default(""),
  archetype: z.string().nullable().optional(),
  ban_tcg: z.string().nullable().optional(),
  master_duel_banned: z.boolean().optional().default(false),
  imageurl: z.string().optional().nullable(),
});

export type CardDoc = z.infer<typeof CardDocZ>;

// ============================================================================
// Recommendation Response Schemas
// ============================================================================

/**
 * Play format type
 */
export type PlayFormat = "MASTER_DUEL" | "TCG";

/**
 * Explanation level type
 */
export type ExplainLevel = "novice" | "intermediate" | "advanced";

/**
 * Recommendation action type
 */
export type RecommendationAction = "add" | "remove" | "replace" | "tech" | "note";

/**
 * Recommendation item schema
 * Represents a single card recommendation
 */
export const RecoItemZ = z.object({
  cardId: z.string(), // String to match cardPool ids (will be validated server-side)
  cardName: z.string().optional(),
  action: z.enum(["add", "remove", "replace", "tech", "note"]),
  reason: z.string(),
  impactEst: z.number().min(-1).max(1),
  synergyScore: z.number().min(0).max(1).optional(),
  evidence: z.array(z.string()),
  banned: z.boolean().optional(),
});

export type Recommendation = z.infer<typeof RecoItemZ>;

/**
 * UI block content type
 * Can be string, array of strings, or object (for suggestion blocks)
 */
const UIBlockContentZ = z.union([
  z.string(),
  z.array(z.string()),
  z.record(z.string(), z.any()), // For suggestion blocks with { suggestionId, cardId, verb, label }
]);

/**
 * UI block schema
 * Defines renderable blocks for the client UI
 */
export const UIBlockZ = z.object({
  id: z.string(),
  type: z.enum(["text", "list", "card", "table", "suggestion"]),
  content: UIBlockContentZ,
});

export type UIBlock = z.infer<typeof UIBlockZ>;

/**
 * Full recommender response schema
 * Matches RECOMMENDER_SCHEMA from system prompt
 */
export const RecommenderZ = z.object({
  schemaVersion: z.string(),
  confidence: z.number().min(0).max(1),
  explainTo: z.enum(["novice", "intermediate", "advanced"]),
  summary: z.string().optional(),
  recommendations: z.array(RecoItemZ),
  ui: z.array(UIBlockZ),
  actions: z.record(z.string(), z.any()).optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

export type RecommenderResponse = z.infer<typeof RecommenderZ>;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Suggestion block content structure
 * Used for actionable suggestions in UI blocks
 */
export interface SuggestionContent {
  suggestionId: string;
  cardId?: string;
  verb: "apply" | "preview";
  label: string;
}

/**
 * Actions object structure
 * Controls UI behavior based on confidence
 */
export interface RecommenderActions {
  applyAllowed?: boolean;
  investigateRecommended?: boolean;
}

/**
 * Meta object structure
 * Contains additional metadata about the recommendation
 */
export interface RecommenderMeta {
  deckFingerprint?: string;
  usedCardIds?: number[];
  mainCount?: number;
  [key: string]: any;
}


