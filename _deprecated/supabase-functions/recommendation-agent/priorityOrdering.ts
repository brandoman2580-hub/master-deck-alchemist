/**
 * Phase 2: Priority Ordering
 * Orders recommendations by priority groups and applies intelligent sorting within groups
 */

export type RecommendationPriority = "must-have" | "highly-recommended" | "good-option" | "situational";

export interface PrioritizedRecommendation {
  cardId: string;
  cardName?: string;
  priority: RecommendationPriority;
  confidence: number;
  synergyScore?: number;
  metaRelevance?: number;
  [key: string]: any;
}

/**
 * Detect priority from recommendation data
 */
export function detectPriority(
  recommendation: {
    impactEst?: number;
    synergyScore?: number;
    reason?: string;
    [key: string]: any;
  },
): RecommendationPriority {
  const confidence = recommendation.impactEst || 0.5;
  const synergy = recommendation.synergyScore || 0;

  // Must-have: High confidence + high synergy, or explicitly critical
  if (confidence >= 0.8 && synergy >= 0.7) {
    return "must-have";
  }
  if (confidence >= 0.9) {
    return "must-have";
  }

  // Highly-recommended: Good confidence and synergy
  if (confidence >= 0.7 || (confidence >= 0.6 && synergy >= 0.6)) {
    return "highly-recommended";
  }

  // Good option: Moderate confidence
  if (confidence >= 0.5) {
    return "good-option";
  }

  // Situational: Low confidence
  return "situational";
}

/**
 * Order recommendations by priority with intelligent sorting
 */
export function orderByPriority(
  recommendations: Array<{
    cardId: string;
    cardName?: string;
    impactEst?: number;
    synergyScore?: number;
    [key: string]: any;
  }>,
  maxRecommendations: number = 8,
): PrioritizedRecommendation[] {
  // Detect and assign priorities
  const prioritized = recommendations.map(rec => ({
    ...rec,
    priority: detectPriority(rec),
    confidence: rec.impactEst || 0.5,
    synergyScore: rec.synergyScore,
  })) as PrioritizedRecommendation[];

  // Group by priority
  const groups = {
    "must-have": prioritized.filter(r => r.priority === "must-have"),
    "highly-recommended": prioritized.filter(r => r.priority === "highly-recommended"),
    "good-option": prioritized.filter(r => r.priority === "good-option"),
    "situational": prioritized.filter(r => r.priority === "situational"),
  };

  // Sort within each group
  const sortWithinGroup = (group: PrioritizedRecommendation[]) => {
    return group.sort((a, b) => {
      // Primary: confidence (descending)
      if (Math.abs(a.confidence - b.confidence) > 0.05) {
        return b.confidence - a.confidence;
      }
      // Secondary: synergy score (descending)
      if (a.synergyScore !== undefined && b.synergyScore !== undefined) {
        if (Math.abs(a.synergyScore - b.synergyScore) > 0.05) {
          return b.synergyScore - a.synergyScore;
        }
      }
      // Tertiary: meta relevance if available
      if (a.metaRelevance !== undefined && b.metaRelevance !== undefined) {
        return b.metaRelevance - a.metaRelevance;
      }
      return 0;
    });
  };

  // Sort each group
  const sortedGroups = {
    "must-have": sortWithinGroup(groups["must-have"]),
    "highly-recommended": sortWithinGroup(groups["highly-recommended"]),
    "good-option": sortWithinGroup(groups["good-option"]),
    "situational": sortWithinGroup(groups["situational"]),
  };

  // Combine in priority order, limiting total count
  const result: PrioritizedRecommendation[] = [];
  
  // Always include all must-haves
  result.push(...sortedGroups["must-have"]);

  // Include highly-recommended up to limit
  const remaining = maxRecommendations - result.length;
  if (remaining > 0) {
    result.push(...sortedGroups["highly-recommended"].slice(0, remaining));
  }

  // Include good-option only if we have space
  const remainingAfter = maxRecommendations - result.length;
  if (remainingAfter > 0) {
    result.push(...sortedGroups["good-option"].slice(0, remainingAfter));
  }

  // Never include situational unless explicitly requested or we have very few recommendations
  if (result.length < 3) {
    result.push(...sortedGroups["situational"].slice(0, maxRecommendations - result.length));
  }

  return result.slice(0, maxRecommendations);
}

/**
 * Generate priority explanation summary
 */
export function generatePriorityExplanation(
  recommendations: PrioritizedRecommendation[],
): string {
  const counts = {
    "must-have": recommendations.filter(r => r.priority === "must-have").length,
    "highly-recommended": recommendations.filter(r => r.priority === "highly-recommended").length,
    "good-option": recommendations.filter(r => r.priority === "good-option").length,
    "situational": recommendations.filter(r => r.priority === "situational").length,
  };

  const parts: string[] = [];

  if (counts["must-have"] > 0) {
    parts.push(`Must-have (${counts["must-have"]} card${counts["must-have"] !== 1 ? "s" : ""}): These address critical deck weaknesses.`);
  }
  if (counts["highly-recommended"] > 0) {
    parts.push(`Highly-recommended (${counts["highly-recommended"]} card${counts["highly-recommended"] !== 1 ? "s" : ""}): These significantly improve the strategy.`);
  }
  if (counts["good-option"] > 0) {
    parts.push(`Good options (${counts["good-option"]} card${counts["good-option"] !== 1 ? "s" : ""}): These are solid additions if space allows.`);
  }
  if (counts["situational"] > 0) {
    parts.push(`Situational (${counts["situational"]} card${counts["situational"] !== 1 ? "s" : ""}): Consider these for specific matchups or tech situations.`);
  }

  return parts.join(" ");
}
