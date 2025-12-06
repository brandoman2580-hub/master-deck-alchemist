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
const MAX_SIMULATIONS = 20;

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
    console.error("Error in loadMasterDuelBanlist:", err);
    return {};
  }
}

// Fetch TCG banlist from external API
async function fetchTCGBanlist(): Promise<Record<string, string>> {
  try {
    const response = await fetch("https://www.yugioh-card.com/en/limited/");
    if (!response.ok) return {};
    await response.text(); // Fetch the text but don't use it yet (placeholder for future parsing)
    // Simple parsing - in production, use proper HTML parsing
    const banlist: Record<string, string> = {};
    // This is a placeholder - implement proper TCG banlist parsing
    return banlist;
  } catch (err) {
    console.error("Error fetching TCG banlist:", err);
    return {};
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

// Build deck composition text for prompt
function buildDeckCompositionText(
  deck: {
    mainDeck: Card[];
    extraDeck: Card[];
    sideDeck: Card[];
  },
  deckName: string,
): string {
  const stats = calculateDeckStats(deck);
  const mainDeckText = deck.mainDeck
    .slice(0, 40) // Limit to first 40 for prompt size
    .map((card) => {
      const archetypeName = getArchetypeNameServer(card);
      return `- ${card.name} (${card.type}${archetypeName ? ", " + archetypeName : ""})`;
    })
    .join("\n");

  const extraDeckText = deck.extraDeck
    .map((card) => {
      const archetypeName = getArchetypeNameServer(card);
      return `- ${card.name} (${card.type}${archetypeName ? ", " + archetypeName : ""})`;
    })
    .join("\n");

  const sideDeckText = deck.sideDeck
    .map((card) => {
      const archetypeName = getArchetypeNameServer(card);
      return `- ${card.name} (${card.type}${archetypeName ? ", " + archetypeName : ""})`;
    })
    .join("\n");

  // Create a clear list of card names for easy reference
  const allCardNamesList = [
    ...deck.mainDeck.map((c) => c.name),
    ...deck.extraDeck.map((c) => c.name),
    ...deck.sideDeck.map((c) => c.name),
  ].join(", ");

  return `
${deckName}:
Main Deck: ${stats.mainCount} cards (${stats.monsterCount} monsters, ${stats.spellCount} spells, ${stats.trapCount} traps)
Extra Deck: ${stats.extraCount} cards
Side Deck: ${stats.sideCount} cards
Primary Archetype: ${stats.primaryArchetype || "Mixed/None"}

Main Deck Cards:
${mainDeckText || "No cards"}

Extra Deck Cards:
${extraDeckText || "No cards"}

Side Deck Cards:
${sideDeckText || "No cards"}

CRITICAL: When referencing cards in your analysis, ALWAYS use the exact card names listed above. 
Available card names: ${allCardNamesList}
NEVER use generic terms like "this card" or "that card" - always use the actual card name.
`;
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

    // Check authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate user token
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
        },
      );
    }

    const {
      deck_a,
      deck_b,
      test_type = "matchup_analysis",
      num_simulations = 10,
      context = "",
      banlist_format = "MASTER_DUEL",
    } = await req.json();

    if (!deck_a || !deck_b) {
      return new Response(
        JSON.stringify({ error: "deck_a and deck_b are required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Enforce max simulations
    const simulations = Math.min(Math.max(1, num_simulations), MAX_SIMULATIONS);

    // Load banlist
    const banlist =
      banlist_format === "MASTER_DUEL"
        ? await loadMasterDuelBanlist(supabase)
        : await fetchTCGBanlist();

    const banlistText = Object.entries(banlist)
      .filter(([, status]) => status === "Forbidden" || status === "Limited")
      .slice(0, 30)
      .map(([name, status]) => `${name}: ${status}`)
      .join("\n");

    // Build deck composition texts
    const deckAText = buildDeckCompositionText(deck_a, deck_a.name || "Deck A");
    const deckBText = buildDeckCompositionText(deck_b, deck_b.name || "Deck B");

    // Get all card names from decks for sanitization
    const deckCardNames = Array.from(
      new Set(
        [
          ...deck_a.mainDeck.map((c) => c.name),
          ...deck_a.extraDeck.map((c) => c.name),
          ...deck_a.sideDeck.map((c) => c.name),
          ...deck_b.mainDeck.map((c) => c.name),
          ...deck_b.extraDeck.map((c) => c.name),
          ...deck_b.sideDeck.map((c) => c.name),
        ].map((n) => n.trim()),
      ),
    );

    // Fetch all card names from database for comprehensive sanitization
    // This ensures we don't replace valid card names that aren't in the decks
    let allCardNames = deckCardNames;
    try {
      const { data: allCards, error: cardError } = await supabase
        .from("cards")
        .select("name")
        .limit(10000); // Get a large sample of card names

      if (!cardError && allCards) {
        const dbCardNames = allCards
          .map((c: any) => c.name.trim())
          .filter(Boolean);
        allCardNames = Array.from(new Set([...deckCardNames, ...dbCardNames]));
      }
    } catch (err) {
      console.error("Error fetching card names for sanitization:", err);
      // Fall back to deck card names only
      allCardNames = deckCardNames;
    }

    // Build prompt based on test type
    let prompt = "";
    let responseSchema = "";

    if (test_type === "matchup_analysis") {
      prompt = `You are an expert Yu-Gi-Oh! matchup analyst. Analyze the matchup between two decks and provide comprehensive analytics.

${deckAText}

${deckBText}

Banlist Restrictions (${banlist_format}):
${banlistText || "No major restrictions"}

Format: ${banlist_format === "MASTER_DUEL" ? "Master Duel" : "TCG"}
${context ? `User Context: ${context}` : ""}

Provide a detailed matchup analysis including:
1. Overall matchup assessment with predicted win rates (going first, going second, overall)
2. Card effectiveness analysis - identify which cards are most impactful in this matchup
3. Matchup strengths and weaknesses - which archetypes/deck types this deck excels or struggles against
4. Side deck impact - which side deck cards improve this matchup and by how much
5. Resource usage metrics - draw consistency, resource depletion rate, recovery success

Return your analysis as valid JSON with this exact schema:`;

      responseSchema = `{
  "analysis": "string - comprehensive matchup analysis",
  "predicted_win_rate": number - 0-100 (overall),
  "matchup_assessment": {
    "deck_a_advantages": ["string - list of advantages"],
    "deck_b_advantages": ["string - list of advantages"],
    "key_factors": ["string - key factors affecting the matchup"],
    "difficulty_rating": "very_favorable" | "favorable" | "even" | "unfavorable" | "very_unfavorable"
  },
  "strategic_insights": {
    "going_first_strategy": "string - strategy when going first",
    "going_second_strategy": "string - strategy when going second",
    "key_plays": ["string - important plays to make"],
    "disruption_points": ["string - when and how to disrupt opponent"]
  },
  "matchup_analytics": {
    "win_rate_estimates": {
      "going_first": number - 0-100,
      "going_second": number - 0-100,
      "overall": number - 0-100
    },
    "card_effectiveness": [
      {
        "card_name": "string - exact card name",
        "impact_score": number - 0-100,
        "description": "string - why this card is effective",
        "frequency_mentioned": number - how often this card appears in key plays
      }
    ],
    "matchup_strengths": [
      {
        "archetype_or_deck_type": "string",
        "win_rate": number - 0-100,
        "reason": "string - why this matchup is favorable"
      }
    ],
    "matchup_weaknesses": [
      {
        "archetype_or_deck_type": "string",
        "win_rate": number - 0-100,
        "reason": "string - why this matchup is unfavorable"
      }
    ],
    "side_deck_impact": [
      {
        "card_name": "string - side deck card name",
        "matchup_improvement": number - 0-100,
        "description": "string - how this card improves the matchup"
      }
    ],
    "resource_usage": {
      "draw_consistency": number - 0-100,
      "resource_depletion_rate": "fast" | "medium" | "slow",
      "recovery_success_rate": number - 0-100,
      "description": "string - resource management analysis"
    }
  }
}`;
    } else if (test_type === "duel_simulation") {
      prompt = `You are an expert Yu-Gi-Oh! duel simulator. Simulate ${simulations} duels between two decks using AI reasoning.

${deckAText}

${deckBText}

Banlist Restrictions (${banlist_format}):
${banlistText || "No major restrictions"}

Format: ${banlist_format === "MASTER_DUEL" ? "Master Duel" : "TCG"}
${context ? `User Context: ${context}` : ""}

For each simulated duel, consider:
- Opening hands and combo potential
- Turn order (going first vs going second)
- Board states and interactions
- Resource management
- Win conditions
- Critical decision points
- Combo execution success
- Damage dealt per turn
- Game duration

Simulate ${simulations} duels and provide:
1. Overall analysis
2. Predicted win rate for Deck A
3. Matchup assessment
4. Strategic insights
5. Detailed simulation analytics including turn-by-turn progression, combo success rates, decision points, game duration stats, and damage trends

Return your analysis as valid JSON with this exact schema:`;

      responseSchema = `{
  "analysis": "string - overall simulation analysis",
  "predicted_win_rate": number - 0-100,
  "matchup_assessment": {
    "deck_a_advantages": ["string"],
    "deck_b_advantages": ["string"],
    "key_factors": ["string"],
    "difficulty_rating": "very_favorable" | "favorable" | "even" | "unfavorable" | "very_unfavorable"
  },
  "strategic_insights": {
    "going_first_strategy": "string",
    "going_second_strategy": "string",
    "key_plays": ["string"],
    "disruption_points": ["string"]
  },
  "simulation_analytics": {
    "games_simulated": ${simulations},
    "wins_deck_a": number,
    "wins_deck_b": number,
    "draws": number,
    "avg_turn_length": number,
    "common_outcomes": [
      {
        "outcome": "string - e.g., combo_win, brick_loss, grind_win",
        "frequency": number,
        "explanation": "string - why this outcome occurred"
      }
    ],
    "turn_by_turn_progression": [
      {
        "turn": number,
        "deck_a_state": "string - board state description",
        "deck_b_state": "string - board state description",
        "critical_play": "string - key play that happened"
      }
    ],
    "combo_success_rates": [
      {
        "combo_name": "string - name of combo",
        "success_rate": number - 0-100,
        "impact_on_win_rate": number - 0-100,
        "description": "string - combo description"
      }
    ],
    "decision_points": [
      {
        "turn": number,
        "decision": "string - decision made",
        "outcome": "string - result of decision",
        "alternative": "string - alternative play",
        "impact": "high" | "medium" | "low"
      }
    ],
    "game_duration_stats": {
      "fastest_win": number - turns,
      "slowest_win": number - turns,
      "average_duration": number - turns,
      "tempo": "fast" | "medium" | "slow"
    },
    "damage_trends": {
      "avg_damage_per_turn": number,
      "peak_damage_turn": number,
      "damage_consistency": number - 0-100,
      "description": "string - damage analysis"
    }
  },
  "simulation_results": {
    "games_simulated": ${simulations},
    "wins_deck_a": number,
    "wins_deck_b": number,
    "draws": number,
    "avg_turn_length": number,
    "common_outcomes": [
      {
        "outcome": "string",
        "frequency": number,
        "explanation": "string"
      }
    ]
  }
}`;
    } else if (test_type === "strategic_insights") {
      prompt = `You are an expert Yu-Gi-Oh! strategist. Provide detailed strategic insights and analytics for playing one deck against another.

${deckAText}

${deckBText}

Banlist Restrictions (${banlist_format}):
${banlistText || "No major restrictions"}

Format: ${banlist_format === "MASTER_DUEL" ? "Master Duel" : "TCG"}
${context ? `User Context: ${context}` : ""}

Provide comprehensive strategic guidance including:
1. Key card synergies - identify the most impactful card interactions
2. Vulnerabilities and counters - pinpoint deck weaknesses and countermeasures
3. Playstyle profiling - categorize the deck's playstyle with evidence
4. Meta adaptation recommendations - suggest modifications for meta fit
5. Risk vs reward analysis - evaluate high-risk/high-reward plays

Return your analysis as valid JSON with this exact schema:`;

      responseSchema = `{
  "analysis": "string - strategic analysis",
  "predicted_win_rate": number - 0-100,
  "matchup_assessment": {
    "deck_a_advantages": ["string"],
    "deck_b_advantages": ["string"],
    "key_factors": ["string"],
    "difficulty_rating": "very_favorable" | "favorable" | "even" | "unfavorable" | "very_unfavorable"
  },
  "strategic_insights": {
    "going_first_strategy": "string - detailed strategy",
    "going_second_strategy": "string - detailed strategy",
    "key_plays": ["string - specific plays to make"],
    "disruption_points": ["string - specific disruption opportunities"]
  },
  "strategic_analytics": {
    "key_card_synergies": [
      {
        "card_a": "string - card name",
        "card_b": "string - card name",
        "synergy_score": number - 0-100,
        "description": "string - why these cards synergize",
        "win_rate_impact": number - 0-100
      }
    ],
    "vulnerabilities": [
      {
        "weakness": "string - weakness description",
        "exploitability_score": number - 0-100,
        "exploitability_level": "high" | "medium" | "low",
        "countermeasures": ["string - ways to counter"]
      }
    ],
    "playstyle_profile": {
      "primary_style": "control" | "aggro" | "combo" | "midrange" | "stun" | "rogue",
      "style_confidence": number - 0-100,
      "evidence": ["string - evidence supporting this playstyle"],
      "description": "string - playstyle description"
    },
    "meta_adaptation": {
      "current_meta_fit": number - 0-100,
      "recommended_changes": [
        {
          "card_to_add": "string - optional",
          "card_to_remove": "string - optional",
          "reason": "string - why this change",
          "expected_improvement": number - 0-100
        }
      ],
      "meta_trends": ["string - current meta trends"]
    },
    "risk_reward_analysis": [
      {
        "play": "string - play description",
        "risk_level": "high" | "medium" | "low",
        "reward_potential": "high" | "medium" | "low",
        "success_rate": number - 0-100,
        "description": "string - risk/reward analysis"
      }
    ]
  }
}`;
    }

    const fullPrompt = `${prompt}\n\n${responseSchema}\n\nSTRONG RULES:\n- ALWAYS use actual card names from the deck compositions above - NEVER use generic terms like "this card" or "that card"\n- For cards in the decks, use their exact names as shown in the deck compositions\n- If referencing cards not in the decks, use their actual official Yu-Gi-Oh! card names\n- NEVER invent card names - only use real card names that exist\n- In the "play" field for risk_reward_analysis, use actual card names (e.g., "Dark Magician" not "this card")\n- Be specific and actionable in your analysis\n- Provide realistic numbers and percentages\n- Ensure all arrays have at least 3-5 items where applicable`;

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
          messages: [{ role: "user", content: fullPrompt }],
          temperature: 0.7,
          max_tokens: 4096,
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

    // Validate card names in response against database
    // Extract all card names from the response
    const extractCardNames = (obj: any, names: Set<string>): void => {
      if (typeof obj === "string") {
        // Try to extract card names from text (2+ capitalized words)
        const cardLikeRegex =
          /\b([A-Z][A-Za-z0-9'&-]+(?:\s+[A-Z][A-Za-z0-9'&-]+)+)\b/g;
        let match;
        while ((match = cardLikeRegex.exec(obj)) !== null) {
          const potentialName = match[1].trim();
          if (potentialName.length > 3) {
            names.add(potentialName);
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item) => extractCardNames(item, names));
      } else if (obj && typeof obj === "object") {
        // Check specific card name fields
        if (obj.card_name && typeof obj.card_name === "string") {
          names.add(obj.card_name.trim());
        }
        if (obj.card_a && typeof obj.card_a === "string") {
          names.add(obj.card_a.trim());
        }
        if (obj.card_b && typeof obj.card_b === "string") {
          names.add(obj.card_b.trim());
        }
        if (obj.card_to_add && typeof obj.card_to_add === "string") {
          names.add(obj.card_to_add.trim());
        }
        if (obj.card_to_remove && typeof obj.card_to_remove === "string") {
          names.add(obj.card_to_remove.trim());
        }
        Object.values(obj).forEach((value) => extractCardNames(value, names));
      }
    };

    const aiCardNames = new Set<string>();
    extractCardNames(parsedResponse, aiCardNames);

    // Validate card names against database
    const validatedCardNames = new Set<string>();
    if (aiCardNames.size > 0) {
      const cardNamesArray = Array.from(aiCardNames);
      const batchSize = 20;

      for (let i = 0; i < cardNamesArray.length; i += batchSize) {
        const batch = cardNamesArray.slice(i, i + batchSize);
        const nameConditions = batch
          .map((name) => {
            const escapedName = name.replace(/[%_\\]/g, "\\$&");
            return `name.ilike.${escapedName}`;
          })
          .join(",");

        const { data: validatedCards } = await supabase
          .from("cards")
          .select("name")
          .or(nameConditions)
          .limit(batchSize * 2);

        if (validatedCards) {
          validatedCards.forEach((card: { name: string }) => {
            validatedCardNames.add(card.name.toLowerCase());
          });
        }
      }
    }

    // Create a comprehensive set of all valid card names (deck + validated)
    const allValidCardNames = new Set<string>();
    allCardNames.forEach((name) => allValidCardNames.add(name.toLowerCase()));
    validatedCardNames.forEach((name) => allValidCardNames.add(name));

    // Create a map for exact matching (preserve original casing)
    const cardNameMap = new Map<string, string>();
    allCardNames.forEach((name) => {
      cardNameMap.set(name.toLowerCase(), name);
    });

    // Replace invalid card names with generic text - but be very conservative
    const replaceInvalidCardNames = (obj: any): any => {
      if (typeof obj === "string") {
        // Don't replace if the string already contains "this card" - it's likely intentional
        if (obj.toLowerCase().includes("this card")) {
          return obj;
        }

        // Replace invalid card names in text - but only if we're very sure
        const cardLikeRegex =
          /\b([A-Z][A-Za-z0-9'&-]+(?:\s+[A-Z][A-Za-z0-9'&-]+)+)\b/g;
        return obj.replace(cardLikeRegex, (match) => {
          const trimmed = match.trim();
          const normalized = trimmed.toLowerCase();

          // Check if it's a valid card name (exact match)
          if (allValidCardNames.has(normalized)) {
            // Try to preserve original casing from deck
            return cardNameMap.get(normalized) || trimmed;
          }

          // Check for fuzzy matches (handles punctuation/spacing variations)
          for (const validName of allValidCardNames) {
            const validNormalized = validName.toLowerCase();
            // Exact match after removing special chars
            const matchNoSpecial = normalized.replace(/['&-]/g, "");
            const validNoSpecial = validNormalized.replace(/['&-]/g, "");
            if (
              matchNoSpecial === validNoSpecial &&
              matchNoSpecial.length > 0
            ) {
              return cardNameMap.get(validNormalized) || trimmed;
            }
            // Check if it's a substring match (e.g., "Dark Magician" in "Dark Magician Girl")
            if (
              (normalized.includes(validNormalized) &&
                normalized.length <= validNormalized.length + 5) ||
              (validNormalized.includes(normalized) &&
                validNormalized.length <= normalized.length + 5)
            ) {
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

          // Be conservative - don't replace unless we're very sure it's an invalid card name
          // Only replace if it looks like a card name but isn't validated
          // For now, preserve it - let the AI's card names through
          return trimmed;
        });
      }
      if (Array.isArray(obj)) {
        return obj.map((item) => replaceInvalidCardNames(item));
      }
      if (obj && typeof obj === "object") {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (
            key === "card_name" ||
            key === "card_a" ||
            key === "card_b" ||
            key === "card_to_add" ||
            key === "card_to_remove"
          ) {
            // Validate card name fields specifically
            if (typeof value === "string") {
              const normalized = value.trim().toLowerCase();
              if (
                validatedCardNames.has(normalized) ||
                allCardNames.some((name) => name.toLowerCase() === normalized)
              ) {
                sanitized[key] = value; // Keep valid card names
              } else {
                sanitized[key] = null; // Remove invalid card names
              }
            } else {
              sanitized[key] = value;
            }
          } else {
            sanitized[key] = replaceInvalidCardNames(value);
          }
        }
        return sanitized;
      }
      return obj;
    };

    parsedResponse = replaceInvalidCardNames(parsedResponse);

    // Remove null card names from arrays
    const removeNullCardNames = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj
          .map((item) => removeNullCardNames(item))
          .filter((item: any) => {
            // Filter out objects with null card_name fields
            if (item && typeof item === "object") {
              if (
                item.card_name === null ||
                item.card_a === null ||
                item.card_b === null
              ) {
                return false;
              }
            }
            return true;
          });
      }
      if (obj && typeof obj === "object") {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
          cleaned[key] = removeNullCardNames(value);
        }
        return cleaned;
      }
      return obj;
    };

    parsedResponse = removeNullCardNames(parsedResponse);

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

          // If parent object exists, check its description or other fields for card names
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
          if (deckCardNames.length > 0) {
            // Prioritize main deck cards
            const mainDeckCards = deck_a.mainDeck.map((c) => c.name);
            if (mainDeckCards.length > 0) {
              return obj.replace(/\bthis card\b/gi, mainDeckCards[0]);
            }
            return obj.replace(/\bthis card\b/gi, deckCardNames[0]);
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
          // Special handling for "play" field in risk_reward_analysis
          if (
            key === "play" &&
            typeof value === "string" &&
            value.toLowerCase().includes("this card")
          ) {
            // Try to extract card names from the description field if available
            if (obj.description && typeof obj.description === "string") {
              const cardLikeRegex =
                /\b([A-Z][A-Za-z0-9'&-]+(?:\s+[A-Z][A-Za-z0-9'&-]+)+)\b/g;
              const mentionedCards: string[] = [];
              let match;
              while ((match = cardLikeRegex.exec(obj.description)) !== null) {
                const cardName = match[1].trim();
                const normalized = cardName.toLowerCase();
                if (allValidCardNames.has(normalized)) {
                  const actualName = cardNameMap.get(normalized) || cardName;
                  if (!mentionedCards.includes(actualName)) {
                    mentionedCards.push(actualName);
                  }
                }
              }
              if (mentionedCards.length > 0) {
                processed[key] = value.replace(
                  /\bthis card\b/gi,
                  mentionedCards[0],
                );
              } else {
                // Fallback to most common deck card
                const mainDeckCards = deck_a.mainDeck.map((c) => c.name);
                if (mainDeckCards.length > 0) {
                  processed[key] = value.replace(
                    /\bthis card\b/gi,
                    mainDeckCards[0],
                  );
                } else {
                  processed[key] = value;
                }
              }
            } else {
              // Fallback to most common deck card
              const mainDeckCards = deck_a.mainDeck.map((c) => c.name);
              if (mainDeckCards.length > 0) {
                processed[key] = value.replace(
                  /\bthis card\b/gi,
                  mainDeckCards[0],
                );
              } else {
                processed[key] = value;
              }
            }
          } else {
            processed[key] = replaceThisCardWithActualNames(value, obj);
          }
        }
        return processed;
      }
      return obj;
    };

    parsedResponse = replaceThisCardWithActualNames(parsedResponse);

    // Calculate token usage (approximate)
    const inputTokens = Math.ceil(fullPrompt.length / 4);
    const outputTokens = Math.ceil(rawContent.length / 4);
    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUSD = (totalTokens / 1000000) * 0.27;

    return new Response(
      JSON.stringify({
        ...parsedResponse,
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
