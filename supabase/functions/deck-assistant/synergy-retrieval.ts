/**
 * Condition-driven RAG for discover_synergy mode.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, Deck } from "./types.ts";
import type { EngineCondition } from "./engine-conditions.ts";
import {
  archetypeOverlapPenalty,
  buildDiscoveryCondition,
  discoveryFilterBoost,
  diversifyByFamily,
  parseDiscoveryFilters,
  scoreConditionFit,
  type DiscoveryFilters,
} from "./engine-conditions.ts";
import type { RetrievedSynergyCard } from "./coach-response.ts";
import type { BanlistFormat } from "./rag-retrieval.ts";
import { canAddCardToDeck } from "./synergy-eligibility.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/** Per-condition text fallback patterns when hybrid_card_search fails. */
const FALLBACK_ILIKE: Record<string, string> = {
  tribute_opponent_for_cost: "%tribute%opponent%",
  send_from_deck_to_gy: "%send%deck%graveyard%",
  banish_for_cost_or_summon: "%banish%graveyard%",
  discard_for_advantage: "%discard%1%card%",
  link_arrow_pointing_zones: "%points to%",
  dark_field_wide_payoff: "%tribute%1%DARK%",
  fusion_material_steal: "%fusion%opponent%",
  card_discovery: "%add%deck%hand%",
};

