// Refactored recommendation agent with hybrid prompts, feedback integration, and observability
// Rationale: Implements hybrid prompt system (freeform analysis + templated output), adds recommendation_id for feedback tracking, and logs all requests

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import {
  analyzeQuestionForFilters,
  buildDeckContextText,
  getQueryEmbedding,
  hybridSearch,
  type CardCandidate,
} from "../_shared/cardSearch.ts";
import { mmrSelect, type MMRCandidate } from "../_shared/mmr.ts";
import { toTOON } from "../_shared/toon.ts";
import {
  GRANDMASTER_SYSTEM_PROMPT,
  buildHybridUserPrompt,
  classifyIntent,
} from "../_shared/prompts.ts";

type Card = {
  id: number;
  name: string;
  type: string;
  desc: string;
  level?: number;
  race?: string;
  attribute?: string;
  archetype?: string | null;
  atk?: number | string;
  def?: number | string;
  card_images?: Array<{
    id: number;
    image_url: string;
    image_url_small: string;
  }>;
};

interface MasterDuelBanlistEntry {
  card_name: string;
  ban_status: string;
}

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const MODEL_NAME = Deno.env.get("MODEL_NAME") || "llama-3.3-70b-versatile";

// Configuration constants
const MAX_CANDIDATES_TO_LLM = 30; // Maximum cards to send to LLM (target < 1500 tokens)
const MMR_LAMBDA = 0.65; // MMR balance: 0.65 = 65% relevance, 35% diversity
const VECTOR_WEIGHT = 0.7; // Hybrid search: 70% vector, 30% FTS
const FTS_WEIGHT = 0.3;


// Helper: safely extract archetype as string
function getArchetypeNameServer(card: { archetype?: any }): string {
  const raw = card?.archetype;
  if (!raw) return "";
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "[object Object]") return "";
    return trimmed;
  }
  if (typeof raw === "object" && typeof raw.name === "string") {
    const name = raw.name.trim();
    if (name === "[object Object]") return "";
    return name;
  }
  return "";
}

