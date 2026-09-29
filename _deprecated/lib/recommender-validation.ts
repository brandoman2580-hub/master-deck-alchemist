import { z } from "zod";
import {
  RecommendationRequestZ,
  RecommenderZ,
  type RecommendationRequest,
  type RecommenderResponse,
  type RecommendationAction,
  type ExplainLevel,
  type PlayFormat,
} from "../types/recommender";

/**
 * Validate a recommendation request
 * @throws {z.ZodError} if validation fails
 */
export function validateRecommendationRequest(
  data: unknown,
): RecommendationRequest {
  return RecommendationRequestZ.parse(data);
}

/**
 * Validate a recommender response
 * @throws {z.ZodError} if validation fails
 */
export function validateRecommenderResponse(
  data: unknown,
): RecommenderResponse {
  return RecommenderZ.parse(data);
}

/**
 * Safe parse a recommender response (returns success/error)
 * Does not throw, returns result object instead
 */
export function safeParseRecommenderResponse(
  data: unknown,
): { success: true; data: RecommenderResponse } | { success: false; error: z.ZodError } {
  const result = RecommenderZ.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Check if a recommendation action is valid
 * Type guard for RecommendationAction
 */
export function isValidRecommendationAction(
  action: string,
): action is RecommendationAction {
  return ["add", "remove", "replace", "tech", "note"].includes(action);
}

/**
 * Check if an explain level is valid
 * Type guard for ExplainLevel
 */
export function isValidExplainLevel(
  level: string,
): level is ExplainLevel {
  return ["novice", "intermediate", "advanced"].includes(level);
}

/**
 * Check if a play format is valid
 * Type guard for PlayFormat
 */
export function isValidPlayFormat(format: string): format is PlayFormat {
  return format === "MASTER_DUEL" || format === "TCG";
}