async function generateQueryEmbedding(text: string): Promise<number[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase environment variables");
  }
  const embedFn = `${SUPABASE_URL}/functions/v1/embed`;
  const res = await fetch(embedFn, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: String(text).slice(0, 20000),
      model: "gte-small",
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Embed call failed: ${res.status} - ${errorText}`);
  }
  const result = await res.json();
  if (!result.embedding || !Array.isArray(result.embedding)) {
    throw new Error("Invalid embedding response format");
  }
  return result.embedding as number[];
}

const PER_CONDITION_CAP = 8;
const FINAL_CAP = 12;

function isEligibleCandidate(
  card: Card,
  deck: Deck | undefined,
  banlist: Record<string, string>,
): boolean {
  if (!deck) {
    return canAddCardToDeck(
      card,
      { mainDeck: [], extraDeck: [], sideDeck: [] },
      banlist,
    );
  }
  return canAddCardToDeck(card, deck, banlist);
}

function rankScore(
  item: RetrievedSynergyCard,
  filters: DiscoveryFilters,
): number {
  return (
    item.conditionFit * 2 -
    item.overlapPenalty +
    discoveryFilterBoost(item.card, filters)
  );
}

/**
 * Blend condition capability language with the user's ask so different
 * phrasings ("fiend searchers", "going second", "floodgates") diverge.
 */
export function buildSynergySearchText(
  condition: EngineCondition,
  userQuery?: string,
): string {
  const ask = (userQuery || "").trim();
  if (!ask) return condition.retrievalQuery;
  return `${condition.retrievalQuery}. User ask: ${ask.slice(0, 280)}`;
}

async function fetchAttributeRaceFallback(args: {
  supabase: SupabaseClient;
  filters: DiscoveryFilters;
  exclude: Set<string>;
  deck?: Deck;
  banlist: Record<string, string>;
  matchCount: number;
  condition: EngineCondition;
  primaryArchetype: string | null;
}): Promise<RetrievedSynergyCard[]> {
  const {
    supabase,
    filters,
    exclude,
    deck,
    banlist,
    matchCount,
    condition,
    primaryArchetype,
  } = args;
  let query = supabase
    .from("cards")
    .select(
      "id, name, type, desc, archetype, attribute, race, atk, def, level, card_images",
    )
    .limit(matchCount);

  if (filters.attributes.length === 1) {
    query = query.eq("attribute", filters.attributes[0]!);
  }
  if (filters.races.length === 1) {
    query = query.eq("race", filters.races[0]!);
  }
  if (filters.wantsSearcher) {
    query = query.or(
      "desc.ilike.%add%deck%hand%,desc.ilike.%from your deck%hand%,desc.ilike.%search%deck%",
    );
  }

  const { data } = await query;
  const bucket: RetrievedSynergyCard[] = [];
  for (const row of data ?? []) {
    const card = row as Card;
    if (exclude.has(String(card.id))) continue;
    if (!isEligibleCandidate(card, deck, banlist)) continue;
    if (
      filters.attributes.length > 1 &&
      !filters.attributes.some(
        (a) => (card.attribute || "").toUpperCase() === a.toUpperCase(),
      )
    ) {
      continue;
    }
    if (
      filters.races.length > 1 &&
      !filters.races.some(
        (r) => (card.race || "").toLowerCase() === r.toLowerCase(),
      )
    ) {
      continue;
    }
    const conditionFit = Math.max(
      0.35,
      scoreConditionFit(card, condition) || 0.35,
    );
    const overlapPenalty = archetypeOverlapPenalty(card, primaryArchetype);
    bucket.push({ card, condition, conditionFit, overlapPenalty });
  }
  return bucket;
}

/**
 * Retrieve synergy candidates for each engine condition.
 * Soft conditionFit (keyword overlap) is allowed so hybrid hits are not
 * dropped solely for wording that misses a hard regex.
 * Family diversity prevents Kaiju-clone spam from filling the whole list.
 * Attribute/race/searcher asks get an explicit discovery bucket + SQL fallback.
 */
export async function retrieveSynergyCandidates(args: {
  conditions: EngineCondition[];
  deckCardIds: number[];
  primaryArchetype: string | null;
  supabase: SupabaseClient;
  banlistFormat: BanlistFormat;
  matchCount?: number;
  deck?: Deck;
  banlist?: Record<string, string>;
  userQuery?: string;
}): Promise<RetrievedSynergyCard[]> {
  const {
    conditions,
    deckCardIds,
    primaryArchetype,
    supabase,
    banlistFormat,
    matchCount = 24,
    deck,
    banlist = {},
    userQuery,
  } = args;

  const filters = parseDiscoveryFilters(userQuery || "");
  const discovery = buildDiscoveryCondition(
    filters,
    conditions.flatMap((c) => c.satisfiedByDeck),
  );
  const workConditions = [...conditions];
  if (
    discovery &&
    !workConditions.some((c) => c.slug === "card_discovery")
  ) {
    workConditions.unshift(discovery);
  }

  if (workConditions.length === 0) return [];

  const exclude = new Set(deckCardIds.map(String));
  const perCondition: RetrievedSynergyCard[][] = [];

  for (const condition of workConditions.slice(0, 4)) {
    const bucket: RetrievedSynergyCard[] = [];
    const searchText = buildSynergySearchText(condition, userQuery);

    let embedding: number[] | null = null;
    try {
      embedding = await generateQueryEmbedding(searchText);
    } catch (err) {
      console.warn("Synergy embed failed:", err);
    }

    if (embedding) {
      const { data: candidates, error } = await supabase.rpc(
        "hybrid_card_search",
        {
          query_embedding: embedding,
          query_text: searchText,
          exclude_archetypes: primaryArchetype ? [primaryArchetype] : [],
          exclude_ids: deckCardIds,
          exclude_types: null,
          exclude_races: null,
          banlist_format: banlistFormat,
          vector_weight: 0.65,
          fts_weight: 0.35,
          match_count: matchCount,
        },
      );

      if (error) {
        console.warn("hybrid_card_search error:", error.message);
      } else {
        for (const row of candidates ?? []) {
          const card = row as Card;
          if (exclude.has(String(card.id))) continue;
          if (!isEligibleCandidate(card, deck, banlist)) continue;
          const conditionFit =
            condition.slug === "card_discovery"
              ? Math.max(0.3, scoreConditionFit(card, condition) || 0.3)
              : scoreConditionFit(card, condition);
          if (conditionFit <= 0) continue;
          // Hard filter for explicit discovery asks: keep attribute/race matches.
          if (condition.slug === "card_discovery") {
            const boost = discoveryFilterBoost(card, filters);
            if (
              (filters.attributes.length > 0 || filters.races.length > 0) &&
              boost < 0.3
            ) {
              continue;
            }
          }
          const overlapPenalty = archetypeOverlapPenalty(
            card,
            primaryArchetype,
          );
          bucket.push({ card, condition, conditionFit, overlapPenalty });
        }
      }
    }

    if (bucket.length === 0 && condition.slug === "card_discovery") {
      const fallback = await fetchAttributeRaceFallback({
        supabase,
        filters,
        exclude,
        deck,
        banlist,
        matchCount,
        condition,
        primaryArchetype,
      });
      bucket.push(...fallback);
    }

    if (bucket.length === 0) {
      const pattern = FALLBACK_ILIKE[condition.slug] ?? "%special summon%";
      const { data: fallback } = await supabase
        .from("cards")
        .select(
          "id, name, type, desc, archetype, attribute, race, atk, def, level, card_images",
        )
        .ilike("desc", pattern)
        .limit(matchCount);
      for (const row of fallback ?? []) {
        const card = row as Card;
        if (exclude.has(String(card.id))) continue;
        if (!isEligibleCandidate(card, deck, banlist)) continue;
        const conditionFit = scoreConditionFit(card, condition);
        if (conditionFit <= 0) continue;
        const overlapPenalty = archetypeOverlapPenalty(
          card,
          primaryArchetype,
        );
        bucket.push({ card, condition, conditionFit, overlapPenalty });
      }
    }

    bucket.sort((a, b) => rankScore(b, filters) - rankScore(a, filters));
    perCondition.push(diversifyByFamily(bucket, PER_CONDITION_CAP));
  }

  const byId = new Map<number, RetrievedSynergyCard>();
  const maxLen = Math.max(0, ...perCondition.map((b) => b.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (const bucket of perCondition) {
      const item = bucket[i];
      if (!item) continue;
      const rank = rankScore(item, filters);
      const existing = byId.get(item.card.id);
      const existingRank = existing ? rankScore(existing, filters) : -Infinity;
      if (!existing || rank > existingRank) {
        byId.set(item.card.id, item);
      }
    }
  }

  const ranked = [...byId.values()].sort(
    (a, b) => rankScore(b, filters) - rankScore(a, filters),
  );

  return diversifyByFamily(ranked, FINAL_CAP);
}
