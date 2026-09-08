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

type CandidateCard = {
  candidateId: number;
  id: number;
  name: string;
  type: string;
  race?: string | null;
  desc: string;
  archetype?: string | null;
};

type RecommendationPriority = "high" | "medium" | "low";
type RecommendationRole =
  | "starter"
  | "extender"
  | "hand_trap"
  | "removal"
  | "engine"
  | "tech"
  | "floodgate"
  | "other";

type CardSuggestionFromLlm = {
  candidate_id: number;
  priority: RecommendationPriority;
  role: RecommendationRole;
  reason: string;
};

type CardSuggestionLlmResult = {
  strategy_summary: string;
  recommendations: CardSuggestionFromLlm[];
};

type AnalysisType =
  | "summary"
  | "power_level"
  | "consistency"
  | "resilience"
  | "matchup"
  | "complexity"
  | "card_suggestions"
  | "custom";

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

// Helper: extract meaningful search terms from text
function extractSearchTerms(text: string): string[] {
  if (!text) return [];

  const STOP_WORDS = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "for",
    "with",
    "to",
    "in",
    "on",
    "this",
    "that",
    "it",
    "my",
    "your",
    "their",
    "our",
    "is",
    "are",
    "be",
    "can",
    "could",
    "would",
    "should",
    "deck",
    "cards",
    "card",
    "build",
    "add",
    "run",
    "good",
    "better",
    "more",
    "less",
    "help",
    "support",
    "engine",
    "please",
    "need",
    "want",
    "like",
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

// Helper: safely extract archetype as string (never returns [object Object])
function getArchetypeNameServer(card: { archetype?: string | null }): string {
  const raw = card?.archetype;

  if (!raw) return "";

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "[object Object]") return "";
    return trimmed;
  }

  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as any).name === "string"
  ) {
    const name = (raw as any).name.trim();
    if (name === "[object Object]") return "";
    return name;
  }

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

// Helper: extract potential card names from text (simple pattern matching)
function extractCardNamesFromText(text: string): string[] {
  const cardNames: string[] = [];
  const seen = new Set<string>();

  // Pattern 1: **Card Name** (bold markdown)
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let match;
  while ((match = boldPattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (name.length >= 3 && !seen.has(name.toLowerCase())) {
      cardNames.push(name);
      seen.add(name.toLowerCase());
    }
  }

  // Pattern 2: "Card Name" (quoted)
  const quotedPattern = /"([^"]+)"/g;
  while ((match = quotedPattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (name.length >= 3 && !seen.has(name.toLowerCase())) {
      cardNames.push(name);
      seen.add(name.toLowerCase());
    }
  }

  // Pattern 3: Capitalized phrases that might be card names
  // This is more conservative - only match if it looks like a proper card name
  const capitalizedPattern =
    /\b([A-Z][a-zA-Z\s\-']{2,}(?:\s+[A-Z][a-zA-Z\s\-']*)*)\b/g;
  while ((match = capitalizedPattern.exec(text)) !== null) {
    const name = match[1].trim();
    // Skip common words and short phrases
    if (
      name.length >= 4 &&
      name.length <= 50 &&
      !seen.has(name.toLowerCase()) &&
      !/^(The|A|An|And|Or|Of|In|On|At|To|For|With|From|By)\s/i.test(name)
    ) {
      cardNames.push(name);
      seen.add(name.toLowerCase());
    }
  }

  return cardNames;
}

