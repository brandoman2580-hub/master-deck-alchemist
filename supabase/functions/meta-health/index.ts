/**
 * Meta Health Check Edge Function
 * Provides health monitoring and data quality checks for tier list data
 */

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    dataFreshness: {
      status: "pass" | "fail" | "warning";
      message: string;
      lastUpdate?: string;
      daysSinceUpdate?: number;
    };
    dataQuality: {
      status: "pass" | "fail" | "warning";
      message: string;
      issues: string[];
    };
    coverage: {
      status: "pass" | "fail" | "warning";
      message: string;
      tcgDecks?: number;
      masterDuelDecks?: number;
    };
  };
  timestamp: string;
}

/**
 * Check data freshness (last update should be < 14 days old)
 */
async function checkDataFreshness(format: "tcg" | "master_duel"): Promise<{
  status: "pass" | "fail" | "warning";
  message: string;
  lastUpdate?: string;
  daysSinceUpdate?: number;
}> {
  try {
    const { data, error } = await supabase
      .from("tier_list_snapshots")
      .select("scraped_at")
      .eq("format", format)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return {
        status: "fail",
        message: `No tier list data found for ${format}`,
      };
    }

    const lastUpdate = new Date(data.scraped_at);
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate > 14) {
      return {
        status: "fail",
        message: `Data is ${Math.round(daysSinceUpdate)} days old (should be < 14 days)`,
        lastUpdate: lastUpdate.toISOString(),
        daysSinceUpdate: Math.round(daysSinceUpdate),
      };
    } else if (daysSinceUpdate > 7) {
      return {
        status: "warning",
        message: `Data is ${Math.round(daysSinceUpdate)} days old (should be < 7 days)`,
        lastUpdate: lastUpdate.toISOString(),
        daysSinceUpdate: Math.round(daysSinceUpdate),
      };
    }

    return {
      status: "pass",
      message: `Data is ${Math.round(daysSinceUpdate)} days old`,
      lastUpdate: lastUpdate.toISOString(),
      daysSinceUpdate: Math.round(daysSinceUpdate),
    };
  } catch (error) {
    return {
      status: "fail",
      message: `Error checking freshness: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check data quality (validate entries, check for duplicates, etc.)
 */
async function checkDataQuality(format: "tcg" | "master_duel"): Promise<{
  status: "pass" | "fail" | "warning";
  message: string;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    // Get latest scrape run
    const { data: latestRun } = await supabase
      .from("tier_list_snapshots")
      .select("scrape_run_id, scraped_at")
      .eq("format", format)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    if (!latestRun) {
      return {
        status: "fail",
        message: "No data found",
        issues: ["No tier list snapshots found"],
      };
    }

    // Check for entries with invalid tiers
    const { data: invalidTiers } = await supabase
      .from("tier_list_snapshots")
      .select("deck_name, tier")
      .eq("format", format)
      .eq("scrape_run_id", latestRun.scrape_run_id)
      .or("tier.lt.1,tier.gt.4");

    if (invalidTiers && invalidTiers.length > 0) {
      issues.push(`Found ${invalidTiers.length} entries with invalid tier values`);
    }

    // Check for empty deck names
    const { data: emptyNames } = await supabase
      .from("tier_list_snapshots")
      .select("id")
      .eq("format", format)
      .eq("scrape_run_id", latestRun.scrape_run_id)
      .or("deck_name.is.null,deck_name.eq.");

    if (emptyNames && emptyNames.length > 0) {
      issues.push(`Found ${emptyNames.length} entries with empty deck names`);
    }

    // Check for very few decks (might indicate scraping issue)
    const { count } = await supabase
      .from("tier_list_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("format", format)
      .eq("scrape_run_id", latestRun.scrape_run_id);

    if (count !== null && count < 5) {
      issues.push(`Only ${count} decks found (expected at least 10-20)`);
    }

    if (issues.length === 0) {
      return {
        status: "pass",
        message: "Data quality checks passed",
        issues: [],
      };
    } else if (issues.length <= 2) {
      return {
        status: "warning",
        message: "Minor data quality issues detected",
        issues,
      };
    } else {
      return {
        status: "fail",
        message: "Multiple data quality issues detected",
        issues,
      };
    }
  } catch (error) {
    return {
      status: "fail",
      message: `Error checking data quality: ${error instanceof Error ? error.message : String(error)}`,
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Check coverage (both formats should have data)
 */
async function checkCoverage(): Promise<{
  status: "pass" | "fail" | "warning";
  message: string;
  tcgDecks?: number;
  masterDuelDecks?: number;
}> {
  try {
    // Get latest scrape for TCG
    const { data: tcgRun } = await supabase
      .from("tier_list_snapshots")
      .select("scrape_run_id")
      .eq("format", "tcg")
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    // Get latest scrape for Master Duel
    const { data: mdRun } = await supabase
      .from("tier_list_snapshots")
      .select("scrape_run_id")
      .eq("format", "master_duel")
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    let tcgDecks = 0;
    let masterDuelDecks = 0;

    if (tcgRun) {
      const { count } = await supabase
        .from("tier_list_snapshots")
        .select("*", { count: "exact", head: true })
        .eq("format", "tcg")
        .eq("scrape_run_id", tcgRun.scrape_run_id);
      tcgDecks = count || 0;
    }

    if (mdRun) {
      const { count } = await supabase
        .from("tier_list_snapshots")
        .select("*", { count: "exact", head: true })
        .eq("format", "master_duel")
        .eq("scrape_run_id", mdRun.scrape_run_id);
      masterDuelDecks = count || 0;
    }

    if (tcgDecks === 0 && masterDuelDecks === 0) {
      return {
        status: "fail",
        message: "No data for either format",
        tcgDecks: 0,
        masterDuelDecks: 0,
      };
    } else if (tcgDecks === 0 || masterDuelDecks === 0) {
      return {
        status: "warning",
        message: `Missing data for ${tcgDecks === 0 ? "TCG" : "Master Duel"}`,
        tcgDecks,
        masterDuelDecks,
      };
    }

    return {
      status: "pass",
      message: "Both formats have data",
      tcgDecks,
      masterDuelDecks,
    };
  } catch (error) {
    return {
      status: "fail",
      message: `Error checking coverage: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") as "tcg" | "master_duel" | null;

    // Check data freshness
    const freshnessTCG = await checkDataFreshness("tcg");
    const freshnessMD = await checkDataFreshness("master_duel");
    const dataFreshness = format === "tcg" ? freshnessTCG : format === "master_duel" ? freshnessMD : freshnessTCG;

    // Check data quality
    const qualityTCG = await checkDataQuality("tcg");
    const qualityMD = await checkDataQuality("master_duel");
    const dataQuality = format === "tcg" ? qualityTCG : format === "master_duel" ? qualityMD : qualityTCG;

    // Check coverage
    const coverage = await checkCoverage();

    // Determine overall status
    const statuses = [dataFreshness.status, dataQuality.status, coverage.status];
    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (statuses.includes("fail")) {
      overallStatus = "unhealthy";
    } else if (statuses.includes("warning")) {
      overallStatus = "degraded";
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      checks: {
        dataFreshness,
        dataQuality,
        coverage,
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      status: overallStatus === "unhealthy" ? 503 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error in meta-health function:", error);
    return new Response(
      JSON.stringify({
        status: "unhealthy",
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
