import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AnalysisCategory {
  id: string;
  name: string;
  description: string;
  focusAreas: string[];
}

interface CandidateCard {
  id: number;
  name: string;
  type: string;
  desc: string;
  archetype: string | null;
  race: string | null;
  attribute: string | null;
  ban_status: string;
}

const ANALYSIS_CATEGORIES: Record<string, AnalysisCategory> = {
  consistency: {
    id: "consistency",
    name: "Consistency",
    description: "Improve deck reliability and reduce bricking",
    focusAreas: [
      "Draw power and search effects",
      "Starter cards and combo enablers",
      "Card ratios (monsters/spells/traps)",
      "Deck thinning and filtering",
      "Redundancy in key effects",
      "One-card starters vs multi-card combos",
    ],
  },
  power: {
    id: "power",
    name: "Power/Ceiling",
    description: "Maximize explosive plays and win conditions",
    focusAreas: [
      "Power cards and boss monsters",
      "Combo extenders and additional summons",
      "End board strength and threats",
      "OTK potential and damage output",
      "Resource generation",
      "Turn 1 board building capability",
    ],
  },
  interaction: {
    id: "interaction",
    name: "Interaction/Resilience",
    description: "Improve disruption and defensive options",
    focusAreas: [
      "Hand traps and quick effects",
      "Negation and interruption",
      "Removal options (targeted and non-targeted)",
      "Protection and resilience cards",
      "Graveyard hate and floodgates",
      "Playing through disruption",
      "Recovery and grind game",
    ],
  },
  meta: {
    id: "meta",
    name: "Meta/Matchup",
    description: "Adapt to current meta and specific matchups",
    focusAreas: [
      "Side deck optimization",
      "Counters to top-tier decks",
      "Tech choices for current format",
      "Going first vs going second cards",
      "Blowout cards against popular strategies",
      "Format-specific techs",
    ],
  },
};

async function enrichDeckWithCards(
  deckCards: any,
  mode: string | null
): Promise<any> {
  const allCardIds = [
    ...deckCards.main.map((c: any) => c.id),
    ...deckCards.extra.map((c: any) => c.id),
    ...deckCards.side.map((c: any) => c.id),
  ];

  // Fetch cards from public.cards table
  const { data: cards, error } = await supabase
    .from("cards")
    .select("*")
    .in("id", allCardIds);

  if (error) throw error;

  const cardMap = new Map();
  cards?.forEach((card) => cardMap.set(card.id, card));

  // If mode is Master Duel, fetch Master Duel banlist
  let mdBanlistMap = new Map<string, string>();
  if (mode === "Master Duel") {
    const cardNames = cards?.map((c) => c.name) || [];
    const { data: mdBanlist } = await supabase
      .from("master_duel_banlist")
      .select("card_name, ban_status")
      .in("card_name", cardNames);

    mdBanlist?.forEach((entry) => {
      if (entry.card_name && entry.ban_status) {
        mdBanlistMap.set(entry.card_name, entry.ban_status);
      }
    });
  }

  // Enrich cards with appropriate banlist
  const enrichCard = (dc: any) => {
    const card = cardMap.get(dc.id);
    if (!card) return null;

    return {
      ...card,
      quantity: dc.quantity,
      // Use Master Duel banlist if mode is Master Duel, otherwise use TCG banlist
      ban_status:
        mode === "Master Duel"
          ? mdBanlistMap.get(card.name) || "Unlimited"
          : card.ban_tcg || "Unlimited",
    };
  };

  return {
    main: deckCards.main.map(enrichCard).filter(Boolean),
    extra: deckCards.extra.map(enrichCard).filter(Boolean),
    side: deckCards.side.map(enrichCard).filter(Boolean),
  };
}

