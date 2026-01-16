/**
 * Phase 2: Confidence Calibration
 * Adjusts LLM confidence scores based on card metadata, deck analysis, and intent alignment
 */

import type { RecommendationIntent } from "../_shared/intentClassifier.ts";
import type { EnhancedDeckAnalysis } from "../_shared/intentClassifier.ts";

export interface CalibrationInput {
  rawConfidence: number;
  cardMetadata?: {
    consistency_score?: number;
    interaction_score?: number;
    power_ceiling?: number;
    meta_relevance?: number;
    is_staple?: boolean;
  };
  deckAnalysis?: EnhancedDeckAnalysis;
  intent: RecommendationIntent;
  synergyScore?: number;
}

/**
 * Calibrate confidence score based on metadata alignment and context
 */
export function calibrateConfidence(input: CalibrationInput): number {
  const { rawConfidence, cardMetadata, intent, synergyScore } = input;
  let calibrated = rawConfidence;

  // If no metadata, use raw confidence with slight penalty
  if (!cardMetadata) {
    return Math.max(0.0, Math.min(1.0, calibrated * 0.9));
  }

  // Check intent-metadata alignment
  const intentAlignment = checkIntentAlignment(intent, cardMetadata);
  
  // If high confidence but poor alignment, reduce
  if (rawConfidence > 0.8 && intentAlignment < 0.5) {
    calibrated = Math.max(0.6, calibrated * 0.75);
  }

  // If low confidence but perfect alignment, boost
  if (rawConfidence < 0.5 && intentAlignment > 0.8) {
    calibrated = Math.min(0.7, calibrated * 1.3);
  }

  // Apply synergy boost
  if (synergyScore !== undefined && synergyScore > 0.7) {
    calibrated = Math.min(1.0, calibrated * (1 + synergyScore * 0.2));
  }

  // Penalize staples for tech requests
  if (intent === "tech" && cardMetadata.is_staple) {
    calibrated = Math.max(0.4, calibrated * 0.6);
  }

  // Boost staples for non-tech requests (if meta-relevant)
  if (intent !== "tech" && cardMetadata.is_staple && (cardMetadata.meta_relevance || 0) > 0.7) {
    calibrated = Math.min(1.0, calibrated * 1.1);
  }

  // Penalize if recommending staple for tech request
  if (intent === "tech" && cardMetadata.is_staple) {
    calibrated = Math.max(0.0, Math.min(0.4, calibrated));
  }

  // Ensure confidence is in valid range
  return Math.max(0.0, Math.min(1.0, calibrated));
}

/**
 * Check how well card metadata aligns with intent
 */
function checkIntentAlignment(
  intent: RecommendationIntent,
  metadata: CalibrationInput["cardMetadata"],
): number {
  if (!metadata) return 0.5;

  switch (intent) {
    case "consistency":
      return metadata.consistency_score || 0;
    case "interaction":
      return metadata.interaction_score || 0;
    case "power":
      return metadata.power_ceiling || 0;
    case "meta":
      return metadata.meta_relevance || 0;
    case "tech":
      // Tech cards should NOT be staples
      return metadata.is_staple ? 0.2 : 0.7;
    case "archetype_support":
      // Archetype support doesn't have specific metadata score
      return 0.6;
    default:
      return 0.5;
  }
}

/**
 * Apply confidence calibration to recommendations
 */
export function applyConfidenceCalibration(
  recommendations: Array<{
    cardId: string;
    cardName?: string;
    reason?: string;
    impactEst?: number;
    synergyScore?: number;
    [key: string]: any;
  }>,
  cardMetadataMap: Map<number, CalibrationInput["cardMetadata"]>,
  intent: RecommendationIntent,
  deckAnalysis?: EnhancedDeckAnalysis,
): Array<{
  cardId: string;
  cardName?: string;
  reason?: string;
  impactEst?: number;
  synergyScore?: number;
  calibratedConfidence?: number;
  [key: string]: any;
}> {
  return recommendations.map(rec => {
    const cardId = parseInt(rec.cardId, 10);
    const metadata = cardMetadataMap.get(cardId);
    const rawConfidence = rec.impactEst || 0.5;

    const calibrated = calibrateConfidence({
      rawConfidence,
      cardMetadata: metadata,
      intent,
      deckAnalysis,
      synergyScore: rec.synergyScore,
    });

    return {
      ...rec,
      impactEst: calibrated, // Update impactEst with calibrated value
      calibratedConfidence: calibrated,
    };
  });
}
