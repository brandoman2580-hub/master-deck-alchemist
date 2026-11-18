import { createClient } from "@/utils/supabase/client";
import type { EngineFormat } from "@/lib/engine/types";
import { isMetaGateBands, type MetaGateBands } from "./gate-bands";
import type { MetaListCardRef, MetaListRef } from "./matchup-plan";
import type { MetaTier } from "./representation-tier";

const supabase = createClient();

/**
 * Current gate bands for a format, only when the snapshot was checked
 * against the same banlist the caller is holding.
 */
export async function loadGateBands(
  format: EngineFormat,
  banlistFingerprint: string,
): Promise<MetaGateBands | null> {
  if (!banlistFingerprint) return null;

  const { data, error } = await supabase
    .from("meta_list_snapshots")
    .select("gate_bands")
    .eq("format", format)
    .eq("is_current", true)
    .eq("banlist_fingerprint", banlistFingerprint)
    .maybeSingle();

  if (error || !data) return null;
  return isMetaGateBands(data.gate_bands) ? data.gate_bands : null;
}

interface SnapshotListRow {
  archetype_name: string;
  tier: number;
  meta_list_cards: Array<{
    zone: string;
    copies: number;
    cards: { name: string } | { name: string }[] | null;
  }> | null;
}

function asTier(value: number): MetaTier | null {
  if (value === 1 || value === 2 || value === 3) return value;
  return null;
}

function cardName(
  value: { name: string } | { name: string }[] | null,
): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name;
}

function toList(row: SnapshotListRow): MetaListRef | null {
  const tier = asTier(row.tier);
  if (!tier || !row.archetype_name) return null;
  const cards: MetaListCardRef[] = [];
  for (const entry of row.meta_list_cards ?? []) {
    const name = cardName(entry.cards);
    if (!name) continue;
    if (entry.zone !== "main" && entry.zone !== "extra" && entry.zone !== "side") {
      continue;
    }
    cards.push({
      name,
      copies: entry.copies,
      zone: entry.zone,
    });
  }
  return { name: row.archetype_name, tier, cards };
}

/**
 * Current legal lists for the banlist the caller is holding.
 * An older snapshot is ignored when the live banlist has changed.
 */
export async function loadMetaLists(
  format: EngineFormat,
  banlistFingerprint: string,
): Promise<MetaListRef[]> {
  if (!banlistFingerprint) return [];

  const { data, error } = await supabase
    .from("meta_list_snapshots")
    .select(
      "meta_lists(archetype_name, tier, meta_list_cards(zone, copies, cards(name)))",
    )
    .eq("format", format)
    .eq("is_current", true)
    .eq("banlist_fingerprint", banlistFingerprint)
    .maybeSingle();

  if (error || !data) return [];
  const rows = (data.meta_lists ?? []) as SnapshotListRow[];
  return rows.flatMap((row) => {
    const list = toList(row);
    return list ? [list] : [];
  });
}
