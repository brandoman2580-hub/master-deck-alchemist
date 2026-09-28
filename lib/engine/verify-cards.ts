/**
 * Client-safe grounding helpers (Jest / fixtures).
 * Edge async Supabase tools live in supabase/functions/strategist/verify-cards.ts.
 */

import { maxCopiesForBanStatus } from "./synergy-eligibility";

export type NormalizedBanStatus =
  | "forbidden"
  | "limited"
  | "semi-limited"
  | "unlimited";

export interface VerifiedCard {
  id: number;
  name: string;
}

export interface CardNameVerification {
  found: VerifiedCard[];
  notFound: string[];
}

export interface BanStatusResult {
  id: number | null;
  name: string;
  status: NormalizedBanStatus;
  rawStatus: string | null;
  maxCopies: number;
}

function normalizeCardKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizeBanStatus(
  raw: string | null | undefined,
): NormalizedBanStatus {
  if (!raw) return "unlimited";
  const n = String(raw).trim().toLowerCase();
  if (n === "forbidden" || n === "banned") return "forbidden";
  if (n === "limited") return "limited";
  if (n === "semi-limited" || n === "semi limited") return "semi-limited";
  return "unlimited";
}

/**
 * Pure name match against an in-memory library (no network).
 */
export function verifyCardNamesAgainstLibrary(
  names: string[],
  library: Array<{ id: number; name: string }>,
): CardNameVerification {
  const found: VerifiedCard[] = [];
  const notFound: string[] = [];
  const seenIds = new Set<number>();

  for (const raw of names) {
    const needle = normalizeCardKey(raw);
    if (!needle || needle.length < 2) {
      if (raw.trim()) notFound.push(raw.trim());
      continue;
    }

    let best: { id: number; name: string; score: number } | null = null;
    for (const card of library) {
      const hay = normalizeCardKey(card.name);
      if (!hay) continue;
      let score = 0;
      if (hay === needle) score = 1;
      else if (hay.startsWith(needle) || needle.startsWith(hay)) score = 0.9;
      else if (hay.includes(needle) || needle.includes(hay)) {
        score =
          Math.min(needle.length, hay.length) /
          Math.max(needle.length, hay.length);
        if (score < 0.55 && Math.min(needle.length, hay.length) >= 6) {
          score = 0.7;
        }
      }
      if (score >= 0.55 && (!best || score > best.score)) {
        best = { id: card.id, name: card.name, score };
      }
    }

    if (best && !seenIds.has(best.id)) {
      seenIds.add(best.id);
      found.push({ id: best.id, name: best.name });
    } else if (!best) {
      notFound.push(raw.trim());
    }
  }

  return { found, notFound };
}

/**
 * Pure ban-status lookup against an in-memory map (fixtures / Jest).
 */
export function banStatusAgainstMap(
  cards: Array<{ id: number | null; name: string }>,
  banlist: Record<string, string>,
): BanStatusResult[] {
  return cards.map((card) => {
    const raw =
      banlist[card.name] ??
      Object.entries(banlist).find(
        ([n]) => normalizeCardKey(n) === normalizeCardKey(card.name),
      )?.[1] ??
      null;
    const status = normalizeBanStatus(raw);
    return {
      id: card.id,
      name: card.name,
      status,
      rawStatus: raw,
      maxCopies: maxCopiesForBanStatus(raw ?? undefined),
    };
  });
}
