/**
 * Meta Update Edge Function
 * Handles scheduled and manual meta data updates
 */

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import * as cheerio from "cheerio";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface UpdateRequest {
  format?: "tcg" | "master_duel" | "both" | "TCG" | "MASTER_DUEL" | "BOTH";
  force?: boolean;
}

/**
 * Check if update is needed (last snapshot >7 days old)
 */
async function shouldUpdate(format: "TCG" | "MASTER_DUEL"): Promise<boolean> {
  const { data, error } = await supabase
    .from("meta_snapshots")
    .select("snapshot_date")
    .eq("format", format)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // No snapshots exist, should update
    return true;
  }

  const lastSnapshotDate = new Date(data.snapshot_date);
  const daysSinceUpdate = (Date.now() - lastSnapshotDate.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceUpdate > 7;
}

/**
 * Check if tier list update is needed (last snapshot >7 days old)
 */
async function shouldUpdateTierList(format: "tcg" | "master_duel"): Promise<boolean> {
  const { data, error } = await supabase
    .from("tier_list_snapshots")
    .select("scraped_at")
    .eq("format", format)
    .order("scraped_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // No snapshots exist, should update
    return true;
  }

  const lastSnapshotDate = new Date(data.scraped_at);
  const daysSinceUpdate = (Date.now() - lastSnapshotDate.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceUpdate > 7;
}

interface TierListEntry {
  deck_name: string;
  tier: number;
  playstyle?: "combo" | "control" | "midrange" | "stun";
  notes?: string;
}

interface ScrapeResult {
  entries: TierListEntry[];
  scrapeRunId: string;
  scrapedAt: Date;
  errors: string[];
}

const YUGIOHMETA_BASE = "https://www.yugiohmeta.com";
const MASTERDUELMETA_BASE = "https://www.masterduelmeta.com";
const TIER_LIST_URL_MD = `${MASTERDUELMETA_BASE}/tier-list#power-rankings`;
const USER_AGENT = "YuGiOhDeckBuilder/1.0 (Meta Scraper)";

/**
 * Validate tier list entry
 */
function validateTierEntry(entry: TierListEntry): boolean {
  if (!entry.deck_name || entry.deck_name.trim().length === 0) {
    return false;
  }
  if (entry.tier < 1 || entry.tier > 4) {
    return false;
  }
  if (entry.playstyle && !["combo", "control", "midrange", "stun"].includes(entry.playstyle)) {
    return false;
  }
  if (entry.notes && entry.notes.length > 500) {
    return false;
  }
  return true;
}

/**
 * Scrape YuGiOhMeta.com tier list
 */
async function scrapeYuGiOhMeta(): Promise<ScrapeResult> {
  const errors: string[] = [];
  const entries: TierListEntry[] = [];
  const scrapedAt = new Date();
  const scrapeRunId = `yugiohmeta_tcg_${scrapedAt.toISOString().replace(/[:.]/g, '-')}`;

  try {
    console.log("🔍 Starting YuGiOhMeta tier list scrape...");
    const tierListUrl = `${YUGIOHMETA_BASE}/tier-list`;
    
    const response = await fetch(tierListUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    
    if (!response.ok) {
      const error = `HTTP ${response.status}: ${response.statusText}`;
      errors.push(error);
      throw new Error(`Failed to fetch tier list: ${error}`);
    }
    
    const html = await response.text();
    
    if (!html.includes("tier") && !html.includes("Tier") && !html.includes("deck") && !html.includes("img-button")) {
      const error = "Tier list appears to require JavaScript rendering.";
      errors.push(error);
      throw new Error(error);
    }
    
    const $ = cheerio.load(html);
    const deckLinks = $('a.img-button');
    
    if (deckLinks.length === 0) {
      const error = `Cannot find deck links in HTML. Site structure may have changed.`;
      errors.push(error);
      throw new Error(error);
    }
    
    console.log(`   Found ${deckLinks.length} deck links`);
    
    const deckData: Array<{ name: string; percentage: number }> = [];
    
    deckLinks.each((_index, element) => {
      const $link = $(element);
      let deckName = $link.find('.label').text().trim();
      if (!deckName) {
        deckName = $link.find('img').attr('alt') || '';
      }
      
      if (!deckName) {
        return;
      }
      
      const $parent = $link.closest('div[class*="container"], div[class*="button"], section, article');
      let parentText = '';
      let $current = $parent;
      for (let i = 0; i < 3 && $current.length > 0; i++) {
        parentText = $current.text();
        const nameIndex = parentText.indexOf(deckName);
        if (nameIndex >= 0) {
          const afterName = parentText.substring(nameIndex, nameIndex + 50);
          const percentageMatch = afterName.match(/\((\d+)\)\s*(\d+\.?\d*)%/);
          if (percentageMatch) {
            const percentage = parseFloat(percentageMatch[2]);
            deckData.push({ name: deckName, percentage });
            return;
          }
        }
        $current = $current.parent();
      }
      
      const percentageMatch = parentText.match(/(\d+\.?\d*)%/);
      if (percentageMatch) {
        const percentage = parseFloat(percentageMatch[1]);
        deckData.push({ name: deckName, percentage });
      } else {
        deckData.push({ name: deckName, percentage: 0 });
      }
    });
    
    deckData.sort((a, b) => b.percentage - a.percentage);
    
    deckData.forEach((data) => {
      let tier = 4;
      if (data.percentage > 10) {
        tier = 1;
      } else if (data.percentage >= 5) {
        tier = 2;
      } else if (data.percentage >= 2) {
        tier = 3;
      } else {
        const index = deckData.indexOf(data);
        if (index < 3) {
          tier = 1;
        } else if (index < 10) {
          tier = 2;
        } else if (index < 20) {
          tier = 3;
        }
      }
      
      entries.push({ deck_name: data.name, tier });
    });
    
    if (entries.length === 0) {
      throw new Error(`Parsed HTML but found no valid deck entries.`);
    }
    
    console.log(`✅ Scraped ${entries.length} tier list entries from YuGiOhMeta`);
    
    return { entries, scrapeRunId, scrapedAt, errors };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(errorMsg);
    console.error("❌ YuGiOhMeta scrape failed:", errorMsg);
    return { entries, scrapeRunId, scrapedAt, errors };
  }
}

/**
 * Scrape MasterDuelMeta.com tier list
 */
async function scrapeMasterDuelMeta(): Promise<ScrapeResult> {
  const errors: string[] = [];
  const entries: TierListEntry[] = [];
  const scrapedAt = new Date();
  const scrapeRunId = `masterduelmeta_master_duel_${scrapedAt.toISOString().replace(/[:.]/g, '-')}`;

  try {
    console.log("🔍 Starting MasterDuelMeta tier list scrape...");
    
    const response = await fetch(TIER_LIST_URL_MD, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    
    if (!response.ok) {
      const error = `HTTP ${response.status}: ${response.statusText}`;
      errors.push(error);
      throw new Error(`Failed to fetch tier list: ${error}`);
    }
    
    const html = await response.text();
    
    if (!html.includes("tier") && !html.includes("Tier") && !html.includes("deck") && 
        !html.includes("power-rankings") && !html.includes("img-button")) {
      const error = "Tier list appears to require JavaScript rendering.";
      errors.push(error);
      throw new Error(error);
    }
    
    const $ = cheerio.load(html);
    const deckLinks = $('a.img-button');
    
    if (deckLinks.length === 0) {
      const error = `Cannot find deck links in HTML. Site structure may have changed.`;
      errors.push(error);
      throw new Error(error);
    }
    
    console.log(`   Found ${deckLinks.length} deck links`);
    
    const tierPositions: Array<{ tier: number; position: number }> = [];
    const tier1Regex = /TIER\s*1/gi;
    const tier2Regex = /TIER\s*2/gi;
    const tier3Regex = /TIER\s*3/gi;
    const trendingRegex = /TRENDING/gi;
    
    let match;
    while ((match = tier1Regex.exec(html)) !== null) {
      tierPositions.push({ tier: 1, position: match.index });
    }
    while ((match = tier2Regex.exec(html)) !== null) {
      tierPositions.push({ tier: 2, position: match.index });
    }
    while ((match = tier3Regex.exec(html)) !== null) {
      tierPositions.push({ tier: 3, position: match.index });
    }
    while ((match = trendingRegex.exec(html)) !== null) {
      tierPositions.push({ tier: 4, position: match.index });
    }
    
    tierPositions.sort((a, b) => a.position - b.position);
    const uniqueTierPositions = tierPositions.filter((pos, index, self) => {
      if (index === 0) return true;
      const prev = self[index - 1];
      return pos.tier !== prev.tier || (pos.position - prev.position) > 100;
    });
    
    console.log(`   Found ${uniqueTierPositions.length} tier labels in HTML`);
    
    deckLinks.each((_linkIndex, element) => {
      const $link = $(element);
      let deckName = $link.find('.label').text().trim();
      if (!deckName) {
        deckName = $link.find('img').attr('alt') || '';
      }
      
      if (!deckName) {
        return;
      }
      
      let linkPosition = -1;
      const linkHtml = $.html($link);
      if (linkHtml) {
        linkPosition = html.indexOf(linkHtml);
      }
      
      if (linkPosition < 0) {
        const nameInHtml = html.indexOf(deckName);
        if (nameInHtml >= 0) {
          const beforeName = html.substring(Math.max(0, nameInHtml - 500), nameInHtml);
          const lastAnchor = beforeName.lastIndexOf('<a');
          if (lastAnchor >= 0) {
            linkPosition = nameInHtml - 500 + lastAnchor;
          }
        }
      }
      
      let tier = 4;
      
      if (uniqueTierPositions.length > 0 && linkPosition >= 0) {
        for (let i = uniqueTierPositions.length - 1; i >= 0; i--) {
          if (uniqueTierPositions[i].position < linkPosition) {
            tier = uniqueTierPositions[i].tier;
            break;
          }
        }
      } else if (uniqueTierPositions.length > 0) {
        const deckIndex = entries.length;
        if (deckIndex < 3) {
          tier = 1;
        } else if (deckIndex < 6) {
          tier = 3;
        }
      }
      
      if (tier === 4) {
        const $closestSection = $link.closest('section, div[class*="tier"], div[id*="tier"]');
        if ($closestSection.length > 0) {
          const sectionText = $closestSection.text().toUpperCase();
          if (sectionText.includes('TIER 1')) {
            tier = 1;
          } else if (sectionText.includes('TIER 2')) {
            tier = 2;
          } else if (sectionText.includes('TIER 3')) {
            tier = 3;
          } else if (sectionText.includes('TRENDING')) {
            tier = 4;
          }
        }
      }
      
      entries.push({ deck_name: deckName, tier });
    });
    
    if (entries.length === 0) {
      throw new Error(`Parsed HTML but found no valid deck entries.`);
    }
    
    console.log(`✅ Scraped ${entries.length} tier list entries from MasterDuelMeta`);
    
    return { entries, scrapeRunId, scrapedAt, errors };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(errorMsg);
    console.error("❌ MasterDuelMeta scrape failed:", errorMsg);
    return { entries, scrapeRunId, scrapedAt, errors };
  }
}

/**
 * Store tier list snapshot in database
 */
async function storeTierSnapshot(
  entry: TierListEntry,
  format: "tcg" | "master_duel",
  source: "yugiohmeta" | "masterduelmeta",
  scrapeRunId: string,
  scrapedAt: Date
): Promise<boolean> {
  try {
    const { error } = await supabase.from("tier_list_snapshots").insert({
      deck_name: entry.deck_name.trim(),
      tier: entry.tier,
      format,
      source,
      scraped_at: scrapedAt.toISOString(),
      scrape_run_id: scrapeRunId,
      playstyle: entry.playstyle || null,
      notes: entry.notes ? entry.notes.substring(0, 500) : null,
    });

    if (error) {
      if (error.code === "23505") {
        console.log(`  ℹ️ Skipping duplicate: ${entry.deck_name} (tier ${entry.tier})`);
        return true;
      }
      throw error;
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Failed to store ${entry.deck_name}:`, error);
    return false;
  }
}

/**
 * Update tier list data for a specific format
 */
async function updateTierListData(
  format: "tcg" | "master_duel" | "both" = "both",
  force = false
): Promise<{
  success: boolean;
  summary: {
    entriesInserted: number;
    errors: string[];
    scrapeRunId?: string;
  };
}> {
  const summary: {
    entriesInserted: number;
    errors: string[];
    scrapeRunId?: string;
  } = {
    entriesInserted: 0,
    errors: [],
  };

  try {
    // Check if update is needed (unless forced)
    if (!force) {
      if (format === "tcg" || format === "both") {
        const shouldUpdateTCG = await shouldUpdateTierList("tcg");
        if (!shouldUpdateTCG) {
          return {
            success: true,
            summary: {
              entriesInserted: 0,
              errors: ["TCG tier list is up to date (<7 days old)"],
            },
          };
        }
      }

      if (format === "master_duel" || format === "both") {
        const shouldUpdateMD = await shouldUpdateTierList("master_duel");
        if (!shouldUpdateMD) {
          return {
            success: true,
            summary: {
              entriesInserted: 0,
              errors: ["Master Duel tier list is up to date (<7 days old)"],
            },
          };
        }
      }
    }

    console.log(`🔄 Starting tier list update for format: ${format}`);

    // Scrape TCG if requested
    if (format === "tcg" || format === "both") {
      try {
        console.log("📥 Scraping TCG tier list from YuGiOhMeta...");
        const tcgResult = await scrapeYuGiOhMeta();

        for (const entry of tcgResult.entries) {
          if (validateTierEntry(entry)) {
            const stored = await storeTierSnapshot(
              entry,
              "tcg",
              "yugiohmeta",
              tcgResult.scrapeRunId,
              tcgResult.scrapedAt
            );
            if (stored) {
              summary.entriesInserted++;
            }
          } else {
            summary.errors.push(`Invalid TCG entry: ${entry.deck_name}`);
          }
        }

        summary.errors.push(...tcgResult.errors);
        if (tcgResult.entries.length > 0) {
          summary.scrapeRunId = tcgResult.scrapeRunId;
        }

        console.log(`✅ TCG: ${tcgResult.entries.length} entries scraped, ${summary.entriesInserted} stored`);
      } catch (error) {
        const errorMsg = `TCG scraping failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        summary.errors.push(errorMsg);
      }
    }

    // Scrape Master Duel if requested
    if (format === "master_duel" || format === "both") {
      try {
        console.log("📥 Scraping Master Duel tier list from MasterDuelMeta...");
        const mdResult = await scrapeMasterDuelMeta();

        for (const entry of mdResult.entries) {
          if (validateTierEntry(entry)) {
            const stored = await storeTierSnapshot(
              entry,
              "master_duel",
              "masterduelmeta",
              mdResult.scrapeRunId,
              mdResult.scrapedAt
            );
            if (stored) {
              summary.entriesInserted++;
            }
          } else {
            summary.errors.push(`Invalid Master Duel entry: ${entry.deck_name}`);
          }
        }

        summary.errors.push(...mdResult.errors);
        if (mdResult.entries.length > 0 && !summary.scrapeRunId) {
          summary.scrapeRunId = mdResult.scrapeRunId;
        }

        console.log(`✅ Master Duel: ${mdResult.entries.length} entries scraped`);
      } catch (error) {
        const errorMsg = `Master Duel scraping failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        summary.errors.push(errorMsg);
      }
    }

    console.log(`✅ Tier list update complete: ${summary.entriesInserted} entries stored`);

    return {
      success: summary.errors.length === 0 || summary.entriesInserted > 0,
      summary,
    };
  } catch (error) {
    console.error("❌ Tier list update failed:", error);
    return {
      success: false,
      summary: {
        entriesInserted: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // No authentication required - function is configured with verify_jwt = false
    // This allows cron jobs and internal calls without requiring auth headers
    // The function uses service role key internally for database operations

    // Parse request body
    let requestData: UpdateRequest = {};
    if (req.method === "POST") {
      try {
        requestData = await req.json();
      } catch {
        // Body is optional
      }
    }

    const format = (requestData.format || "both").toLowerCase() as "tcg" | "master_duel" | "both";
    const force = requestData.force || false;

    console.log(`📥 Tier list update request: format=${format}, force=${force}`);

    // Perform update
    const result = await updateTierListData(format, force);

    return new Response(
      JSON.stringify({
        success: result.success,
        format,
        force,
        summary: result.summary,
        timestamp: new Date().toISOString(),
      }),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error in update-meta function:", error);
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
