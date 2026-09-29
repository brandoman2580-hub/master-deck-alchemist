/**
 * YuGiOhMeta.com Tier List Scraper
 * 
 * Source: https://www.yugiohmeta.com
 * Target: Tier list page
 * 
 * Extracts: deck_name, tier only
 * Does NOT extract: decklists, card data, win rates, matchups
 */

import * as cheerio from "cheerio";

interface TierListEntry {
  deck_name: string;
  tier: number; // 1-4, normalized
  playstyle?: "combo" | "control" | "midrange" | "stun";
  notes?: string; // Only if trivially visible
}

interface ScrapeResult {
  entries: TierListEntry[];
  scrapeRunId: string;
  scrapedAt: Date;
  errors: string[];
}

const YUGIOHMETA_BASE = "https://www.yugiohmeta.com";
const USER_AGENT = "YuGiOhDeckBuilder/1.0 (Meta Scraper)";

/**
 * Normalize tier labels to integers (1-4)
 * Handles various label formats from source sites
 * Exported for use when HTML parsing is implemented
 */
export function normalizeTier(tierLabel: string): number {
  const normalized = tierLabel.toLowerCase().trim();
  
  // Tier 1 patterns
  if (normalized.includes("tier 1") || normalized.includes("tier1") || 
      normalized === "t1" || normalized.includes("s tier") ||
      normalized.includes("top tier")) {
    return 1;
  }
  
  // Tier 2 patterns
  if (normalized.includes("tier 2") || normalized.includes("tier2") || 
      normalized === "t2" || normalized.includes("high tier")) {
    return 2;
  }
  
  // Tier 3 patterns
  if (normalized.includes("tier 3") || normalized.includes("tier3") || 
      normalized === "t3" || normalized.includes("mid tier")) {
    return 3;
  }
  
  // Tier 4 / Rogue patterns
  if (normalized.includes("tier 4") || normalized.includes("tier4") || 
      normalized === "t4" || normalized.includes("rogue") ||
      normalized.includes("low tier")) {
    return 4;
  }
  
  // Default to 4 if unrecognized (fail-safe)
  console.warn(`⚠️ Unrecognized tier label: "${tierLabel}", defaulting to tier 4`);
  return 4;
}

/**
 * Scrape tier list from YuGiOhMeta.com
 * 
 * STOP CONDITIONS:
 * - If page requires JavaScript to render tier list → report and stop
 * - If HTML structure doesn't contain tier list → report and stop
 * - If authentication required → report and stop
 * 
 * This function will FAIL LOUDLY if site structure changes.
 */
