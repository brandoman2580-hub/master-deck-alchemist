import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

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

type DeckType = {
  id: string;
  name: string;
  mainDeck: Card[];
  extraDeck: Card[];
  sideDeck: Card[];
  mode?: "Master Duel" | "TCG";
};

interface MasterDuelBanlistEntry {
  card_name: string;
  ban_status: string;
}

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const MODEL_NAME = Deno.env.get("MODEL_NAME") || "llama3-70b-8192";

// Helper: truncate card descriptions
function truncateDesc(desc: string, maxLen = 200): string {
  if (!desc) return "";
  return desc.length > maxLen ? desc.slice(0, maxLen) + "..." : desc;
}

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

// Helper: sanitize AI text - be conservative, don't replace valid card names
function sanitizeAiCardText(content: string, allowedCardNames: string[], allCardNames: string[] = []): string {
  let cleaned = content.replace(/\[object Object\]/g, "this archetype");
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
  
  // Don't replace if the string already contains "this card" - it's likely intentional
  if (cleaned.toLowerCase().includes("this card")) {
    return cleaned;
  }
  
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
      "this card", "that card", "your card", "opponent", "player", "duel", "game"
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
      recommendation_type = "personalized", // personalized, archetype, engine, tech
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

    // Build context based on recommendation type
    let contextText = "";
    let relatedCards: Card[] = [];

    if (recommendation_type === "archetype") {
      // Extract archetype from question (simple pattern matching)
      const archetypeMatch = question.match(/(?:for|in|with)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i);
      if (archetypeMatch) {
        const archetypeName = archetypeMatch[1].trim();
        relatedCards = await findCardsByArchetype(supabase, archetypeName, excludeIds);
        contextText = `Archetype: ${archetypeName}\nRelated Cards: ${relatedCards.slice(0, 20).map(c => `${c.name} (${c.type})`).join(", ")}`;
      }
    }

    const deckCardsText = allDeckCards.length > 0
      ? allDeckCards.map((card: Card) => `${card.name} (${card.type}): ${truncateDesc(card.desc)}`).join("\n\n")
      : "No deck provided";

    const profileText = userProfile
      ? `User Profile:
- Preferred Archetypes: ${userProfile.preferredArchetypes.join(", ") || "None"}
- Playstyle Pattern: ${userProfile.playstylePattern}
- Skill Level: ${userProfile.skillLevel}
- Frequently Used Cards: ${userProfile.frequentlyUsedCards.slice(0, 5).join(", ")}
- Deck Count: ${userProfile.deckCount}`
      : "";

    const allowedCardNames = Array.from(
      new Set([
        ...allDeckCards.map((c: Card) => c.name),
        ...relatedCards.map((c: Card) => c.name),
      ].map((n) => n.trim()))
    );

    const prompt = `You are an expert Yu-Gi-Oh! recommendation assistant. Answer the user's question about card or deck recommendations.

${profileText ? `${profileText}\n\n` : ""}Current Deck:
${deckCardsText}

${contextText ? `${contextText}\n\n` : ""}Format: ${format === "MASTER_DUEL" ? "Master Duel" : "TCG"}

Banlist Restrictions:
${banlistText || "No major restrictions"}

User Question: ${question}

CRITICAL: Available card names you can reference:
${allowedCardNames.length > 0 ? allowedCardNames.join(", ") : "None"}

Instructions:
1. Answer the user's question directly and helpfully
2. Provide specific card recommendations when appropriate
3. ALWAYS use actual card names from the Yu-Gi-Oh! card database - NEVER use generic terms like "this card" or "that card"
4. Only reference cards that exist in the official Yu-Gi-Oh! card database
5. NEVER invent card names - only use real card names
6. Format card names in **bold** markdown when mentioning them (e.g., **Blue-Eyes White Dragon**)
7. Be specific and actionable in your recommendations
8. Consider the user's profile and current deck when making recommendations

Return your response as plain text (not JSON). Be conversational and helpful.`;

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
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2048,
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

    // Sanitize response
    let sanitizedContent = sanitizeAiCardText(rawContent, allowedCardNames, allCardNames);
    
    // Replace "this card" with actual card names
    sanitizedContent = replaceThisCardWithActualNames(sanitizedContent, allDeckCards);

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

    // Calculate token usage
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(rawContent.length / 4);
    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUSD = (totalTokens / 1000000) * 0.27;

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

