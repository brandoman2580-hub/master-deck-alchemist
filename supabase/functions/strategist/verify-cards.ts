/**
 * Server grounding tools: verify names, ban status, and official effect text.
 * Used before Groq narrates so the coach only names cards that exist / are legal.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadFormatBanlist,
  maxCopiesForBanStatus,
} from "./synergy-eligibility.ts";

export type BanlistFormat = "TCG" | "MASTER_DUEL";

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

export interface CardTextSnippet {
  id: number;
  name: string;
  effectSnippet: string;
}

const EFFECT_SNIPPET_CAP = 280;

function normalizeCardKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Map raw banlist / ban_tcg strings to a stable status enum.
 */
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
 * Pure name match against an in-memory library (Jest / fixtures — no network).
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
 * Look up card names in the `cards` table (exact + fuzzy via ilike).
 */
export async function verifyCardNames(
  supabase: SupabaseClient,
  names: string[],
): Promise<CardNameVerification> {
  const cleaned = [
    ...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2)),
  ].slice(0, 24);
  if (cleaned.length === 0) {
    return { found: [], notFound: [] };
  }

  const library: Array<{ id: number; name: string }> = [];
  for (const name of cleaned) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, name")
      .ilike("name", `%${name.replace(/%/g, "")}%`)
      .limit(8);
    if (error) {
      console.warn("verifyCardNames query failed:", error.message);
      continue;
    }
    for (const row of data ?? []) {
      if (row.id != null && row.name) {
        library.push({ id: Number(row.id), name: String(row.name) });
      }
    }
  }

  // De-dupe library by id
  const byId = new Map(library.map((c) => [c.id, c]));
  return verifyCardNamesAgainstLibrary(cleaned, [...byId.values()]);
}

/**
 * Resolve ban status for card ids and/or names against format banlist.
 */