// Helper: validate card names against database and return only valid ones
async function validateCardNames(
  supabaseClient: any,
  cardNames: string[],
): Promise<Set<string>> {
  if (cardNames.length === 0) return new Set();

  const validCardNames = new Set<string>();

  // Query database for cards matching any of the input names (case-insensitive)
  // Use batch queries to avoid query size limits
  const batchSize = 20;
  const allMatchingCards: { name: string }[] = [];

  for (let i = 0; i < cardNames.length; i += batchSize) {
    const batch = cardNames.slice(i, i + batchSize);

    // Build OR conditions for this batch
    // Format: name.ilike.value1,name.ilike.value2,...
    // Use exact matching (case-insensitive) by not using wildcards
    const orConditions = batch
      .map((name) => {
        // Escape special characters for ilike
        const escapedName = name.replace(/[%_\\]/g, "\\$&");
        return `name.ilike.${escapedName}`;
      })
      .join(",");

    const { data: cards, error } = await supabaseClient
      .from("cards")
      .select("name")
      .or(orConditions)
      .limit(batchSize * 3); // Allow for multiple matches per name

    if (error) {
      console.error("Error validating card names:", error);
      continue;
    }

    if (cards) {
      allMatchingCards.push(...cards);
    }
  }

  // Create a case-insensitive map of all matching cards
  const dbCardMap = new Map<string, string>();
  allMatchingCards.forEach((card: { name: string }) => {
    const lowerName = card.name.toLowerCase();
    if (!dbCardMap.has(lowerName)) {
      dbCardMap.set(lowerName, card.name);
    }
  });

  // Match input names to database names (case-insensitive, exact match)
  for (const inputName of cardNames) {
    // Try exact match first
    const dbName = dbCardMap.get(inputName.toLowerCase());
    if (dbName) {
      validCardNames.add(dbName); // Use the exact database name
    } else {
      // Try to find a card that matches (case-insensitive)
      // This handles cases where the AI response has slight variations
      for (const [dbLowerName, dbExactName] of dbCardMap.entries()) {
        if (dbLowerName === inputName.toLowerCase()) {
          validCardNames.add(dbExactName);
          break;
        }
      }
    }
  }

  return validCardNames;
}

