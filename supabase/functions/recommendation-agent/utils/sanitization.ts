/**
 * Defensive sanitization of recommendations
 * Normalizes cardId formats and validates against available cards
 */

type Card = {
  id: number;
  name: string;
  desc?: string;
  ban_tcg?: string | null;
  master_duel_banned?: boolean;
};

type SanitizedRecommendation = {
  cardId: string;
  cardName: string;
  reason: string;
  impactEst: number;
  synergyScore: number;
  evidence: string[];
  banned: boolean;
  action: "add" | "remove" | "replace" | "tech" | "note";
  card: Card;
  [key: string]: any; // Allow additional properties for post-processing compatibility
};

/**
 * Sanitize recommendations by normalizing cardIds and validating against available cards
 */
export function sanitizeRecommendations(
  recommendations: any[],
  availableCards: Card[],
  format: "MASTER_DUEL" | "TCG" = "MASTER_DUEL",
): Array<{
  cardId: string;
  cardName: string;
  reason: string;
  impactEst: number;
  synergyScore: number;
  evidence: string[];
  banned: boolean;
  action: "add" | "remove" | "replace" | "tech" | "note";
  [key: string]: any; // Allow additional properties for post-processing
}> {
  // Build card map for O(1) lookup with multiple key formats
  const cardMap = new Map<string, Card>();
  availableCards.forEach((c) => {
    const idStr = String(c.id);
    cardMap.set(idStr, c);
    // Also add normalized versions for better matching
    cardMap.set(idStr.trim(), c);
    cardMap.set(idStr.replace(/['"]/g, ""), c);
    // Handle number coercion
    const numId = Number(c.id);
    if (!isNaN(numId)) {
      cardMap.set(String(numId), c);
    }
  });

  return recommendations
    .map((rec) => {
      // Normalize cardId - try multiple formats
      const cardIdVariants = [
        String(rec.cardId).trim(),
        String(rec.cardId).replace(/['"]/g, ""),
        String(rec.cardId),
        String(Number(rec.cardId)), // Handle number coercion
      ];

      let card: Card | undefined;
      for (const variant of cardIdVariants) {
        card = cardMap.get(variant);
        if (card) break;
      }

      if (!card) {
        console.warn(
          `Card ${rec.cardId} not found in available cards. Variants tried:`,
          cardIdVariants,
        );
        return null;
      }

      // Check ban status
      const isBanned =
        format === "TCG"
          ? (card.ban_tcg || "").toLowerCase() === "banned"
          : !!card.master_duel_banned;

      // Determine action (convert "add" to "note" if banned)
      let action: "add" | "remove" | "replace" | "tech" | "note" =
        rec.action || "add";
      if (isBanned && action === "add") {
        action = "note";
      }

      return {
        // Include all original properties for post-processing compatibility
        ...rec,
        // Override with sanitized values (must come after spread to override)
        cardId: String(card.id),
        cardName: card.name,
        reason: rec.reason || "No reason provided",
        impactEst: rec.impactEst ?? 0.5,
        synergyScore: rec.synergyScore ?? 0.5,
        evidence: rec.evidence || [],
        banned: isBanned,
        action,
      };
    })
    .filter((r) => r !== null);
}