function calculateDeckStats(enrichedDeck: any, mode: string | null) {
  return {
    mainDeckSize: enrichedDeck.main.reduce(
      (sum: number, c: any) => sum + c.quantity,
      0
    ),
    extraDeckSize: enrichedDeck.extra.reduce(
      (sum: number, c: any) => sum + c.quantity,
      0
    ),
    sideDeckSize: enrichedDeck.side.reduce(
      (sum: number, c: any) => sum + c.quantity,
      0
    ),
    monsterCount: enrichedDeck.main
      .filter((c: any) => c.type && c.type.toLowerCase().includes("monster"))
      .reduce((sum: number, c: any) => sum + c.quantity, 0),
    spellCount: enrichedDeck.main
      .filter((c: any) => c.type && c.type.toLowerCase() === "spell card")
      .reduce((sum: number, c: any) => sum + c.quantity, 0),
    trapCount: enrichedDeck.main
      .filter((c: any) => c.type && c.type.toLowerCase() === "trap card")
      .reduce((sum: number, c: any) => sum + c.quantity, 0),
    archetypes: [
      ...new Set(enrichedDeck.main.map((c: any) => c.archetype).filter(Boolean)),
    ],
    banListCards: {
      forbidden: enrichedDeck.main
        .filter((c: any) => c.ban_status === "Forbidden" || c.ban_status === "Banned")
        .map((c: any) => c.name),
      limited: enrichedDeck.main
        .filter((c: any) => c.ban_status === "Limited")
        .map((c: any) => c.name),
      semiLimited: enrichedDeck.main
        .filter((c: any) => c.ban_status === "Semi-Limited")
        .map((c: any) => c.name),
    },
    mode: mode || "TCG",
  };
}

function formatBanListStatus(banListCards: any, mode: string): string {
  const parts = [];
  const formatName = mode === "Master Duel" ? "Master Duel" : "TCG";

  if (banListCards.forbidden.length > 0) {
    parts.push(`⚠️ ${formatName} Banned: ${banListCards.forbidden.join(", ")}`);
  }
  if (banListCards.limited.length > 0) {
    parts.push(`${formatName} Limited: ${banListCards.limited.join(", ")}`);
  }
  if (banListCards.semiLimited.length > 0) {
    parts.push(
      `${formatName} Semi-Limited: ${banListCards.semiLimited.join(", ")}`
    );
  }

  return parts.length > 0
    ? parts.join(" | ")
    : `All cards legal in ${formatName}`;
}

function getCategoryKeywords(category: string): string[] {
  const keywords: Record<string, string[]> = {
    consistency: [
      "draw",
      "search",
      "add",
      "deck",
      "hand",
      "shuffle",
      "foolish",
      "one for one",
      "mill",
      "excavate",
      "reveal",
    ],
    power: [
      "special summon",
      "negate",
      "cannot be",
      "unaffected",
      "3000 ATK",
      "4000 ATK",
      "banish",
      "destroy all",
      "omni-negate",
      "towers",
    ],
    interaction: [
      "negate",
      "quick effect",
      "hand",
      "during either player",
      "opponent",
      "discard",
      "cannot activate",
      "ash blossom",
      "infinite impermanence",
      "called by the grave",
    ],
    meta: [
      "floodgate",
      "lock",
      "cannot special summon",
      "extra deck",
      "graveyard",
      "banish",
      "skill drain",
      "dimensional barrier",
    ],
  };

  return keywords[category] || [];
}

