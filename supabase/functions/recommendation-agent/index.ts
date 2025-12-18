// Recommendation Agent - Strict JSON Schema Implementation (Phase 2)
// Rationale: Enforces strict JSON-only output using RECOMMENDER_SCHEMA with comprehensive validation,
// error handling, and consistency improvements. Integrates with existing hybrid search infrastructure.

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
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
const RETRIEVAL_K = 30;
const MODEL_TEMP = 0.12; // Low temperature for consistency
const MAX_OUTPUT_TOKENS = 800;
const APPLY_CONF_THRESHOLD = 0.6;
const INVESTIGATE_THRESHOLD = 0.45;
const MAX_PROMPT_CARD_SUMMARY_CHARS = 700;

// ============================================================================
// Zod Schemas (matching types/recommender.ts)
// ============================================================================

const DeckCardZ = z.object({
  cardId: z.number(),
  count: z.number().min(0),
});

const DeckZ = z.object({
  main: z.array(DeckCardZ),
  extra: z.array(DeckCardZ).optional().default([]),
  side: z.array(DeckCardZ).optional().default([]),
});

const UserPrefsZ = z
  .object({
    playstyle: z.enum(["aggro", "control", "combo", "stall", "hybrid"]).optional(),
    budget: z.enum(["low", "mid", "high"]).optional(),
  })
  .optional();

const NumberConstraintZ = z
  .object({
    exact: z.number().min(1).max(20).optional(),
    min: z.number().min(1).max(20).optional(),
    max: z.number().min(1).max(20).optional(),
  })
  .optional();

const RecommendationRequestZ = z.object({
  question: z.string().optional(),
  current_deck: DeckZ.optional(),
  format: z.enum(["MASTER_DUEL", "TCG"]).default("MASTER_DUEL"),
  recommendation_type: z
    .enum(["personalized", "archetype", "engine", "tech", "simple"])
    .optional(),
  use_hybrid_search: z.boolean().optional().default(true),
  explainTo: z.enum(["novice", "intermediate", "advanced"]).optional().default("novice"),
  userPrefs: UserPrefsZ,
  maxOutputTokens: z.number().optional().default(MAX_OUTPUT_TOKENS),
  numberConstraint: NumberConstraintZ,
});

const CardDocZ = z.object({
  id: z.number(),
  name: z.string(),
  desc: z.string().optional().default(""),
  archetype: z.string().nullable().optional(),
  ban_tcg: z.string().nullable().optional(),
  master_duel_banned: z.boolean().optional().default(false),
  imageurl: z.string().optional().nullable(),
});

const RecoItemZ = z.object({
  cardId: z.string(),
  cardName: z.string().optional(),
  action: z.enum(["add", "remove", "replace", "tech", "note"]),
  reason: z.string(),
  impactEst: z.number().min(-1).max(1),
  synergyScore: z.number().min(0).max(1).optional(),
  evidence: z.array(z.string()),
  banned: z.boolean().optional(),
});

const UIBlockContentZ = z.union([
  z.string(),
  z.array(z.string()),
  z.record(z.string(), z.any()),
]);

const UIBlockZ = z.object({
  id: z.string(),
  type: z.enum(["text", "list", "card", "table", "suggestion"]),
  content: UIBlockContentZ,
});

const RecommenderZ = z.object({
  schemaVersion: z.string(),
  confidence: z.number().min(0).max(1),
  explainTo: z.enum(["novice", "intermediate", "advanced"]),
  summary: z.string().optional(),
  recommendations: z.array(RecoItemZ),
  ui: z.array(UIBlockZ),
  actions: z.record(z.string(), z.any()).optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

// ============================================================================
// Strict JSON-Only System Prompt
// ============================================================================

const STRICT_SYSTEM_PROMPT = `You are a Yu-Gi-Oh! deck recommender assistant for an interactive web UI. You must ONLY output a single JSON object (no surrounding text, no markdown, no comments). The JSON must follow the RECOMMENDER_SCHEMA exactly. If you cannot satisfy the schema, return an object with "schemaVersion", "confidence":0.0, "explainTo":"novice", "recommendations":[], and a "ui" field with an investigation suggestion.

Hard rules:

- NEVER invent card names or IDs. All recommended cards must match cardIds provided in the 'cardPool' context supplied in the prompt.

- Respect format-specific banlist metadata in cardPool (ban_tcg / master_duel_banned). Mark banned suggestions with "banned": true and set "action":"note" instead of add/remove.

- Confidence range: 0.0 - 1.0. If confidence < 0.45, be conservative and prefer 'investigate' recommendations.

- explainTo is one of "novice"|"intermediate"|"advanced". Use this to tailor explanations.

- ui must be an ordered array of render blocks. Block types: "text","list","card","table","suggestion".

- No raw HTML/markdown in 'content' fields. Use plain text or arrays.

- Use retrieval context only — do not hallucinate extra card text beyond what's provided. If inferring, tag the evidence with "INFERENCE:" prefix.

- Keep output concise.

RECOMMENDER_SCHEMA:

{
  "schemaVersion": "string",
  "confidence": number,
  "explainTo": "novice"|"intermediate"|"advanced",
  "summary": "string",
  "recommendations": [
    {
      "cardId": "string",         // must match cardPool ids
      "cardName": "string",
      "action": "add"|"remove"|"replace"|"tech"|"note",
      "reason": "string",
      "impactEst": number,        // -1..+1
      "synergyScore": number,     // 0..1
      "evidence": ["string"],     // references to card text/name in cardPool
      "banned": boolean (optional)
    }
  ],
  "ui": [
    {"id":"string","type":"text"|"list"|"card"|"table"|"suggestion","content": string | string[] | object}
  ],
  "actions": object,
  "meta": object
}

When constructing recommendations:

- Use at most top-k cardPool docs supplied. Prefer cards already in the current deck for "synergyScore" context.

- Provide concise "summary" at top-level and a short "explainTo"-level tailored teaching note for each recommendation.

- Evidence items should reference exact strings from cardPool (e.g., "Dark Magician — 'When this card is summoned...'" or "INFERENCE: based on X + Y").

- ui blocks guide the client to render. For actionable suggestions include a "suggestion" block with \`content\` object: { "suggestionId":string, "cardId":string, "verb":"apply"|"preview", "label":"Apply: add 1x Hand Trap" }.

FAIL-FAST: If you are missing required data to make a safe recommendation (e.g., cardPool missing for a recommended card), return confidence:0 and an "investigate" UI block.`;

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
    console.error("Error loading Master Duel banlist:", err);
    return {};
  }
}

