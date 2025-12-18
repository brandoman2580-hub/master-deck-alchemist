/**
 * Utility functions for parsing and extracting information from user prompts
 */

/**
 * Extract number constraints from user prompts
 * Examples:
 * - "3 other cards" -> 3
 * - "give me 5 cards" -> 5
 * - "show me 2-3 options" -> 2 (min) or 3 (max)
 * - "a few cards" -> undefined (no specific number)
 */
export function extractNumberConstraint(
  prompt: string,
): { exact?: number; min?: number; max?: number } | null {
  if (!prompt || typeof prompt !== "string") {
    return null;
  }

  const normalized = prompt.toLowerCase().trim();

  // Pattern 1: Exact numbers like "3 cards", "5 options", "2 recommendations"
  const exactMatch = normalized.match(
    /\b(\d+)\s+(?:other\s+)?(?:card|option|recommendation|suggestion|choice|alternative)(?:s)?\b/i,
  );
  if (exactMatch) {
    const num = parseInt(exactMatch[1], 10);
    if (num > 0 && num <= 20) {
      // Reasonable limit
      return { exact: num };
    }
  }

  // Pattern 2: "give me X", "show me X", "I need X"
  const giveMeMatch = normalized.match(
    /\b(?:give|show|need|want|get|provide|suggest)\s+(?:me\s+)?(\d+)\s+(?:other\s+)?(?:card|option|recommendation|suggestion|choice|alternative)(?:s)?\b/i,
  );
  if (giveMeMatch) {
    const num = parseInt(giveMeMatch[1], 10);
    if (num > 0 && num <= 20) {
      return { exact: num };
    }
  }

  // Pattern 3: Range like "2-3 cards", "3 to 5 options"
  const rangeMatch = normalized.match(
    /\b(\d+)\s*[-–—]\s*(\d+)\s+(?:card|option|recommendation|suggestion|choice|alternative)(?:s)?\b/i,
  );
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    if (min > 0 && max > min && max <= 20) {
      return { min, max };
    }
  }

  // Pattern 4: "between X and Y"
  const betweenMatch = normalized.match(
    /\bbetween\s+(\d+)\s+and\s+(\d+)\s+(?:card|option|recommendation|suggestion|choice|alternative)(?:s)?\b/i,
  );
  if (betweenMatch) {
    const min = parseInt(betweenMatch[1], 10);
    const max = parseInt(betweenMatch[2], 10);
    if (min > 0 && max > min && max <= 20) {
      return { min, max };
    }
  }

  // Pattern 5: "at least X", "at most X"
  const atLeastMatch = normalized.match(
    /\bat\s+least\s+(\d+)\s+(?:card|option|recommendation|suggestion|choice|alternative)(?:s)?\b/i,
  );
  if (atLeastMatch) {
    const num = parseInt(atLeastMatch[1], 10);
    if (num > 0 && num <= 20) {
      return { min: num };
    }
  }

  const atMostMatch = normalized.match(
    /\bat\s+most\s+(\d+)\s+(?:card|option|recommendation|suggestion|choice|alternative)(?:s)?\b/i,
  );
  if (atMostMatch) {
    const num = parseInt(atMostMatch[1], 10);
    if (num > 0 && num <= 20) {
      return { max: num };
    }
  }

  return null;
}

/**
 * Check if recommendations contain duplicate cards
 */
export function detectDuplicateCards(
  recommendations: Array<{ cardId: string; cardName?: string }>,
): {
  hasDuplicates: boolean;
  duplicateCount: number;
  uniqueCount: number;
} {
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const rec of recommendations) {
    const key = rec.cardId || rec.cardName?.toLowerCase() || "";
    if (key && seen.has(key)) {
      duplicateCount++;
    } else if (key) {
      seen.add(key);
    }
  }

  return {
    hasDuplicates: duplicateCount > 0,
    duplicateCount,
    uniqueCount: seen.size,
  };
}

/**
 * Format number constraint for display or logging
 */
export function formatNumberConstraint(
  constraint: { exact?: number; min?: number; max?: number } | null,
): string {
  if (!constraint) {
    return "none";
  }

  if (constraint.exact !== undefined) {
    return `${constraint.exact}`;
  }

  if (constraint.min !== undefined && constraint.max !== undefined) {
    return `${constraint.min}-${constraint.max}`;
  }

  if (constraint.min !== undefined) {
    return `at least ${constraint.min}`;
  }

  if (constraint.max !== undefined) {
    return `at most ${constraint.max}`;
  }

  return "none";
}

