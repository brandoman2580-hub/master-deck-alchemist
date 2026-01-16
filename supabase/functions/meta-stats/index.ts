/**
 * Meta Statistics Edge Function
 * Provides tier list statistics and meta insights
 */

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MetaStatsRequest {
  format?: "tcg" | "master_duel";
  days?: number; // Number of days to look back (default: 30)
}

interface TierDistribution {
  tier: number;
  count: number;
  decks: string[];
}

interface MetaStatsResponse {
  format: string;
  lastUpdate: string | null;
  totalDecks: number;
  tierDistribution: TierDistribution[];
  topDecks: Array<{
    deck_name: string;
    tier: number;
    firstSeen: string;
    lastSeen: string;
  }>;
  metaHealth: {
    diversity: number; // 0-1, higher = more diverse
    stability: number; // 0-1, higher = more stable
  };
}

/**
 * Get meta statistics for a format
 */
async function getMetaStats(
  format: "tcg" | "master_duel",
  days: number = 30
): Promise<MetaStatsResponse> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Get latest scrape run
  const { data: latestRun } = await supabase
    .from("tier_list_snapshots")
    .select("scraped_at, scrape_run_id")
    .eq("format", format)
    .order("scraped_at", { ascending: false })
    .limit(1)
    .single();

  if (!latestRun) {
    return {
      format,
      lastUpdate: null,
      totalDecks: 0,
      tierDistribution: [],
      topDecks: [],
      metaHealth: { diversity: 0, stability: 0 },
    };
  }

  // Get current tier list
  const { data: currentTierList } = await supabase
    .from("tier_list_snapshots")
    .select("deck_name, tier")
    .eq("format", format)
    .eq("scrape_run_id", latestRun.scrape_run_id)
    .order("tier, deck_name");

  // Calculate tier distribution
  const tierMap = new Map<number, { count: number; decks: string[] }>();
  currentTierList?.forEach((entry) => {
    const existing = tierMap.get(entry.tier) || { count: 0, decks: [] };
    existing.count++;
    existing.decks.push(entry.deck_name);
    tierMap.set(entry.tier, existing);
  });

  const tierDistribution: TierDistribution[] = Array.from(tierMap.entries())
    .map(([tier, data]) => ({
      tier,
      count: data.count,
      decks: data.decks.sort(),
    }))
    .sort((a, b) => a.tier - b.tier);

  // Get top decks (Tier 1 and Tier 2)
  const topDecks = currentTierList
    ?.filter((entry) => entry.tier <= 2)
    .map((entry) => ({
      deck_name: entry.deck_name,
      tier: entry.tier,
      firstSeen: latestRun.scraped_at,
      lastSeen: latestRun.scraped_at,
    })) || [];

  // Calculate meta health
  const totalDecks = currentTierList?.length || 0;
  const uniqueDecks = new Set(currentTierList?.map((e) => e.deck_name) || []).size;
  const diversity = totalDecks > 0 ? uniqueDecks / totalDecks : 0;

  // Stability: Check how many decks were in previous snapshot
  const { data: previousRun } = await supabase
    .from("tier_list_snapshots")
    .select("scrape_run_id, scraped_at")
    .eq("format", format)
    .lt("scraped_at", latestRun.scraped_at)
    .order("scraped_at", { ascending: false })
    .limit(1)
    .single();

  let stability = 1.0; // Default to stable if no previous data
  if (previousRun) {
    const { data: previousTierList } = await supabase
      .from("tier_list_snapshots")
      .select("deck_name")
      .eq("format", format)
      .eq("scrape_run_id", previousRun.scrape_run_id);

    const previousDecks = new Set(previousTierList?.map((e) => e.deck_name) || []);
    const currentDecks = new Set(currentTierList?.map((e) => e.deck_name) || []);
    const overlap = Array.from(currentDecks).filter((d) => previousDecks.has(d)).length;
    const total = Math.max(previousDecks.size, currentDecks.size);
    stability = total > 0 ? overlap / total : 1.0;
  }

  return {
    format,
    lastUpdate: latestRun.scraped_at,
    totalDecks,
    tierDistribution,
    topDecks,
    metaHealth: {
      diversity: Math.min(1.0, diversity),
      stability,
    },
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    let requestData: MetaStatsRequest = {};
    if (req.method === "POST") {
      try {
        requestData = await req.json();
      } catch {
        // Body is optional
      }
    } else if (req.method === "GET") {
      const url = new URL(req.url);
      requestData = {
        format: (url.searchParams.get("format") as "tcg" | "master_duel") || undefined,
        days: url.searchParams.get("days") ? parseInt(url.searchParams.get("days")!) : undefined,
      };
    }

    const format = requestData.format || "tcg";
    const days = requestData.days || 30;

    if (format !== "tcg" && format !== "master_duel") {
      return new Response(
        JSON.stringify({ error: "Invalid format. Must be 'tcg' or 'master_duel'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stats = await getMetaStats(format, days);

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error in meta-stats function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