async function generateCandidateCards(
  enrichedDeck: any,
  category: string,
  mode: string,
  deckId: string,
  limit: number = 200
): Promise<CandidateCard[]> {
  console.log(`🔍 Generating candidates for category: ${category}, mode: ${mode}`);

  const deckArchetypes = [
    ...new Set(
      enrichedDeck.main
        .map((c: any) => c.archetype)
        .filter((a: any) => a && a !== "")
    ),
  ];

  const deckCardIds = [
    ...enrichedDeck.main.map((c: any) => c.id),
    ...enrichedDeck.extra.map((c: any) => c.id),
    ...enrichedDeck.side.map((c: any) => c.id),
  ];

  console.log(`📋 Deck archetypes: ${deckArchetypes.join(", ") || "None"}`);
  console.log(`🚫 Excluding ${deckCardIds.length} cards already in deck`);

  // Fetch recent recommendations to avoid repetition
  const { data: recentSessions } = await supabase
    .from("recommendation_sessions")
    .select("recommendations")
    .eq("deck_id", deckId)
    .order("created_at", { ascending: false })
    .limit(3);

  const previouslyRecommended = new Set<string>();
  recentSessions?.forEach((session) => {
    session.recommendations?.recommendations?.forEach((rec: any) => {
      if (rec.cardName) {
        previouslyRecommended.add(rec.cardName.toLowerCase());
      }
    });
  });

  console.log(`📝 Previously recommended ${previouslyRecommended.size} cards (will deprioritize)`);

  // Build category-specific type filters
  let typeFilters: string[] = [];
  
  switch (category) {
    case "consistency":
      typeFilters = ["Spell Card", "Effect Monster"];
      break;
    case "power":
      typeFilters = ["Effect Monster", "Fusion Monster", "Synchro Monster", "Xyz Monster", "Link Monster"];
      break;
    case "interaction":
      typeFilters = ["Effect Monster", "Trap Card", "Spell Card"];
      break;
    case "meta":
      typeFilters = ["Effect Monster", "Spell Card", "Trap Card"];
      break;
  }

  const candidateMap = new Map<number, any>();

  // Query 1: Archetype-related cards (if deck has clear archetypes)
  if (deckArchetypes.length > 0 && deckArchetypes.length <= 3) {
    console.log(`🎯 Fetching archetype-related cards...`);
    
    for (const archetype of deckArchetypes) {
      const { data: archetypeCards, error: err1 } = await supabase
        .from("cards")
        .select("id, name, type, desc, archetype, race, attribute, ban_tcg")
        .not("id", "in", `(${deckCardIds.join(",")})`)
        .eq("archetype", archetype)
        .neq("ban_tcg", "Forbidden")
        .limit(50);

      if (err1) {
        console.error(`Error fetching archetype ${archetype} cards:`, err1);
      } else {
        archetypeCards?.forEach((card) => {
          if (!candidateMap.has(card.id)) {
            candidateMap.set(card.id, card);
          }
        });
      }
    }
    
    console.log(`✅ Found ${candidateMap.size} archetype-related cards`);
  }

  // Query 2: Generic staples based on category keywords
  console.log(`🔑 Fetching generic staples for ${category}...`);
  const stapleKeywords = getCategoryKeywords(category);
  
  for (const keyword of stapleKeywords) {
    const { data: stapleCards, error: err2 } = await supabase
      .from("cards")
      .select("id, name, type, desc, archetype, race, attribute, ban_tcg")
      .not("id", "in", `(${deckCardIds.join(",")})`)
      .ilike("desc", `%${keyword}%`)
      .in("type", typeFilters)
      .neq("ban_tcg", "Forbidden")
      .limit(20);

    if (err2) {
      console.error(`Error fetching cards with keyword "${keyword}":`, err2);
    } else {
      stapleCards?.forEach((card) => {
        if (!candidateMap.has(card.id)) {
          candidateMap.set(card.id, card);
        }
      });
    }
  }

  console.log(`✅ Total candidates before filtering: ${candidateMap.size}`);

  let candidates = Array.from(candidateMap.values());

  // Apply Master Duel banlist if needed
  if (mode === "Master Duel") {
    console.log(`⚖️ Applying Master Duel banlist...`);
    const cardNames = candidates.map((c) => c.name);
    const { data: mdBanlist } = await supabase
      .from("master_duel_banlist")
      .select("card_name, ban_status")
      .in("card_name", cardNames);

    const mdBanMap = new Map<string, string>();
    mdBanlist?.forEach((entry) => {
      if (entry.card_name && entry.ban_status) {
        mdBanMap.set(entry.card_name, entry.ban_status);
      }
    });

    candidates = candidates
      .map((card) => ({
        ...card,
        ban_status: mdBanMap.get(card.name) || "Unlimited",
      }))
      .filter((card) => card.ban_status !== "Forbidden" && card.ban_status !== "Banned");
  } else {
    candidates = candidates.map((card) => ({
      ...card,
      ban_status: card.ban_tcg || "Unlimited",
    }));
  }

  // Deprioritize previously recommended cards (move to end)
  const newCandidates = candidates.filter(
    (c) => !previouslyRecommended.has(c.name.toLowerCase())
  );
  const repeatedCandidates = candidates.filter(
    (c) => previouslyRecommended.has(c.name.toLowerCase())
  );

  candidates = [...newCandidates, ...repeatedCandidates];

  console.log(`✅ Final candidate count: ${candidates.length} (${newCandidates.length} new, ${repeatedCandidates.length} repeated)`);

  // Limit to specified count
  return candidates.slice(0, limit);
}

