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
  
  cleaned = cleaned.replace(thisCardRegex, (match, pronoun, offset) => {
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

// Post-process to replace "this card" with actual card names
function replaceThisCardWithActualNames(obj: any, deckCards: Card[] = []): any {
  if (typeof obj === "string") {
    if (obj.toLowerCase().includes("this card")) {
      const cardLikeRegex = /\b([A-Z][A-Za-z0-9'&-]+(?:\s+[A-Z][A-Za-z0-9'&-]+)+)\b/g;
      const mentionedCards: string[] = [];
      let match;
      const tempStr = obj;
      while ((match = cardLikeRegex.exec(tempStr)) !== null) {
        const cardName = match[1].trim();
        if (!mentionedCards.includes(cardName)) {
          mentionedCards.push(cardName);
        }
      }
      
      if (mentionedCards.length > 0) {
        return obj.replace(/\bthis card\b/gi, mentionedCards[0]);
      }
      
      // Fallback to first deck card
      if (deckCards.length > 0) {
        return obj.replace(/\bthis card\b/gi, deckCards[0].name);
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => replaceThisCardWithActualNames(item, deckCards));
  }
  if (obj && typeof obj === "object") {
    const processed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = replaceThisCardWithActualNames(value, deckCards);
    }
    return processed;
  }
  return obj;
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

// Find cards by archetype
async function findCardsByArchetype(
  supabaseClient: any,
  archetype: string,
  excludeIds: number[] = []
): Promise<Card[]> {
  if (!archetype) return [];

  const { data, error } = await supabaseClient
    .from("cards")
    .select("id, name, type, desc, level, race, attribute, archetype, card_images, atk, def")
    .eq("archetype", archetype)
    .not("id", "in", `(${excludeIds.length > 0 ? excludeIds.join(",") : "0"})`)
    .limit(50);

  if (error) {
    console.error("Error finding cards by archetype:", error);
    return [];
  }

  return (data || []).map((card: any) => ({
    ...card,
    archetype: getArchetypeNameServer(card),
  }));
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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not authenticated." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
    
    // Build deck context text for embedding
    const deckContextText = buildDeckContextText(current_deck || {});
    
    // Build query text: question + deck context
    const queryText = `${question}. ${deckContextText}`;

    // Get card candidates using hybrid search
    let candidateCards: CardCandidate[] = [];
    
    if (use_hybrid_search) {
      try {
        // Generate embedding for query
        const queryEmbedding = await getQueryEmbedding(queryText);
        
        // Perform hybrid search
        candidateCards = await hybridSearch(
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
      } catch (err) {
        console.error("Hybrid search failed, falling back to simple search:", err);
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

    // Apply MMR reranking (enabled by default, skip for "simple" type)
    let finalCandidates: CardCandidate[] = candidateCards;
    
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
        const mmrCandidates: MMRCandidate[] = candidateCards.map((c) => ({
          id: c.id,
          embedding: embMap.get(c.id) ?? null,
          sim: c.hybrid_score ?? c.vector_sim ?? 0,
          row: c,
        }));

        // Apply MMR reranking
        const mmrSelected = mmrSelect(mmrCandidates, queryEmbedding, MAX_CANDIDATES_TO_LLM, MMR_LAMBDA);
        finalCandidates = mmrSelected.map((s) => s.row);
      } catch (err) {
        console.warn("MMR reranking failed, using top candidates by score:", err);
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

    // Build list of candidate card names for the prompt
    const candidateCardNames = finalCandidates.map((c) => c.name).join(", ");
    
    // Build expert-level prompt with TOON format
    const systemPrompt = `You are an expert Yu-Gi-Oh! strategist and deck builder with deep knowledge of card interactions, meta strategies, and competitive play.

Your task is to provide expert-level card recommendations based on the user's question and the candidate cards provided in TOON format.

CRITICAL RULES - READ CAREFULLY:
1. Use ONLY the candidate cards provided in the TOON table below
2. NEVER suggest cards that are not in the candidate list
3. ALWAYS use the EXACT card name from the "name" column in the TOON table
4. NEVER use generic terms like "this card", "that card", "the card" - ALWAYS use the actual card name
5. Format card names in **bold** markdown when mentioning them (e.g., **Blue-Eyes White Dragon**)
6. When discussing a card, use its full name from the TOON table - do not abbreviate or use pronouns
7. Provide strategic, expert-level reasoning - not generic advice
8. Consider card synergies, combo potential, and meta relevance
9. Be specific about why each card fits the deck/strategy

Available candidate card names (use these EXACT names):
${candidateCardNames}

Format: ${format === "MASTER_DUEL" ? "Master Duel" : "TCG"}
${banlistText ? `\nBanlist Restrictions:\n${banlistText}` : ""}
${profileText ? `\n${profileText}` : ""}`;

    const userPrompt = `User Question: ${question}

${deckSummary}

Candidate Cards (TOON format - use ONLY these cards, reference by EXACT name from "name" column):
${toonTable}

Task: Analyze the candidate cards and provide expert recommendations. For EACH card you mention, use its EXACT name from the "name" column above. NEVER use "this card" or "that card" - always use the actual card name.`;

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

    // Sanitize response - replace "this card" with actual candidate card names
    let sanitizedContent = sanitizeAiCardText(
      rawContent, 
      allowedCardNames, 
      finalCandidates, // Pass candidate cards for context-aware replacement
      allCardNames
    );

    // Extract card names mentioned in response for validation
    const extractCardNames = (text: string): string[] => {
      const cardNames: string[] = [];
      const boldPattern = /\*\*([^*]+)\*\*/g;
      let match;
      while ((match = boldPattern.exec(text)) !== null) {
        cardNames.push(match[1].trim());
      }
      return cardNames;
    };

    const mentionedCardNames = extractCardNames(sanitizedContent);
    
    // Validate and fetch card data
    const validatedCards: Card[] = [];
    if (mentionedCardNames.length > 0) {
      const batchSize = 20;
      for (let i = 0; i < mentionedCardNames.length; i += batchSize) {
        const batch = mentionedCardNames.slice(i, i + batchSize);
        const nameConditions = batch
          .map((name) => {
            const escapedName = name.replace(/[%_\\]/g, '\\$&');
            return `name.ilike.${escapedName}`;
          })
          .join(",");

        const { data: validatedCardsData } = await supabase
          .from("cards")
          .select("id, name, type, desc, level, race, attribute, archetype, card_images, atk, def, misc_info, card_sets, card_prices")
          .or(nameConditions)
          .limit(batchSize * 2);

        if (validatedCardsData) {
          validatedCardsData.forEach((card: any) => {
            validatedCards.push({
              ...card,
              archetype: getArchetypeNameServer(card),
            });
          });
        }
      }
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

    return new Response(
      JSON.stringify({
        answer: sanitizedContent,
        validated_cards: validatedCards,
        estimated_cost: {
          tokens_used: totalTokens,
          cost_usd: estimatedCostUSD,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