// Helper: sanitize AI text and replace "this card" with actual card names
function sanitizeAiCardText(
  content: string, 
  allowedCardNames: string[], 
  candidateCards: CardCandidate[] = [],
  allCardNames: string[] = []
): string {
  let cleaned = content.replace(/\[object Object\]/g, "this archetype");
  
  // First, replace "this card" / "that card" / "the card" with actual candidate card names
  // Strategy: Find the most recently mentioned candidate card name before each "this card"
  const thisCardRegex = /\b(this|that|the)\s+card\b/gi;
  const candidateNames = candidateCards.map(c => c.name);
  
  // Create a regex that matches any candidate card name (case-insensitive)
  const candidateNamesPattern = candidateNames
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const candidateNameRegex = new RegExp(`\\b(${candidateNamesPattern})\\b`, 'gi');
  
  cleaned = cleaned.replace(thisCardRegex, (match, _pronoun, offset) => {
    // Find the text before this match (look back up to 300 chars)
    const beforeText = cleaned.substring(Math.max(0, offset - 300), offset);
    
    // Extract all candidate card names mentioned before this "this card"
    const mentionedCandidates: string[] = [];
    let cardMatch;
    const searchText = beforeText;
    
    // Reset regex lastIndex to search from start
    candidateNameRegex.lastIndex = 0;
    while ((cardMatch = candidateNameRegex.exec(searchText)) !== null) {
      const matchedName = cardMatch[1];
      // Find the original casing from candidateCards
      const originalName = candidateNames.find(
        n => n.toLowerCase() === matchedName.toLowerCase()
      );
      if (originalName && !mentionedCandidates.includes(originalName)) {
        mentionedCandidates.push(originalName);
      }
    }
    
    // Use the most recently mentioned candidate card
    if (mentionedCandidates.length > 0) {
      return `**${mentionedCandidates[mentionedCandidates.length - 1]}**`;
    } else if (candidateCards.length > 0) {
      // Use first candidate card as fallback
      return `**${candidateCards[0].name}**`;
    }
    
    return match; // Keep original if no replacement found
  });
  
  // Now validate and fix any card names that might be incorrect
  if (!allowedCardNames || allowedCardNames.length === 0) {
    return cleaned;
  }
  
  // Create comprehensive set of valid card names (allowed + all from database)
  const allValidCardNames = new Set<string>();
  allowedCardNames.forEach(name => allValidCardNames.add(name.toLowerCase()));
  allCardNames.forEach(name => allValidCardNames.add(name.toLowerCase()));
  
  // Create a map for exact matching (preserve original casing)
  const cardNameMap = new Map<string, string>();
  allowedCardNames.forEach(name => {
    cardNameMap.set(name.toLowerCase(), name);
  });
  
  // Validate card names in the text
  const cardLikeRegex = /\b([A-Z][A-Za-z0-9'&-]+(?:\s+[A-Z][A-Za-z0-9'&-]+)+)\b/g;
  cleaned = cleaned.replace(cardLikeRegex, (match) => {
    const trimmed = match.trim();
    const normalized = trimmed.toLowerCase();
    
    // Check if it's a valid card name (exact match)
    if (allValidCardNames.has(normalized)) {
      return cardNameMap.get(normalized) || trimmed;
    }
    
    // Check for fuzzy matches (handles punctuation/spacing variations)
    for (const validName of allValidCardNames) {
      const validNormalized = validName.toLowerCase();
      const matchNoSpecial = normalized.replace(/['&-]/g, "");
      const validNoSpecial = validNormalized.replace(/['&-]/g, "");
      if (matchNoSpecial === validNoSpecial && matchNoSpecial.length > 0) {
        return cardNameMap.get(validNormalized) || trimmed;
      }
    }
    
    // Check common game terms - don't replace these
    const commonTerms = [
      "deck", "card", "hand", "field", "graveyard", "banish", "summon", "tribute",
      "monster", "spell", "trap", "extra deck", "main deck", "side deck",
      "going first", "going second", "turn", "phase", "battle", "damage", "life points",
      "opponent", "player", "duel", "game"
    ];
    if (commonTerms.some(term => normalized.includes(term) || term.includes(normalized))) {
      return trimmed;
    }
    
    // Be conservative - preserve card names even if not validated
    return trimmed;
  });
  
  return cleaned;
}

// Clean up and format response text for better readability
function formatResponseText(text: string): string {
  let formatted = text;
  
  // Remove excessive markdown formatting (e.g., ****text**** -> **text**)
  // Pattern: 4+ asterisks should be reduced to 2
  formatted = formatted.replace(/\*{4,}([^*]+?)\*{4,}/g, '**$1**');
  formatted = formatted.replace(/\*{3,}([^*]+?)\*{3,}/g, '**$1**');
  
  // Fix multiple consecutive numbers (e.g., "1. 6. Card" -> "1. Card")
  formatted = formatted.replace(/(\d+)\.\s+(\d+)\.\s+/g, '$1. ');
  
  // Fix out-of-order numbering: find all numbered list items and renumber them sequentially
  // Pattern: number followed by period and space, typically before bold text or card names
  const numberPattern = /\b(\d+)\.\s+(?=\*\*[^*]+\*\*|[A-Z])/g;
  
  // Find all numbered items and their positions
  const matches: Array<{ number: number; index: number; length: number }> = [];
  let match;
  const textCopy = formatted; // Work with copy to avoid index issues
  while ((match = numberPattern.exec(textCopy)) !== null) {
    matches.push({
      number: parseInt(match[1], 10),
      index: match.index,
      length: match[0].length,
    });
  }
  
  // If we have multiple numbered items, fix them to be sequential
  if (matches.length > 1) {
    // Work backwards to avoid index shifting
    for (let i = matches.length - 1; i >= 0; i--) {
      const matchInfo = matches[i];
      const correctNumber = i + 1;
      
      if (matchInfo.number !== correctNumber) {
        // Replace the number at this specific position
        const before = formatted.substring(0, matchInfo.index);
        const numberStr = matchInfo.number.toString();
        const after = formatted.substring(matchInfo.index + numberStr.length + 2); // +2 for ". "
        formatted = before + correctNumber + ". " + after;
      }
    }
  }
  
  // Clean up excessive backticks and formatting
  // Remove backticks around single words (e.g., `add` -> add, but keep code blocks)
  formatted = formatted.replace(/`([a-zA-Z]+)`/g, '$1');
  
  // Clean up spacing and formatting
  // Remove multiple spaces
  formatted = formatted.replace(/\s{2,}/g, ' ');
  
  // Ensure proper spacing after periods (but preserve numbered lists)
  formatted = formatted.replace(/\.([A-Z])/g, '. $1');
  
  // Fix spacing around bold text
  formatted = formatted.replace(/\s+\*\*/g, ' **');
  formatted = formatted.replace(/\*\*\s+/g, '** ');
  
  // Remove duplicate bold markers (e.g., **text** **text** -> **text**)
  formatted = formatted.replace(/\*\*([^*]+?)\*\*\s+\*\*([^*]+?)\*\*/g, (match, p1, p2) => {
    // If they're the same, keep one
    if (p1.trim() === p2.trim()) {
      return `**${p1}**`;
    }
    return match;
  });
  
  // Ensure proper paragraph breaks
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // Clean up any remaining formatting issues
  formatted = formatted.trim();
  
  return formatted;
}

// Clean up card names in JSON response (remove excessive formatting)
function cleanCardName(name: string): string {
  if (!name) return name;
  
  let cleaned = name;
  
  // Remove excessive asterisks (keep only double asterisks for bold)
  cleaned = cleaned.replace(/\*{4,}([^*]+?)\*{4,}/g, '**$1**');
  cleaned = cleaned.replace(/\*{3,}([^*]+?)\*{3,}/g, '**$1**');
  
  // Remove backticks
  cleaned = cleaned.replace(/`/g, '');
  
  // Clean up spacing
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  
  return cleaned;
}

// Load Master Duel banlist from Supabase
async function loadMasterDuelBanlist(supabaseClient: any): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabaseClient
      .from("master_duel_banlist")
      .select("card_name, ban_status");

    if (error) {
      console.error("Error loading Master Duel banlist:", error);
      return {};
    }

    if (!data || data.length === 0) {
      return {};
    }

    const banlist: Record<string, string> = {};
    for (const entry of data as MasterDuelBanlistEntry[]) {
      if (entry.card_name && entry.ban_status) {
        banlist[entry.card_name] = entry.ban_status;
      }
    }
    return banlist;
  } catch (err) {
    console.error("Error loading Master Duel banlist:", err);
    return {};
  }
}

// Analyze user's deck history to build profile
async function analyzeUserProfile(
  supabaseClient: any,
  userId: string,
  format: "MASTER_DUEL" | "TCG"
): Promise<{
  preferredArchetypes: string[];
  playstylePattern: "control" | "aggro" | "combo" | "midrange" | "stun" | "mixed";
  skillLevel: "beginner" | "intermediate" | "advanced";
  frequentlyUsedCards: string[];
  averageDeckComplexity: number;
  deckCount: number;
}> {
  try {
    const { data: decks, error } = await supabaseClient
      .from("decks")
      .select("cards, mode, name")
      .eq("user_id", userId)
      .eq("mode", format === "MASTER_DUEL" ? "Master Duel" : "TCG")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error || !decks || decks.length === 0) {
      return {
        preferredArchetypes: [],
        playstylePattern: "mixed",
        skillLevel: "beginner",
        frequentlyUsedCards: [],
        averageDeckComplexity: 50,
        deckCount: 0,
      };
    }

    const archetypeCounts = new Map<string, number>();
    const cardCounts = new Map<string, number>();
    let totalComplexity = 0;

    for (const deck of decks) {
      const allCards = [
        ...(deck.cards?.main || []),
        ...(deck.cards?.extra || []),
        ...(deck.cards?.side || []),
      ];

      // Count archetypes
      allCards.forEach((card: Card) => {
        const arch = getArchetypeNameServer(card);
        if (arch) {
          archetypeCounts.set(arch, (archetypeCounts.get(arch) || 0) + 1);
        }
        // Count cards
        if (card.name) {
          cardCounts.set(card.name, (cardCounts.get(card.name) || 0) + 1);
        }
      });

      // Estimate complexity
      const complexity = Math.min(100, (allCards.length / 60) * 100);
      totalComplexity += complexity;
    }

    const preferredArchetypes = Array.from(archetypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([arch]) => arch);

    const frequentlyUsedCards = Array.from(cardCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    const averageDeckComplexity = decks.length > 0 ? totalComplexity / decks.length : 50;
    
    let skillLevel: "beginner" | "intermediate" | "advanced" = "beginner";
    if (averageDeckComplexity > 70) {
      skillLevel = "advanced";
    } else if (averageDeckComplexity > 40) {
      skillLevel = "intermediate";
    }

    return {
      preferredArchetypes,
      playstylePattern: "mixed",
      skillLevel,
      frequentlyUsedCards,
      averageDeckComplexity,
      deckCount: decks.length,
    };
  } catch (err) {
    console.error("Error analyzing user profile:", err);
    return {
      preferredArchetypes: [],
      playstylePattern: "mixed",
      skillLevel: "beginner",
      frequentlyUsedCards: [],
      averageDeckComplexity: 50,
      deckCount: 0,
    };
  }
}

// Find cards by archetype (case-insensitive, supports partial matches)
async function findCardsByArchetype(
  supabaseClient: any,
  archetype: string,
  excludeIds: number[] = []
): Promise<Card[]> {
  if (!archetype) return [];

  // Try exact match first, then case-insensitive match
  // Use case-insensitive search to catch "Toy" regardless of case
  let query = supabaseClient
    .from("cards")
    .select("id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg")
    .ilike("archetype", archetype); // Case-insensitive exact match
  
  // Apply exclusion filter if needed
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }
  
  let { data, error } = await query.limit(50);

  // If no exact match, try partial match
  if ((!data || data.length === 0) && !error) {
    let partialQuery = supabaseClient
      .from("cards")
      .select("id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg")
      .ilike("archetype", `%${archetype}%`);
    
    if (excludeIds.length > 0) {
      partialQuery = partialQuery.not("id", "in", `(${excludeIds.join(",")})`);
    }
    
    const { data: partialData, error: partialError } = await partialQuery.limit(50);
    
    if (!partialError && partialData && partialData.length > 0) {
      data = partialData;
      error = null;
    } else if (partialError) {
      error = partialError;
    }
  }

  // If still no results, try archetype_normalized column if it exists
  if ((!data || data.length === 0) && !error) {
    try {
      let normalizedQuery = supabaseClient
        .from("cards")
        .select("id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg")
        .ilike("archetype_normalized", `%${archetype.toLowerCase()}%`);
      
      if (excludeIds.length > 0) {
        normalizedQuery = normalizedQuery.not("id", "in", `(${excludeIds.join(",")})`);
      }
      
      const { data: normalizedData, error: normalizedError } = await normalizedQuery.limit(50);
      
      if (!normalizedError && normalizedData && normalizedData.length > 0) {
        data = normalizedData;
        error = null;
        console.log(`  Found ${normalizedData.length} cards using archetype_normalized column`);
      }
    } catch (_err) {
      // archetype_normalized might not exist, ignore error
      console.log("  Note: archetype_normalized column not available");
    }
  }

  if (error) {
    console.error("Error finding cards by archetype:", error);
    return [];
  }

  const results = (data || []).map((card: Card) => ({
    ...card,
    archetype: getArchetypeNameServer(card),
  }));
  
  console.log(`  Found ${results.length} cards for archetype "${archetype}"`);
  if (results.length > 0) {
    console.log(`  Sample: ${results.slice(0, 3).map((c: Card) => c.name).join(", ")}`);
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check authentication
    const authHeader = req.headers.get("Authorization");
    console.log("🔐 Auth check:", {
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader?.length || 0,
      authHeaderPrefix: authHeader?.substring(0, 20) || "none",
    });
    
    if (!authHeader) {
      console.error("❌ No Authorization header provided");
      return new Response(
        JSON.stringify({ 
          error: "Authentication required.",
          details: "No Authorization header found in request. Please ensure you are logged in.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token.length === 0) {
      console.error("❌ Empty token after Bearer prefix removal");
      return new Response(
        JSON.stringify({ 
          error: "Invalid authentication token.",
          details: "Token is empty or malformed.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Basic JWT structure validation (should have 3 parts separated by dots)
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      console.error("❌ Token doesn't appear to be a valid JWT (expected 3 parts, got", tokenParts.length, ")");
      console.error("   Token preview:", token.substring(0, 50), "...");
      return new Response(
        JSON.stringify({ 
          error: "Invalid token format.",
          details: "Token does not appear to be a valid JWT. Please ensure you are using an access token, not an API key.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Try to decode the payload to check for 'sub' claim (without verification)
    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log("🔍 Token payload preview:", {
        hasSub: !!payload.sub,
        sub: payload.sub,
        exp: payload.exp,
        iat: payload.iat,
        aud: payload.aud,
      });
      
      if (!payload.sub) {
        console.error("❌ Token missing 'sub' claim in payload");
        return new Response(
          JSON.stringify({ 
            error: "Invalid token: missing user identifier.",
            details: "The provided token does not contain a user identifier (sub claim). This might be an API key instead of an access token. Please ensure you are logged in and using a valid access token.",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (decodeErr) {
      console.error("❌ Failed to decode token payload:", decodeErr);
      // Continue anyway - let Supabase handle validation
    }

    console.log("🔍 Validating token with Supabase (length:", token.length, ")");
    let user;
    try {
      // Create a client with anon key for user token validation
      // The service role key can validate user tokens, but let's be explicit
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser(token);
      
      if (authError) {
        console.error("❌ Auth error:", authError.message, "Status:", authError.status);
        console.error("   Error details:", JSON.stringify(authError));
        return new Response(
          JSON.stringify({ 
            error: "Authentication failed.",
            details: authError.message || "Invalid or expired token. Please try logging in again.",
            error_code: authError.status,
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      user = authUser;
      if (!user) {
        console.error("❌ No user returned from auth.getUser()");
        return new Response(
          JSON.stringify({ 
            error: "User not authenticated.",
            details: "Token validation succeeded but no user found.",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      console.log("✅ User authenticated:", user.id);
    } catch (err) {
      console.error("❌ Exception during auth validation:", err);
      return new Response(
        JSON.stringify({ 
          error: "Authentication validation failed.",
          details: err instanceof Error ? err.message : "Unknown error",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate recommendation_id for tracking and feedback
    const recommendationId = crypto.randomUUID();
    const startTime = Date.now();

    const {
      question,
      current_deck,
      format = "MASTER_DUEL",
      recommendation_type = "personalized", // personalized, archetype, engine, tech, simple
      use_hybrid_search = true, // Enable hybrid RAG by default
    } = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({ error: "question is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Load banlist
    const banlist = format === "MASTER_DUEL"
      ? await loadMasterDuelBanlist(supabase)
      : {};

    const banlistText = Object.entries(banlist)
      .filter(([, status]) => status === "Forbidden" || status === "Limited")
      .slice(0, 30)
      .map(([name, status]) => `${name}: ${status}`)
      .join("\n");

    // Get user profile for personalized recommendations
    let userProfile: any = null;
    if (recommendation_type === "personalized") {
      userProfile = await analyzeUserProfile(supabase, user.id, format);
    }

    // Get current deck cards if provided
    const allDeckCards = current_deck
      ? [...(current_deck.mainDeck || []), ...(current_deck.extraDeck || []), ...(current_deck.sideDeck || [])]
      : [];
    const excludeIds = allDeckCards.map((c: Card) => c.id);

    // Extract archetypes from deck for exclusion
    const deckArchetypes = new Set<string>();
    allDeckCards.forEach((card: Card) => {
      const arch = getArchetypeNameServer(card);
      if (arch) deckArchetypes.add(arch);
    });
    const excludeArchetypes = Array.from(deckArchetypes);

    // Analyze question for structured filters (auto-detect)
    const questionFilters = analyzeQuestionForFilters(question);
    console.log("🔍 Question analysis:", {
      question,
      filters: questionFilters,
      detectedArchetypes: questionFilters.archetypes,
    });
    
    // Build deck context text for embedding
    const deckContextText = buildDeckContextText(current_deck || {});
    
    // Build query text: question + deck context
    const queryText = `${question}. ${deckContextText}`;

    // Get card candidates using hybrid search
    let candidateCards: CardCandidate[] = [];
    
    // If archetype detected, try direct archetype search first (more reliable)
    if (questionFilters.archetypes && questionFilters.archetypes.length > 0) {
      console.log(`🎯 Archetype detected, searching directly for: ${questionFilters.archetypes.join(", ")}`);
      for (const arch of questionFilters.archetypes) {
        try {
          const archCards = await findCardsByArchetype(supabase, arch, excludeIds);
          console.log(`  Found ${archCards.length} cards for archetype "${arch}"`);
          candidateCards.push(...archCards.map((c) => ({
            id: c.id,
            name: c.name,
            archetype: c.archetype,
            type: c.type,
            desc: c.desc,
          })));
        } catch (err) {
          console.warn(`  Error searching for archetype "${arch}":`, err);
        }
      }
      // Deduplicate by ID
      const seenIds = new Set<number>();
      candidateCards = candidateCards.filter(c => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
      });
      console.log(`📊 After archetype search: ${candidateCards.length} unique candidates`);
    }
    
    if (use_hybrid_search) {
      try {
        // Generate embedding for query
        const queryEmbedding = await getQueryEmbedding(queryText);
        console.log("✅ Generated query embedding");
        
        // Perform hybrid search (combine with archetype results if any)
        const hybridResults = await hybridSearch(
          {
            queryEmbedding,
            queryText: question, // Use just the question for FTS
            excludeArchetypes,
            excludeIds,
            excludeTypes: questionFilters.excludeTypes,
            excludeRaces: questionFilters.excludeRaces,
            banlistFormat: format,
            vectorWeight: VECTOR_WEIGHT,
            ftsWeight: FTS_WEIGHT,
            matchCount: 200, // Get 200 candidates for MMR reranking
          },
          supabase
        );
        console.log(`🔎 Hybrid search found ${hybridResults.length} candidates`);
        
        // Merge with archetype results (deduplicate)
        const existingIds = new Set(candidateCards.map(c => c.id));
        for (const result of hybridResults) {
          if (!existingIds.has(result.id)) {
            candidateCards.push(result);
            existingIds.add(result.id);
          }
        }
        console.log(`📊 Total candidates after hybrid search: ${candidateCards.length}`);
      } catch (err) {
        console.error("❌ Hybrid search failed, falling back to simple search:", err);
        // Fallback: use simple archetype matching (existing logic)
        if (recommendation_type === "archetype") {
          const archetypeMatch = question.match(/(?:for|in|with)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i);
          if (archetypeMatch) {
            const archetypeName = archetypeMatch[1].trim();
            const relatedCards = await findCardsByArchetype(supabase, archetypeName, excludeIds);
            candidateCards = relatedCards.map((c) => ({
              id: c.id,
              name: c.name,
              archetype: c.archetype,
              type: c.type,
              desc: c.desc,
            }));
          }
        }
      }
    } else {
      // Legacy: simple archetype matching
      if (recommendation_type === "archetype") {
        const archetypeMatch = question.match(/(?:for|in|with)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i);
        if (archetypeMatch) {
          const archetypeName = archetypeMatch[1].trim();
          const relatedCards = await findCardsByArchetype(supabase, archetypeName, excludeIds);
          candidateCards = relatedCards.map((c) => ({
            id: c.id,
            name: c.name,
            archetype: c.archetype,
            type: c.type,
            desc: c.desc,
          }));
        }
      }
    }

    // Check if we have any candidates
    if (candidateCards.length === 0) {
      console.warn("⚠️ No candidates found! Attempting fallback search with reduced restrictions...");
      
      // Last resort: Try a very permissive search for generic terms like "engines", "tech cards", etc.
      const genericTerms = ["engine", "tech", "staple", "support", "combo", "extender", "searcher"];
      const lowerQuestion = question.toLowerCase();
      const hasGenericTerm = genericTerms.some(term => lowerQuestion.includes(term));
      
      if (hasGenericTerm && use_hybrid_search) {
        console.log("🔄 Attempting permissive fallback search for generic term...");
        try {
          // Build a more generic query
          const fallbackQuery = lowerQuestion.includes("engine") 
            ? "cards that support deck strategy and enable combos"
            : lowerQuestion.includes("tech")
            ? "versatile cards that work in many decks"
            : "useful cards for deck building";
          
          const fallbackEmbedding = await getQueryEmbedding(`${fallbackQuery}. ${deckContextText}`);
          
          // Try with minimal exclusions (only exclude deck cards, not archetypes)
          const fallbackResults = await hybridSearch(
            {
              queryEmbedding: fallbackEmbedding,
              queryText: fallbackQuery,
              excludeArchetypes: [], // Don't exclude archetypes for generic searches
              excludeIds: excludeIds.slice(0, 20), // Only exclude first 20 deck cards
              excludeTypes: [],
              excludeRaces: [],
              banlistFormat: format,
              vectorWeight: VECTOR_WEIGHT,
              ftsWeight: FTS_WEIGHT,
              matchCount: 100, // Get fewer candidates
            },
            supabase
          );
          
          if (fallbackResults.length > 0) {
            console.log(`✅ Fallback search found ${fallbackResults.length} candidates`);
            candidateCards = fallbackResults;
          }
        } catch (err) {
          console.error("❌ Fallback search also failed:", err);
        }
      }
      
      // If still no candidates, return helpful error
      if (candidateCards.length === 0) {
        console.warn("⚠️ No candidates found after all attempts! Diagnostic info:", {
          question,
          questionFilters,
          excludeIds: excludeIds.length,
          excludeArchetypes,
          use_hybrid_search,
        });
        
        return new Response(
          JSON.stringify({
            answer: `I couldn't find any candidate cards matching "${question}". 

This might be because:
- The search terms don't match any cards in the database
- All matching cards are already in your deck (${excludeIds.length} cards excluded)
- The RPC search functions may not be available or configured correctly

Try rephrasing your question or being more specific. For example:
- "What Toy archetype cards work with this deck?"
- "Recommend Spell cards for this strategy"
- "What tech cards counter [specific archetype]?"`,
            validated_cards: [],
            diagnostic: {
              question,
              filters: questionFilters,
              candidates_found: 0,
              exclude_ids_count: excludeIds.length,
              exclude_archetypes: excludeArchetypes,
            },
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
    }

    // Apply MMR reranking (enabled by default, skip for "simple" type)
    // IMPORTANT: If archetype was detected, prioritize archetype matches
    let finalCandidates: CardCandidate[] = candidateCards;
    
    // Check if we have archetype matches that should be prioritized
    const detectedArchetypes = questionFilters.archetypes || [];
    const archetypeMatches = detectedArchetypes.length > 0
      ? candidateCards.filter(c => 
          detectedArchetypes.some(arch => 
            c.archetype?.toLowerCase().includes(arch.toLowerCase()) ||
            arch.toLowerCase().includes(c.archetype?.toLowerCase() || "")
          )
        )
      : [];
    
    console.log(`🎯 Found ${archetypeMatches.length} archetype matches out of ${candidateCards.length} total candidates`);
    if (archetypeMatches.length > 0) {
      console.log(`   Archetype match names: ${archetypeMatches.map(c => c.name).join(", ")}`);
    }
    
    if (use_hybrid_search && recommendation_type !== "simple" && candidateCards.length > 0) {
      try {
        // Fetch embeddings for MMR
        const candidateIds = candidateCards.map((c) => c.id);
        const { data: embRows } = await supabase
          .from("cards")
          .select("id, effect_embedding")
          .in("id", candidateIds);

        const embMap = new Map<number, number[]>();
        for (const e of embRows || []) {
          if (e.effect_embedding && Array.isArray(e.effect_embedding)) {
            embMap.set(e.id, e.effect_embedding);
          }
        }

        // Generate query embedding if not already done
        const queryEmbedding = await getQueryEmbedding(queryText);

        // Prepare MMR candidates
        // Boost scores for archetype matches to ensure they're included
        const archetypeMatchIds = new Set(archetypeMatches.map(c => c.id));
        const mmrCandidates: MMRCandidate[] = candidateCards.map((c) => {
          const baseSim = c.hybrid_score ?? c.vector_sim ?? 0;
          // Boost archetype matches significantly to ensure they're selected
          const boostedSim = archetypeMatchIds.has(c.id) ? baseSim + 0.5 : baseSim;
          return {
            id: c.id,
            embedding: embMap.get(c.id) ?? null,
            sim: boostedSim,
            row: c,
          };
        });

        // Apply MMR reranking
        const mmrSelected = mmrSelect(mmrCandidates, queryEmbedding, MAX_CANDIDATES_TO_LLM, MMR_LAMBDA);
        finalCandidates = mmrSelected.map((s) => s.row);
        
        // Ensure archetype matches are included (add any missing ones)
        const finalIds = new Set(finalCandidates.map(c => c.id));
        for (const archMatch of archetypeMatches) {
          if (!finalIds.has(archMatch.id)) {
            finalCandidates.push(archMatch);
            finalIds.add(archMatch.id);
            console.log(`  ➕ Added archetype match to final candidates: ${archMatch.name}`);
          }
        }
        
        // Limit to MAX_CANDIDATES_TO_LLM (but keep archetype matches)
        if (finalCandidates.length > MAX_CANDIDATES_TO_LLM) {
          // Keep all archetype matches, then fill rest with top non-archetype matches
          const archetypeInFinal = finalCandidates.filter(c => archetypeMatchIds.has(c.id));
          const nonArchetype = finalCandidates
            .filter(c => !archetypeMatchIds.has(c.id))
            .sort((a, b) => (b.hybrid_score ?? b.vector_sim ?? 0) - (a.hybrid_score ?? a.vector_sim ?? 0))
            .slice(0, MAX_CANDIDATES_TO_LLM - archetypeInFinal.length);
          finalCandidates = [...archetypeInFinal, ...nonArchetype];
        }
        
        console.log(`🎯 After MMR reranking: ${finalCandidates.length} final candidates`);
        const archetypeInFinal = finalCandidates.filter(c => archetypeMatchIds.has(c.id)).length;
        console.log(`   Includes ${archetypeInFinal} archetype matches`);
      } catch (err) {
        console.warn("⚠️ MMR reranking failed, using top candidates by score:", err);
        // Fallback: just take top candidates by hybrid_score
        finalCandidates = candidateCards
          .sort((a, b) => (b.hybrid_score ?? b.vector_sim ?? 0) - (a.hybrid_score ?? a.vector_sim ?? 0))
          .slice(0, MAX_CANDIDATES_TO_LLM);
      }
    } else {
      // No MMR: just take top candidates
      finalCandidates = candidateCards
        .sort((a, b) => (b.hybrid_score ?? b.vector_sim ?? 0) - (a.hybrid_score ?? a.vector_sim ?? 0))
        .slice(0, MAX_CANDIDATES_TO_LLM);
    }

    // Get card names for sanitization
    let allCardNames: string[] = [];
    try {
      const { data: allCards, error: cardError } = await supabase
        .from("cards")
        .select("name")
        .limit(10000);
      
      if (!cardError && allCards) {
        allCardNames = allCards.map((c: any) => c.name.trim()).filter(Boolean);
      }
    } catch (err) {
      console.error("Error fetching card names for sanitization:", err);
    }

    const allowedCardNames = Array.from(
      new Set([
        ...allDeckCards.map((c: Card) => c.name),
        ...finalCandidates.map((c) => c.name),
      ].map((n) => n.trim()))
    );

    // Convert candidates to TOON format for efficient token usage
    const toonTable = toTOON({
      name: "candidate_cards",
      items: finalCandidates.map((c) => ({
        id: c.id,
        name: c.name,
        archetype: c.archetype || "",
        type: c.type || "",
        desc: (c.desc || "").slice(0, 320), // Truncate to 320 chars
      })),
      fields: ["id", "name", "archetype", "type", "desc"],
      truncate: { desc: 320 },
    });
    
    console.log(`📋 TOON table generated: ${toonTable.length} chars, ${finalCandidates.length} cards`);
    console.log(`📝 Sample candidate names: ${finalCandidates.slice(0, 5).map(c => c.name).join(", ")}`);
    console.log(`📝 All candidate names: ${finalCandidates.map(c => c.name).join(", ")}`);
    console.log(`📝 TOON table preview (first 1000 chars):\n${toonTable.slice(0, 1000)}`);
    
    // Check if any candidates match the question keywords
    const questionLower = question.toLowerCase();
    const matchingCandidates = finalCandidates.filter(c => 
      c.name.toLowerCase().includes(questionLower) ||
      c.archetype?.toLowerCase().includes(questionLower) ||
      c.desc?.toLowerCase().includes(questionLower)
    );
    console.log(`🎯 Candidates matching question keywords: ${matchingCandidates.length}`);
    if (matchingCandidates.length > 0) {
      console.log(`   Matches: ${matchingCandidates.map(c => c.name).join(", ")}`);
    }

    const profileText = userProfile
      ? `User Profile:
- Preferred Archetypes: ${userProfile.preferredArchetypes.join(", ") || "None"}
- Playstyle Pattern: ${userProfile.playstylePattern}
- Skill Level: ${userProfile.skillLevel}
- Frequently Used Cards: ${userProfile.frequentlyUsedCards.slice(0, 5).join(", ")}
- Deck Count: ${userProfile.deckCount}`
      : "";

    const deckSummary = allDeckCards.length > 0
      ? `Deck contains ${allDeckCards.length} cards. Key archetypes: ${excludeArchetypes.join(", ") || "None"}.`
      : "No deck provided.";

    // Validate TOON table has content (skip for explanation questions)
    const intentClassified = classifyIntent(question);
    const isExplanation = intentClassified === "explanation";
    
    if ((!toonTable || toonTable.trim().length === 0) && !isExplanation) {
      console.error("❌ TOON table is empty! This should not happen if finalCandidates.length > 0");
      
      // Log error
      const { error: logError } = await supabase.from("recommendation_logs").insert({
        recommendation_id: recommendationId,
        user_id: user.id,
        question,
        format,
        recommendation_type,
        use_hybrid_search,
        candidate_count: candidateCards.length,
        final_candidate_count: 0,
        response_version: "1.0",
        error_message: "TOON table is empty",
      });
      if (logError) {
        console.error("Failed to log error:", logError);
      }
      
      return new Response(
        JSON.stringify({
          answer: `Error: No candidate cards were found or formatted correctly. Please try again or rephrase your question.`,
          validated_cards: [],
          recommendation_id: recommendationId,
          response_version: "1.0",
          diagnostic: {
            question,
            finalCandidatesCount: finalCandidates.length,
            toonTableLength: toonTable?.length || 0,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    // For explanation questions, allow proceeding even without candidate cards
    if (isExplanation && (!toonTable || toonTable.trim().length === 0)) {
      console.log("ℹ️ Explanation question with no candidates - proceeding with deck context only");
    }
    
    // Build hybrid prompts (freeform analysis + templated output)
    // Customize system prompt for explanation questions
    const systemPrompt = isExplanation
      ? `${GRANDMASTER_SYSTEM_PROMPT}

IMPORTANT FOR EXPLANATION QUESTIONS:
- If the user asks about cards in their deck, focus on explaining those specific cards
- Explain the purpose, benefits, and strategic value of the mentioned cards
- Discuss synergies and how they work together
- DO NOT mention "candidate table", "candidate cards", or any technical implementation details
- DO NOT pivot to recommending other cards unless the user explicitly asks for recommendations
- If the cards mentioned aren't in the deck, explain what you know about those cards in general
- If you're unsure about something, be honest and say "I'm not certain" or "I don't have enough information"
- Provide strategic insight and reasoning, not just card effects`
      : GRANDMASTER_SYSTEM_PROMPT;
    
    const userPrompt = buildHybridUserPrompt(
      question,
      deckSummary,
      toonTable || "",
      finalCandidates.length,
      format,
      banlistText,
      profileText,
      intentClassified,
      allDeckCards // Pass deck cards for explanation questions
    );

    // Call Groq API
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY not configured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log what we're sending to LLM for debugging
    console.log("📤 Sending to LLM:", {
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      candidateCount: finalCandidates.length,
      toonTableLength: toonTable.length,
      candidateNamesPreview: finalCandidates.slice(0, 5).map(c => c.name).join(", "),
    });
    console.log("📤 System prompt preview (first 500 chars):", systemPrompt.substring(0, 500));
    console.log("📤 User prompt preview (first 500 chars):", userPrompt.substring(0, 500));

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1500, // Reduced for token efficiency (target < 1500 total)
        }),
      }
    );

    if (!groqResponse.ok) {
      const error = await groqResponse.text();
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await groqResponse.json();
    const rawContent = result.choices?.[0]?.message?.content || "";
    
    console.log("📝 LLM raw response length:", rawContent.length);
    console.log("📝 LLM response preview (first 500 chars):", rawContent.substring(0, 500));
    
    // Try to parse JSON response (hybrid prompt may return JSON)
    let answerText = rawContent;
    type ParsedResponse = {
      answer?: string;
      recommended_cards?: Array<{ id?: number; name?: string; reason?: string; synergy_score?: number; risk_assessment?: string }>;
      alternative_considerations?: Array<{ name?: string; why_not?: string }>;
      meta?: { intent_classified?: string; confidence?: number; format_specific_notes?: string };
    };
    let parsedResponse: ParsedResponse | null = null;
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsedResponse = JSON.parse(jsonMatch[0]) as ParsedResponse;
        if (parsedResponse?.answer) {
          answerText = parsedResponse.answer;
        }
        
        // Clean up card names in recommended_cards if present
        if (parsedResponse?.recommended_cards && Array.isArray(parsedResponse.recommended_cards)) {
          parsedResponse.recommended_cards = parsedResponse.recommended_cards.map((card) => ({
            ...card,
            name: card.name ? cleanCardName(card.name) : card.name,
            reason: card.reason ? formatResponseText(card.reason) : card.reason,
          }));
        }
        
        // Clean up card names in alternative_considerations if present
        if (parsedResponse?.alternative_considerations && Array.isArray(parsedResponse.alternative_considerations)) {
          parsedResponse.alternative_considerations = parsedResponse.alternative_considerations.map((alt) => ({
            ...alt,
            name: alt.name ? cleanCardName(alt.name) : alt.name,
            why_not: alt.why_not ? formatResponseText(alt.why_not) : alt.why_not,
          }));
        }
      } catch (e) {
        console.warn("⚠️ Failed to parse JSON response, using raw text:", e);
      }
    }

    // Sanitize response - replace "this card" with actual candidate card names
    let sanitizedContent = sanitizeAiCardText(
      answerText, 
      allowedCardNames, 
      finalCandidates, // Pass candidate cards for context-aware replacement
      allCardNames
    );
    
    // Format and clean up the response for better readability
    sanitizedContent = formatResponseText(sanitizedContent);

    // For explanation questions, also extract card names from the user's question
    // (cards they're asking about that might be in their deck)
    let questionCardNames: string[] = [];
    if (intentClassified === "explanation") {
      // Extract card names from the question using simple patterns
      const cardNamePatterns = [
        /\b([A-Z][a-zA-Z0-9\s'-]+(?:Connector|Dolphin|Monster|Dragon|Magician|Warrior|Beast|Machine|Fiend|Spellcaster|Zombie|Plant|Insect|Rock|Pyro|Thunder|Aqua|Psychic|Divine|Winged|Elemental|Creator|HERO|Cyber|Blackwing|Gladiator|Six|Samurai|Archfiend|Ojama|Harpie|Amazoness|Toon|Spirit|Union|Gemini|Tuner|Synchro|Xyz|Pendulum|Link|Fusion|Ritual|Ruler|Cardcar))\b/g,
        /\b([A-Z][a-zA-Z0-9\s'-]+(?:\s+[A-Z][a-zA-Z0-9\s'-]+)+)\b/g, // Multi-word card names
      ];
      
      for (const pattern of cardNamePatterns) {
        let match;
        while ((match = pattern.exec(question)) !== null) {
          const cardName = match[1].trim();
          // Filter out common words
          if (cardName.length > 3 && 
              !["Master Duel", "TCG", "Deck", "Card", "Cards"].some(word => 
                cardName.toLowerCase().includes(word.toLowerCase())
              )) {
            questionCardNames.push(cardName);
          }
        }
      }
      // Remove duplicates
      questionCardNames = [...new Set(questionCardNames)];
      console.log(`📋 Extracted ${questionCardNames.length} card names from question:`, questionCardNames);
    }

    // Extract card names mentioned in response for validation
    // For explanation questions, also include cards from the user's question
    const extractCardNames = (text: string): string[] => {
      const cardNames = new Set<string>();
      
      // First, extract potential card names from bold markdown
      const boldPattern = /\*\*([^*]+?)\*\*/g;
      const boldMatches: string[] = [];
      let match;
      while ((match = boldPattern.exec(text)) !== null) {
        const extracted = match[1].trim();
        // Filter out obvious non-card text (too long, contains special patterns)
        if (extracted.length > 2 && extracted.length < 100 && 
            !extracted.includes('\\n') && !extracted.includes('+') &&
            !extracted.startsWith('s ') && !extracted.startsWith('user') &&
            !extracted.includes('playstyle') && !extracted.includes('archetype')) {
          boldMatches.push(extracted);
        }
      }
      
      // For explanation questions, also check deck cards
      const searchTargets = isExplanation 
        ? [...finalCandidates, ...allDeckCards.map(c => ({ name: c.name, id: c.id }))]
        : finalCandidates;
      
      // Match extracted names against actual card names (case-insensitive)
      // This ensures we only return valid card names
      for (const extractedName of boldMatches) {
        // Clean up extracted name (remove extra whitespace, handle commas)
        const cleanedName = extractedName.trim();
        
        // Try exact match first
        const exactMatch = searchTargets.find(c => 
          c.name.toLowerCase() === cleanedName.toLowerCase()
        );
        if (exactMatch) {
          cardNames.add(exactMatch.name); // Use exact name
          continue;
        }
        
        // Handle cards with commas (e.g., "Goldd, Wu-Lord of Dark World" might be extracted as one name)
        // Check if extracted name contains a comma and try matching each part
        if (cleanedName.includes(',')) {
          const parts = cleanedName.split(',').map(p => p.trim()).filter(p => p.length > 0);
          for (const part of parts) {
            const partMatch = searchTargets.find(c => 
              c.name.toLowerCase().includes(part.toLowerCase()) ||
              part.toLowerCase().includes(c.name.toLowerCase().split(',')[0].toLowerCase())
            );
            if (partMatch) {
              cardNames.add(partMatch.name);
              break; // Only add one match per extracted name
            }
          }
          continue;
        }
        
        // Try partial match (card name contains extracted text or vice versa)
        const partialMatch = searchTargets.find(c => {
          const candidateLower = c.name.toLowerCase();
          const extractedLower = cleanedName.toLowerCase();
          // Check if either name contains the other (but require at least 3 chars to avoid false matches)
          if (extractedLower.length < 3) return false;
          return candidateLower.includes(extractedLower) || 
                 extractedLower.includes(candidateLower);
        });
        if (partialMatch) {
          cardNames.add(partialMatch.name); // Use exact name
        }
      }
      
      // Also check if any card names appear in the text (even without bold)
      // This catches cases where LLM mentions cards but forgets bold formatting
      // But be more strict - only match if it's clearly a card mention
      for (const card of searchTargets) {
        const cardName = card.name;
        if (cardNames.has(cardName)) continue; // Already matched
        
        // Check if card name appears in text (case-insensitive, whole word)
        const escapedName = cardName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'gi');
        if (nameRegex.test(text)) {
          // For explanation questions, be more lenient - any mention is valid
          // For discovery questions, only add if it's mentioned in a context that suggests it's a recommendation
          if (isExplanation) {
            cardNames.add(cardName);
          } else {
            const contextPatterns = [
              new RegExp(`(?:recommend|suggest|include|add|use|try|consider|think|believe).{0,100}${escapedName}`, 'gi'),
              new RegExp(`${escapedName}.{0,50}(?:is|can|has|provides|offers|allows|enables)`, 'gi'),
              new RegExp(`(?:card|monster|spell|trap).{0,50}${escapedName}`, 'gi'),
            ];
            
            const hasGoodContext = contextPatterns.some(pattern => pattern.test(text));
            if (hasGoodContext) {
              cardNames.add(cardName);
            }
          }
        }
      }
      
      console.log(`🔍 Extracted ${boldMatches.length} bold matches, matched ${cardNames.size} to cards`);
      if (cardNames.size > 0) {
        console.log(`   Matched cards: ${Array.from(cardNames).join(", ")}`);
      }
      return Array.from(cardNames);
    };

    const mentionedCardNames = extractCardNames(sanitizedContent);
    console.log(`🎯 Extracted ${mentionedCardNames.length} card names from LLM response:`, mentionedCardNames);
    
    // For explanation questions, combine cards from response and question
    // Also try to match question card names against deck cards
    const allMentionedCardNames: string[] = [...mentionedCardNames];
    if (isExplanation && questionCardNames.length > 0) {
      // Try to match question card names to deck cards or database
      for (const qCardName of questionCardNames) {
        // Check if it's in the deck
        const deckMatch = allDeckCards.find(c => 
          c.name.toLowerCase() === qCardName.toLowerCase() ||
          c.name.toLowerCase().includes(qCardName.toLowerCase()) ||
          qCardName.toLowerCase().includes(c.name.toLowerCase())
        );
        if (deckMatch && !allMentionedCardNames.includes(deckMatch.name)) {
          allMentionedCardNames.push(deckMatch.name);
        }
      }
      console.log(`📋 Combined ${allMentionedCardNames.length} card names (${mentionedCardNames.length} from response, ${questionCardNames.length} from question)`);
    }
    
    // Validate and fetch card data
    const validatedCards: Card[] = [];
    if (allMentionedCardNames.length > 0) {
      console.log(`🔍 Validating ${allMentionedCardNames.length} mentioned card names...`);
      const batchSize = 20;
      for (let i = 0; i < allMentionedCardNames.length; i += batchSize) {
        const batch = allMentionedCardNames.slice(i, i + batchSize);
        console.log(`  Batch ${Math.floor(i / batchSize) + 1}:`, batch);
        
        // Try exact match first (select only columns that exist in database)
        const { data: exactMatches } = await supabase
          .from("cards")
          .select("id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg")
          .in("name", batch)
          .limit(batchSize * 2);
        
        if (exactMatches && exactMatches.length > 0) {
          exactMatches.forEach((card: any) => {
            validatedCards.push({
              ...card,
              archetype: getArchetypeNameServer(card),
              // Add client-side fields that don't exist in DB
              misc_info: [{ md_rarity: "" }],
              card_images: [{ 
                id: card.id, 
                image_url: `https://images.ygoprodeck.com/images/cards/${card.id}.jpg`,
                image_url_small: `https://images.ygoprodeck.com/images/cards_small/${card.id}.jpg`
              }],
              card_sets: [],
              card_prices: [],
            });
          });
          console.log(`  ✅ Found ${exactMatches.length} exact matches`);
        }
        
        // If not all found, try case-insensitive search
        const foundNames = new Set(exactMatches?.map((c: any) => c.name.toLowerCase()) || []);
        const notFound = batch.filter(name => !foundNames.has(name.toLowerCase()));
        
        if (notFound.length > 0) {
          console.log(`  🔍 Trying case-insensitive search for ${notFound.length} cards...`);
          const nameConditions = notFound
            .map((name) => {
              const escapedName = name.replace(/[%_\\]/g, '\\$&');
              return `name.ilike.${escapedName}`;
            })
            .join(",");

          const { data: fuzzyMatches } = await supabase
            .from("cards")
            .select("id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg")
            .or(nameConditions)
            .limit(batchSize * 2);

          if (fuzzyMatches) {
            fuzzyMatches.forEach((card: any) => {
              // Avoid duplicates
              if (!validatedCards.some(c => c.id === card.id)) {
                validatedCards.push({
                  ...card,
                  archetype: getArchetypeNameServer(card),
                  // Add client-side fields that don't exist in DB
                  misc_info: [{ md_rarity: "" }],
                  card_images: [{ 
                    id: card.id, 
                    image_url: `https://images.ygoprodeck.com/images/cards/${card.id}.jpg`,
                    image_url_small: `https://images.ygoprodeck.com/images/cards_small/${card.id}.jpg`
                  }],
                  card_sets: [],
                  card_prices: [],
                });
              }
            });
            console.log(`  ✅ Found ${fuzzyMatches.length} fuzzy matches`);
          }
        }
      }
      console.log(`📊 Total validated cards: ${validatedCards.length}`);
    } else {
      console.warn("⚠️ No card names extracted from LLM response. LLM may not have mentioned specific cards.");
      console.warn("   Response preview:", sanitizedContent.substring(0, 200));
    }

    // Calculate token usage (more accurate estimation)
    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const userTokens = Math.ceil(userPrompt.length / 4);
    const inputTokens = systemTokens + userTokens;
    const outputTokens = Math.ceil(rawContent.length / 4);
    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUSD = (totalTokens / 1000000) * 0.27;
    
    // Log token usage for monitoring
    console.log(`Token usage: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total (target: < 1500)`);
    
    const durationMs = Date.now() - startTime;
    const responseVersion = "1.0";
    
    // Log successful recommendation
    const { error: logError } = await supabase.from("recommendation_logs").insert({
      recommendation_id: recommendationId,
      user_id: user.id,
      question,
      format,
      recommendation_type,
      use_hybrid_search,
      candidate_count: candidateCards.length,
      final_candidate_count: finalCandidates.length,
      tokens_used: totalTokens,
      cost_usd: estimatedCostUSD,
      response_version: responseVersion,
    });
    if (logError) {
      console.error("Failed to log recommendation:", logError);
    }
    
    // Structured log for observability
    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      recommendation_id: recommendationId,
      user_id: user.id,
      question: question.substring(0, 100),
      candidate_count: candidateCards.length,
      final_candidate_count: finalCandidates.length,
      tokens_used: totalTokens,
      cost_usd: estimatedCostUSD,
      response_version: responseVersion,
      duration_ms: durationMs,
      intent_classified: intentClassified,
    }));

    // Build response with structured JSON data if available
    type ResponseData = {
      answer: string;
      validated_cards: typeof validatedCards;
      recommendation_id: string;
      response_version: string;
      estimated_cost: {
        tokens_used: number;
        cost_usd: number;
      };
      recommended_cards?: ParsedResponse["recommended_cards"];
      alternative_considerations?: ParsedResponse["alternative_considerations"];
      meta?: ParsedResponse["meta"];
    };
    
    const responseData: ResponseData = {
      answer: sanitizedContent,
      validated_cards: validatedCards,
      recommendation_id: recommendationId,
      response_version: responseVersion,
      estimated_cost: {
        tokens_used: totalTokens,
        cost_usd: estimatedCostUSD,
      },
    };
    
    // Include structured JSON data if available
    if (parsedResponse?.recommended_cards) {
      responseData.recommended_cards = parsedResponse.recommended_cards;
    }
    if (parsedResponse?.alternative_considerations) {
      responseData.alternative_considerations = parsedResponse.alternative_considerations;
    }
    if (parsedResponse?.meta) {
      responseData.meta = parsedResponse.meta;
    }
    
    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    // Log error
    const recommendationId = crypto.randomUUID();
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    console.error(JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      recommendation_id: recommendationId,
      error_message: errorMessage,
      error_type: "exception",
    }));
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      recommendation_id: recommendationId,
      response_version: "1.0",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