function validateRecommendations(
  recommendations: any,
  candidateCards: CandidateCard[],
  enrichedDeck: any
): any {
  const candidateNames = new Set(candidateCards.map((c) => c.name.toLowerCase()));
  const deckCardNames = new Set([
    ...enrichedDeck.main.map((c: any) => c.name.toLowerCase()),
    ...enrichedDeck.extra.map((c: any) => c.name.toLowerCase()),
    ...enrichedDeck.side.map((c: any) => c.name.toLowerCase()),
  ]);

  let filteredCount = 0;

  // Validate recommendations array
  if (recommendations.recommendations && Array.isArray(recommendations.recommendations)) {
    const originalLength = recommendations.recommendations.length;
    recommendations.recommendations = recommendations.recommendations.filter(
      (rec: any) => {
        const cardNameLower = rec.cardName?.toLowerCase() || "";
        
        // Must be in candidates AND not already in deck
        const isValid =
          candidateNames.has(cardNameLower) &&
          !deckCardNames.has(cardNameLower);

        if (!isValid) {
          console.warn(`❌ Filtered out invalid recommendation: ${rec.cardName} (in candidates: ${candidateNames.has(cardNameLower)}, in deck: ${deckCardNames.has(cardNameLower)})`);
          filteredCount++;
        }

        return isValid;
      }
    );
    console.log(`🔍 Recommendations: ${recommendations.recommendations.length}/${originalLength} valid`);
  }

  // Validate ratioAdjustments (these SHOULD reference deck cards)
  if (recommendations.ratioAdjustments && Array.isArray(recommendations.ratioAdjustments)) {
    const originalLength = recommendations.ratioAdjustments.length;
    recommendations.ratioAdjustments = recommendations.ratioAdjustments.filter(
      (adj: any) => {
        const cardNameLower = adj.cardName?.toLowerCase() || "";
        const isValid = deckCardNames.has(cardNameLower);
        
        if (!isValid) {
          console.warn(`❌ Filtered out invalid ratio adjustment: ${adj.cardName} (not in deck)`);
          filteredCount++;
        }
        
        return isValid;
      }
    );
    console.log(`🔍 Ratio adjustments: ${recommendations.ratioAdjustments.length}/${originalLength} valid`);
  }

  // Validate cuts (must be in deck)
  if (recommendations.cutsRecommendations && Array.isArray(recommendations.cutsRecommendations)) {
    const originalLength = recommendations.cutsRecommendations.length;
    recommendations.cutsRecommendations = recommendations.cutsRecommendations.filter(
      (cut: any) => {
        const cardNameLower = cut.cardName?.toLowerCase() || "";
        const isValid = deckCardNames.has(cardNameLower);
        
        if (!isValid) {
          console.warn(`❌ Filtered out invalid cut recommendation: ${cut.cardName} (not in deck)`);
          filteredCount++;
        }
        
        return isValid;
      }
    );
    console.log(`🔍 Cut recommendations: ${recommendations.cutsRecommendations.length}/${originalLength} valid`);
  }

  // Validate combo lines (cards should exist in either deck or candidates)
  if (recommendations.comboLines && Array.isArray(recommendations.comboLines)) {
    recommendations.comboLines = recommendations.comboLines.filter((combo: any) => {
      if (!combo.cards || !Array.isArray(combo.cards)) return true;
      
      const allCardsValid = combo.cards.every((cardName: string) => {
        const cardNameLower = cardName.toLowerCase();
        return candidateNames.has(cardNameLower) || deckCardNames.has(cardNameLower);
      });
      
      if (!allCardsValid) {
        console.warn(`❌ Filtered out combo with invalid cards: ${combo.name}`);
        filteredCount++;
      }
      
      return allCardsValid;
    });
  }

  if (filteredCount > 0) {
    console.log(`⚠️ Total filtered recommendations: ${filteredCount}`);
  }

  return recommendations;
}