// Analyze user's deck history to build profile
async function analyzeUserProfile(
  supabaseClient: any,
  userId: string,
  format: "MASTER_DUEL" | "TCG",
): Promise<{
  preferredArchetypes: string[];
  playstylePattern:
    | "control"
    | "aggro"
    | "combo"
    | "midrange"
    | "stun"
    | "mixed";
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

    const averageDeckComplexity =
      decks.length > 0 ? totalComplexity / decks.length : 50;

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
  excludeIds: number[] = [],
): Promise<Card[]> {
  if (!archetype) return [];

  // Try exact match first, then case-insensitive match
  // Use case-insensitive search to catch "Toy" regardless of case
  let query = supabaseClient
    .from("cards")
    .select(
      "id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg",
    )
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
      .select(
        "id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg",
      )
      .ilike("archetype", `%${archetype}%`);

    if (excludeIds.length > 0) {
      partialQuery = partialQuery.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data: partialData, error: partialError } =
      await partialQuery.limit(50);

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
        .select(
          "id, name, type, desc, level, race, attribute, archetype, atk, def, ban_tcg",
        )
        .ilike("archetype_normalized", `%${archetype.toLowerCase()}%`);

      if (excludeIds.length > 0) {
        normalizedQuery = normalizedQuery.not(
          "id",
          "in",
          `(${excludeIds.join(",")})`,
        );
      }

      const { data: normalizedData, error: normalizedError } =
        await normalizedQuery.limit(50);

      if (!normalizedError && normalizedData && normalizedData.length > 0) {
        data = normalizedData;
        error = null;
        console.log(
          `  Found ${normalizedData.length} cards using archetype_normalized column`,
        );
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
    console.log(
      `  Sample: ${results
        .slice(0, 3)
        .map((c: Card) => c.name)
        .join(", ")}`,
    );
  }

  return results;
}

// ============================================================================
// Phase 2: New Helper Functions for Strict Schema
// ============================================================================

/**
 * Hash deck blob into SHA256 hex (for caching)
 */
async function fingerprintDeck(
  deck: unknown,
  explainTo: string,
  prefs: unknown,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = JSON.stringify({ deck, explainTo, prefs });
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build concise summary string for card for prompt
 */
function makeCardSummary(card: z.infer<typeof CardDocZ>): string {
  const desc = (card.desc || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROMPT_CARD_SUMMARY_CHARS);
  return `${card.id} | ${card.name} | archetype:${card.archetype || ""} | ban_tcg:${card.ban_tcg || ""} | master_duel_banned:${!!card.master_duel_banned} | desc: ${desc}`;
}

/**
 * Build the system+user prompt that will be sent to Groq LLM (strict JSON format)
 */
function buildStrictPrompt(
  payload: z.infer<typeof RecommendationRequestZ>,
  cardDocs: z.infer<typeof CardDocZ>[],
): Array<{ role: string; content: string }> {
  const system = STRICT_SYSTEM_PROMPT;

  const cardSummaries = cardDocs.map(makeCardSummary).join("\n");

  // Build number constraint instruction
  let numberConstraintInstruction = "";
  if (payload.numberConstraint) {
    if (payload.numberConstraint.exact !== undefined) {
      numberConstraintInstruction = `\n\nIMPORTANT: The user specifically requested exactly ${payload.numberConstraint.exact} card recommendation(s). Please provide exactly ${payload.numberConstraint.exact} recommendation(s) in the recommendations array. Do not provide more or fewer.`;
    } else if (
      payload.numberConstraint.min !== undefined &&
      payload.numberConstraint.max !== undefined
    ) {
      numberConstraintInstruction = `\n\nIMPORTANT: The user requested between ${payload.numberConstraint.min} and ${payload.numberConstraint.max} card recommendations. Please provide between ${payload.numberConstraint.min} and ${payload.numberConstraint.max} recommendations in the recommendations array.`;
    } else if (payload.numberConstraint.min !== undefined) {
      numberConstraintInstruction = `\n\nIMPORTANT: The user requested at least ${payload.numberConstraint.min} card recommendation(s). Please provide at least ${payload.numberConstraint.min} recommendation(s) in the recommendations array.`;
    } else if (payload.numberConstraint.max !== undefined) {
      numberConstraintInstruction = `\n\nIMPORTANT: The user requested at most ${payload.numberConstraint.max} card recommendation(s). Please provide at most ${payload.numberConstraint.max} recommendation(s) in the recommendations array.`;
    }
  }

  const userObj = {
    currentDeck: payload.current_deck || { main: [], extra: [], side: [] },
    userPrefs: payload.userPrefs || {},
    format: payload.format || "MASTER_DUEL",
    explainTo: payload.explainTo || "novice",
    maxOutputTokens: payload.maxOutputTokens || MAX_OUTPUT_TOKENS,
    numberConstraint: payload.numberConstraint || undefined,
    cardPoolSummaries: cardDocs.map((c) => ({
      id: c.id,
      name: c.name,
      archetype: c.archetype,
      ban_tcg: c.ban_tcg,
      desc: (c.desc || "").slice(0, MAX_PROMPT_CARD_SUMMARY_CHARS),
    })),
  };

  const userContent = JSON.stringify(userObj) + numberConstraintInstruction;

  const messages = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];

  return messages;
}

/**
 * Try to parse model output strictly as JSON; if it's a string with extra text,
 * attempt to find the first JSON object substring.
 */
function extractJsonLike(text: string): any {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    const candidate = text.slice(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // pass through
    }
  }

  // final attempt: parse entire string
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Validate model output using zod; throws on invalid
 */
