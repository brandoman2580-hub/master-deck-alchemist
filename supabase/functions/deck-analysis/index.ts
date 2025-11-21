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
  archetype?: string;
};

type CardWithCounts = Card & {
  main: number;
  side: number;
  extra: number;
  totalCount: number;
};

type IdCounts = {
  [cardId: number]: {
    main: number;
    side: number;
    extra: number;
  };
};

type DeckStats = {
  mainCount: number;
  extraCount: number;
  sideCount: number;
  monsterCount: number;
  spellCount: number;
  trapCount: number;
  averageLevel?: number;
  archetypeCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  attributeCounts: Record<string, number>;
};

type AnalysisType =
  | "summary"
  | "power_level"
  | "consistency"
  | "resilience"
  | "matchup"
  | "complexity"
  | "card_suggestions";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const MODEL_NAME = Deno.env.get("MODEL_NAME");

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

// Helper: extract meaningful search terms from text
function extractSearchTerms(text: string): string[] {
  if (!text) return [];

  const STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "of", "for", "with", "to", "in", "on", "this", "that", "it",
    "my", "your", "their", "our", "is", "are", "be", "can", "could", "would", "should",
    "deck", "cards", "card", "build", "add", "run", "good", "better", "more", "less",
    "help", "support", "engine", "please", "need", "want", "like"
  ]);

  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

  const unique: string[] = [];
  for (const t of tokens) {
    if (!unique.includes(t)) unique.push(t);
    if (unique.length >= 8) break; // cap terms
  }
  return unique;
}

// Helper: build search query string from question and deck metadata
function buildCardSearchQuery(params: {
  question: string;
  deckArchetypes: Set<string>;
  deckTypes: Set<string>;
  deckAttributes: Set<string>;
}): string {
  const { question, deckArchetypes, deckTypes, deckAttributes } = params;

  const coreTerms = extractSearchTerms(question);
  const archetypes = [...deckArchetypes].map((s) => s.toLowerCase());
  const types = [...deckTypes].map((s) => s.toLowerCase());
  const attrs = [...deckAttributes].map((s) => s.toLowerCase());

  const allTerms = [...coreTerms, ...archetypes, ...types, ...attrs];

  if (!allTerms.length) {
    return question || ""; // fallback; plainto_tsquery will handle this
  }

  // Join into a plain-text query; plainto_tsquery will tokenize it
  return allTerms.join(" ");
}

// Helper: truncate card descriptions to keep prompts small
function truncateDesc(desc: string, maxLen = 220): string {
  if (!desc) return "";
  return desc.length > maxLen ? desc.slice(0, maxLen) + "..." : desc;
}

// Compute deck statistics
function computeDeckStats(cards: CardWithCounts[]): DeckStats {
  let mainCount = 0;
  let extraCount = 0;
  let sideCount = 0;
  let monsterCount = 0;
  let spellCount = 0;
  let trapCount = 0;
  let totalLevel = 0;
  let levelCount = 0;
  const archetypeCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const attributeCounts: Record<string, number> = {};

  for (const card of cards) {
    mainCount += card.main;
    extraCount += card.extra;
    sideCount += card.side;

    // Count by card type
    const cardType = card.type?.toLowerCase() || "";
    if (cardType.includes("monster")) {
      monsterCount += card.totalCount;
    } else if (cardType.includes("spell")) {
      spellCount += card.totalCount;
    } else if (cardType.includes("trap")) {
      trapCount += card.totalCount;
    }

    // Average level calculation (only for monsters with levels)
    if (card.level !== undefined && card.level !== null && cardType.includes("monster")) {
      totalLevel += card.level * card.totalCount;
      levelCount += card.totalCount;
    }

    // Archetype counts
    if (card.archetype) {
      archetypeCounts[card.archetype] = (archetypeCounts[card.archetype] || 0) + card.totalCount;
    }

    // Type counts (race)
    if (card.race) {
      typeCounts[card.race] = (typeCounts[card.race] || 0) + card.totalCount;
    }

    // Attribute counts
    if (card.attribute) {
      attributeCounts[card.attribute] = (attributeCounts[card.attribute] || 0) + card.totalCount;
    }
  }

  return {
    mainCount,
    extraCount,
    sideCount,
    monsterCount,
    spellCount,
    trapCount,
    averageLevel: levelCount > 0 ? totalLevel / levelCount : undefined,
    archetypeCounts,
    typeCounts,
    attributeCounts,
  };
}

// --- Banlist Helpers ---

interface MasterDuelBanlistEntry {
  card_name: string;
  ban_status: string;
}