function buildCategorySpecificPrompt(
  category: string,
  enrichedDeck: any,
  candidateCards: CandidateCard[],
  userPrompt: string,
  deckMode: string | null
): string {
  const categoryConfig = ANALYSIS_CATEGORIES[category];

  if (!categoryConfig) {
    throw new Error(`Invalid category: ${category}`);
  }

  const stats = calculateDeckStats(enrichedDeck, deckMode);
  const mode = deckMode || "TCG";
  const formatSpecificGuidance =
    mode === "Master Duel"
      ? `
MASTER DUEL FORMAT CONSIDERATIONS:
- Best-of-1 format (no side deck usage between games)
- Bo1 means main deck must handle all matchups
- Different banlist from TCG (refer to ban_status field)
- Digital-only format with different meta game
- Recommend cards that are versatile across multiple matchups
- Side deck suggestions should focus on alternate strategies, not matchup-specific counters`
      : `
TCG FORMAT CONSIDERATIONS:
- Best-of-3 format with side deck usage
- Side deck can be tailored for specific matchups
- Current TCG banlist applies (refer to ban_status field)
- Physical format with established tournament meta
- Side deck recommendations should target specific top-tier decks`;

  return `You are analyzing a Yu-Gi-Oh deck with a specific focus on ${categoryConfig.name.toUpperCase()}.

GAME MODE: ${mode}${formatSpecificGuidance}

ANALYSIS FOCUS: ${categoryConfig.description}

KEY AREAS TO EVALUATE:
${categoryConfig.focusAreas.map((area, i) => `${i + 1}. ${area}`).join("\n")}

USER REQUEST: ${userPrompt}

DECK COMPOSITION (${stats.mainDeckSize} main / ${stats.extraDeckSize} extra / ${stats.sideDeckSize} side):
- Monsters: ${stats.monsterCount} | Spells: ${stats.spellCount} | Traps: ${stats.trapCount}
- Primary Archetypes: ${stats.archetypes.join(", ") || "Mixed/Generic"}
- ${mode} Ban List Status: ${formatBanListStatus(stats.banListCards, mode)}

MAIN DECK CARDS:
${enrichedDeck.main
  .map(
    (c: any) =>
      `${c.quantity}x ${c.name} [${c.type}${c.archetype ? ` | ${c.archetype}` : ""}${c.ban_status && c.ban_status !== "Unlimited" ? ` | ${mode} ${c.ban_status}` : ""}]
  Effect: ${c.desc?.substring(0, 120)}${c.desc?.length > 120 ? "..." : ""}`
  )
  .join("\n\n")}

${
  enrichedDeck.extra.length > 0
    ? `EXTRA DECK:
${enrichedDeck.extra.map((c: any) => `${c.quantity}x ${c.name} [${c.type}${c.ban_status && c.ban_status !== "Unlimited" ? ` | ${mode} ${c.ban_status}` : ""}]`).join("\n")}`
    : "EXTRA DECK: Empty"
}

${
  enrichedDeck.side.length > 0
    ? `SIDE DECK:
${enrichedDeck.side.map((c: any) => `${c.quantity}x ${c.name} [${c.type}]`).join("\n")}`
    : "SIDE DECK: Empty"
}

CANDIDATE CARDS FOR RECOMMENDATIONS (${candidateCards.length} pre-filtered options):
These are the ONLY cards you are allowed to recommend. Do not suggest any cards outside this list.
${candidateCards
  .map(
    (c, idx) =>
      `${idx + 1}. ${c.name} [${c.type}${c.archetype ? ` | ${c.archetype}` : ""}${c.ban_status !== "Unlimited" ? ` | ${mode} ${c.ban_status}` : ""}]
   ${c.desc.substring(0, 150)}${c.desc.length > 150 ? "..." : ""}`
  )
  .join("\n\n")}

═══════════════════════════════════════════════════════════════
CRITICAL RECOMMENDATION RULES - READ CAREFULLY:
═══════════════════════════════════════════════════════════════

1. 🚨 ONLY RECOMMEND CARDS FROM THE CANDIDATE CARDS LIST ABOVE
   - You MUST use the EXACT card name as written in the candidate list
   - Card names are case-sensitive and must match EXACTLY
   - DO NOT suggest any cards not in the candidate list
   - DO NOT invent card names or suggest cards from memory

2. 🚫 NEVER RECOMMEND CARDS ALREADY IN THE DECK
   - Check the MAIN DECK, EXTRA DECK, and SIDE DECK sections above
   - If a card is already in the deck, do not recommend adding it
   - You CAN suggest ratio adjustments for existing cards

3. ⚖️ RESPECT THE ${mode} BANLIST
   - All recommendations must be legal in ${mode} format
   - Do not recommend Forbidden/Banned cards for main/extra deck
   - Limited cards can only be recommended if not in deck at limit
   - Semi-Limited cards can be recommended up to 2 copies total

4. 🎯 FOCUS ON ${categoryConfig.name.toUpperCase()}
   - Prioritize cards that directly improve ${categoryConfig.description.toLowerCase()}
   - Reference the KEY AREAS TO EVALUATE listed above
   - Explain HOW each card addresses the specific focus

5. 📊 PROVIDE COMPLETE JSON RESPONSE
   - Use the exact JSON structure specified below
   - Include specific, actionable advice for each recommendation
   - Explain synergies with existing deck cards
   - Provide measurable impact statements

6. ⚠️ IF NO SUITABLE CANDIDATES EXIST
   - Acknowledge the limitation in your analysis
   - Explain why available candidates don't fit
   - Suggest general direction for improvements

═══════════════════════════════════════════════════════════════

INSTRUCTIONS:
Provide a comprehensive analysis focused specifically on ${categoryConfig.name} for ${mode} format. 
${mode === "Master Duel" ? "Remember this is Best-of-1, so main deck versatility is crucial." : "Consider both main deck and side deck options for Best-of-3 play."}

RESPONSE FORMAT RULES:
1. List each card recommendation on its own numbered line (1., 2., 3., etc.)
2. Start each line with the card name in bold: **Card Name**
3. Follow with a dash and explanation: **Card Name** - This card provides...
4. NEVER use phrases like "this card" or "the card" - always use the specific card name
5. NEVER repeat the same card name twice in one sentence
6. NEVER start sentences with "which", "that", or "since" - start with the card name
7. Keep explanations concise (1-2 sentences per card)

Example format:
1. **Dark Magician** - provides strong spell-casting support
2. **Eternal Soul** - protects your Dark Magician cards from destruction
3. **Magician's Rod** - searches for spell/trap cards when Normal Summoned

Your response must be in JSON format with this structure:

{
  "categoryAnalysis": {
    "category": "${category}",
    "mode": "${mode}",
    "score": 1-10,
    "summary": "Brief assessment of how well the deck performs in this category for ${mode}",
    "specificIssues": ["issue1", "issue2", "issue3"],
    "opportunities": ["opportunity1", "opportunity2"],
    "formatSpecificNotes": "Notes specific to ${mode} format"
  },
  "recommendations": [
    {
      "cardName": "EXACT card name from candidate list",
      "reason": "Detailed explanation of how this card addresses ${categoryConfig.name} concerns in ${mode}",
      "location": "main/extra/side",
      "priority": "critical/high/medium/low",
      "quantity": 1-3,
      "replacesCards": ["optional - specific cards to cut from deck"],
      "synergies": ["existing deck cards this works with"],
      "impact": "Specific measurable improvement this card provides",
      "banlistLegal": true
    }
  ],
  "comboLines": [
    {
      "name": "Combo name",
      "relevance": "How this combo improves ${categoryConfig.name} in ${mode}",
      "cards": ["card1", "card2", "card3"],
      "steps": ["step1", "step2", "step3"],
      "outcome": "End board or result",
      "consistency": "Reliability rating and why"
    }
  ],
  "cutsRecommendations": [
    {
      "cardName": "Card currently in deck to consider removing",
      "reason": "Why this card doesn't fit the ${categoryConfig.name} strategy in ${mode}",
      "quantity": 1-3
    }
  ],
  "ratioAdjustments": [
    {
      "cardName": "Card currently in deck",
      "currentQuantity": 1-3,
      "recommendedQuantity": 1-3,
      "reason": "Why this ratio change improves ${categoryConfig.name} in ${mode}"
    }
  ]
}

Be specific with card names and provide actionable advice. Focus exclusively on ${categoryConfig.name} for ${mode} format.
Remember: ONLY recommend cards from the candidate list above. Use EXACT card names.`;
}