export async function banStatus(
  supabase: SupabaseClient,
  args: {
    cardIds?: number[];
    names?: string[];
    format: BanlistFormat;
    /** Optional preloaded name→status map (avoids a second fetch). */
    banlist?: Record<string, string>;
  },
): Promise<BanStatusResult[]> {
  const banlist =
    args.banlist ?? (await loadFormatBanlist(supabase, args.format));

  const idSet = new Set(
    (args.cardIds ?? []).filter((id) => Number.isFinite(id) && id > 0),
  );
  const nameHints = [
    ...new Set((args.names ?? []).map((n) => n.trim()).filter(Boolean)),
  ];

  const rows: Array<{ id: number; name: string }> = [];

  if (idSet.size > 0) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, name")
      .in("id", [...idSet]);
    if (error) {
      console.warn("banStatus id lookup failed:", error.message);
    } else {
      for (const row of data ?? []) {
        rows.push({ id: Number(row.id), name: String(row.name) });
      }
    }
  }

  let unresolvedNames: string[] = [];
  if (nameHints.length > 0) {
    const verified = await verifyCardNames(supabase, nameHints);
    for (const card of verified.found) {
      if (!rows.some((r) => r.id === card.id)) {
        rows.push(card);
      }
    }
    unresolvedNames = verified.notFound;
  }

  const results: BanStatusResult[] = [];
  const seen = new Set<string>();

  const resolveRaw = (name: string): string | null =>
    banlist[name] ??
      Object.entries(banlist).find(
        ([n]) => normalizeCardKey(n) === normalizeCardKey(name),
      )?.[1] ??
      null;

  for (const row of rows) {
    const key = `id:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const raw = resolveRaw(row.name);
    results.push({
      id: row.id,
      name: row.name,
      status: normalizeBanStatus(raw),
      rawStatus: raw,
      maxCopies: maxCopiesForBanStatus(raw ?? undefined),
    });
  }

  for (const hint of unresolvedNames) {
    const raw = resolveRaw(hint);
    results.push({
      id: null,
      name: hint,
      status: normalizeBanStatus(raw),
      rawStatus: raw,
      maxCopies: maxCopiesForBanStatus(raw ?? undefined),
    });
  }

  return results;
}

/**
 * Fetch official effect text snippets for card ids.
 */
export async function fetchCardTexts(
  supabase: SupabaseClient,
  cardIds: number[],
): Promise<CardTextSnippet[]> {
  const ids = [
    ...new Set(cardIds.filter((id) => Number.isFinite(id) && id > 0)),
  ].slice(0, 40);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("cards")
    .select("id, name, desc")
    .in("id", ids);
  if (error) {
    console.warn("fetchCardTexts failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    effectSnippet: String(row.desc || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, EFFECT_SNIPPET_CAP),
  }));
}

/**
 * Pull likely card-name phrases from the question + classifier entities.
 */
export function extractCandidateCardNames(
  question: string,
  entities: string[] = [],
): string[] {
  const out: string[] = [];
  for (const e of entities) {
    if (e.trim()) out.push(e.trim());
  }

  // Quoted titles
  const quoted = question.matchAll(/["'“”]([^"'“”]{3,80})["'“”]/g);
  for (const m of quoted) {
    if (m[1]) out.push(m[1].trim());
  }

  // Capitalized multi-word phrases (common card name shape)
  const caps = question.matchAll(
    /\b([A-Z][a-z]+(?:\s+(?:of|the|and|&)?\s*[A-Z][a-z]+){0,5})\b/g,
  );
  for (const m of caps) {
    const phrase = m[1]?.trim();
    if (!phrase || phrase.split(/\s+/).length < 2) continue;
    // Skip common sentence starters
    if (
      /^(What|Why|How|Where|When|Which|Show|Find|Convert|Optimize|Bridge|Rework)\b/i
        .test(phrase)
    ) {
      continue;
    }
    out.push(phrase);
  }

  return [...new Set(out)].slice(0, 16);
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

/**
 * Prompt attachment: verified names, rejects, ban status, effect snippets.
 * DECK_CARDS may be pre-packed lines (M3 Name [role]) or plain names.
 */
export function formatGroundingBlock(args: {
  verification: CardNameVerification;
  banResults?: BanStatusResult[];
  texts?: CardTextSnippet[];
  deckCardNames?: string[];
  /** Pre-packed sectioned lines from packDeckCardsForPrompt. */
  deckCardLines?: string[];
  deckCardsTruncated?: boolean;
}): string {
  const lines: string[] = ["# GROUNDING_TOOLS"];

  const deckLines =
    args.deckCardLines && args.deckCardLines.length > 0
      ? args.deckCardLines
      : (args.deckCardNames ?? []);

  if (deckLines.length) {
    lines.push(
      args.deckCardsTruncated
        ? "## DECK_CARDS (priority-packed; always nameable — section+count)"
        : "## DECK_CARDS (always nameable — section+count when packed)",
    );
    for (const n of deckLines) lines.push(`- ${n}`);
  }

  lines.push("## VERIFIED_CARD_NAMES");
  if (args.verification.found.length === 0) {
    lines.push("- (none beyond deck list)");
  } else {
    for (const c of args.verification.found) {
      lines.push(`- card:${c.id} | ${c.name}`);
    }
  }

  if (args.verification.notFound.length > 0) {
    lines.push("## REJECTED_INVENTED_OR_UNKNOWN_NAMES");
    for (const n of args.verification.notFound) {
      lines.push(`- ${n} — DO NOT recommend or invent this name`);
    }
  }

  if (args.banResults && args.banResults.length > 0) {
    lines.push("## BAN_STATUS");
    for (const b of args.banResults) {
      lines.push(
        `- ${b.name}${b.id != null ? ` (card:${b.id})` : ""} → ${b.status} (max ${b.maxCopies})`,
      );
    }
  }

  if (args.texts && args.texts.length > 0) {
    lines.push("## OFFICIAL_EFFECT_SNIPPETS");
    for (const t of args.texts) {
      lines.push(`- card:${t.id} | ${t.name}: ${t.effectSnippet || "(empty)"}`);
    }
  }

  lines.push(
    "RULE: Only name cards that appear in DECK_CARDS, VERIFIED_CARD_NAMES, RETRIEVED_CARDS, or SERVER_VARIANTS. Never invent card names.",
  );

  return lines.join("\n");
}