// Master Duel - fetch from Supabase master_duel_banlist table
async function loadMasterDuelBanlist(supabaseClient: any): Promise<Record<string, string>> {
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

// TCG - fetch from online API (adapted from your function)
async function fetchTCGBanlist(): Promise<Record<string, string>> {
  const url = "https://db.ygoprodeck.com/api/v7/cardinfo.php?banlist=tcg";
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    const data = await resp.json();
    const banlist: Record<string, string> = {};
    for (const card of data.data) {
      if (card.banlist_info && card.banlist_info.ban_tcg) {
        banlist[card.name] = card.banlist_info.ban_tcg as string;
      }
    }
    return banlist;
  } catch (err) {
    console.error("Error fetching TCG banlist:", err);
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
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

    // --- Parse request (add format param and analysis_type) ---
    const {
      question,
      deck_id,
      banlist_format = "TCG",
      analysis_type = "summary",
    } = await req.json();

    // Validate analysis_type
    const validAnalysisTypes: AnalysisType[] = [
      "summary",
      "power_level",
      "consistency",
      "resilience",
      "matchup",
      "complexity",
      "card_suggestions",
    ];
    if (!validAnalysisTypes.includes(analysis_type as AnalysisType)) {
      return new Response(
        JSON.stringify({ error: "Invalid analysis_type." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!deck_id) {
      return new Response(JSON.stringify({ error: "Missing deck ID." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Load banlist ---
    let banlist: Record<string, string> = {};
    if (banlist_format === "MASTER_DUEL") {
      banlist = await loadMasterDuelBanlist(supabase);
    } else if (banlist_format === "TCG") {
      banlist = await fetchTCGBanlist();
      // Consider caching this in Supabase or memory to prevent rate limiting
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid banlist format." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- Deck loading ---
    const { data: deckData, error: deckErr } = await supabase
      .from("decks")
      .select("cards, name")
      .eq("id", deck_id)
      .eq("user_id", user.id)
      .single();

    if (deckErr || !deckData) {
      return new Response(JSON.stringify({ error: "Could not find deck." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deckCardsBySection = deckData.cards as {
      main: (number | { id: number })[] | number[];
      side: (number | { id: number })[] | number[];
      extra: (number | { id: number })[] | number[];
    };

    // Helper function to extract card ID (handles both number and object formats)
    const getCardId = (item: number | { id: number }): number => {
      return typeof item === "number" ? item : item.id;
    };

    // Extract card IDs from all sections (handles both formats)
    const mainCardIds = (deckCardsBySection.main || []).map(getCardId);
    const sideCardIds = (deckCardsBySection.side || []).map(getCardId);
    const extraCardIds = (deckCardsBySection.extra || []).map(getCardId);
    
    const allDeckCardIds = [
      ...mainCardIds,
      ...sideCardIds,
      ...extraCardIds,
    ];

    // --- Build idCounts map (card-copy tracking) ---
    const idCounts: IdCounts = {};
    for (const cardId of mainCardIds) {
      if (!idCounts[cardId]) {
        idCounts[cardId] = { main: 0, side: 0, extra: 0 };
      }
      idCounts[cardId].main++;
    }
    for (const cardId of sideCardIds) {
      if (!idCounts[cardId]) {
        idCounts[cardId] = { main: 0, side: 0, extra: 0 };
      }
      idCounts[cardId].side++;
    }
    for (const cardId of extraCardIds) {
      if (!idCounts[cardId]) {
        idCounts[cardId] = { main: 0, side: 0, extra: 0 };
      }
      idCounts[cardId].extra++;
    }

    // --- Fetch deck card details ---
    const { data: deckCardDetails } = await supabase
      .from("cards")
      .select("id, name, type, desc, level, race, attribute, archetype")
      .in("id", allDeckCardIds);

    // Remove forbidden cards from deck (optional: or just warn user in prompt)
    const deckCardsFiltered = (deckCardDetails ?? []).filter(
      (card) => banlist[card.name] !== "Forbidden"
    );

    // --- Enrich cards with counts ---
    const safeDeckCards: CardWithCounts[] = deckCardsFiltered.map((card) => {
      const counts = idCounts[card.id] || { main: 0, side: 0, extra: 0 };
      return {
        ...card,
        main: counts.main,
        side: counts.side,
        extra: counts.extra,
        totalCount: counts.main + counts.side + counts.extra,
      };
    });

    // --- Context builder: archetypes/types/attributes for pool filtering ---
    const deckArchetypes = new Set(
      safeDeckCards.map((c) => c.archetype).filter((a): a is string => Boolean(a))
    );
    const deckTypes = new Set(
      safeDeckCards.map((c) => c.type).filter((t): t is string => Boolean(t))
    );
    const deckAttributes = new Set(
      safeDeckCards.map((c) => c.attribute).filter((a): a is string => Boolean(a))
    );

    // --- Card pool selection: FTS for card_suggestions, filters for others ---
    let relevantCards: Card[] = [];

    if (analysis_type === "card_suggestions") {
      // Build search query string for full-text search
      const searchQuery = buildCardSearchQuery({
        question: question ?? "",
        deckArchetypes,
        deckTypes,
        deckAttributes,
      });

      const matchCount = 80;
      const excludedIds = allDeckCardIds.length ? allDeckCardIds : [0];

      const { data: matches, error: matchError } = await supabase.rpc(
        "match_cards_by_text",
        {
          query: searchQuery,
          match_count: matchCount,
          excluded_ids: excludedIds,
          banlist_format,
        }
      );

      if (matchError) {
        console.error("Error in match_cards_by_text:", matchError);
      }

      const pool = (matches ?? []).map((m: any) => ({
        id: m.card_id,
        name: m.name,
        type: m.type,
        desc: m.desc,
        level: undefined,
        race: m.race,
        attribute: m.attribute,
        archetype: m.archetype,
      }));

      // Additional safety filter using the existing banlist map
      const filtered = pool.filter((card: Card) => banlist[card.name] !== "Forbidden");

      relevantCards = onlyUniqueByName(filtered).slice(0, 50);
    } else {
      // Existing logic for summary/power_level/etc.
      const filterParts = [
        deckArchetypes.size
          ? `archetype.in.(${[...deckArchetypes].map((s) => `"${s}"`).join(",")})`
          : undefined,
        deckTypes.size
          ? `type.in.(${[...deckTypes].map((s) => `"${s}"`).join(",")})`
          : undefined,
        deckAttributes.size
          ? `attribute.in.(${[...deckAttributes].map((s) => `"${s}"`).join(",")})`
          : undefined,
      ].filter(Boolean);

      let query = supabase
        .from("cards")
        .select("id, name, type, desc, level, race, attribute, archetype")
        .not("id", "in", `(${allDeckCardIds.join(",")})`);

      if (filterParts.length) {
        query = query.or(filterParts.join(","));
      }

      let { data: relevantPoolCards } = await query
        .order("name", { ascending: true })
        .limit(60);

      relevantPoolCards = (relevantPoolCards ?? []).filter(
        (card) => banlist[card.name] !== "Forbidden"
      );

      relevantCards = onlyUniqueByName(relevantPoolCards).slice(0, 50);
    }

    // --- Compute deck statistics ---
    const deckStats = computeDeckStats(safeDeckCards);

    // --- Compute free slots for suggestions ---
    const mainFreeSlots = Math.max(0, 60 - deckStats.mainCount);
    const extraFreeSlots = Math.max(0, 15 - deckStats.extraCount);
    const suggestionConstraints = `
Deck capacity:
- Main deck count: ${deckStats.mainCount} (free slots until 60: ${mainFreeSlots})
- Extra deck count: ${deckStats.extraCount} (free slots until 15: ${extraFreeSlots})
`;

    // --- Build structured deck-stats summary ---
    const topArchetypes = Object.entries(deckStats.archetypeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ");

    const topTypes = Object.entries(deckStats.typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ");

    const topAttributes = Object.entries(deckStats.attributeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ");

    const featureSummary = `
Deck stats:
- Main Deck: ${deckStats.mainCount}
  - Monsters: ${deckStats.monsterCount}
  - Spells: ${deckStats.spellCount}
  - Traps: ${deckStats.trapCount}
- Extra Deck: ${deckStats.extraCount}
- Side Deck: ${deckStats.sideCount}
- Average Level: ${deckStats.averageLevel?.toFixed(2) ?? "N/A"}
- Top Archetypes: ${topArchetypes || "None"}
- Top Types: ${topTypes || "None"}
- Top Attributes: ${topAttributes || "None"}
`;

    // --- Prompt context assembly ---
    const deckSummary = `
Format: ${banlist_format}
Deck Name: ${deckData.name}
Key cards: ${safeDeckCards
      .slice(0, 12)
      .map((c) => `${c.name} (x${c.totalCount})`)
      .join(", ")}
Archetypes: ${[...deckArchetypes].join(", ")}
Types: ${[...deckTypes].join(", ")}
Attributes: ${[...deckAttributes].join(", ")}
`;

    const deckDetailContext = safeDeckCards
      .slice(0, 10)
      .map(
        (card) =>
          `${card.name} (x${card.totalCount}) [Main: ${card.main}, Side: ${card.side}, Extra: ${card.extra}] (${card.type}${
            card.archetype ? ", " + card.archetype : ""
          }): ${card.desc}`
      )
      .join("\n\n");

    const relevantCardsContext = relevantCards
      .map(
        (card: Card) =>
          `${card.name} (${card.type}${
            card.archetype ? ", " + card.archetype : ""
          }): ${truncateDesc(card.desc)}`
      )
      .join("\n\n");

    // --- Mode-aware analysis instructions ---
    const analysisInstructions = `
You must adapt your output based on the requested analysis_type: "${analysis_type}".

1) If analysis_type === "summary":
   - Return the full multi-dimensional analysis as BEFORE, with this JSON schema:

   {
     "overview": string,
     "strategic_identity": { "playstyle": string, "description": string },
     "power_level": { "score": number, "explanation": string, "suggestions": string[] },
     "consistency": { "score": number, "explanation": string, "suggestions": string[] },
     "resilience_and_grind": { "score": number, "explanation": string, "suggestions": string[] },
     "matchup_profile": { "score": number, "explanation": string, "suggestions": string[] },
     "complexity_and_skill": {
       "score": number,
       "explanation": string,
       "skill_floor": string,
       "skill_ceiling": string
     },
     "illegal_cards": { "forbidden": string[], "notes": string }
   }

2) If analysis_type === "power_level":
   - Focus ONLY on power-level-related content.
   - Minimal JSON schema:

   {
     "power_level": {
       "score": number,
       "explanation": string,
       "suggestions": string[]
     }
   }

3) If analysis_type === "consistency":
   - Focus ONLY on consistency-related content.
   - JSON schema:

   {
     "consistency": {
       "score": number,
       "explanation": string,
       "suggestions": string[]
     }
   }

4) If analysis_type === "resilience":
   - Focus ONLY on resilience/grind-game content.
   - JSON schema:

   {
     "resilience_and_grind": {
       "score": number,
       "explanation": string,
       "suggestions": string[]
     }
   }

5) If analysis_type === "matchup":
   - Focus ONLY on matchup-related content.
   - JSON schema:

   {
     "matchup_profile": {
       "score": number,
       "explanation": string,
       "suggestions": string[]
     }
   }

6) If analysis_type === "complexity":
   - Focus ONLY on complexity/skill content.
   - JSON schema:

   {
     "complexity_and_skill": {
       "score": number,
       "explanation": string,
       "skill_floor": string,
       "skill_ceiling": string
     }
   }

7) If analysis_type === "card_suggestions":
   - Your job is to use ONLY the provided legal card pool and the deck context to suggest cards that can be added to the current deck.
   - Respect the deck capacity (do not suggest more cards than there are free slots).
   - Suggested cards MUST be drawn only from:
     - "Relevant legal pool cards" (the non-deck pool context)
   - You MUST return JSON with this schema:

   {
     "suggested_cards": [
       {
         "card_name": string,
         "section": "main" | "side" | "extra",
         "reason": string
       }
     ],
     "notes": string
   }

   - Prefer adding cards to the "main" section unless the user question clearly indicates side or extra deck.
   - Focus only on cards that improve the requested feature(s) described in the user question (power, consistency, resilience, etc.), and explain WHY each card helps.

For ALL analysis_type values:
- Respond with strict JSON only. No markdown.
- Do NOT include any fields outside the specified schema for the given analysis_type.
`;

    const prompt = `
You are an expert Yu-Gi-Oh! ${
      banlist_format === "MASTER_DUEL" ? "Master Duel" : "TCG"
    } deckbuilder. Enforce card legality for the chosen format.

Deck summary:
${deckSummary}

Computed stats:
${featureSummary}

Deck capacity:
${suggestionConstraints}

Key deck cards (with copies and effects):
${deckDetailContext}

Relevant legal pool cards ('not in deck', matching deck archetype/type/attribute):
${relevantCardsContext}

User question:
${question}

Requested analysis_type: "${analysis_type}"

${analysisInstructions}
`;

    // --- LLM call ---
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
    const aiContent =
      result.choices?.[0]?.message?.content || "No response from AI.";
    const requestsLeft = Number(
      groqResponse.headers.get("x-ratelimit-remaining-requests")
    );
    const maxRequests = Number(
      groqResponse.headers.get("x-ratelimit-limit-requests")
    );

    // --- Parse JSON from LLM response ---
    let parsedAnalysis = null;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonContent = aiContent.trim();
      // Remove markdown code blocks if present
      if (jsonContent.startsWith("```")) {
        const lines = jsonContent.split("\n");
        lines.shift(); // Remove first line (```json or ```)
        if (lines[lines.length - 1].trim() === "```") {
          lines.pop(); // Remove last line (```)
        }
        jsonContent = lines.join("\n");
      }
      parsedAnalysis = JSON.parse(jsonContent);
    } catch {
      parsedAnalysis = null;
    }

    return new Response(
      JSON.stringify({
        user,
        analysis_type,
        raw_answer: aiContent,
        structured_analysis: parsedAnalysis,
        deck_cards: safeDeckCards,
        relevant_card_pool: relevantCards,
        banned_in_deck:
          deckCardDetails &&
          deckCardDetails
            .filter((card) => banlist[card.name] === "Forbidden")
            .map((card) => card.name),
        deck_stats: deckStats,
        requests_left: requestsLeft,
        max_requests: maxRequests,
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