async function callGroqAPI(prompt: string): Promise<any> {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert Yu-Gi-Oh deck building assistant. You provide precise, actionable recommendations based solely on the candidate cards provided to you. You never invent card names or suggest cards outside the candidate list."
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.3,
      max_tokens: 2048,
      top_p: 0.9,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${error}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content || "{}");
}

async function saveRecommendationSession(
  deckId: string,
  userId: string,
  category: string,
  mode: string,
  prompt: string,
  deckSnapshot: any,
  recommendations: any
): Promise<string | null> {
  const { data, error } = await supabase
    .from("recommendation_sessions")
    .insert({
      deck_id: deckId,
      user_id: userId,
      prompt: `[${mode}][${category}] ${prompt}`,
      deck_snapshot: deckSnapshot,
      recommendations,
      model_version: "llama-3.3-70b-versatile",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to save recommendation session:", error);
    return null;
  }

  return data?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { deckId, category, prompt } = await req.json();

    if (!deckId || !category || !prompt) {
      return new Response(
        JSON.stringify({ error: "deckId, category, and prompt are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate category
    if (!ANALYSIS_CATEGORIES[category]) {
      return new Response(
        JSON.stringify({
          error: `Invalid category. Must be one of: ${Object.keys(ANALYSIS_CATEGORIES).join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🎯 Processing recommendation request: category=${category}, deckId=${deckId}`);

    // Fetch deck
    const { data: deck, error: deckError } = await supabase
      .from("decks")
      .select("*")
      .eq("id", deckId)
      .eq("user_id", user.id)
      .single();

    if (deckError || !deck) {
      return new Response(JSON.stringify({ error: "Deck not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📦 Deck loaded: ${deck.name || 'Unnamed'}, mode: ${deck.mode || 'TCG'}`);

    // Enrich deck with full card data AND appropriate banlist
    const enrichedDeck = await enrichDeckWithCards(deck.cards, deck.mode);
    console.log(`✅ Deck enriched with card data`);

    // Generate candidate cards based on deck analysis
    const candidateCards = await generateCandidateCards(
      enrichedDeck,
      category,
      deck.mode || "TCG",
      deckId,
      200 // Adjust based on expected recommendation count
    );

    if (candidateCards.length === 0) {
      console.warn(`⚠️ No candidate cards found for category ${category}`);
      return new Response(
        JSON.stringify({
          error: "No suitable candidate cards found for this analysis",
          category,
          mode: deck.mode || "TCG",
          recommendations: {
            categoryAnalysis: {
              category,
              mode: deck.mode || "TCG",
              score: 0,
              summary: "Unable to generate recommendations - no suitable candidates found in database",
              specificIssues: ["Insufficient card pool for analysis"],
              opportunities: [],
              formatSpecificNotes: "",
            },
            recommendations: [],
            comboLines: [],
            cutsRecommendations: [],
            ratioAdjustments: [],
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🎴 Generated ${candidateCards.length} candidate cards`);

    // Build category-specific prompt WITH candidate cards
    const fullPrompt = buildCategorySpecificPrompt(
      category,
      enrichedDeck,
      candidateCards,
      prompt,
      deck.mode
    );

    console.log(`📝 Prompt built, calling Groq API...`);

    // Call Groq API
    const recommendations = await callGroqAPI(fullPrompt);

    console.log(`🤖 Groq API response received`);

    // Validate recommendations against candidate cards and deck
    const validatedRecs = validateRecommendations(
      recommendations,
      candidateCards,
      enrichedDeck
    );

    console.log(`✅ Recommendations validated`);

    // Save recommendation session with validated recommendations
    const sessionId = await saveRecommendationSession(
      deckId,
      user.id,
      category,
      deck.mode || "TCG",
      prompt,
      deck.cards,
      validatedRecs
    );

    console.log(`💾 Session saved: ${sessionId || 'failed'}`);

    return new Response(
      JSON.stringify({
        category,
        mode: deck.mode || "TCG",
        recommendations: validatedRecs,
        sessionId,
        meta: {
          candidatesConsidered: candidateCards.length,
          deckSize: {
            main: enrichedDeck.main.length,
            extra: enrichedDeck.extra.length,
            side: enrichedDeck.side.length,
          },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Recommendation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});