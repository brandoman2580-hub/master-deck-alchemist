/**
 * Ingest current Master Duel meta lists and the four-gate floors.
 *
 * Tiers 1, 2, and 3 are all stored. A list is kept only when every card
 * resolves to public.cards and the list is legal on the live Master Duel
 * banlist. Missing catalog cards are added from YGOPRODeck by exact name.
 * The snapshot becomes current only after a tier-1 list is stored.
 *
 * Usage: npx tsx scripts/ops/scrapers/ingest-meta-lists.ts
 */
import path from "path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { banlistFingerprint } from "../../../lib/meta/banlist-fingerprint";
import {
  bandsFromScoredLists,
  type ScoredMetaList,
} from "../../../lib/meta/gate-bands";
import {
  firstBanlistViolation,
  normalizeCardName,
} from "../../../lib/meta/list-legality";
import {
  tierFromRepresentation,
  type MetaTier,
} from "../../../lib/meta/representation-tier";
import { scoreMetaList } from "../../../lib/meta/score-meta-list";
import type { Card } from "../../../types/card";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

const SOURCE = "masterduelmeta";
const FORMAT = "MASTER_DUEL";
const SAMPLE_ITERATIONS = 3000;
const REQUEST_GAP_MS = 500;
const API = "https://www.masterduelmeta.com/api/v1";
const CARD_API = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const LIST_CANDIDATES = 8;

interface DeckTypeRow {
  _id: string;
  name: string;
  masterPopRank?: number | null;
}

interface MdmCardSlot {
  card?: { name?: string };
  amount?: number;
}

interface MdmDeck {
  url?: string;
  main?: MdmCardSlot[];
  extra?: MdmCardSlot[];
  side?: MdmCardSlot[];
}

interface CardRow {
  id: number;
  name: string;
  type: string | null;
  desc: string | null;
  atk: number | null;
  race: string | null;
  archetype: string | null;
}

interface KeptList {
  name: string;
  tier: MetaTier;
  sourceUrl: string | null;
  zones: Record<"main" | "extra" | "side", Map<number, number>>;
  cards: { card: Card; copies: number; zone: "main" | "extra" | "side" }[];
  scored: ScoredMetaList;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serviceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(supabaseUrl, serviceKey);
}

function stayedOn(response: Response, host: string): boolean {
  return new URL(response.url).host === host;
}

async function mdmGet<T>(pathAndQuery: string): Promise<T> {
  const response = await fetch(`${API}/${pathAndQuery}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MasterDeckAlchemist/1.0",
    },
  });
  if (!response.ok || !stayedOn(response, "www.masterduelmeta.com")) {
    throw new Error(`Master Duel Meta ${pathAndQuery} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

function asArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

async function loadBanlist(
  supabase: SupabaseClient,
): Promise<Record<string, string>> {
  const banlist: Record<string, string> = {};
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("master_duel_banlist")
      .select("card_name, ban_status")
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      if (row.card_name && row.ban_status) {
        banlist[row.card_name] = row.ban_status;
      }
    }
    if (rows.length < page) break;
    from += page;
  }
  return banlist;
}

async function loadCards(supabase: SupabaseClient): Promise<Map<string, CardRow>> {
  const index = new Map<string, CardRow>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, name, type, desc, atk, race, archetype")
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as CardRow[];
    for (const row of rows) {
      const key = normalizeCardName(row.name);
      if (!index.has(key)) index.set(key, row);
    }
    if (rows.length < page) break;
    from += page;
  }
  return index;
}

function toCard(row: CardRow): Card {
  return {
    id: row.id,
    deckInstanceId: `meta-${row.id}`,
    name: row.name,
    type: row.type ?? "",
    desc: row.desc ?? "",
    atk: row.atk ?? undefined,
    race: row.race ?? "",
    archetype: row.archetype,
    misc_info: [{ md_rarity: "" }],
    card_sets: {
      set_name: "",
      set_code: "",
      set_rarity: "",
      set_rarity_code: "",
      set_price: "",
    },
    card_images: [],
    card_prices: [],
  };
}

function countZone(
  slots: MdmCardSlot[] | undefined,
): Map<string, number> | null {
  const counts = new Map<string, number>();
  for (const slot of slots ?? []) {
    const name = slot.card?.name?.trim();
    const amount = slot.amount ?? 1;
    if (!name || !Number.isInteger(amount) || amount < 1) return null;
    counts.set(name, (counts.get(name) ?? 0) + amount);
  }
  return counts;
}

function sourceUrl(deck: MdmDeck): string | null {
  if (!deck.url) return null;
  if (deck.url.startsWith("http")) return deck.url;
  return `https://www.masterduelmeta.com${deck.url.startsWith("/") ? "" : "/"}${deck.url}`;
}

