/**
 * Phase 2: Explanation Enhancement
 * Enhances recommendation explanations with specific metrics and concrete examples
 */

import type { ReasoningOutput } from "./reasoningStage.ts";
import type { EnhancedDeckAnalysis } from "../_shared/intentClassifier.ts";

export interface EnhancedExplanation {
  originalRationale: string;
  enhancedRationale: string;
  metrics?: {
    consistencyScore?: number;
    interactionScore?: number;
    synergyScore?: number;
    metaRelevance?: number;
  };
  concreteExamples?: string[];
  expectedImpact?: string;
}

/**
 * Enhance explanation with metrics, examples, and impact estimates
 */
export function enhanceExplanation(
  rationale: string,
  cardMetadata?: {
    consistency_score?: number;
    interaction_score?: number;
    power_ceiling?: number;
    meta_relevance?: number;
    is_staple?: boolean;
  },
  deckAnalysis?: EnhancedDeckAnalysis,
  reasoning?: ReasoningOutput,
  cardName?: string,
  cardDesc?: string,
): EnhancedExplanation {
  let enhanced = rationale;

  // Add metrics if available
  const metrics: EnhancedExplanation["metrics"] = {};
  if (cardMetadata) {
    if (cardMetadata.consistency_score !== undefined) {
      metrics.consistencyScore = cardMetadata.consistency_score;
      enhanced += ` (Consistency Score: ${(cardMetadata.consistency_score * 100).toFixed(0)}%)`;
    }
    if (cardMetadata.interaction_score !== undefined) {
      metrics.interactionScore = cardMetadata.interaction_score;
      enhanced += ` (Interaction Score: ${(cardMetadata.interaction_score * 100).toFixed(0)}%)`;
    }
    if (cardMetadata.meta_relevance !== undefined) {
      metrics.metaRelevance = cardMetadata.meta_relevance;
      enhanced += ` (Meta Relevance: ${(cardMetadata.meta_relevance * 100).toFixed(0)}%)`;
    }
  }

  // Add concrete examples based on deck analysis
  const examples: string[] = [];
  if (deckAnalysis?.primaryArchetype && cardName) {
    examples.push(`Works with your ${deckAnalysis.primaryArchetype} strategy`);
  }

  if (cardDesc && deckAnalysis) {
    // Extract specific synergies from card description
    const desc = cardDesc.toLowerCase();
    if (desc.includes("search") && deckAnalysis.cardRoles.starters < 8) {
      examples.push(`This search effect will increase your starter count from ${deckAnalysis.cardRoles.starters} to ${deckAnalysis.cardRoles.starters + 1}`);
    }
    if (desc.includes("draw") && deckAnalysis.estimatedBrickRate > 0.3) {
      const currentBrickRate = (deckAnalysis.estimatedBrickRate * 100).toFixed(0);
      const estimatedNewRate = (deckAnalysis.estimatedBrickRate * 0.9 * 100).toFixed(0);
      examples.push(`Should reduce brick rate from ${currentBrickRate}% to approximately ${estimatedNewRate}%`);
    }
  }

  // Add expected impact
  let expectedImpact: string | undefined;
  if (deckAnalysis && cardMetadata) {
    if (cardMetadata.consistency_score && cardMetadata.consistency_score > 0.7) {
      const currentStarters = deckAnalysis.cardRoles.starters;
      expectedImpact = `Adding this starter should increase opening play consistency. With ${currentStarters} starters, you have a ${((currentStarters / deckAnalysis.mainDeckSize) * 100).toFixed(0)}% chance to open a starter. Adding this increases that to approximately ${(((currentStarters + 1) / deckAnalysis.mainDeckSize) * 100).toFixed(0)}%.`;
    }
    if (cardMetadata.interaction_score && cardMetadata.interaction_score > 0.7) {
      const currentInterruptions = deckAnalysis.cardRoles.interruptions;
      expectedImpact = `This adds to your ${currentInterruptions} interruptions, improving your ability to disrupt opponent plays.`;
    }
  }

  return {
    originalRationale: rationale,
    enhancedRationale: enhanced,
    metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
    concreteExamples: examples.length > 0 ? examples : undefined,
    expectedImpact,
  };
}

/**
 * Apply explanation enhancement to all recommendations
 */
export function applyExplanationEnhancement(
  recommendations: Array<{
    cardId: string;
    cardName?: string;
    reason?: string;
    [key: string]: any;
  }>,
  cardMetadataMap: Map<number, any>,
  deckAnalysis?: EnhancedDeckAnalysis,
  reasoning?: ReasoningOutput,
  cardDescMap?: Map<number, string>,
): Array<{
  cardId: string;
  cardName?: string;
  reason?: string;
  enhancedReason?: string;
  [key: string]: any;
}> {
  return recommendations.map(rec => {
    const cardId = parseInt(rec.cardId, 10);
    const metadata = cardMetadataMap.get(cardId);
    const cardDesc = cardDescMap?.get(cardId);

    const enhanced = enhanceExplanation(
      rec.reason || "",
      metadata,
      deckAnalysis,
      reasoning,
      rec.cardName,
      cardDesc,
    );

    return {
      ...rec,
      reason: enhanced.enhancedRationale, // Replace with enhanced version
      enhancedReason: enhanced.enhancedRationale, // Also keep as separate field
    };
  });
}