function validateRecommender(parsed: unknown): z.infer<typeof RecommenderZ> {
  return RecommenderZ.parse(parsed);
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify Supabase connection by testing cards table access
    const { data: testCards, error: testError } = await supabase
      .from("cards")
      .select("id")
      .limit(1);
    
    if (testError) {
      console.error("❌ Cannot access cards table:", {
        error: testError.message,
        code: testError.code,
        details: testError.details,
        hint: testError.hint,
      });
    } else {
      console.log(`✅ Cards table accessible. Test query returned ${testCards?.length || 0} cards`);
    }

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
          details:
            "No Authorization header found in request. Please ensure you are logged in.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
        },
      );
    }

    // Basic JWT structure validation (should have 3 parts separated by dots)
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      console.error(
        "❌ Token doesn't appear to be a valid JWT (expected 3 parts, got",
        tokenParts.length,
        ")",
      );
      console.error("   Token preview:", token.substring(0, 50), "...");
      return new Response(
        JSON.stringify({
          error: "Invalid token format.",
          details:
            "Token does not appear to be a valid JWT. Please ensure you are using an access token, not an API key.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
            details:
              "The provided token does not contain a user identifier (sub claim). This might be an API key instead of an access token. Please ensure you are logged in and using a valid access token.",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } catch (decodeErr) {
      console.error("❌ Failed to decode token payload:", decodeErr);
      // Continue anyway - let Supabase handle validation
    }

    console.log(
      "🔍 Validating token with Supabase (length:",
      token.length,
      ")",
    );
    let user;
    try {
      // Create a client with anon key for user token validation
      // The service role key can validate user tokens, but let's be explicit
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError) {
        console.error(
          "❌ Auth error:",
          authError.message,
          "Status:",
          authError.status,
        );
        console.error("   Error details:", JSON.stringify(authError));
        return new Response(
          JSON.stringify({
            error: "Authentication failed.",
            details:
              authError.message ||
              "Invalid or expired token. Please try logging in again.",
            error_code: authError.status,
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
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
          },
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
        },
      );
    }

    // Generate recommendation_id for tracking and feedback
    const recommendationId = crypto.randomUUID();
    const startTime = Date.now();

    // Parse and validate request with Zod
    const body = await req.json();
    const parsedReq = RecommendationRequestZ.safeParse(body);

    if (!parsedReq.success) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          details: parsedReq.error.format(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const reqVal = parsedReq.data;
    const {
      question,
      current_deck,
      format = "MASTER_DUEL",
      recommendation_type = "personalized",
      use_hybrid_search = true,
      explainTo = "novice",
      userPrefs,
      maxOutputTokens = MAX_OUTPUT_TOKENS,
    } = reqVal;

    // Phase 2: Deck Legality Check
    const mainCount = (current_deck?.main || []).reduce(
      (s, c) => s + c.count,
      0,
    );

    if (mainCount < 40 || mainCount > 60) {
      const payload = {
        schemaVersion: "1.0.0",
        confidence: 0.0,
        explainTo: explainTo,
        summary: `Deck legality: main deck must be 40-60 cards. Current main deck size: ${mainCount}. Please adjust before applying suggestions.`,
        recommendations: [],
        ui: [
          {
            id: "legality",
            type: "text",
            content: `Deck legality issue: main deck size ${mainCount}. Fix deck to 40–60.`,
          },
          {
            id: "investigate",
            type: "suggestion",
            content: {
              suggestionId: "fix_deck_size",
              label: "Open deck editor",
              verb: "preview",
            },
          },
        ],
        actions: {},
        meta: { mainCount },
      };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!question) {
      return new Response(JSON.stringify({ error: "question is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load banlist
    const banlist =
      format === "MASTER_DUEL" ? await loadMasterDuelBanlist(supabase) : {};

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

    // Phase 2: Convert new deck format (main/extra/side with cardId/count) to old format for compatibility
    // First, collect all cardIds from the new format
    const deckCardIds: number[] = [];
    if (current_deck) {
      deckCardIds.push(...(current_deck.main || []).map((c) => c.cardId));
      deckCardIds.push(...(current_deck.extra || []).map((c) => c.cardId));
      deckCardIds.push(...(current_deck.side || []).map((c) => c.cardId));
    }

    // Fetch actual card data for deck cards (needed for old format compatibility)
    let allDeckCards: Card[] = [];
    if (deckCardIds.length > 0) {
      const uniqueDeckCardIds = [...new Set(deckCardIds)];
      const { data: deckCardData } = await supabase
        .from("cards")
        .select("id, name, type, desc, level, race, attribute, archetype, atk, def")
        .in("id", uniqueDeckCardIds);

      if (deckCardData) {
        allDeckCards = deckCardData.map((c: any) => ({
          ...c,
          archetype: getArchetypeNameServer(c),
        })) as Card[];
      }
    }

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

    // Build deck context text for embedding (convert to old format)
    const deckForContext = allDeckCards.length > 0
      ? {
          mainDeck: allDeckCards.filter((c) =>
            (current_deck?.main || []).some((dc) => dc.cardId === c.id)
          ),
          extraDeck: allDeckCards.filter((c) =>
            (current_deck?.extra || []).some((dc) => dc.cardId === c.id)
          ),
          sideDeck: allDeckCards.filter((c) =>
            (current_deck?.side || []).some((dc) => dc.cardId === c.id)
          ),
        }
      : {};
    const deckContextText = buildDeckContextText(deckForContext);

    // Build query text: question + deck context
    const queryText = `${question}. ${deckContextText}`;

    // Get card candidates using hybrid search
    let candidateCards: CardCandidate[] = [];

    // If archetype detected, try direct archetype search first (more reliable)
    if (questionFilters.archetypes && questionFilters.archetypes.length > 0) {
      console.log(
        `🎯 Archetype detected, searching directly for: ${questionFilters.archetypes.join(", ")}`,
      );
      for (const arch of questionFilters.archetypes) {
        try {
          const archCards = await findCardsByArchetype(
            supabase,
            arch,
            excludeIds,
          );
          console.log(
            `  Found ${archCards.length} cards for archetype "${arch}"`,
          );
          candidateCards.push(
            ...archCards.map((c) => ({
              id: c.id,
              name: c.name,
              archetype: c.archetype,
              type: c.type,
              desc: c.desc,
            })),
          );
        } catch (err) {
          console.warn(`  Error searching for archetype "${arch}":`, err);
        }
      }
      // Deduplicate by ID
      const seenIds = new Set<number>();
      candidateCards = candidateCards.filter((c) => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
      });
      console.log(
        `📊 After archetype search: ${candidateCards.length} unique candidates`,
      );
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
          supabase,
        );
        console.log(
          `🔎 Hybrid search found ${hybridResults.length} candidates`,
        );

        // Merge with archetype results (deduplicate)
        const existingIds = new Set(candidateCards.map((c) => c.id));
        for (const result of hybridResults) {
          if (!existingIds.has(result.id)) {
            candidateCards.push(result);
            existingIds.add(result.id);
          }
        }
        console.log(
          `📊 Total candidates after hybrid search: ${candidateCards.length}`,
        );
      } catch (err) {
        console.error(
          "❌ Hybrid search failed, falling back to simple search:",
          err,
        );
        // Fallback: use simple archetype matching (existing logic)
        if (recommendation_type === "archetype") {
          const archetypeMatch = question.match(
            /(?:for|in|with)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i,
          );
          if (archetypeMatch) {
            const archetypeName = archetypeMatch[1].trim();
            const relatedCards = await findCardsByArchetype(
              supabase,
              archetypeName,
              excludeIds,
            );
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
        const archetypeMatch = question.match(
          /(?:for|in|with)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i,
        );
        if (archetypeMatch) {
          const archetypeName = archetypeMatch[1].trim();
          const relatedCards = await findCardsByArchetype(
            supabase,
            archetypeName,
            excludeIds,
          );
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
      console.warn(
        "⚠️ No candidates found! Attempting fallback search with reduced restrictions...",
      );

      // Last resort: Try a very permissive search for generic terms like "engines", "tech cards", etc.
      const genericTerms = [
        "engine",
        "tech",
        "staple",
        "support",
        "combo",
        "extender",
        "searcher",
      ];
      const lowerQuestion = question.toLowerCase();
      const hasGenericTerm = genericTerms.some((term) =>
        lowerQuestion.includes(term),
      );

      if (hasGenericTerm && use_hybrid_search) {
        console.log(
          "🔄 Attempting permissive fallback search for generic term...",
        );
        try {
          // Build a more generic query based on the question
          let fallbackQuery = "useful cards for deck building";
          if (lowerQuestion.includes("engine")) {
            fallbackQuery = "cards that support deck strategy and enable combos";
          } else if (lowerQuestion.includes("tech")) {
            fallbackQuery = "versatile cards that work in many decks";
          } else if (lowerQuestion.includes("staple")) {
            fallbackQuery = "commonly used staple cards";
          } else if (lowerQuestion.includes("support")) {
            fallbackQuery = "support cards for deck strategies";
          }

          console.log(`🔄 Fallback query: "${fallbackQuery}"`);
          const fallbackEmbedding = await getQueryEmbedding(
            `${fallbackQuery}. ${deckContextText}`,
          );

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
            supabase,
          );

          if (fallbackResults.length > 0) {
            console.log(
              `✅ Fallback search found ${fallbackResults.length} candidates`,
            );
            candidateCards = fallbackResults;
          } else {
            console.warn("⚠️ Fallback search returned no results");
          }
        } catch (err) {
          console.error("❌ Fallback search also failed:", err);
        }
      }

      // If still no candidates, try one more fallback: get random popular cards
      if (candidateCards.length === 0) {
        console.warn(
          "⚠️ No candidates found after all attempts! Trying final fallback: random popular cards...",
        );
        
        try {
          // Final fallback: Get some popular/generic cards that aren't in the deck
          const { data: fallbackCards, error: fallbackError } = await supabase
            .from("cards")
            .select("id, name, type, desc, archetype, ban_tcg")
            .not("id", "in", `(${excludeIds.length > 0 ? excludeIds.slice(0, 50).join(",") : "0"})`)
            .limit(50);
          
          if (!fallbackError && fallbackCards && fallbackCards.length > 0) {
            console.log(`✅ Fallback found ${fallbackCards.length} generic cards`);
            candidateCards = fallbackCards.map((c: any) => ({
              id: c.id,
              name: c.name,
              archetype: c.archetype,
              type: c.type,
              desc: c.desc || "",
            }));
          }
        } catch (fallbackErr) {
          console.error("❌ Final fallback also failed:", fallbackErr);
        }
      }

      // If STILL no candidates after all fallbacks, return proper error response
      if (candidateCards.length === 0) {
        console.error(
          "❌ No candidates found after ALL fallback attempts! Diagnostic info:",
          {
            question,
            questionFilters,
            excludeIds: excludeIds.length,
            excludeArchetypes,
            use_hybrid_search,
            deckSize: allDeckCards.length,
          },
        );

        const fingerprint = await fingerprintDeck(
          current_deck || {},
          explainTo || "novice",
          userPrefs || {},
        );

        const errorPayload = {
          schemaVersion: "1.0.0",
          confidence: 0.0,
          explainTo: explainTo || "novice",
          summary: `I couldn't find any candidate cards matching "${question}". This might be because the search terms don't match any cards in the database, all matching cards are already in your deck, or the search functions may not be available. Try rephrasing your question.`,
          recommendations: [],
          ui: [
            {
              id: "no_candidates",
              type: "text",
              content: `I couldn't find any cards matching your request. Try rephrasing your question or being more specific. For example:
- "What archetype cards work with this deck?"
- "Recommend Spell cards for this strategy"
- "What tech cards counter [specific archetype]?"`,
            },
          ],
          actions: {
            applyAllowed: false,
            investigateRecommended: true,
          },
          meta: {
            deckFingerprint: fingerprint,
            recommendation_id: recommendationId,
            diagnostic: {
              question,
              filters: questionFilters,
              candidates_found: 0,
              exclude_ids_count: excludeIds.length,
              exclude_archetypes: excludeArchetypes,
            },
          },
        };

        return new Response(JSON.stringify(errorPayload), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
      }
    }

    // Apply MMR reranking (enabled by default, skip for "simple" type)
    // IMPORTANT: If archetype was detected, prioritize archetype matches
    let finalCandidates: CardCandidate[] = candidateCards;

    // Check if we have archetype matches that should be prioritized
    const detectedArchetypes = questionFilters.archetypes || [];
    const archetypeMatches =
      detectedArchetypes.length > 0
        ? candidateCards.filter((c) =>
            detectedArchetypes.some(
              (arch) =>
                c.archetype?.toLowerCase().includes(arch.toLowerCase()) ||
                arch.toLowerCase().includes(c.archetype?.toLowerCase() || ""),
            ),
          )
        : [];

    console.log(
      `🎯 Found ${archetypeMatches.length} archetype matches out of ${candidateCards.length} total candidates`,
    );
    if (archetypeMatches.length > 0) {
      console.log(
        `   Archetype match names: ${archetypeMatches.map((c) => c.name).join(", ")}`,
      );
    }

    if (
      use_hybrid_search &&
      recommendation_type !== "simple" &&
      candidateCards.length > 0
    ) {
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
        const archetypeMatchIds = new Set(archetypeMatches.map((c) => c.id));
        const mmrCandidates: MMRCandidate[] = candidateCards.map((c) => {
          const baseSim = c.hybrid_score ?? c.vector_sim ?? 0;
          // Boost archetype matches significantly to ensure they're selected
          const boostedSim = archetypeMatchIds.has(c.id)
            ? baseSim + 0.5
            : baseSim;
          return {
            id: c.id,
            embedding: embMap.get(c.id) ?? null,
            sim: boostedSim,
            row: c,
          };
        });

        // Apply MMR reranking
        const mmrSelected = mmrSelect(
          mmrCandidates,
          queryEmbedding,
          MAX_CANDIDATES_TO_LLM,
          MMR_LAMBDA,
        );
        finalCandidates = mmrSelected.map((s) => s.row);

        // Ensure archetype matches are included (add any missing ones)
        const finalIds = new Set(finalCandidates.map((c) => c.id));
        for (const archMatch of archetypeMatches) {
          if (!finalIds.has(archMatch.id)) {
            finalCandidates.push(archMatch);
            finalIds.add(archMatch.id);
            console.log(
              `  ➕ Added archetype match to final candidates: ${archMatch.name}`,
            );
          }
        }

        // Limit to MAX_CANDIDATES_TO_LLM (but keep archetype matches)
        if (finalCandidates.length > MAX_CANDIDATES_TO_LLM) {
          // Keep all archetype matches, then fill rest with top non-archetype matches
          const archetypeInFinal = finalCandidates.filter((c) =>
            archetypeMatchIds.has(c.id),
          );
          const nonArchetype = finalCandidates
            .filter((c) => !archetypeMatchIds.has(c.id))
            .sort(
              (a, b) =>
                (b.hybrid_score ?? b.vector_sim ?? 0) -
                (a.hybrid_score ?? a.vector_sim ?? 0),
            )
            .slice(0, MAX_CANDIDATES_TO_LLM - archetypeInFinal.length);
          finalCandidates = [...archetypeInFinal, ...nonArchetype];
        }

        console.log(
          `🎯 After MMR reranking: ${finalCandidates.length} final candidates`,
        );
        const archetypeInFinal = finalCandidates.filter((c) =>
          archetypeMatchIds.has(c.id),
        ).length;
        console.log(`   Includes ${archetypeInFinal} archetype matches`);
      } catch (err) {
        console.warn(
          "⚠️ MMR reranking failed, using top candidates by score:",
          err,
        );
        // Fallback: just take top candidates by hybrid_score
        finalCandidates = candidateCards
          .sort(
            (a, b) =>
              (b.hybrid_score ?? b.vector_sim ?? 0) -
              (a.hybrid_score ?? a.vector_sim ?? 0),
          )
          .slice(0, MAX_CANDIDATES_TO_LLM);
      }
    } else {
      // No MMR: just take top candidates
      finalCandidates = candidateCards
        .sort(
          (a, b) =>
            (b.hybrid_score ?? b.vector_sim ?? 0) -
            (a.hybrid_score ?? a.vector_sim ?? 0),
        )
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
      new Set(
        [
          ...allDeckCards.map((c: Card) => c.name),
          ...finalCandidates.map((c) => c.name),
        ].map((n) => n.trim()),
      ),
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

    console.log(
      `📋 TOON table generated: ${toonTable.length} chars, ${finalCandidates.length} cards`,
    );
    console.log(
      `📝 Sample candidate names: ${finalCandidates
        .slice(0, 5)
        .map((c) => c.name)
        .join(", ")}`,
    );
    console.log(
      `📝 All candidate names: ${finalCandidates.map((c) => c.name).join(", ")}`,
    );
    console.log(
      `📝 TOON table preview (first 1000 chars):\n${toonTable.slice(0, 1000)}`,
    );

    // Check if any candidates match the question keywords
    const questionLower = question.toLowerCase();
    const matchingCandidates = finalCandidates.filter(
      (c) =>
        c.name.toLowerCase().includes(questionLower) ||
        c.archetype?.toLowerCase().includes(questionLower) ||
        c.desc?.toLowerCase().includes(questionLower),
    );
    console.log(
      `🎯 Candidates matching question keywords: ${matchingCandidates.length}`,
    );
    if (matchingCandidates.length > 0) {
      console.log(
        `   Matches: ${matchingCandidates.map((c) => c.name).join(", ")}`,
      );
    }

    const profileText = userProfile
      ? `User Profile:
- Preferred Archetypes: ${userProfile.preferredArchetypes.join(", ") || "None"}
- Playstyle Pattern: ${userProfile.playstylePattern}
- Skill Level: ${userProfile.skillLevel}
- Frequently Used Cards: ${userProfile.frequentlyUsedCards.slice(0, 5).join(", ")}
- Deck Count: ${userProfile.deckCount}`
      : "";

    const deckSummary =
      allDeckCards.length > 0
        ? `Deck contains ${allDeckCards.length} cards. Key archetypes: ${excludeArchetypes.join(", ") || "None"}.`
        : "No deck provided.";

    // Validate TOON table has content (skip for explanation questions)
    const intentClassified = classifyIntent(question);
    const isExplanation = intentClassified === "explanation";

    if ((!toonTable || toonTable.trim().length === 0) && !isExplanation) {
      console.error(
        "❌ TOON table is empty! This should not happen if finalCandidates.length > 0",
      );

      // Log error
      const { error: logError } = await supabase
        .from("recommendation_logs")
        .insert({
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
        },
      );
    }

    // For explanation questions, allow proceeding even without candidate cards
    if (isExplanation && (!toonTable || toonTable.trim().length === 0)) {
      console.log(
        "ℹ️ Explanation question with no candidates - proceeding with deck context only",
      );
    }

    // Phase 2: Convert finalCandidates to CardDoc format for strict schema (batch fetch)
    const candidateIds = finalCandidates.map((c) => c.id);
    const deckCardIdsForFetch = allDeckCards.map((c) => c.id);
    const allIdsToFetch = [...new Set([...candidateIds, ...deckCardIdsForFetch.slice(0, 10)])].slice(0, RETRIEVAL_K);

    console.log(`🔍 Fetching card data for ${allIdsToFetch.length} IDs (${candidateIds.length} candidates, ${deckCardIdsForFetch.slice(0, 10).length} deck cards)`);
    console.log(`🔍 Sample candidate IDs:`, candidateIds.slice(0, 5));
    console.log(`🔍 Sample IDs to fetch:`, allIdsToFetch.slice(0, 5));
    console.log(`🔍 All IDs to fetch (first 10):`, allIdsToFetch.slice(0, 10));
    console.log(`🔍 ID types:`, allIdsToFetch.slice(0, 5).map(id => ({ id, type: typeof id })));

    // Ensure all IDs are numbers (not strings)
    const numericIds = allIdsToFetch.map(id => {
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      if (isNaN(numId)) {
        console.warn(`⚠️ Invalid ID found: ${id} (type: ${typeof id})`);
        return null;
      }
      return numId;
    }).filter((id): id is number => id !== null);

    console.log(`🔍 After numeric conversion: ${numericIds.length} valid IDs`);

    if (numericIds.length === 0) {
      console.error("❌ No valid numeric IDs to fetch!");
      const fingerprint = await fingerprintDeck(
        current_deck || {},
        explainTo || "novice",
        userPrefs || {},
      );
      const errorPayload = {
        schemaVersion: "1.0.0",
        confidence: 0.0,
        explainTo: explainTo || "novice",
        summary: "Invalid card IDs found. Cannot fetch card data.",
        recommendations: [],
        ui: [
          {
            id: "invalid_ids",
            type: "text",
            content: "Error: Invalid card IDs detected. Please try again.",
          },
        ],
        actions: {
          applyAllowed: false,
          investigateRecommended: true,
        },
        meta: {
          deckFingerprint: fingerprint,
          recommendation_id: recommendationId,
          diagnostic: {
            candidateCount: finalCandidates.length,
            cardDocsCount: 0,
      question,
            invalidIds: allIdsToFetch.filter(id => {
              const numId = typeof id === 'string' ? parseInt(id, 10) : id;
              return isNaN(numId);
            }),
          },
        },
      };
      return new Response(JSON.stringify(errorPayload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cardDataBatch, error: cardFetchError } = await supabase
      .from("cards")
      .select("id, name, desc, archetype, ban_tcg")
      .in("id", numericIds);

    if (cardFetchError) {
      console.error("❌ Error fetching card data:", {
        error: cardFetchError.message,
        code: cardFetchError.code,
        details: cardFetchError.details,
        hint: cardFetchError.hint,
        idsCount: allIdsToFetch.length,
        sampleIds: allIdsToFetch.slice(0, 5),
      });
    } else {
      console.log(`✅ Card data fetch successful: ${cardDataBatch?.length || 0} cards returned`);
    }

    // Use the banlist already loaded earlier (or load it if not available)
    // Create a set of banned card names for quick lookup
    const bannedCardNames = new Set(
      format === "MASTER_DUEL" && banlist
        ? Object.entries(banlist)
            .filter(([, status]) => status === "Forbidden" || status === "Limited")
            .map(([name]) => name.toLowerCase())
        : []
    );

    const cardDocs: z.infer<typeof CardDocZ>[] = [];
    if (cardDataBatch && cardDataBatch.length > 0) {
      // Create a map for quick lookup
      const candidateMap = new Map(finalCandidates.map((c) => [c.id, c]));
      const deckCardMap = new Map(allDeckCards.map((c) => [c.id, c]));

      for (const cardData of cardDataBatch) {
        try {
          const candidate = candidateMap.get(cardData.id);
          const deckCard = deckCardMap.get(cardData.id);
          // Check if card is banned in Master Duel format
          const isMasterDuelBanned = format === "MASTER_DUEL" 
            ? bannedCardNames.has(cardData.name.toLowerCase())
            : false;
          
          const cardDoc = CardDocZ.parse({
            id: cardData.id,
            name: cardData.name,
            desc: cardData.desc || candidate?.desc || deckCard?.desc || "",
            archetype: cardData.archetype || candidate?.archetype || deckCard?.archetype || null,
            ban_tcg: cardData.ban_tcg || null,
            master_duel_banned: isMasterDuelBanned,
            imageurl: null, // imageurl column doesn't exist in cards table
          });
          cardDocs.push(cardDoc);
        } catch (err) {
          console.warn(`⚠️ Failed to validate card ${cardData.id}:`, err);
        }
      }
    } else {
      console.warn(`⚠️ No card data returned from database query. Expected ${allIdsToFetch.length} cards, got ${cardDataBatch?.length || 0}`);
      // Try fetching cards one by one as a fallback to see if it's a batch size issue
      if (candidateIds.length > 0 && candidateIds.length <= 100) {
        console.log(`🔄 Attempting individual card fetches for ${candidateIds.length} candidates...`);
        const numericCandidateIds = candidateIds.map(id => {
          const numId = typeof id === 'string' ? parseInt(id, 10) : id;
          return isNaN(numId) ? null : numId;
        }).filter((id): id is number => id !== null);

        const individualFetches = await Promise.all(
          numericCandidateIds.slice(0, 30).map(async (id) => {
            const { data, error } = await supabase
              .from("cards")
              .select("id, name, desc, archetype, ban_tcg")
              .eq("id", id)
              .single();
            if (!error && data) {
              try {
                const candidate = finalCandidates.find((c) => c.id === id);
                // Check if card is banned in Master Duel format
                const isMasterDuelBanned = format === "MASTER_DUEL" 
                  ? bannedCardNames.has(data.name.toLowerCase())
                  : false;
                
                const cardDoc = CardDocZ.parse({
                  id: data.id,
                  name: data.name,
                  desc: data.desc || candidate?.desc || "",
                  archetype: data.archetype || candidate?.archetype || null,
                  ban_tcg: data.ban_tcg || null,
                  master_duel_banned: isMasterDuelBanned,
                  imageurl: null, // imageurl column doesn't exist in cards table
                });
                return cardDoc;
              } catch (parseErr) {
                console.warn(`⚠️ Failed to parse card ${id}:`, parseErr);
                return null;
              }
            } else if (error) {
              console.warn(`⚠️ Error fetching card ${id}:`, error.message);
            }
            return null;
          })
        );
        const validFetches = individualFetches.filter((c): c is z.infer<typeof CardDocZ> => c !== null);
        if (validFetches.length > 0) {
          console.log(`✅ Individual fetches found ${validFetches.length} cards`);
          cardDocs.push(...validFetches);
        } else {
          console.warn(`⚠️ Individual fetches also returned 0 cards. This suggests the card IDs don't exist in the database.`);
          // Last resort: try to get ANY cards from the database to verify it's accessible
          const { data: anyCards, error: anyError } = await supabase
            .from("cards")
            .select("id, name")
            .limit(5);
          if (anyError) {
            console.error(`❌ Cannot access cards table at all:`, anyError);
          } else {
            console.log(`ℹ️ Cards table is accessible. Found ${anyCards?.length || 0} sample cards. This suggests the candidate IDs don't match database IDs.`);
            if (anyCards && anyCards.length > 0) {
              console.log(`   Sample card IDs in DB:`, anyCards.map(c => c.id).slice(0, 5));
            }
          }
        }
      }
    }

    // Prioritize candidates over deck cards
    const candidateCardDocs = cardDocs.filter((c) => candidateIds.includes(c.id));
    const deckCardDocs = cardDocs.filter((c) => !candidateIds.includes(c.id) && deckCardIdsForFetch.includes(c.id));
    const prioritizedCardDocs = [...candidateCardDocs, ...deckCardDocs].slice(0, RETRIEVAL_K);

    console.log(`📊 Fetched ${prioritizedCardDocs.length} card docs (${candidateCardDocs.length} candidates, ${deckCardDocs.length} deck cards)`);

    // Phase 2: Check if we have card data before calling LLM
    if (prioritizedCardDocs.length === 0) {
      console.warn("⚠️ No card docs available - returning error response");
      const fingerprint = await fingerprintDeck(
        current_deck || {},
        explainTo || "novice",
        userPrefs || {},
      );
      const errorPayload = {
        schemaVersion: "1.0.0",
        confidence: 0.0,
        explainTo: explainTo || "novice",
        summary: "Insufficient data to provide recommendations. No candidate cards were found matching your query.",
        recommendations: [],
        ui: [
          {
            id: "insufficient_data",
            type: "text",
            content: "I couldn't find any cards matching your request. Try rephrasing your question or being more specific about what you're looking for.",
          },
        ],
        actions: {
          applyAllowed: false,
          investigateRecommended: true,
        },
        meta: {
          deckFingerprint: fingerprint,
          recommendation_id: recommendationId,
          diagnostic: {
            candidateCount: finalCandidates.length,
            cardDocsCount: 0,
            question,
          },
        },
      };
      return new Response(JSON.stringify(errorPayload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Phase 2: Build strict JSON-only prompt
    const messages = buildStrictPrompt(reqVal, prioritizedCardDocs);
    const systemPrompt = messages[0].content;
    const userPrompt = messages[1].content;

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

    // Log what we're sending to LLM for debugging
    console.log("📤 Sending to LLM (strict schema):", {
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      cardDocsCount: cardDocs.length,
      cardDocsPreview: cardDocs.slice(0, 5).map((c) => c.name).join(", "),
    });

    // Phase 2: Call LLM with strict schema prompt
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY not configured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let llmResp: { content: string; raw: any };
    try {
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
            messages,
            temperature: MODEL_TEMP, // Low temperature for consistency
            top_p: 0.8,
            max_tokens: maxOutputTokens,
            stop: ["<<END>>"],
        }),
      },
    );

    if (!groqResponse.ok) {
      const error = await groqResponse.text();
        throw new Error(`LLM call failed: ${groqResponse.status} ${groqResponse.statusText} - ${error}`);
    }

    const result = await groqResponse.json();
      const content = result.choices?.[0]?.message?.content ?? result?.output_text ?? JSON.stringify(result);
      llmResp = { content, raw: result };
    } catch (err) {
      console.error("LLM call error:", err);
      const payload = {
        schemaVersion: "1.0.0",
        confidence: 0.0,
        explainTo: explainTo,
        summary: "Failed to call LLM. Please try again.",
        recommendations: [],
        ui: [
          {
            id: "llm_error",
            type: "text",
            content: `LLM call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        ],
        actions: {},
        meta: {},
      };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("📝 LLM raw response length:", llmResp.content.length);
      console.log(
      "📝 LLM response preview (first 500 chars):",
      llmResp.content.substring(0, 500),
    );

    // Phase 2: Extract JSON from response
    let parsed = extractJsonLike(llmResp.content);

    // Phase 2: Retry with salvage prompt if JSON extraction fails
    let attempts = 0;
    while (!parsed && attempts < 1) {
      console.log("⚠️ JSON extraction failed, attempting salvage retry...");
      const salvagePrompt = [
        {
          role: "system",
          content:
            "You must return a single JSON object matching the RECOMMENDER_SCHEMA. No commentary.",
        },
        {
          role: "user",
          content: `The previous response failed to be valid JSON. Please output only the JSON object (no markdown/text). Previous output: ${llmResp.content}`,
        },
      ];

      try {
        const salvageResponse = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: MODEL_NAME,
              messages: salvagePrompt,
              temperature: MODEL_TEMP,
              max_tokens: 400,
            }),
          },
        );

        if (salvageResponse.ok) {
          const salvageResult = await salvageResponse.json();
          const salvageContent =
            salvageResult.choices?.[0]?.message?.content ?? "";
          llmResp.content = salvageContent;
          parsed = extractJsonLike(salvageContent);
        }
      } catch (salvageErr) {
        console.error("Salvage retry failed:", salvageErr);
      }
      attempts++;
    }

    if (!parsed) {
      const payload = {
        schemaVersion: "1.0.0",
        confidence: 0.0,
        explainTo: explainTo,
        summary: "Model output invalid. Please investigate.",
        recommendations: [],
        ui: [
          {
            id: "err",
            type: "text",
            content:
              "The recommendation engine returned an invalid response. Try again or report.",
          },
          {
            id: "retry",
            type: "suggestion",
            content: {
              suggestionId: "retry_recs",
              label: "Retry recommendation",
              verb: "preview",
            },
          },
        ],
        actions: {},
        meta: { rawModelOutput: llmResp.raw },
      };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Phase 2: Validate parsed JSON with Zod
    let validated;
    try {
      validated = validateRecommender(parsed);
    } catch (e) {
      // If validation fails, try to sanitize recommendations
      const recs = (parsed as any).recommendations || [];
      const allowedIds = new Set(cardDocs.map((c) => String(c.id)));
      const filteredRecs = recs.filter((r: any) =>
        allowedIds.has(String(r.cardId)),
      );
      parsed.recommendations = filteredRecs;

      try {
        validated = validateRecommender(parsed);
      } catch (err2) {
        const payload = {
          schemaVersion: "1.0.0",
          confidence: 0.0,
          explainTo: explainTo,
          summary: "Model produced invalid recommendation schema after sanitization.",
          recommendations: [],
          ui: [
            {
              id: "err2",
              type: "text",
              content: "The recommender returned an invalid schema. Please retry.",
            },
          ],
          meta: {
            originalParseError: (e as any).toString(),
            secondError: (err2 as any).toString(),
          },
        };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Phase 2: Server-side sanitization and validation
    const allowedIds = new Set(prioritizedCardDocs.map((c) => String(c.id)));
    const sanitizedRecs = (validated as any).recommendations.map((r: any) => {
      const idStr = String(r.cardId);

      // Mark banned according to cardDocs ban fields if present
      const cardDoc = prioritizedCardDocs.find((c) => String(c.id) === idStr);
      if (cardDoc) {
        if (
          (format === "TCG" &&
            (cardDoc.ban_tcg || "").toLowerCase() === "banned") ||
          (format === "MASTER_DUEL" && !!cardDoc.master_duel_banned)
        ) {
          r.banned = true;
          // If banned, convert action to note to avoid "add" suggestions
          if (r.action === "add") r.action = "note";
        }
        r.cardName = cardDoc.name;
      } else {
        // If cardDoc not found, force-out this recommendation
        r._serverRejected = true;
      }

      return r;
    }).filter((r: any) => !r._serverRejected);

    // Phase 2: Compute confidence gating for UI
    const confidence = (validated as any).confidence ?? 0.0;
    const actions: any = {};

    if (confidence >= APPLY_CONF_THRESHOLD) {
      actions["applyAllowed"] = true;
    } else if (confidence <= INVESTIGATE_THRESHOLD) {
      actions["applyAllowed"] = false;
      actions["investigateRecommended"] = true;
    } else {
      actions["applyAllowed"] = false;
      actions["investigateRecommended"] = false;
    }

    // Phase 2: Calculate token usage
    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const userTokens = Math.ceil(userPrompt.length / 4);
    const inputTokens = systemTokens + userTokens;
    const outputTokens = Math.ceil(llmResp.content.length / 4);
    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUSD = (totalTokens / 1000000) * 0.27;

    // Log token usage for monitoring
    console.log(
      `Token usage: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total (target: < 1500)`,
    );

    // Phase 2: Build final payload with fingerprinting
    const fingerprint = await fingerprintDeck(
      current_deck || {},
      explainTo || "novice",
      userPrefs || {},
    );

    const finalPayload = {
      schemaVersion: (validated as any).schemaVersion || "1.0.0",
      confidence,
      explainTo: (validated as any).explainTo,
      summary: (validated as any).summary || "",
      recommendations: sanitizedRecs,
      ui: (validated as any).ui || [
        {
          id: "summary",
          type: "text",
          content: (validated as any).summary || "See recommendations.",
        },
      ],
      actions,
      meta: {
        usedCardIds: prioritizedCardDocs.map((c) => c.id),
        deckFingerprint: fingerprint,
        recommendation_id: recommendationId,
        tokens_used: totalTokens,
        cost_usd: estimatedCostUSD,
      },
    };

    // Log successful recommendation
    const durationMs = Date.now() - startTime;
    const { error: logError } = await supabase
      .from("recommendation_logs")
      .insert({
        recommendation_id: recommendationId,
        user_id: user.id,
        question: question || "",
        format,
        recommendation_type: recommendation_type || "personalized",
        use_hybrid_search,
        candidate_count: finalCandidates.length,
        final_candidate_count: cardDocs.length,
        tokens_used: totalTokens,
        cost_usd: estimatedCostUSD,
        response_version: "2.0", // Phase 2 version
      });
    if (logError) {
      console.error("Failed to log recommendation:", logError);
    }

    // Structured log for observability
    console.log(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        recommendation_id: recommendationId,
        user_id: user.id,
        question: (question || "").substring(0, 100),
        candidate_count: finalCandidates.length,
        final_candidate_count: cardDocs.length,
        tokens_used: totalTokens,
        cost_usd: estimatedCostUSD,
        response_version: "2.0",
        duration_ms: durationMs,
        confidence,
      }),
    );

    return new Response(JSON.stringify(finalPayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("recommendation-agent error:", err);
    const payload = {
      schemaVersion: "1.0.0",
      confidence: 0.0,
      explainTo: "novice",
      summary: "Internal server error generating recommendations.",
      recommendations: [],
      ui: [
        {
          id: "err_generic",
          type: "text",
          content: `Internal error: ${(err && (err.message || String(err))) || "unknown"}`,
        },
      ],
    };

    return new Response(JSON.stringify(payload), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