export async function scrapeYuGiOhMeta(): Promise<ScrapeResult> {
  const errors: string[] = [];
  const entries: TierListEntry[] = [];
  const scrapedAt = new Date();
  const scrapeRunId = `yugiohmeta_tcg_${scrapedAt.toISOString().replace(/[:.]/g, '-')}`;
  
  try {
    console.log("🔍 Starting YuGiOhMeta tier list scrape...");
    
    // Step 1: Determine tier list URL
    // TODO: Navigate to site and identify exact tier list page URL
    // This may be: /tier-list, /tiers, /meta, etc.
    const tierListUrl = `${YUGIOHMETA_BASE}/tier-list`; // Placeholder - needs verification
    
    // Step 2: Fetch page
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
    
    // Step 3: Check if page requires JavaScript
    // If tier list data is not in initial HTML, it's likely JS-rendered
    if (!html.includes("tier") && !html.includes("Tier") && !html.includes("deck") && 
        !html.includes("img-button")) {
      const error = "Tier list appears to require JavaScript rendering. Cannot scrape without headless browser.";
      errors.push(error);
      throw new Error(error);
    }
    
    // Step 4: Parse HTML using cheerio
    const $ = cheerio.load(html);
    
    // Find all deck links: <a class="img-button"> with deck names
    // Deck name is in: <div class="label">Deck Name</div> or img alt attribute
    const deckLinks = $('a.img-button');
    
    if (deckLinks.length === 0) {
      const error = `Cannot find deck links in HTML. Site structure may have changed.
        Expected: <a class="img-button"> elements with deck names.
        Please inspect: ${tierListUrl}`;
      errors.push(error);
      throw new Error(error);
    }
    
    console.log(`   Found ${deckLinks.length} deck links`);
    
    // Extract deck names and determine tiers
    // TCG (YuGiOhMeta) uses tournament tops percentage, not explicit tiers
    // Strategy: Extract percentages from parent containers and infer tiers based on percentage ranges
    
    // Try to find percentage data for tier inference
    const deckData: Array<{ name: string; percentage: number }> = [];
    
    deckLinks.each((_index, element) => {
      const $link = $(element);
      
      // Extract deck name from label div or img alt
      let deckName = $link.find('.label').text().trim();
      if (!deckName) {
        deckName = $link.find('img').attr('alt') || '';
      }
      
      if (!deckName) {
        console.warn(`   ⚠️ Skipping deck link: no deck name found`);
        return;
      }
      
      // Try to extract percentage from parent container text
      // Pattern: "DeckName (count) percentage%" or just "percentage%"
      const $parent = $link.closest('div[class*="container"], div[class*="button"], section, article');
      let parentText = '';
      
      // Try multiple parent levels to find percentage
      let $current = $parent;
      for (let i = 0; i < 3 && $current.length > 0; i++) {
        parentText = $current.text();
        // Look for pattern like "(58) 22.48%" near the deck name
        const nameIndex = parentText.indexOf(deckName);
        if (nameIndex >= 0) {
          const afterName = parentText.substring(nameIndex, nameIndex + 50);
          // Match: (number) percentage%
          const percentageMatch = afterName.match(/\((\d+)\)\s*(\d+\.?\d*)%/);
          if (percentageMatch) {
            const percentage = parseFloat(percentageMatch[2]);
            deckData.push({ name: deckName, percentage });
            return; // Found, exit early
          }
        }
        $current = $current.parent();
      }
      
      // Fallback: look for any percentage in parent text
      const percentageMatch = parentText.match(/(\d+\.?\d*)%/);
      if (percentageMatch) {
        const percentage = parseFloat(percentageMatch[1]);
        deckData.push({ name: deckName, percentage });
      } else {
        // No percentage found, use 0 (will be assigned Tier 4)
        deckData.push({ name: deckName, percentage: 0 });
      }
    });
    
    // Sort by percentage descending
    deckData.sort((a, b) => b.percentage - a.percentage);
    
    // Assign tiers based on percentage ranges
    // Based on screenshot: Top 3 have > 10%, others have lower percentages
    // Tier 1: > 10% (top tier)
    // Tier 2: 5-10% (high tier)
    // Tier 3: 2-5% (mid tier)
    // Tier 4: < 2% (low tier / rogue)
    deckData.forEach((data) => {
      let tier = 4; // Default to tier 4
      
      if (data.percentage > 10) {
        tier = 1;
      } else if (data.percentage >= 5) {
        tier = 2;
      } else if (data.percentage >= 2) {
        tier = 3;
      } else if (data.percentage > 0) {
        tier = 4;
      } else {
        // No percentage found - use order-based assignment
        const index = deckData.indexOf(data);
        if (index < 3) {
          tier = 1; // Top 3 likely Tier 1
        } else if (index < 10) {
          tier = 2; // Next tier
        } else if (index < 20) {
          tier = 3;
        } else {
          tier = 4;
        }
      }
      
      entries.push({
        deck_name: data.name,
        tier,
      });
    });
    
    // If no entries found after parsing, report error
    if (entries.length === 0) {
      const error = `Parsed HTML but found no valid deck entries.
        Found ${deckLinks.length} deck links but couldn't extract deck names.
        Please inspect: ${tierListUrl}`;
      errors.push(error);
      throw new Error(error);
    }
    
    console.log(`   Extracted ${entries.length} deck entries`);
    
    console.log(`✅ Scraped ${entries.length} tier list entries from YuGiOhMeta`);
    
    return {
      entries,
      scrapeRunId,
      scrapedAt,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(errorMsg);
    console.error("❌ YuGiOhMeta scrape failed:", errorMsg);
    
    // Return partial results if any entries were found before error
    return {
      entries,
      scrapeRunId,
      scrapedAt,
      errors,
    };
  }
}

/**
 * Validate tier list entry before storage
 */
export function validateTierEntry(entry: TierListEntry): boolean {
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
    // Enforce max length
    return false;
  }
  return true;
}
