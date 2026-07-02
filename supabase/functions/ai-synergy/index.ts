import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveGroqModel } from "../_shared/groq-model.ts";

type Card = {
  id: number;
  name: string;
  type: string;
  desc: string;
  level?: number;
  race?: string;
  attribute?: string;
  archetype?: string;
  atk?: number | string;
  def?: number | string;
  card_images?: Array<{
    id: number;
    image_url: string;
    image_url_small: string;
  }>;
  misc_info?: any[];
  card_sets?: any[];
  card_prices?: any[];
};

interface MasterDuelBanlistEntry {
  card_name: string;
  ban_status: string;
}

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const MODEL_NAME = resolveGroqModel();

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

// Helper: safely extract archetype as string (never returns [object Object])
function getArchetypeNameServer(card: { archetype?: any }): string {
  const raw = card?.archetype;

  // No archetype at all
  if (!raw) return "";

  // If it's already a clean string
  if (typeof raw === "string") {
    // Guard against literal "[object Object]"
    if (raw.trim() === "[object Object]") return "";
    return raw;
  }

  // If it's an object with a name property
  if (typeof raw === "object" && typeof raw.name === "string") {
    const name = raw.name.trim();
    if (name === "[object Object]") return "";
    return name;
  }

  // Any other weird case: never surface it
  return "";
}

/**
 * Sanitize AI text so that:
 * - Any "[object Object]" is removed/replaced.
 * - Any multi-word "card-like" name not in allowedCardNames is replaced with "this card".
 *
 * allowedCardNames must be full, real card names (deck + candidate pool).
 */
