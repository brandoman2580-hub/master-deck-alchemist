import { createClient } from "@/utils/supabase/client";
import type { EngineFormat, YugiohPlayStrategy } from "./types";
import type { MetaMatchupTemplate } from "./matchups";

const supabase = createClient();

function normalizeFormat(format: EngineFormat): string[] {
  if (format === "TCG") return ["tcg", "TCG"];
  return ["master_duel", "MASTER_DUEL", "Master Duel", "md"];
}

function mapTier(raw: number | string | null | undefined): "1" | "2" | "3" {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (n === 1) return "1";
  if (n === 2) return "2";
  return "3";
}

/**
 * Load latest tier-list rows as Matchups v1 templates (format-keyed).
 */
export async function loadMetaMatchupTemplates(
  format: EngineFormat,
  limit = 24,
): Promise<MetaMatchupTemplate[]> {
  const formats = normalizeFormat(format);

  const { data: tiers, error } = await supabase
    .from("tier_list_snapshots")
    .select("deck_name, tier, format, playstyle, scraped_at")
    .in("format", formats)
    .order("scraped_at", { ascending: false })
    .limit(80);

  if (error || !tiers?.length) {
    return fallbackTemplates(format);
  }

  // Keep newest scrape per deck_name
  const seen = new Set<string>();
  const unique: typeof tiers = [];
  for (const row of tiers) {
    const key = (row.deck_name ?? "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length >= limit) break;
  }

  const { data: strategies } = await supabase
    .from("archetype_strategies")
    .select("archetype_name, primary_strategy")
    .eq("format", format);

  const strategyByName = new Map<string, YugiohPlayStrategy>();
  for (const row of strategies ?? []) {
    strategyByName.set(
      String(row.archetype_name).toLowerCase(),
      row.primary_strategy as YugiohPlayStrategy,
    );
  }

  return unique.map((row, index) => {
    const name = row.deck_name as string;
    const strategy =
      strategyByName.get(name.toLowerCase()) ??
      [...strategyByName.entries()].find(([key]) =>
        name.toLowerCase().includes(key),
      )?.[1] ??
      null;

    const tier = mapTier(row.tier);
    // Soft meta share from tier rank (Tier 1 higher share)
    const base = tier === "1" ? 12 : tier === "2" ? 7 : 3;
    const metaShare = base + ((index % 5) * 0.8);

    return {
      name,
      opponentArchetype: name,
      tier,
      metaShare,
      strategy,
      playstyle: row.playstyle as string | null,
    };
  });
}

function fallbackTemplates(format: EngineFormat): MetaMatchupTemplate[] {
  const names =
    format === "TCG"
      ? ["Snake-Eye", "Branded", "Tenpai Dragon", "Yubel", "Voiceless Voice"]
      : ["Tearlaments", "Swordsoul", "Branded", "Kashtira", "Labrynth"];
  return names.map((name, index) => ({
    name,
    opponentArchetype: name,
    tier: (index < 2 ? "1" : index < 4 ? "2" : "3") as "1" | "2" | "3",
    metaShare: 10 - index,
    strategy: null,
    playstyle: null,
  }));
}
