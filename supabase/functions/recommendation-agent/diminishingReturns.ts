/**
 * Phase 2: Diminishing Returns Detection
 * Detects when deck already has many cards serving the same role and applies penalties
 */

import type { EnhancedDeckAnalysis } from "../_shared/intentClassifier.ts";
import type { CardCandidate } from "../_shared/cardSearch.ts";

const ENABLE_DIMINISHING_RETURNS = Deno.env.get("ENABLE_DIMINISHING_RETURNS") !== "false"; // Default: true

export interface DiminishingReturnsInfo {
  penalty: number; // Multiplier 0.5-1.0 (1.0 = no penalty)
  explanation: string;
}

/**
 * Detect diminishing returns for a candidate card based on deck role
 */
export function detectDiminishingReturns(
  candidate: CardCandidate & { metadata?: any },
  deckAnalysis: EnhancedDeckAnalysis | undefined,
  deckRole: "starter" | "extender" | "interruption" | "board_breaker" | "end_board_piece" | "unknown",
): DiminishingReturnsInfo {
  if (!ENABLE_DIMINISHING_RETURNS || !deckAnalysis) {
    return { penalty: 1.0, explanation: "" };
  }

  const mainDeckSize = deckAnalysis.mainDeckSize;
  const is60CardDeck = mainDeckSize >= 50;

  // Define thresholds by role
  const thresholds: Record<string, { threshold40: number; threshold60: number; penalty: number }> = {
    starter: {
      threshold40: 10,
      threshold60: 15,
      penalty: 0.7, // 30% penalty
    },
    extender: {
      threshold40: 12,
      threshold60: 18,
      penalty: 0.75,
    },
    interruption: {
      threshold40: 12,
      threshold60: 18,
      penalty: 0.6, // 40% penalty (hand traps are very common)
    },
    board_breaker: {
      threshold40: 8,
      threshold60: 12,
      penalty: 0.7,
    },
    end_board_piece: {
      threshold40: 5,
      threshold60: 8,
      penalty: 0.8,
    },
  };

  const roleConfig = thresholds[deckRole];
  if (!roleConfig) {
    return { penalty: 1.0, explanation: "" };
  }

  const threshold = is60CardDeck ? roleConfig.threshold60 : roleConfig.threshold40;
  let currentCount = 0;

  // Get current count based on role
  switch (deckRole) {
    case "starter":
      currentCount = deckAnalysis.cardRoles.starters;
      break;
    case "extender":
      currentCount = deckAnalysis.cardRoles.extenders;
      break;
    case "interruption":
      currentCount = deckAnalysis.cardRoles.interruptions;
      break;
    case "board_breaker":
      currentCount = deckAnalysis.cardRoles.boardBreakers;
      break;
    case "end_board_piece":
      currentCount = deckAnalysis.cardRoles.endBoardPieces;
      break;
    default:
      return { penalty: 1.0, explanation: "" };
  }

  // Apply penalty if over threshold
  if (currentCount >= threshold) {
    const overThreshold = currentCount - threshold;
    const penaltySeverity = Math.min(0.5, overThreshold / 5); // Max 50% penalty
    const finalPenalty = Math.max(roleConfig.penalty, 1.0 - penaltySeverity);

    return {
      penalty: finalPenalty,
      explanation: `Deck already has ${currentCount} ${deckRole}${currentCount !== 1 ? "s" : ""}, prioritizing other roles.`,
    };
  }

  return { penalty: 1.0, explanation: "" };
}

/**
 * Detect deck role for a candidate card based on metadata and description
 */
export function detectCardRole(
  candidate: CardCandidate & { metadata?: any },
): "starter" | "extender" | "interruption" | "board_breaker" | "end_board_piece" | "unknown" {
  const metadata = candidate.metadata || {};
  const desc = (candidate.desc || "").toLowerCase();

  // Check metadata first
  if (metadata.starter) return "starter";
  if (metadata.extender) return "extender";
  if (metadata.interruption || metadata.hand_trap) return "interruption";
  if (metadata.board_breaker) return "board_breaker";
  if (metadata.end_board_piece) return "end_board_piece";

  // Fallback to description analysis
  if (desc.includes("add") && desc.includes("hand") || 
      desc.includes("search") || 
      desc.includes("deck") && desc.includes("hand")) {
    return "starter";
  }

  if (desc.includes("special summon") && desc.includes("from") ||
      desc.includes("summon") && desc.includes("additional")) {
    return "extender";
  }

  if (desc.includes("negate") || 
      desc.includes("destroy") && desc.includes("opponent") ||
      desc.includes("hand trap") ||
      desc.includes("quick effect") && desc.includes("opponent")) {
    return "interruption";
  }

  if (desc.includes("destroy") && desc.includes("all") ||
      desc.includes("clear") ||
      desc.includes("board")) {
    return "board_breaker";
  }

  if (desc.includes("cannot be") && desc.includes("destroy") ||
      desc.includes("unaffected") ||
      desc.includes("boss")) {
    return "end_board_piece";
  }

  return "unknown";
}

/**
 * Apply diminishing returns penalties to candidate list
 */
export function applyDiminishingReturns(
  candidates: Array<CardCandidate & { metadata?: any; synergyScore?: number }>,
  deckAnalysis: EnhancedDeckAnalysis | undefined,
): Array<CardCandidate & { synergyScore?: number; diminishingReturnsPenalty: number; diminishingReturnsExplanation: string }> {
  return candidates.map(candidate => {
    const role = detectCardRole(candidate);
    const drInfo = detectDiminishingReturns(candidate, deckAnalysis, role);

    return {
      ...candidate,
      diminishingReturnsPenalty: drInfo.penalty,
      diminishingReturnsExplanation: drInfo.explanation,
    };
  });
}