function sanitizeAiCardText(
  content: string,
  allowedCardNames: string[],
): string {
  // 1) Remove raw [object Object] artifacts
  let cleaned = content.replace(/\[object Object\]/g, "this archetype");

  if (!allowedCardNames || allowedCardNames.length === 0) {
    return cleaned;
  }

  const allowed = new Set(allowedCardNames.map((n) => n.toLowerCase()));

  // 2) Replace invented multi-word card-like names.
  // Pattern: Two or more capitalized words in a row (e.g. "Mystic Tomahawk")
  const cardLikeRegex =
    /\b([A-Z][A-Za-z0-9'&-]+(?:\s+[A-Z][A-Za-z0-9'&-]+)+)\b/g;

  cleaned = cleaned.replace(cardLikeRegex, (match) => {
    const normalized = match.trim().toLowerCase();
    if (allowed.has(normalized)) return match;
    // Not in allowed list → replace with a generic phrase
    return "this card";
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
      console.error("Error loading Master Duel banlist from Supabase:", error);
      return {};
    }

    if (!data || data.length === 0) {
      console.warn("No Master Duel banlist data found in Supabase");
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

// Find related cards by archetype match
async function findRelatedByArchetype(
  supabaseClient: any,
  selectedCards: Card[],
  excludeIds: number[],
): Promise<Card[]> {
  // CRITICAL: Use getArchetypeNameServer to normalize archetypes before querying
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

  // CRITICAL: Normalize archetype in returned cards
  return (data || [])
    .filter((card: Card) => getArchetypeNameServer(card))
    .map((card: any) => ({
      ...card,
      archetype: getArchetypeNameServer(card), // Normalize archetype
    }));
}

// Find related cards by type/subtype match
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

  // CRITICAL: Normalize archetype in returned cards
  return (data || []).map((card: any) => ({
    ...card,
    archetype: getArchetypeNameServer(card), // Normalize archetype
  }));
}

// Find related cards by keyword similarity in effect text
async function findRelatedByKeywords(
  supabaseClient: any,
  selectedCards: Card[],
  excludeIds: number[],
): Promise<Card[]> {
  // Extract keywords from selected card descriptions
  const keywords = new Set<string>();
  selectedCards.forEach((card) => {
    if (card.desc) {
      // Extract common effect keywords
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

  // Use full-text search if available, otherwise fallback to simple matching
  try {
    const keywordArray = Array.from(keywords);
    const searchQuery = keywordArray.slice(0, 5).join(" "); // Limit to avoid query size issues

    const { data: matches, error: matchError } = await supabaseClient.rpc(
      "match_cards_by_text",
      {
        query: searchQuery,
        match_count: 50,
        excluded_ids: excludeIds.length > 0 ? excludeIds : [0],
        banlist_format: "MASTER_DUEL", // Default, can be made configurable
      },
    );

    if (matchError) {
      console.error("Error in match_cards_by_text:", matchError);
      return [];
    }

    // CRITICAL: Normalize archetype when mapping from database
    return (matches || []).map((m: any) => {
      const normalizedCard = {
        id: m.card_id,
        name: m.name,
        type: m.type,
        desc: m.desc,
        level: undefined,
        race: m.race,
        attribute: m.attribute,
        archetype: m.archetype, // Will be normalized below
      };
      return {
        ...normalizedCard,
        archetype: getArchetypeNameServer(normalizedCard), // Normalize archetype immediately
      };
    });
  } catch (err) {
    console.error("Error finding related cards by keywords:", err);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
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

    // Parse request body
    const { selectedCards, userGoal } = await req.json();

    if (
      !selectedCards ||
      !Array.isArray(selectedCards) ||
      selectedCards.length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "selectedCards must be a non-empty array." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch selected card entries from cards table
    const cardIds = selectedCards
      .filter(
        (item: string | number): item is number => typeof item === "number",
      )
      .map((id: number) => id);

    const cardNames = selectedCards.filter(
      (item: string | number): item is string => typeof item === "string",
    );

    let selectedCardData: Card[] = [];

    if (cardIds.length > 0) {
      const { data: cardsById, error: idError } = await supabase
        .from("cards")
        .select("id, name, type, desc, level, race, attribute, archetype")
        .in("id", cardIds);

      if (!idError && cardsById) {
        // CRITICAL: Normalize archetype when mapping from database
        const normalizedCards = cardsById.map((card: any) => ({
          ...card,
          archetype: getArchetypeNameServer(card), // Normalize archetype
        }));
        selectedCardData.push(...normalizedCards);
      }
    }

    if (cardNames.length > 0) {
      // Build OR conditions for name matching
      const nameConditions = cardNames
        .map((name: string) => {
          const escapedName = name.replace(/[%_\\]/g, "\\$&");
          return `name.ilike.${escapedName}`;
        })
        .join(",");

      const { data: cardsByName, error: nameError } = await supabase
        .from("cards")
        .select("id, name, type, desc, level, race, attribute, archetype")
        .or(nameConditions)
        .limit(cardNames.length * 2); // Allow for multiple matches

      if (!nameError && cardsByName) {
        // Filter to exact matches (case-insensitive)
        const nameSet = new Set(cardNames.map((n: string) => n.toLowerCase()));
        const exactMatches = cardsByName
          .filter((card: Card) => nameSet.has(card.name.toLowerCase()))
          .map((card: any) => ({
            ...card,
            archetype: getArchetypeNameServer(card), // Normalize archetype
          }));
        selectedCardData.push(...exactMatches);
      }
    }

    // Deduplicate selected cards
    selectedCardData = onlyUniqueByName(selectedCardData);

    if (selectedCardData.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid cards found for selectedCards." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const excludeIds = selectedCardData.map((c) => c.id);

    // Fetch related cards using multiple strategies
    const [relatedByArchetype, relatedByType, relatedByKeywords] =
      await Promise.all([
        findRelatedByArchetype(supabase, selectedCardData, excludeIds),
        findRelatedByType(supabase, selectedCardData, excludeIds),
        findRelatedByKeywords(supabase, selectedCardData, excludeIds),
      ]);

    // Combine and deduplicate related cards
    const allRelated = [
      ...relatedByArchetype,
      ...relatedByType,
      ...relatedByKeywords,
    ];

    // Load banlist data
    const banlist = await loadMasterDuelBanlist(supabase);

    // CRITICAL: Filter forbidden cards from related cards
    const banlistMap = new Map<string, string>(Object.entries(banlist));
    const filteredRelated = allRelated.filter((card: Card) => {
      const ban = banlistMap.get(card.name) || "Unlimited";
      return ban !== "Forbidden";
    });

    const relatedCards = onlyUniqueByName(filteredRelated).slice(0, 60);

    // Build structured prompt
    const selectedCardsText = selectedCardData
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

    const banlistText = Object.entries(banlist)
      .filter(([, status]) => status === "Forbidden" || status === "Limited")
      .slice(0, 30)
      .map(([name, status]) => `${name}: ${status}`)
      .join("\n");

    // Build allowedCardNames whitelist for sanitization
    const selectedCardNames = selectedCardData.map((card) => card.name);
    const relatedCardNames = relatedCards.map((card) => card.name);
    const allowedCardNames = Array.from(
      new Set([...selectedCardNames, ...relatedCardNames].map((n) => n.trim())),
    );

    const prompt = `You are an expert Yu-Gi-Oh! Master Duel synergy analyst. Analyze the selected cards and identify synergies, combos, and strategic interactions.

Deck Name Rule:
- Do NOT rename, restyle, or invent a new name for any deck.
- Refer to decks only as "this deck" or "the current deck".
- Do NOT output deck titles. Only provide synergy analysis.

Selected Cards:
${selectedCardsText}

Related Card Options (matching archetype, type, or keywords):
${relatedCardsText || "None found"}

Banlist Restrictions:
${banlistText || "No major restrictions"}

User Goal: ${userGoal || "General synergy analysis"}

Instructions:
1. Analyze synergies between the selected cards
2. Identify potential combos and interactions
3. Suggest related cards from the "Related Card Options" that would enhance the synergy
4. Consider banlist restrictions when making suggestions
5. Return your analysis as valid JSON with this exact schema:

{
  "synergy_analysis": {
    "overview": "string - overall synergy assessment",
    "key_interactions": ["string - list of key card interactions"],
    "combo_opportunities": ["string - list of combo opportunities"],
    "strengths": ["string - list of strengths"],
    "weaknesses": ["string - list of weaknesses"]
  },
  "recommended_cards": [
    {
      "card_name": "string - exact card name from Related Card Options",
      "reason": "string - why this card enhances synergy",
      "priority": "high" | "medium" | "low"
    }
  ],
  "strategic_notes": "string - additional strategic insights"
}

STRONG RULES (MUST FOLLOW):
- You MUST ONLY mention or recommend cards that are in:
  - The selected cards list, or
  - The "Related Card Options" list above.
- You MUST NOT invent or rename any card.
- If you think of a card that is not in the allowed lists, DO NOT mention it.
- NEVER output invented names like "Mystic Tomahawk" or any other made-up card.
- Refer to decks only as "this deck" or "the current deck"; do not rename them.
- IMPORTANT: Only recommend cards that exist in the "Related Card Options" list. Do not invent card names.`;

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
    const rawContent =
      result.choices?.[0]?.message?.content || "No response from AI.";

    // Sanitize AI text: remove [object Object] and replace invented card names
    const aiContent = sanitizeAiCardText(rawContent, allowedCardNames);

    // Parse JSON output safely
    let parsedSynergy: any = null;
    try {
      // Remove markdown code blocks if present
      let jsonContent = aiContent.trim();
      if (jsonContent.startsWith("```")) {
        const lines = jsonContent.split("\n");
        lines.shift(); // Remove first line
        if (lines[lines.length - 1].trim() === "```") {
          lines.pop(); // Remove last line
        }
        jsonContent = lines.join("\n");
      }
      parsedSynergy = JSON.parse(jsonContent);

      // Sanitize text fields in parsedSynergy
      if (parsedSynergy?.synergy_analysis) {
        if (parsedSynergy.synergy_analysis.overview) {
          parsedSynergy.synergy_analysis.overview = sanitizeAiCardText(
            parsedSynergy.synergy_analysis.overview,
            allowedCardNames,
          );
        }
        if (Array.isArray(parsedSynergy.synergy_analysis.key_interactions)) {
          parsedSynergy.synergy_analysis.key_interactions =
            parsedSynergy.synergy_analysis.key_interactions.map(
              (text: string) => sanitizeAiCardText(text, allowedCardNames),
            );
        }
        if (Array.isArray(parsedSynergy.synergy_analysis.combo_opportunities)) {
          parsedSynergy.synergy_analysis.combo_opportunities =
            parsedSynergy.synergy_analysis.combo_opportunities.map(
              (text: string) => sanitizeAiCardText(text, allowedCardNames),
            );
        }
        if (Array.isArray(parsedSynergy.synergy_analysis.strengths)) {
          parsedSynergy.synergy_analysis.strengths =
            parsedSynergy.synergy_analysis.strengths.map((text: string) =>
              sanitizeAiCardText(text, allowedCardNames),
            );
        }
        if (Array.isArray(parsedSynergy.synergy_analysis.weaknesses)) {
          parsedSynergy.synergy_analysis.weaknesses =
            parsedSynergy.synergy_analysis.weaknesses.map((text: string) =>
              sanitizeAiCardText(text, allowedCardNames),
            );
        }
      }
      if (parsedSynergy?.strategic_notes) {
        parsedSynergy.strategic_notes = sanitizeAiCardText(
          parsedSynergy.strategic_notes,
          allowedCardNames,
        );
      }
      if (Array.isArray(parsedSynergy?.recommended_cards)) {
        parsedSynergy.recommended_cards = parsedSynergy.recommended_cards.map(
          (rec: any) => ({
            ...rec,
            reason: sanitizeAiCardText(rec.reason || "", allowedCardNames),
          }),
        );
      }
    } catch (parseError) {
      console.error("Error parsing synergy JSON:", parseError);
      return new Response(
        JSON.stringify({
          error: "Failed to parse AI response as JSON.",
          raw_response: aiContent,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate recommended card names against database
    if (
      parsedSynergy &&
      parsedSynergy.recommended_cards &&
      Array.isArray(parsedSynergy.recommended_cards)
    ) {
      const recommendedNames = parsedSynergy.recommended_cards.map(
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

      // Filter to exact matches and attach full card data
      if (validatedCards) {
        // CRITICAL: Normalize archetype in validated cards
        const normalizedValidatedCards = validatedCards.map((card: any) => ({
          ...card,
          archetype: getArchetypeNameServer(card), // Normalize archetype
        }));

        const nameMap = new Map(
          normalizedValidatedCards.map((card: Card) => [
            card.name.toLowerCase(),
            card,
          ]),
        );

        parsedSynergy.recommended_cards = parsedSynergy.recommended_cards.map(
          (rec: any) => {
            const card = nameMap.get(rec.card_name.toLowerCase());
            return {
              ...rec,
              card_data: card || null,
            };
          },
        );
      }
    }

    return new Response(
      JSON.stringify({
        synergy_data: parsedSynergy,
        selected_cards: selectedCardData,
        related_cards: relatedCards,
        banlist: banlist,
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
