/**
 * Recompute floors for the current Master Duel snapshot.
 * Adds the chance to open a starter without fetching new lists.
 *
 * Usage: npx tsx scripts/ops/scrapers/rescore-meta-bands.ts
 */
import path from "path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bandsFromScoredLists, isMetaGateBands } from "../../../lib/meta/gate-bands";
import { scoreMetaList } from "../../../lib/meta/score-meta-list";
import type { MetaTier } from "../../../lib/meta/representation-tier";
import type { Card } from "../../../types/card";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

interface CardJoin {
  id: number;
  name: string;
  type: string | null;
  desc: string | null;
  atk: number | null;
  race: string | null;
  archetype: string | null;
}

interface ListRow {
  archetype_name: string;
  tier: number;
  meta_list_cards: Array<{
    zone: string;
    copies: number;
    cards: CardJoin | CardJoin[] | null;
  }> | null;
}

function serviceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceKey);
}

function asTier(value: number): MetaTier | null {
  if (value === 1 || value === 2 || value === 3) return value;
  return null;
}

function cardOf(value: CardJoin | CardJoin[] | null): CardJoin | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toCard(row: CardJoin): Card {
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

async function main(): Promise<void> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("meta_list_snapshots")
    .select(
      "id, sample_iterations, gate_bands, meta_lists(archetype_name, tier, meta_list_cards(zone, copies, cards(id, name, type, desc, atk, race, archetype)))",
    )
    .eq("format", "MASTER_DUEL")
    .eq("is_current", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "No current Master Duel snapshot");
  }
  if (!isMetaGateBands(data.gate_bands)) {
    throw new Error("Current snapshot has no gate bands");
  }

  const iterations = data.sample_iterations as number;
  const lists = (data.meta_lists ?? []) as ListRow[];
  const scored = lists.flatMap((list) => {
    const tier = asTier(list.tier);
    if (!tier) return [];
    const cards = (list.meta_list_cards ?? []).flatMap((entry) => {
      const row = cardOf(entry.cards);
      if (!row) return [];
      if (entry.zone !== "main" && entry.zone !== "extra" && entry.zone !== "side") {
        return [];
      }
      const zone: "main" | "extra" | "side" = entry.zone;
      return [{ card: toCard(row), copies: entry.copies, zone }];
    });
    return [
      scoreMetaList({
        tier,
        name: list.archetype_name,
        cards,
        format: "MASTER_DUEL",
        iterations,
      }),
    ];
  });

  const bands = bandsFromScoredLists(scored, iterations);
  const { error: updateError } = await supabase
    .from("meta_list_snapshots")
    .update({ gate_bands: bands })
    .eq("id", data.id);
  if (updateError) throw new Error(updateError.message);

  console.log(
    `Rescored snapshot ${data.id}: ${bands.decks?.length ?? 0} deck scores, tiers ${bands.listCounts[1]}/${bands.listCounts[2]}/${bands.listCounts[3]}`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : "Rescore failed");
  process.exit(1);
});
