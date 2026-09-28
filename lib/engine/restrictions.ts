/**
 * Mechanical Extra Deck / summon restriction extractor.
 * Temporary SoT until curated card_capabilities ships.
 */

import { EvidenceIds } from "./assistant-contract";

export type RestrictionAppliesTo =
  | "extra_deck"
  | "special_summon"
  | "summon"
  | "other";

export interface RestrictionFact {
  cardId: number;
  name: string;
  lockSummary: string;
  appliesTo: RestrictionAppliesTo;
  evidenceId: string;
}

interface RestrictionRule {
  appliesTo: RestrictionAppliesTo;
  /** Match effect text */
  pattern: RegExp;
  /** Build player-facing lock summary from card name */
  summarize: (cardName: string, match: RegExpMatchArray) => string;
}

const RESTRICTION_RULES: RestrictionRule[] = [
  {
    appliesTo: "extra_deck",
    pattern:
      /you can only special summon\s+(.{5,80}?)\s+from\s+(?:your\s+)?extra deck/i,
    summarize: (name, m) =>
      `${name} locks Extra Deck summons to ${m[1]!.trim()} while its lock is live.`,
  },
  {
    appliesTo: "extra_deck",
    pattern:
      /you cannot special summon(?:\s+monsters)?\s+from\s+(?:your\s+)?extra deck(?!\s+except)/i,
    summarize: (name) =>
      `${name} blocks Extra Deck Special Summons while its lock is live.`,
  },
  {
    appliesTo: "extra_deck",
    pattern:
      /cannot special summon(?:\s+monsters)?\s+from\s+(?:the\s+)?extra deck(?!\s+except)/i,
    summarize: (name) =>
      `${name} blocks Extra Deck Special Summons while its lock is live.`,
  },
  {
    appliesTo: "special_summon",
    pattern:
      /you can only special summon\s+(.{5,60}?)\s+(?:monsters\s+)?(?:for the rest of this turn|this turn)/i,
    summarize: (name, m) =>
      `${name} locks Special Summons to ${m[1]!.trim()} for the turn.`,
  },
  {
    appliesTo: "special_summon",
    pattern:
      /you cannot special summon(?:\s+monsters)?(?!\s+from\s+(?:your\s+)?extra deck)/i,
    summarize: (name) =>
      `${name} restricts Special Summons while its effect is applying.`,
  },
  {
    appliesTo: "summon",
    pattern: /you can only summon\s+(.{5,60}?)\s+(?:monsters\s+)?this turn/i,
    summarize: (name, m) =>
      `${name} locks summons to ${m[1]!.trim()} for the turn.`,
  },
];

/** Named engines that often collide with ED locks (e.g. Lair tribute lines). */
const FIELD_ENGINE_NAME =
  /\b(lair of darkness|there can be only one|rivalry of warlords|gozen match)\b/i;

export interface RestrictionCardRef {
  id: number;
  name: string;
  desc?: string | null;
}

/**
 * Extract summon / Extra Deck locks from deck card effect text.
 */
export function extractRestrictions(
  cards: RestrictionCardRef[],
): RestrictionFact[] {
  const out: RestrictionFact[] = [];
  const seen = new Set<number>();

  for (const card of cards) {
    if (seen.has(card.id)) continue;
    const blob = `${card.name}\n${card.desc || ""}`;
    for (const rule of RESTRICTION_RULES) {
      const match = blob.match(rule.pattern);
      if (!match) continue;
      seen.add(card.id);
      out.push({
        cardId: card.id,
        name: card.name,
        lockSummary: rule.summarize(card.name, match),
        appliesTo: rule.appliesTo,
        evidenceId: EvidenceIds.restriction(card.id),
      });
      break;
    }
  }

  return out;
}

/**
 * Collision when a field engine (Lair / floodgate) sits with ED/SS locks.
 */
export function detectPackageLockConflicts(args: {
  restrictions: RestrictionFact[];
  deckCardNames: string[];
}): Array<{
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  cardIds?: number[];
}> {
  const engines = args.deckCardNames.filter((n) => FIELD_ENGINE_NAME.test(n));
  if (engines.length === 0 || args.restrictions.length === 0) return [];

  const edLocks = args.restrictions.filter(
    (r) => r.appliesTo === "extra_deck" || r.appliesTo === "special_summon",
  );
  if (edLocks.length === 0) return [];

  return [
    {
      code: "PACKAGE_LOCK_CONFLICT",
      severity: "warning" as const,
      message: `${engines[0]} is in the list with summon/ED locks (${edLocks
        .map((r) => r.name)
        .slice(0, 3)
        .join(", ")}). Lines that need both packages can soft-brick each other.`,
      cardIds: edLocks.map((r) => r.cardId),
    },
  ];
}

/**
 * Filter synergy candidates that would be illegal under an active Extra Deck lock
 * when the question is lock-scoped. Heuristic: ED-type candidates flagged via name patterns.
 */
export function isLikelyExtraDeckCard(card: {
  name: string;
  desc?: string | null;
  type?: string | null;
}): boolean {
  const t = (card.type || "").toLowerCase();
  if (
    t.includes("synchro") ||
    t.includes("xyz") ||
    t.includes("fusion") ||
    t.includes("link") ||
    t.includes("pendulum")
  ) {
    return true;
  }
  const d = (card.desc || "").toLowerCase();
  return (
    /\b(synchro|xyz|fusion|link)\s+monster\b/i.test(d) ||
    /must (?:first )?be (?:fusion|synchro|xyz|link) summoned/i.test(d)
  );
}
