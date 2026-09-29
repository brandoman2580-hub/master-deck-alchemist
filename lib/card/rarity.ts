/**
 * Rarity badge utilities for TCG and Master Duel formats.
 * Supports Master Duel (N, R, SR, UR) and TCG set rarities.
 */

import type { Card } from "@/types/card";

export interface RarityBadgeResult {
  badgeClass: string;
  displayText: string;
}

/**
 * Get rarity badge styling for Master Duel format (N, R, SR, UR only).
 * C/Common maps to N. U and other invalid rarities return null.
 */
export function getRarityBadge(
  rarity: string | undefined | null,
  mdRarityOverride?: string | null,
): RarityBadgeResult | null {
  const raw = mdRarityOverride ?? rarity;
  if (!raw || typeof raw !== "string" || raw.trim() === "") return null;

  const upper = raw.toUpperCase().trim();

  // U and unknown rarities - do not show
  if (upper === "U" || upper === "UNKNOWN") return null;

  let badgeClass = "";
  let displayText = "";

  // Master Duel: N - Grey, R - Blue, SR - Gold, UR - Purple/Pink/Light Blue gradient
  if (upper === "N" || upper === "NORMAL" || upper.includes("NORMAL")) {
    badgeClass = "bg-gray-500 border-gray-400 text-white";
    displayText = "N";
  } else if (upper === "C" || upper.includes("COMMON")) {
    // Common maps to Normal (N) - Master Duel only has N, R, SR, UR
    badgeClass = "bg-gray-500 border-gray-400 text-white";
    displayText = "N";
  } else if (upper === "R" || (upper.includes("RARE") && !upper.includes("SUPER") && !upper.includes("ULTRA") && !upper.includes("SECRET"))) {
    badgeClass = "bg-blue-500 border-blue-400 text-white";
    displayText = "R";
  } else if (upper === "SR" || upper.includes("SUPER RARE") || upper.includes("SUPERRARE")) {
    badgeClass = "amber-gradient";
    displayText = "SR";
  } else if (upper === "UR" || upper.includes("ULTRA RARE") || upper.includes("ULTRARARE")) {
    badgeClass = "purple-gradient";
    displayText = "UR";
  } else if (upper.includes("SECRET")) {
    // TCG Secret Rare -> similar to UR
    badgeClass = "purple-gradient";
    displayText = "ScR";
  } else {
    return null;
  }

  return { badgeClass, displayText };
}

/**
 * Get rarity for a card based on format.
 * Master Duel: prefer mdRarityOverride (from master_duel_rarity table), else misc_info.
 * TCG: use first card_set's set_rarity.
 */
export function getCardRarityForDisplay(
  card: Card,
  format: "TCG" | "Master Duel",
  mdRarityOverride?: string | null,
): string | undefined {
  if (format === "Master Duel") {
    return mdRarityOverride ?? card.misc_info?.[0]?.md_rarity?.trim() ?? undefined;
  }

  // TCG: use card_sets (can be array or single object in API)
  const sets = card.card_sets;
  if (!sets) return undefined;

  const firstSet = Array.isArray(sets) ? sets[0] : sets;
  const setRarity = (firstSet as { set_rarity?: string })?.set_rarity;
  return setRarity?.trim() ?? undefined;
}
