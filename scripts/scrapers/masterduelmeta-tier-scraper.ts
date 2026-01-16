/**
 * MasterDuelMeta.com Tier List Scraper
 * 
 * Source: https://www.masterduelmeta.com/tier-list#power-rankings
 * Target: Power rankings tier list section
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

const MASTERDUELMETA_BASE = "https://www.masterduelmeta.com";
const TIER_LIST_URL = `${MASTERDUELMETA_BASE}/tier-list#power-rankings`;
const USER_AGENT = "YuGiOhDeckBuilder/1.0 (Meta Scraper)";

/**
 * Normalize tier labels to integers (1-4)
 * MasterDuelMeta typically uses explicit tier labels
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
  
  // Default to 4 if unrecognized
  console.warn(`⚠️ Unrecognized tier label: "${tierLabel}", defaulting to tier 4`);
  return 4;
}

/**
 * Scrape tier list from MasterDuelMeta.com
 * 
 * STOP CONDITIONS:
 * - If page requires JavaScript to render tier list → report and stop
 * - If HTML structure doesn't contain tier list → report and stop
 * - If authentication required → report and stop
 * 
 * This function will FAIL LOUDLY if site structure changes.
 */
export async function scrapeMasterDuelMetaTierList(): Promise<ScrapeResult> {
  const errors: string[] = [];
  const entries: TierListEntry[] = [];
  const scrapedAt = new Date();
  const scrapeRunId = `masterduelmeta_master_duel_${scrapedAt.toISOString().replace(/[:.]/g, '-')}`;
  
  try {
    console.log("🔍 Starting MasterDuelMeta tier list scrape...");
    
    // Step 1: Fetch tier list page
    const response = await fetch(TIER_LIST_URL, {
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
    
    // Step 2: Check if page requires JavaScript
    // MasterDuelMeta may use React/Vue - check if tier data is in initial HTML
    if (!html.includes("tier") && !html.includes("Tier") && !html.includes("deck") && 
        !html.includes("power-rankings") && !html.includes("img-button")) {
      const error = "Tier list appears to require JavaScript rendering. Cannot scrape without headless browser.";
      errors.push(error);
      throw new Error(error);
    }
    
    // Step 3: Parse HTML using cheerio
    const $ = cheerio.load(html);
    
    // Find all deck links: <a class="img-button"> with deck names
    // Deck name is in: <div class="label">Deck Name</div> or img alt attribute
    const deckLinks = $('a.img-button');
    
    if (deckLinks.length === 0) {
      const error = `Cannot find deck links in HTML. Site structure may have changed.
        Expected: <a class="img-button"> elements with deck names.
        Please inspect: ${TIER_LIST_URL}`;
      errors.push(error);
      throw new Error(error);
    }
    
    console.log(`   Found ${deckLinks.length} deck links`);
    
    // Extract deck names and determine tiers
    // Strategy: Search raw HTML for tier labels, find their positions, then assign decks based on HTML position
    
    // Find tier label positions in raw HTML
    const tierPositions: Array<{ tier: number; position: number }> = [];
    
    // Search for tier labels in HTML (case-insensitive)
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
    
    // Sort by position
    tierPositions.sort((a, b) => a.position - b.position);
    
    // Remove duplicates (same tier, close positions - within 100 chars)
    const uniqueTierPositions = tierPositions.filter((pos, index, self) => {
      if (index === 0) return true;
      const prev = self[index - 1];
      return pos.tier !== prev.tier || (pos.position - prev.position) > 100;
    });
    
    console.log(`   Found ${uniqueTierPositions.length} tier labels in HTML: ${uniqueTierPositions.map(p => `Tier ${p.tier}`).join(', ')}`);
    
    // Extract deck names and assign to tiers based on HTML position
    deckLinks.each((_linkIndex, element) => {
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
      
      // Find the link's position in the raw HTML
      // Try multiple methods to find the link's position
      let linkPosition = -1;
      
      // Method 1: Try to find the link's HTML representation
      const linkHtml = $.html($link);
      if (linkHtml) {
        linkPosition = html.indexOf(linkHtml);
      }
      
      // Method 2: If not found, try finding by deck name
      if (linkPosition < 0) {
        const nameInHtml = html.indexOf(deckName);
        if (nameInHtml >= 0) {
          // Find the nearest <a> tag before the name
          const beforeName = html.substring(Math.max(0, nameInHtml - 500), nameInHtml);
          const lastAnchor = beforeName.lastIndexOf('<a');
          if (lastAnchor >= 0) {
            linkPosition = nameInHtml - 500 + lastAnchor;
          }
        }
      }
      
      // Determine tier by finding the most recent tier label before this link
      let tier = 4; // Default to tier 4 (TRENDING/rogue)
      
      if (uniqueTierPositions.length > 0 && linkPosition >= 0) {
        // Find the last tier position that comes before this link
        for (let i = uniqueTierPositions.length - 1; i >= 0; i--) {
          if (uniqueTierPositions[i].position < linkPosition) {
            tier = uniqueTierPositions[i].tier;
            break;
          }
        }
      } else if (uniqueTierPositions.length > 0) {
        // If we couldn't find link position, use order-based assignment
        // First few decks after Tier 1 = Tier 1, etc.
        // This is a fallback and may not be accurate
        const deckIndex = entries.length;
        if (deckIndex < 3) {
          tier = 1; // First 3 decks likely Tier 1
        } else if (deckIndex < 6) {
          tier = 3; // Next few likely Tier 3
        }
      }
      
      // Fallback: Check parent containers for tier indicators
      if (tier === 4) {
        const $closestSection = $link.closest('section, div[class*="tier"], div[id*="tier"], div[class*="section"]');
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
      
      entries.push({
        deck_name: deckName,
        tier,
      });
    });
    
    // If no entries found after parsing, report error
    if (entries.length === 0) {
      const error = `Parsed HTML but found no valid deck entries.
        Found ${deckLinks.length} deck links but couldn't extract deck names.
        Please inspect: ${TIER_LIST_URL}`;
      errors.push(error);
      throw new Error(error);
    }
    
    console.log(`   Extracted ${entries.length} deck entries`);
    
    console.log(`✅ Scraped ${entries.length} tier list entries from MasterDuelMeta`);
    
    return {
      entries,
      scrapeRunId,
      scrapedAt,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(errorMsg);
    console.error("❌ MasterDuelMeta scrape failed:", errorMsg);
    
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
    return false;
  }
  return true;
}