async function importMissingCard(
  supabase: SupabaseClient,
  name: string,
  index: Map<string, CardRow>,
): Promise<boolean> {
  const key = normalizeCardName(name);
  if (index.has(key)) return true;

  await sleep(120);
  const response = await fetch(
    `${CARD_API}?name=${encodeURIComponent(name)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok || !stayedOn(response, "db.ygoprodeck.com")) return false;

  const json = (await response.json()) as {
    data?: Array<{
      id?: number;
      name?: string;
      type?: string;
      desc?: string;
      atk?: number;
      def?: number;
      level?: number;
      race?: string;
      attribute?: string;
      archetype?: string;
      banlist_info?: { ban_tcg?: string };
      card_sets?: unknown;
      card_prices?: unknown[];
      misc_info?: unknown;
    }>;
  };
  const card = json.data?.[0];
  if (!card?.id || !card.name || !card.type || card.desc == null) return false;
  if (normalizeCardName(card.name) !== key) return false;
  if (card.id >= 100_000_000 && card.id < 200_000_000) return false;

  const { error } = await supabase.from("cards").upsert({
    id: card.id,
    name: card.name,
    type: card.type,
    desc: card.desc,
    atk: card.atk ?? null,
    def: card.def ?? null,
    level: card.level ?? null,
    race: card.race ?? null,
    attribute: card.attribute ?? null,
    archetype: card.archetype ?? null,
    ban_tcg: card.banlist_info?.ban_tcg ?? null,
    card_images: null,
    card_sets: card.card_sets ?? null,
    card_prices: card.card_prices?.[0] ? [card.card_prices[0]] : null,
    misc_info: card.misc_info ?? null,
  });
  if (error) {
    console.log(`  could not add ${name}`);
    return false;
  }

  index.set(normalizeCardName(card.name), {
    id: card.id,
    name: card.name,
    type: card.type,
    desc: card.desc,
    atk: card.atk ?? null,
    race: card.race ?? null,
    archetype: card.archetype ?? null,
  });
  console.log(`  added catalog card ${card.name}`);
  return index.has(key);
}

async function keepDeck(
  supabase: SupabaseClient,
  deck: MdmDeck,
  tier: MetaTier,
  archetypeName: string,
  cards: Map<string, CardRow>,
  banlist: Record<string, string>,
): Promise<KeptList | string> {
  const zones = {
    main: countZone(deck.main),
    extra: countZone(deck.extra),
    side: countZone(deck.side),
  };
  if (!zones.main || !zones.extra || !zones.side) return "malformed card row";

  const mainCopies = [...zones.main.values()].reduce((sum, n) => sum + n, 0);
  if (mainCopies < 40) return `main deck has ${mainCopies} cards`;

  const byName = new Map<string, number>();
  for (const zone of [zones.main, zones.extra, zones.side]) {
    for (const [name, copies] of zone) {
      byName.set(name, (byName.get(name) ?? 0) + copies);
    }
  }
  for (const [name, copies] of byName) {
    if (copies > 3) return `${name} is listed ${copies} times`;
  }
  const violation = firstBanlistViolation(byName, banlist);
  if (violation) return `${violation} is not legal on the current banlist`;

  const resolvedZones: KeptList["zones"] = {
    main: new Map(),
    extra: new Map(),
    side: new Map(),
  };
  const scoredCards: KeptList["cards"] = [];
  for (const zone of ["main", "extra", "side"] as const) {
    for (const [name, copies] of zones[zone]!) {
      let row = cards.get(normalizeCardName(name));
      if (!row) {
        await importMissingCard(supabase, name, cards);
        row = cards.get(normalizeCardName(name));
      }
      if (!row) return `${name} is not in the card catalog`;
      resolvedZones[zone].set(row.id, copies);
      scoredCards.push({ card: toCard(row), copies, zone });
    }
  }

  return {
    name: archetypeName,
    tier,
    sourceUrl: sourceUrl(deck),
    zones: resolvedZones,
    cards: scoredCards,
    scored: scoreMetaList({
      tier,
      name: archetypeName,
      cards: scoredCards,
      format: FORMAT,
      iterations: SAMPLE_ITERATIONS,
    }),
  };
}

async function newestLegalList(
  supabase: SupabaseClient,
  deckType: DeckTypeRow,
  tier: MetaTier,
  cards: Map<string, CardRow>,
  banlist: Record<string, string>,
): Promise<KeptList | null> {
  await sleep(REQUEST_GAP_MS);
  const payload = await mdmGet<MdmDeck[] | MdmDeck>(
    `top-decks?limit=${LIST_CANDIDATES}&sort=-created&deckType=${encodeURIComponent(deckType._id)}`,
  );
  const decks = asArray(payload);
  const reasons: string[] = [];
  for (const deck of decks) {
    const kept = await keepDeck(
      supabase,
      deck,
      tier,
      deckType.name,
      cards,
      banlist,
    );
    if (typeof kept === "string") {
      reasons.push(kept);
      continue;
    }
    return kept;
  }
  console.log(
    `  skipped ${deckType.name} (tier ${tier}): ${reasons.join("; ") || "no recent lists"}`,
  );
  return null;
}

async function main(): Promise<void> {
  const supabase = serviceClient();
  const banlist = await loadBanlist(supabase);
  const fingerprint = banlistFingerprint(banlist);
  if (!fingerprint) {
    throw new Error("Master Duel banlist is empty, so no snapshot can be current");
  }
  console.log(`Banlist entries used for legality: ${Object.keys(banlist).length}`);

  const cards = await loadCards(supabase);
  console.log(`Card catalog names: ${cards.size}`);

  const types = asArray(
    await mdmGet<DeckTypeRow[] | DeckTypeRow>(
      "deck-types?sort=-masterPopRank&limit=200",
    ),
  );
  const selected = types.flatMap((row) => {
    const tier = tierFromRepresentation(row.masterPopRank);
    return tier ? [{ row, tier }] : [];
  });
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const item of selected) counts[item.tier] += 1;
  console.log(
    `Deck types in scope: tier 1 ${counts[1]}, tier 2 ${counts[2]}, tier 3 ${counts[3]}`,
  );

  const kept: KeptList[] = [];
  for (const item of selected) {
    const list = await newestLegalList(
      supabase,
      item.row,
      item.tier,
      cards,
      banlist,
    );
    if (list) {
      kept.push(list);
      console.log(`  kept ${list.name} (tier ${list.tier})`);
    }
  }
  if (kept.length === 0) {
    throw new Error("No legal tier 1, 2, or 3 lists were resolved");
  }

  const bands = bandsFromScoredLists(
    kept.map((list) => list.scored),
    SAMPLE_ITERATIONS,
  );

  const { data: snapshot, error: snapshotError } = await supabase
    .from("meta_list_snapshots")
    .insert({
      format: FORMAT,
      source: SOURCE,
      banlist_fingerprint: fingerprint,
      sample_iterations: SAMPLE_ITERATIONS,
      gate_bands: bands,
      is_current: false,
    })
    .select("id")
    .single();
  if (snapshotError || !snapshot) {
    throw new Error(snapshotError?.message ?? "Snapshot insert failed");
  }
  const snapshotId = snapshot.id as number;

  try {
    for (const list of kept) {
      const { data: inserted, error: listError } = await supabase
        .from("meta_lists")
        .insert({
          snapshot_id: snapshotId,
          archetype_name: list.name,
          tier: list.tier,
          source_url: list.sourceUrl,
        })
        .select("id")
        .single();
      if (listError || !inserted) throw new Error(listError?.message ?? "List insert failed");

      const rows = (["main", "extra", "side"] as const).flatMap((zone) =>
        [...list.zones[zone].entries()].map(([cardId, copies]) => ({
          list_id: inserted.id,
          card_id: cardId,
          zone,
          copies,
        })),
      );
      const { error: cardError } = await supabase.from("meta_list_cards").insert(rows);
      if (cardError) throw new Error(cardError.message);
    }

    const { error: clearError } = await supabase
      .from("meta_list_snapshots")
      .update({ is_current: false })
      .eq("format", FORMAT)
      .eq("is_current", true);
    if (clearError) throw new Error(clearError.message);

    if (bands.listCounts[1] === 0) {
      console.log(
        `Snapshot ${snapshotId} stored but not current: no legal tier-1 list resolved`,
      );
      return;
    }

    const { error: currentError } = await supabase
      .from("meta_list_snapshots")
      .update({ is_current: true })
      .eq("id", snapshotId);
    if (currentError) throw new Error(currentError.message);
  } catch (error) {
    await supabase.from("meta_list_snapshots").delete().eq("id", snapshotId);
    throw error;
  }

  console.log(
    `Current snapshot ${snapshotId}: tier 1 ${bands.listCounts[1]}, tier 2 ${bands.listCounts[2]}, tier 3 ${bands.listCounts[3]}`,
  );
  console.log(
    `Tier 1 floors — ceiling ${bands.ceiling.tier1}, going second ${bands.floor.tier1}, non-engine ${bands.nonEngine.tier1}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Ingest failed";
  console.error(message);
  process.exitCode = 1;
});
