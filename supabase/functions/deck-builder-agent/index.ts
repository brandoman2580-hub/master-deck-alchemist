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

interface MasterDuelBanlistEntry {
  card_name: string;
  ban_status: string;
}

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const MODEL_NAME = Deno.env.get("MODEL_NAME") || "llama3-70b-8192";

// Helper: dedup by name
function onlyUniqueByName(arr: Card[]): Card[] {
  const seen = new Set<string>();
  return arr.filter((card) => {
    const name = card.name.toLowerCase();
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

// Helper: truncate card descriptions
function truncateDesc(desc: string, maxLen = 220): string {
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
function sanitizeAiCardText(
  content: string,
  allowedCardNames: string[],
  allCardNames: string[] = [],
): string {
  let cleaned = content.replace(/\[object Object\]/g, "this archetype");
  if (!allowedCardNames || allowedCardNames.length === 0) {
    return cleaned;
  }

  // Create comprehensive set of valid card names (allowed + all from database)
  const allValidCardNames = new Set<string>();
  allowedCardNames.forEach((name) => allValidCardNames.add(name.toLowerCase()));
  allCardNames.forEach((name) => allValidCardNames.add(name.toLowerCase()));

  // Create a map for exact matching (preserve original casing)
  const cardNameMap = new Map<string, string>();
  allowedCardNames.forEach((name) => {
    cardNameMap.set(name.toLowerCase(), name);
  });

  // Don't replace if the string already contains "this card" - it's likely intentional
  if (cleaned.toLowerCase().includes("this card")) {
    return cleaned;
  }

  const cardLikeRegex =
    /\b([A-Z][A-Za-z0-9'&-]+(?:\s+[A-Z][A-Za-z0-9'&-]+)+)\b/g;
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
      "deck",
      "card",
      "hand",
      "field",
      "graveyard",
      "banish",
      "summon",
      "tribute",
      "monster",
      "spell",
      "trap",
      "extra deck",
      "main deck",
      "side deck",
      "going first",
      "going second",
      "turn",
      "phase",
      "battle",
      "damage",
      "life points",
      "this card",
      "that card",
      "your card",
      "opponent",
      "player",
      "duel",
      "game",
    ];
    if (
      commonTerms.some(
        (term) => normalized.includes(term) || term.includes(normalized),
      )
    ) {
      return trimmed;
    }

    // Be conservative - preserve card names even if not validated
    return trimmed;
  });
  return cleaned;
}