// Helper: sanitize AI response by removing references to invalid card names
function sanitizeResponseText(
  text: string,
  validCardNames: Set<string>,
): string {
  if (validCardNames.size === 0) return text;

  // Create a case-insensitive map
  const validNamesMap = new Map<string, string>();
  validCardNames.forEach((name) => {
    validNamesMap.set(name.toLowerCase(), name);
  });

  // Extract all potential card names from the text
  const extractedNames = extractCardNamesFromText(text);
  let sanitized = text;

  // For each extracted name, check if it's valid
  for (const extractedName of extractedNames) {
    const isValid = validNamesMap.has(extractedName.toLowerCase());
    if (!isValid) {
      // Remove or replace invalid card name references
      // Option 1: Remove bold formatting around invalid names
      sanitized = sanitized.replace(
        new RegExp(
          `\\*\\*${extractedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*\\*`,
          "gi",
        ),
        extractedName,
      );
      // Option 2: Remove quoted invalid names (replace with just the name)
      sanitized = sanitized.replace(
        new RegExp(
          `"${extractedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
          "gi",
        ),
        extractedName,
      );
    }
  }

  return sanitized;
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
    if (
      card.level !== undefined &&
      card.level !== null &&
      cardType.includes("monster")
    ) {
      totalLevel += card.level * card.totalCount;
      levelCount += card.totalCount;
    }

    // Archetype counts
    const archetypeName = getArchetypeNameServer(card);
    if (archetypeName) {
      archetypeCounts[archetypeName] =
        (archetypeCounts[archetypeName] || 0) + card.totalCount;
    }

    // Type counts (race)
    if (card.race) {
      typeCounts[card.race] = (typeCounts[card.race] || 0) + card.totalCount;
    }

    // Attribute counts
    if (card.attribute) {
      attributeCounts[card.attribute] =
        (attributeCounts[card.attribute] || 0) + card.totalCount;
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
      },
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
        },
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
      "custom",
    ];
    if (!validAnalysisTypes.includes(analysis_type as AnalysisType)) {
      return new Response(JSON.stringify({ error: "Invalid analysis_type." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        },
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

    const allDeckCardIds = [...mainCardIds, ...sideCardIds, ...extraCardIds];

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
      (card) => banlist[card.name] !== "Forbidden",
    );

    // --- Enrich cards with counts ---
    // CRITICAL: Normalize archetype when mapping deck cards
    const safeDeckCards: CardWithCounts[] = deckCardsFiltered.map((card) => {
      const counts = idCounts[card.id] || { main: 0, side: 0, extra: 0 };
      return {
        ...card,
        archetype: getArchetypeNameServer(card), // Normalize archetype
        main: counts.main,
        side: counts.side,
        extra: counts.extra,
        totalCount: counts.main + counts.side + counts.extra,
      };
    });

    // --- Context builder: archetypes/types/attributes for pool filtering ---
    const deckArchetypes = new Set(
      safeDeckCards
        .map((c) => getArchetypeNameServer(c))
        .filter((a): a is string => Boolean(a)),
    );
    const deckTypes = new Set(
      safeDeckCards.map((c) => c.type).filter((t): t is string => Boolean(t)),
    );
    const deckAttributes = new Set(
      safeDeckCards
        .map((c) => c.attribute)
        .filter((a): a is string => Boolean(a)),
    );

    // --- Card pool selection: FTS for card_suggestions (quick prompt only), filters for others ---
    let relevantCards: Card[] = [];
    let candidateCards: (Card & { candidateId: number })[] = []; // For card_suggestions: explicit candidate list

    if (analysis_type === "card_suggestions") {
      // Build candidate card pool: cards the LLM is allowed to recommend
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
        },
      );

      if (matchError) {
        console.error("Error in match_cards_by_text:", matchError);
      }

      const pool = (matches ?? []).map((m: any) => {
        // CRITICAL: Normalize archetype immediately when mapping from database
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

      // CRITICAL: Filter forbidden cards BEFORE building candidate list
      // Forbidden cards must NEVER appear in candidateCards, LLM prompts, or suggestions
      const banlistMap = new Map<string, string>(Object.entries(banlist));
      const allowedCandidates = pool.filter((c: Card) => {
        const ban = banlistMap.get(c.name) || "Unlimited";
        return ban !== "Forbidden"; // REMOVE forbidden cards completely
      });

      const uniqueFiltered = onlyUniqueByName(allowedCandidates).slice(0, 60); // Limit to 60 candidates

      // Map to candidate cards with candidateId (index starting at 1)
      // CRITICAL: Normalize archetype to string or null for CandidateCard
      candidateCards = uniqueFiltered.map((card, index) => {
        const archetypeName = getArchetypeNameServer(card);
        return {
          candidateId: index + 1,
          name: card.name,
          type: card.type,
          race: card.race,
          desc: card.desc,
          archetype: archetypeName || null,
        } as Card & { candidateId: number };
      });

      relevantCards = candidateCards; // Also set for backward compatibility
    } else if (analysis_type === "custom") {
      // Custom analysis: use enhanced search with broader context
      const searchQuery = buildCardSearchQuery({
        question: question ?? "",
        deckArchetypes,
        deckTypes,
        deckAttributes,
      });

      const matchCount = 100;
      const excludedIds = allDeckCardIds.length ? allDeckCardIds : [0];

      const { data: matches, error: matchError } = await supabase.rpc(
        "match_cards_by_text",
        {
          query: searchQuery,
          match_count: matchCount,
          excluded_ids: excludedIds,
          banlist_format,
        },
      );

      if (matchError) {
        console.error("Error in match_cards_by_text:", matchError);
      }

      const pool = (matches ?? []).map((m: any) => {
        // CRITICAL: Normalize archetype immediately when mapping from database
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

      // CRITICAL: Filter forbidden cards
      const banlistMap = new Map<string, string>(Object.entries(banlist));
      const filtered = pool.filter((card: Card) => {
        const ban = banlistMap.get(card.name) || "Unlimited";
        return ban !== "Forbidden";
      });
      relevantCards = onlyUniqueByName(filtered).slice(0, 80);
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

      // CRITICAL: Filter forbidden cards and normalize archetype
      const banlistMap = new Map<string, string>(Object.entries(banlist));
      relevantPoolCards = (relevantPoolCards ?? [])
        .map((card) => ({
          ...card,
          archetype: getArchetypeNameServer(card), // Normalize archetype
        }))
        .filter((card) => {
          const ban = banlistMap.get(card.name) || "Unlimited";
          return ban !== "Forbidden";
        });

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
    // For card_suggestions, use shorter context (quick prompt only)
    const isQuickPrompt = analysis_type === "card_suggestions";

    const deckSummary = `
Format: ${banlist_format}
Deck Name: ${deckData.name}
Key cards: ${safeDeckCards
      .slice(0, isQuickPrompt ? 8 : 12)
      .map((c) => `${c.name} (x${c.totalCount})`)
      .join(", ")}
Archetypes: ${[...deckArchetypes].join(", ")}
Types: ${[...deckTypes].join(", ")}
Attributes: ${[...deckAttributes].join(", ")}
`;

    const deckDetailContext = safeDeckCards
      .slice(0, isQuickPrompt ? 6 : 10)
      .map((card) => {
        const archetypeName = getArchetypeNameServer(card);
        return `${card.name} (x${card.totalCount}) [Main: ${card.main}, Side: ${card.side}, Extra: ${card.extra}] (${card.type}${
          archetypeName ? ", " + archetypeName : ""
        }): ${isQuickPrompt ? truncateDesc(card.desc, 150) : card.desc}`;
      })
      .join("\n\n");

    // Build candidate cards section for card_suggestions (numbered format)
    let candidateCardsSection = "";
    if (analysis_type === "card_suggestions" && candidateCards.length > 0) {
      candidateCardsSection = candidateCards
        .map((card: any) => {
          const archetypeName = getArchetypeNameServer(card);
          const candidateId = card.candidateId || 0;
          // Format: candidateId. Card Name | Type | Archetype (if exists) | "Description"
          return `${candidateId}. ${card.name} | ${card.type}${archetypeName ? ` | ${archetypeName}` : ""} | "${truncateDesc(card.desc, 180)}"`;
        })
        .join("\n");
    }

    const relevantCardsContext = relevantCards
      .slice(0, isQuickPrompt ? 30 : relevantCards.length)
      .map((card: Card) => {
        const archetypeName = getArchetypeNameServer(card);
        return `${card.name} (${card.type}${
          archetypeName ? ", " + archetypeName : ""
        }): ${truncateDesc(card.desc, isQuickPrompt ? 150 : 220)}`;
      })
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
   - QUICK PROMPT ONLY: Keep your response short and direct.
   - You MUST return JSON with this exact schema:

   {
     "strategy": "Clear explanation about what improves the deck overall and why these cards help.",
     "suggestions": [
       {
         "candidateId": 3,
         "reason": "Explanation why candidate #3 is a good fit for this deck.",
         "synergy_with_candidateIds": [1, 2]
       }
     ]
   }

   STRICT RULES (YOU MUST FOLLOW):
   - You MUST ONLY recommend cards from the numbered CANDIDATE CARDS LIST provided below.
   - You MUST NOT create new cards or rename cards.
   - If a recommended card is not in the list, DO NOT output it.
   - NEVER output invented cards like "Mystic Tomahawk" or any equipment spell that is not in the list.
   - You MUST use candidateId numbers ONLY (e.g., if you want the card listed as "3. Card Name", use candidateId: 3).
   - DO NOT use card names in suggestions - ONLY use candidateId numbers.
   - If you think of a card that is not in the list, choose the CLOSEST matching candidate from the list OR return an empty suggestions array.
   - Keep explanations concise.
   - synergy_with_candidateIds is optional and should only include candidateId numbers from the list.
   - The "strategy" field should provide overall deck improvement context without mentioning specific card names.

8) If analysis_type === "custom":
   - Answer the user's question about their deck in a natural, conversational way.
   - You may mention specific cards from the "Relevant legal pool cards" context, but ONLY mention cards that actually exist in that list.
   - DO NOT invent or make up card names. Only reference cards from the provided context.
   - When mentioning card names, format them in bold markdown: **Card Name** (e.g., **Blue-Eyes White Dragon**).
   - This helps users identify which cards you're discussing and allows them to add those cards to their deck.
   - Return a simple text response (not JSON) that directly answers the user's question.
   - Be helpful, specific, and reference actual cards when relevant.
   - Handle various request types:
     * Boss monster pairings: Identify XYZ, Link, Fusion, Synchro, Ritual monsters and suggest enabling cards
     * Hidden synergies: Look for cross-archetype interactions, engine cards, spell/trap support
     * Going first vs going second: Provide tailored suggestions based on turn order
     * Meta counters: Identify meta archetypes mentioned and suggest counter cards
     * Engine replacements: Suggest alternative engines (e.g., Bystials → Blue-Eyes, Shaddoll engine, Invoked engine)
     * Board breakers: Find cards that help break opponent boards
     * Draw power: Find cards that help with card advantage
     * Floodgates: Find floodgates that shut down specific meta decks
     * Deck conversion: Help convert between control, OTK, combo, etc.

For ALL analysis_type values:
- Respond with strict JSON only. No markdown.
- Do NOT include any fields outside the specified schema for the given analysis_type.
- EXCEPTION: For "custom" analysis_type, return plain text (not JSON).
`;

    // Build custom prompt with enhanced context for custom analysis
    let customContext = "";
    if (analysis_type === "custom") {
      // Detect request type and add relevant context
      const questionLower = (question || "").toLowerCase();

      // Detect boss monster types
      const bossTypes: string[] = [];
      if (questionLower.includes("xyz") || questionLower.includes("xyz"))
        bossTypes.push("XYZ");
      if (questionLower.includes("link")) bossTypes.push("Link");
      if (questionLower.includes("fusion")) bossTypes.push("Fusion");
      if (questionLower.includes("synchro")) bossTypes.push("Synchro");
      if (questionLower.includes("ritual")) bossTypes.push("Ritual");

      // Detect going first/second
      const goingFirst =
        questionLower.includes("going first") ||
        questionLower.includes("go first") ||
        questionLower.includes("1st");
      const goingSecond =
        questionLower.includes("going second") ||
        questionLower.includes("go second") ||
        questionLower.includes("2nd");

      // Detect meta archetypes
      const metaArchetypes = [
        "branded",
        "spright",
        "tearlament",
        "kash",
        "kashtira",
        "purrely",
        "labrynth",
        "dlink",
        "dragon link",
      ];
      const mentionedMeta = metaArchetypes.filter((meta) =>
        questionLower.includes(meta),
      );

      customContext = `
Additional Context for Custom Analysis:
${bossTypes.length > 0 ? `- User is asking about ${bossTypes.join(", ")} boss monsters. Focus on enabling cards, materials, and support.` : ""}
${goingFirst ? "- User wants suggestions for going FIRST. Focus on combo starters, extenders, and board setup." : ""}
${goingSecond ? "- User wants suggestions for going SECOND. Focus on board breakers, hand traps, and going-second cards." : ""}
${mentionedMeta.length > 0 ? `- User mentioned meta archetypes: ${mentionedMeta.join(", ")}. Consider counter strategies and cards.` : ""}
${questionLower.includes("engine") ? "- User is asking about deck engines. Consider engine packages and replacements." : ""}
${questionLower.includes("counter") || questionLower.includes("counter") ? "- User wants counter cards. Focus on cards that shut down specific strategies." : ""}
${questionLower.includes("floodgate") ? "- User wants floodgates. Focus on cards that restrict opponent plays." : ""}
${questionLower.includes("control") ? "- User wants control deck suggestions. Focus on resource management and disruption." : ""}
${questionLower.includes("otk") || questionLower.includes("one turn kill") ? "- User wants OTK suggestions. Focus on high damage output and combo finishers." : ""}
`;
    }

    // Build prompt with candidate cards section for card_suggestions
    let prompt = `
You are an expert Yu-Gi-Oh! ${
      banlist_format === "MASTER_DUEL" ? "Master Duel" : "TCG"
    } deckbuilder. Enforce card legality for the chosen format.

VALIDATED FACTS HARD RULE: Do not invent brick rates, win rates, or combo lines. Prefer any VALIDATED FACTS block over heuristic stats when both are present.

Deck Name Rule:
- NEVER rename, restyle, or reinterpret the deck name.
- Refer to the deck ONLY as "this deck" or "the current deck".
- Do NOT output a deck title. Only provide card recommendations and analysis.

Deck summary:
${deckSummary}

${
  !isQuickPrompt
    ? `Computed stats:
${featureSummary}

Deck capacity:
${suggestionConstraints}
`
    : `Deck capacity:
${suggestionConstraints}
`
}

Key deck cards (with copies and effects):
${deckDetailContext}
`;

    // For card_suggestions, add explicit candidate cards list
    if (analysis_type === "card_suggestions") {
      prompt += `
You are ONLY allowed to recommend cards from this numbered candidate list:

${candidateCardsSection || "No candidate cards available."}

STRICT RULES (YOU MUST FOLLOW):
- You MUST ONLY recommend cards from the numbered candidate list above.
- You MUST NOT create new cards or rename cards.
- If a recommended card is not in the list, DO NOT output it.
- NEVER output invented cards like "Mystic Tomahawk" or any equipment spell that is not in the list.
- You MUST use candidateId numbers ONLY - NEVER use card names in your suggestions.
- If you think of a card that is not in the list, choose the CLOSEST matching candidate from the list OR return an empty suggestions array.
- You MUST ONLY mention or recommend cards that are in:
  - The current deck list, or
  - The numbered candidate list above.
- NEVER output invented names like "Mystic Tomahawk" or any other made-up card.
- Refer to the deck only as "this deck" or "the current deck"; do not rename it.

`;
    } else {
      prompt += `
Relevant legal pool cards ('not in deck', matching deck archetype/type/attribute):
${relevantCardsContext}

STRONG RULES (MUST FOLLOW):
- You MUST ONLY mention or recommend cards that are in:
  - The current deck list, or
  - The relevant legal pool cards listed above.
- You MUST NOT invent or rename any card.
- If you think of a card that is not in the allowed lists, DO NOT mention it.
- NEVER output invented names like "Mystic Tomahawk" or any other made-up card.
- Refer to the deck only as "this deck" or "the current deck"; do not rename it.

`;
    }

    prompt += `
User question:
${question}

Requested analysis_type: "${analysis_type}"
${customContext}
${analysisInstructions}
`;

    // --- Build allowedCardNames whitelist for sanitization ---
    const deckCardNames = safeDeckCards.map((card) => card.name);
    const candidateNames = candidateCards.map((c) => c.name);
    const relevantCardNames = relevantCards.map((c) => c.name);

    // Unique allowed card names (deck + candidates + relevant pool)
    const allowedCardNames = Array.from(
      new Set(
        [...deckCardNames, ...candidateNames, ...relevantCardNames].map((n) =>
          n.trim(),
        ),
      ),
    );

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
    let aiContent = sanitizeAiCardText(rawContent, allowedCardNames);
    const requestsLeft = Number(
      groqResponse.headers.get("x-ratelimit-remaining-requests"),
    );
    const maxRequests = Number(
      groqResponse.headers.get("x-ratelimit-limit-requests"),
    );

    // --- For "custom" analysis type: validate and sanitize card names ---
    let validatedCards: Card[] = [];
    if (analysis_type === "custom") {
      const extractedCardNames = extractCardNamesFromText(aiContent);
      if (extractedCardNames.length > 0) {
        const validCardNames = await validateCardNames(
          supabase,
          extractedCardNames,
        );
        // Sanitize the response to remove emphasis from invalid card names
        // Also apply full sanitization with allowedCardNames
        aiContent = sanitizeResponseText(aiContent, validCardNames);
        aiContent = sanitizeAiCardText(aiContent, allowedCardNames);
        // Log warning if invalid cards were found
        const invalidCards = extractedCardNames.filter(
          (name) => !validCardNames.has(name.toLowerCase()),
        );
        if (invalidCards.length > 0) {
          console.warn(
            `Invalid card names found in custom response: ${invalidCards.join(", ")}`,
          );
        }

        // Fetch full card data for validated card names
        if (validCardNames.size > 0) {
          const validNamesArray = Array.from(validCardNames);
          const { data: cardData, error: cardError } = await supabase
            .from("cards")
            .select(
              "id, name, type, desc, level, race, attribute, archetype, card_images, atk, def, misc_info, card_sets, card_prices",
            )
            .in("name", validNamesArray)
            .limit(validNamesArray.length);

          if (!cardError && cardData) {
            validatedCards = cardData.map((card: any) => ({
              id: card.id,
              name: card.name,
              type: card.type,
              desc: card.desc,
              level: card.level,
              race: card.race || "",
              attribute: card.attribute,
              archetype: getArchetypeNameServer(card),
              atk: card.atk,
              def: card.def,
              card_images: card.card_images || [],
              misc_info: card.misc_info || [],
              card_sets: card.card_sets || [],
              card_prices: card.card_prices || [],
            }));
          }
        }
      }
    }

    // --- Parse JSON from LLM response (skip for "custom" type) ---
    let parsedAnalysis: any = null;
    let strategyText: string = "";
    let cardSuggestions: Array<{
      candidateId: number;
      reason: string;
      synergy_with_candidateIds?: number[];
    }> = [];
    let recommendedCards: Card[] = [];

    if (analysis_type !== "custom") {
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

        // For card_suggestions, extract strategy and validate candidateId recommendations
        if (analysis_type === "card_suggestions") {
          // Extract strategy text if present and sanitize it
          strategyText = sanitizeAiCardText(
            parsedAnalysis?.strategy || "",
            allowedCardNames,
          );

          if (parsedAnalysis?.suggestions) {
            const rawSuggestions = Array.isArray(parsedAnalysis.suggestions)
              ? parsedAnalysis.suggestions
              : [];

            // Validate candidateId values against candidate list
            // Drop invalid IDs - candidateId must be a valid integer within range
            const maxId = candidateCards.length;
            const validSuggestions = rawSuggestions.filter((s: any) => {
              const candidateId = s.candidateId;
              // Must be integer, within valid range, and candidate must exist
              if (
                !Number.isInteger(candidateId) ||
                candidateId < 1 ||
                candidateId > maxId
              ) {
                return false;
              }
              // Verify the candidate actually exists in candidateCards
              const candidate = candidateCards[candidateId - 1];
              return candidate !== undefined;
            });

            // If no valid suggestions, return empty response with message
            if (validSuggestions.length === 0) {
              cardSuggestions = [];
              recommendedCards = [];
              // Set a message in raw_answer for the frontend (use strategy if available)
              aiContent =
                strategyText ||
                "No additional legal card recommendations were found for this deck from the current candidate pool.";
            } else {
              // Sanitize reason fields in suggestions
              cardSuggestions = validSuggestions.map((s: any) => ({
                ...s,
                reason: sanitizeAiCardText(s.reason || "", allowedCardNames),
              }));

              // Map candidateId → real card rows
              // NEVER accept invented cards - only map valid candidateIds
              const recommendedCandidates = validSuggestions
                .map((s: any) => {
                  const candidateId = s.candidateId;
                  if (
                    candidateId >= 1 &&
                    candidateId <= candidateCards.length
                  ) {
                    return candidateCards[candidateId - 1];
                  }
                  return undefined;
                })
                .filter((card): card is Card => card !== undefined);

              if (recommendedCandidates.length > 0) {
                // Get unique card names from recommended candidates
                const recommendedNames = recommendedCandidates.map(
                  (c) => c.name,
                );

                // Fetch full card data from database
                const nameConditions = recommendedNames
                  .map((name: string) => {
                    const escapedName = name.replace(/[%_\\]/g, "\\$&");
                    return `name.ilike.${escapedName}`;
                  })
                  .join(",");

                const { data: cardData, error: cardError } = await supabase
                  .from("cards")
                  .select(
                    "id, name, type, desc, level, race, attribute, archetype, card_images, atk, def, misc_info, card_sets, card_prices",
                  )
                  .or(nameConditions)
                  .limit(recommendedNames.length * 2);

                if (!cardError && cardData) {
                  // CRITICAL: Normalize archetype when mapping from database
                  const normalizedCardData = cardData.map((card: any) => ({
                    ...card,
                    archetype: getArchetypeNameServer(card), // Normalize archetype
                  }));

                  // Filter to exact matches (case-insensitive)
                  const nameMap = new Map(
                    normalizedCardData.map((card: Card) => [
                      card.name.toLowerCase(),
                      card,
                    ]),
                  );

                  recommendedCards = recommendedNames
                    .map((name: string) => nameMap.get(name.toLowerCase()))
                    .filter((card): card is Card => card !== undefined);

                  // Final validation: ensure all recommended cards are not forbidden
                  const banlistMap = new Map<string, string>(
                    Object.entries(banlist),
                  );
                  recommendedCards = recommendedCards.filter((card) => {
                    const ban = banlistMap.get(card.name) || "Unlimited";
                    return ban !== "Forbidden";
                  });

                  // Update cardSuggestions to only include those with matching, legal cards
                  cardSuggestions = cardSuggestions.filter((s: any) => {
                    const candidate = candidateCards[s.candidateId - 1];
                    if (!candidate) return false;
                    const card = recommendedCards.find(
                      (c) =>
                        c.name.toLowerCase() === candidate.name.toLowerCase(),
                    );
                    return card !== undefined;
                  });
                } else {
                  // If database query failed, return empty
                  cardSuggestions = [];
                  recommendedCards = [];
                }
              } else {
                // If no valid candidates found, return empty
                cardSuggestions = [];
                recommendedCards = [];
              }
            }
          }
          // Update raw_answer to include strategy if available
          if (strategyText && cardSuggestions.length > 0) {
            aiContent = strategyText;
          }
        }
      } catch {
        parsedAnalysis = null;
        if (analysis_type === "card_suggestions") {
          cardSuggestions = [];
          recommendedCards = [];
        }
      }
    }

    return new Response(
      JSON.stringify({
        user,
        analysis_type,
        raw_answer: aiContent,
        structured_analysis: parsedAnalysis,
        suggestions:
          analysis_type === "card_suggestions" ? cardSuggestions : undefined,
        recommendedCards:
          analysis_type === "card_suggestions" ? recommendedCards : undefined,
        deck_cards: safeDeckCards,
        relevant_card_pool: relevantCards,
        validated_cards:
          analysis_type === "custom" ? validatedCards : undefined, // Return validated cards for custom responses
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
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