// Load Master Duel banlist from Supabase
async function loadMasterDuelBanlist(
  supabaseClient: any,
): Promise<Record<string, string>> {
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

// Find related cards by archetype
async function findRelatedByArchetype(
  supabaseClient: any,
  selectedCards: Card[],
  excludeIds: number[],
): Promise<Card[]> {
  const archetypes = new Set(
    selectedCards
      .map((c) => getArchetypeNameServer(c))
      .filter((a): a is string => Boolean(a)),
  );

  if (archetypes.size === 0) return [];

  const archetypeArray = Array.from(archetypes);
  const { data, error } = await supabaseClient
    .from("cards")
    .select("id, name, type, desc, level, race, attribute, archetype")
    .in("archetype", archetypeArray)
    .not("id", "in", `(${excludeIds.length > 0 ? excludeIds.join(",") : "0"})`)
    .limit(50);

  if (error) {
    console.error("Error finding related cards by archetype:", error);
    return [];
  }

  return (data || [])
    .filter((card: Card) => getArchetypeNameServer(card))
    .map((card: any) => ({
      ...card,
      archetype: getArchetypeNameServer(card),
    }));
}

// Find related cards by type/subtype
async function findRelatedByType(
  supabaseClient: any,
  selectedCards: Card[],
  excludeIds: number[],
): Promise<Card[]> {
  const types = new Set(
    selectedCards.map((c) => c.type).filter((t): t is string => Boolean(t)),
  );
  const races = new Set(
    selectedCards.map((c) => c.race).filter((r): r is string => Boolean(r)),
  );

  if (types.size === 0 && races.size === 0) return [];

  let query = supabaseClient
    .from("cards")
    .select("id, name, type, desc, level, race, attribute, archetype")
    .not("id", "in", `(${excludeIds.length > 0 ? excludeIds.join(",") : "0"})`);

  const conditions: string[] = [];
  if (types.size > 0) {
    const typeArray = Array.from(types);
    conditions.push(`type.in.(${typeArray.map((t) => `"${t}"`).join(",")})`);
  }
  if (races.size > 0) {
    const raceArray = Array.from(races);
    conditions.push(`race.in.(${raceArray.map((r) => `"${r}"`).join(",")})`);
  }

  if (conditions.length > 0) {
    query = query.or(conditions.join(","));
  }

  const { data, error } = await query.limit(50);

  if (error) {
    console.error("Error finding related cards by type:", error);
    return [];
  }

  return (data || []).map((card: any) => ({
    ...card,
    archetype: getArchetypeNameServer(card),
  }));
}

// Find related cards by keywords
async function findRelatedByKeywords(
  supabaseClient: any,
  selectedCards: Card[],
  excludeIds: number[],
): Promise<Card[]> {
  const keywords = new Set<string>();
  selectedCards.forEach((card) => {
    if (card.desc) {
      const desc = card.desc.toLowerCase();
      const effectWords = [
        "banish",
        "negate",
        "destroy",
        "draw",
        "search",
        "special summon",
        "tribute",
        "discard",
        "add",
        "send",
        "reveal",
        "target",
        "activate",
        "fusion",
        "synchro",
        "xyz",
        "link",
        "ritual",
        "pendulum",
      ];
      effectWords.forEach((word) => {
        if (desc.includes(word)) {
          keywords.add(word);
        }
      });
    }
  });

  if (keywords.size === 0) return [];

  try {
    const keywordArray = Array.from(keywords);
    const searchQuery = keywordArray.slice(0, 5).join(" ");

    const { data: matches, error: matchError } = await supabaseClient.rpc(
      "match_cards_by_text",
      {
        query: searchQuery,
        match_count: 50,
        excluded_ids: excludeIds.length > 0 ? excludeIds : [0],
        banlist_format: "MASTER_DUEL",
      },
    );

    if (matchError) {
      console.error("Error in match_cards_by_text:", matchError);
      return [];
    }

    return (matches || []).map((m: any) => {
      const normalizedCard = {
        id: m.card_id,
        name: m.name,
        type: m.type,
        desc: m.desc,
        level: undefined,
        race: m.race,
        attribute: m.attribute,
        archetype: m.archetype,
      };
      return {
        ...normalizedCard,
        archetype: getArchetypeNameServer(normalizedCard),
      };
    });
  } catch (err) {
    console.error("Error finding related cards by keywords:", err);
    return [];
  }
}

// Calculate deck statistics
function calculateDeckStats(deck: {
  mainDeck: Card[];
  extraDeck: Card[];
  sideDeck: Card[];
}) {
  const mainCount = deck.mainDeck.length;
  const extraCount = deck.extraDeck.length;
  const sideCount = deck.sideDeck.length;

  const monsterCount = deck.mainDeck.filter((c) =>
    c.type.includes("Monster"),
  ).length;
  const spellCount = deck.mainDeck.filter((c) =>
    c.type.includes("Spell"),
  ).length;
  const trapCount = deck.mainDeck.filter((c) => c.type.includes("Trap")).length;

  const archetypes = new Map<string, number>();
  deck.mainDeck.forEach((card) => {
    const arch = getArchetypeNameServer(card);
    if (arch) {
      archetypes.set(arch, (archetypes.get(arch) || 0) + 1);
    }
  });

  const primaryArchetype =
    Array.from(archetypes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    null;

  return {
    mainCount,
    extraCount,
    sideCount,
    monsterCount,
    spellCount,
    trapCount,
    primaryArchetype,
    archetypeCount: archetypes.size,
  };
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
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      current_deck,
      user_goal,
      archetype_preference,
      playstyle,
      context = "refining",
      banlist_format = "MASTER_DUEL",
    } = await req.json();

    if (!current_deck) {
      return new Response(
        JSON.stringify({ error: "current_deck is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Calculate deck stats
    const deckStats = calculateDeckStats(current_deck);
    const allDeckCards = [
      ...current_deck.mainDeck,
      ...current_deck.extraDeck,
      ...current_deck.sideDeck,
    ];
    const excludeIds = allDeckCards.map((c) => c.id);

    // Load banlist
    const banlist =
      banlist_format === "MASTER_DUEL"
        ? await loadMasterDuelBanlist(supabase)
        : {};

    // Find related cards
    const [relatedByArchetype, relatedByType, relatedByKeywords] =
      await Promise.all([
        findRelatedByArchetype(supabase, allDeckCards, excludeIds),
        findRelatedByType(supabase, allDeckCards, excludeIds),
        findRelatedByKeywords(supabase, allDeckCards, excludeIds),
      ]);

    const allRelated = [
      ...relatedByArchetype,
      ...relatedByType,
      ...relatedByKeywords,
    ];

    // Filter forbidden cards
    const banlistMap = new Map<string, string>(Object.entries(banlist));
    const filteredRelated = allRelated.filter((card: Card) => {
      const ban = banlistMap.get(card.name) || "Unlimited";
      return ban !== "Forbidden";
    });

    const relatedCards = onlyUniqueByName(filteredRelated).slice(0, 60);

    // Build prompt context
    const deckCardsText = allDeckCards
      .map((card) => {
        const archetypeName = getArchetypeNameServer(card);
        return `${card.name} (${card.type}${archetypeName ? ", " + archetypeName : ""}): ${truncateDesc(card.desc)}`;
      })
      .join("\n\n");

    const relatedCardsText = relatedCards
      .map((card) => {
        const archetypeName = getArchetypeNameServer(card);
        return `${card.name} (${card.type}${archetypeName ? ", " + archetypeName : ""}): ${truncateDesc(card.desc)}`;
      })
      .join("\n\n");

    // Create a clear list of all available card names for easy reference
    const allAvailableCardNames = [
      ...allDeckCards.map((c) => c.name),
      ...relatedCards.map((c) => c.name),
    ];
    const availableCardNamesList = allAvailableCardNames.join(", ");

    const banlistText = Object.entries(banlist)
      .filter(([, status]) => status === "Forbidden" || status === "Limited")
      .slice(0, 30)
      .map(([name, status]) => `${name}: ${status}`)
      .join("\n");

    const allowedCardNames = Array.from(
      new Set(
        [
          ...allDeckCards.map((c) => c.name),
          ...relatedCards.map((c) => c.name),
        ].map((n) => n.trim()),
      ),
    );

    // Fetch all card names from database for comprehensive sanitization
    let allCardNames: string[] = allowedCardNames;
    try {
      const { data: allCards, error: cardError } = await supabase
        .from("cards")
        .select("name")
        .limit(10000); // Get a large sample of card names

      if (!cardError && allCards) {
        const dbCardNames = allCards
          .map((c: any) => c.name.trim())
          .filter(Boolean);
        allCardNames = Array.from(
          new Set([...allowedCardNames, ...dbCardNames]),
        );
      }
    } catch (err) {
      console.error("Error fetching card names for sanitization:", err);
      // Fall back to allowed card names only
      allCardNames = allowedCardNames;
    }

    // Determine context-specific prompt
    const contextPrompts = {
      initial_build:
        "The user is starting to build a new deck. Focus on suggesting core cards, starters, and engine pieces.",
      refining:
        "The user is refining an existing deck. Focus on suggesting improvements, tech choices, and optimization cards.",
      completing:
        "The user is completing their deck. Focus on suggesting final cards, side deck options, and finishing touches.",
    };

    const contextPrompt =
      contextPrompts[context as keyof typeof contextPrompts] ||
      contextPrompts.refining;

    // Build prompt
    const prompt = `You are an expert Yu-Gi-Oh! deck building assistant. Analyze the current deck and provide helpful suggestions.

Current Deck:
Main Deck: ${deckStats.mainCount} cards (${deckStats.monsterCount} monsters, ${deckStats.spellCount} spells, ${deckStats.trapCount} traps)
Extra Deck: ${deckStats.extraCount} cards
Side Deck: ${deckStats.sideCount} cards
Primary Archetype: ${deckStats.primaryArchetype || "Mixed/None"}
Archetype Count: ${deckStats.archetypeCount}

Deck Cards:
${deckCardsText || "No cards yet"}

Related Card Options (matching archetype, type, or keywords):
${relatedCardsText || "None found"}

CRITICAL: Available card names you can reference:
${availableCardNamesList || "None"}

Banlist Restrictions:
${banlistText || "No major restrictions"}

User Goal: ${user_goal || "Build a competitive deck"}
Archetype Preference: ${archetype_preference || "None specified"}
Playstyle: ${playstyle || "Not specified"}
Context: ${contextPrompt}

Instructions:
1. Analyze the current deck composition
2. Identify strengths and weaknesses
3. Suggest cards from the "Related Card Options" list that would improve the deck
4. Consider banlist restrictions when making suggestions
5. Provide a deck assessment with scores and actionable next steps
6. Return your analysis as valid JSON with this exact schema:

{
  "analysis": "string - overall deck analysis and building guidance",
  "suggestions": [
    {
      "candidate_id": number - unique ID for this suggestion,
      "card_name": "string - exact card name from Related Card Options",
      "reason": "string - why this card improves the deck",
      "priority": "high" | "medium" | "low",
      "section": "main" | "extra" | "side",
      "synergy_with": [number] - array of card IDs this synergizes with (optional)
    }
  ],
  "deck_assessment": {
    "completeness_score": number - 0-100,
    "archetype_coherence": number - 0-100,
    "balance_score": number - 0-100,
    "issues": ["string - list of issues"],
    "strengths": ["string - list of strengths"]
  },
  "next_steps": ["string - actionable next steps"]
}

STRONG RULES (MUST FOLLOW):
- You MUST ONLY mention or recommend cards that are in the "Related Card Options" list above
- You MUST NOT invent or rename any card
- If you think of a card that is not in the allowed lists, DO NOT mention it
- NEVER output invented names like "Mystic Tomahawk" or any other made-up card
- ALWAYS use actual card names from the "Related Card Options" list - NEVER use generic terms like "this card" or "that card"
- When referencing cards in your analysis, use their exact names as shown in the lists above
- Only recommend cards that exist in the "Related Card Options" list`;

    // Call Groq API
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY not configured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
          temperature: 0.5,
          max_tokens: 2048,
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!groqResponse.ok) {
      const error = await groqResponse.text();
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await groqResponse.json();
    const rawContent = result.choices?.[0]?.message?.content || "{}";

    // Parse JSON response
    let parsedResponse: any = null;
    try {
      let jsonContent = rawContent.trim();
      if (jsonContent.startsWith("```")) {
        const lines = jsonContent.split("\n");
        lines.shift();
        if (lines[lines.length - 1].trim() === "```") {
          lines.pop();
        }
        jsonContent = lines.join("\n");
      }
      parsedResponse = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      return new Response(
        JSON.stringify({
          error: "Failed to parse AI response as JSON.",
          raw_response: rawContent,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create a map for card name replacement
    const cardNameMap = new Map<string, string>();
    allowedCardNames.forEach((name) => {
      cardNameMap.set(name.toLowerCase(), name);
    });
    const allValidCardNames = new Set<string>();
    allCardNames.forEach((name) => allValidCardNames.add(name.toLowerCase()));

    // Post-process to replace "this card" with actual card names where possible
    const replaceThisCardWithActualNames = (obj: any, parentObj?: any): any => {
      if (typeof obj === "string") {
        // If the string contains "this card", try to infer which card it should be
        if (obj.toLowerCase().includes("this card")) {
          // First, try to find card names mentioned in the same string
          const cardLikeRegex =
            /\b([A-Z][A-Za-z0-9'&-]+(?:\s+[A-Z][A-Za-z0-9'&-]+)+)\b/g;
          const mentionedCards: string[] = [];
          let match;
          const tempStr = obj;
          while ((match = cardLikeRegex.exec(tempStr)) !== null) {
            const cardName = match[1].trim();
            const normalized = cardName.toLowerCase();
            if (allValidCardNames.has(normalized)) {
              const actualName = cardNameMap.get(normalized) || cardName;
              if (!mentionedCards.includes(actualName)) {
                mentionedCards.push(actualName);
              }
            }
          }

          // If we found card names in the same string, replace "this card" with the first one
          if (mentionedCards.length > 0) {
            return obj.replace(/\bthis card\b/gi, mentionedCards[0]);
          }

          // If parent object exists, check its other fields for card names
          if (parentObj) {
            const parentStr = JSON.stringify(parentObj);
            const parentCardRegex =
              /\b([A-Z][A-Za-z0-9'&-]+(?:\s+[A-Z][A-Za-z0-9'&-]+)+)\b/g;
            const parentCards: string[] = [];
            let parentMatch;
            while ((parentMatch = parentCardRegex.exec(parentStr)) !== null) {
              const cardName = parentMatch[1].trim();
              const normalized = cardName.toLowerCase();
              if (allValidCardNames.has(normalized)) {
                const actualName = cardNameMap.get(normalized) || cardName;
                if (!parentCards.includes(actualName)) {
                  parentCards.push(actualName);
                }
              }
            }
            if (parentCards.length > 0) {
              return obj.replace(/\bthis card\b/gi, parentCards[0]);
            }
          }

          // Last resort: use the most common card from the deck (main deck cards prioritized)
          const mainDeckCardNames = current_deck.mainDeck.map((c) => c.name);
          if (mainDeckCardNames.length > 0) {
            return obj.replace(/\bthis card\b/gi, mainDeckCardNames[0]);
          }
          if (allowedCardNames.length > 0) {
            return obj.replace(/\bthis card\b/gi, allowedCardNames[0]);
          }

          return obj;
        }
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map((item) => replaceThisCardWithActualNames(item, obj));
      }
      if (obj && typeof obj === "object") {
        const processed: any = {};
        for (const [key, value] of Object.entries(obj)) {
          processed[key] = replaceThisCardWithActualNames(value, obj);
        }
        return processed;
      }
      return obj;
    };

    // Sanitize AI text (conservative - preserves card names)
    if (parsedResponse.analysis) {
      parsedResponse.analysis = sanitizeAiCardText(
        parsedResponse.analysis,
        allowedCardNames,
        allCardNames,
      );
    }
    if (Array.isArray(parsedResponse.next_steps)) {
      parsedResponse.next_steps = parsedResponse.next_steps.map(
        (step: string) =>
          sanitizeAiCardText(step, allowedCardNames, allCardNames),
      );
    }
    if (parsedResponse.deck_assessment?.issues) {
      parsedResponse.deck_assessment.issues =
        parsedResponse.deck_assessment.issues.map((issue: string) =>
          sanitizeAiCardText(issue, allowedCardNames, allCardNames),
        );
    }
    if (parsedResponse.deck_assessment?.strengths) {
      parsedResponse.deck_assessment.strengths =
        parsedResponse.deck_assessment.strengths.map((strength: string) =>
          sanitizeAiCardText(strength, allowedCardNames, allCardNames),
        );
    }
    if (Array.isArray(parsedResponse.suggestions)) {
      parsedResponse.suggestions = parsedResponse.suggestions.map(
        (sug: any) => ({
          ...sug,
          reason: sanitizeAiCardText(
            sug.reason || "",
            allowedCardNames,
            allCardNames,
          ),
        }),
      );
    }

    // Post-process to replace "this card" with actual card names
    parsedResponse = replaceThisCardWithActualNames(parsedResponse);

    // Validate suggested card names
    if (
      parsedResponse.suggestions &&
      Array.isArray(parsedResponse.suggestions)
    ) {
      const recommendedNames = parsedResponse.suggestions.map(
        (rec: any) => rec.card_name,
      );

      const nameConditions = recommendedNames
        .map((name: string) => {
          const escapedName = name.replace(/[%_\\]/g, "\\$&");
          return `name.ilike.${escapedName}`;
        })
        .join(",");

      const { data: validatedCards } = await supabase
        .from("cards")
        .select(
          "id, name, type, desc, level, race, attribute, archetype, card_images, atk, def, misc_info, card_sets, card_prices",
        )
        .or(nameConditions)
        .limit(recommendedNames.length * 2);

      if (validatedCards) {
        const normalizedValidatedCards = validatedCards.map((card: any) => ({
          ...card,
          archetype: getArchetypeNameServer(card),
        }));

        const nameMap = new Map(
          normalizedValidatedCards.map((card: Card) => [
            card.name.toLowerCase(),
            card,
          ]),
        );

        parsedResponse.suggestions = parsedResponse.suggestions
          .map((rec: any) => {
            const card = nameMap.get(rec.card_name.toLowerCase());
            return {
              ...rec,
              card_data: card || null,
            };
          })
          .filter((rec: any) => rec.card_data !== null); // Only keep validated cards
      }
    }

    // Calculate token usage (approximate)
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(rawContent.length / 4);
    const totalTokens = inputTokens + outputTokens;
    // Rough cost estimate (adjust based on actual Groq pricing)
    const estimatedCostUSD = (totalTokens / 1000000) * 0.27; // Example: $0.27 per 1M tokens

    return new Response(
      JSON.stringify({
        ...parsedResponse,
        deck_stats: deckStats,
        estimated_cost: {
          tokens_used: totalTokens,
          cost_usd: estimatedCostUSD,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
