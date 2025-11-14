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

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const MODEL_NAME = "llama3-70b-8192";

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

    // --- Parse request (add format param) ---
    const { question, deck_id, banlist_format = "TCG" } = await req.json();
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
      main: number[];
      side: number[];
      extra: number[];
    };
    const allDeckCardIds = [
      ...(deckCardsBySection.main || []),
      ...(deckCardsBySection.side || []),
      ...(deckCardsBySection.extra || []),
    ];

    // --- Fetch deck card details ---
    const { data: deckCardDetails } = await supabase
      .from("cards")
      .select("id, name, type, desc, level, race, attribute, archetype")
      .in("id", allDeckCardIds);

    // Remove forbidden cards from deck (optional: or just warn user in prompt)
    const safeDeckCards = (deckCardDetails ?? []).filter(
      (card) => banlist[card.name] !== "Forbidden"
    );

    // --- Context builder: archetypes/types/attributes for pool filtering ---
    const deckArchetypes = new Set(
      safeDeckCards.map((c) => c.archetype).filter(Boolean)
    );
    const deckTypes = new Set(safeDeckCards.map((c) => c.type).filter(Boolean));
    const deckAttributes = new Set(
      safeDeckCards.map((c) => c.attribute).filter(Boolean)
    );

    // --- Unified card pool filtering using match and banlist ---
    // Build 'or' filter string:
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

    let { data: relevantPoolCards } = await supabase
      .from("cards")
      .select("id, name, type, desc, level, race, attribute, archetype")
      .or(filterParts.join(","))
      .not("id", "in", `(${allDeckCardIds.join(",")})`)
      .order("name", { ascending: true })
      .limit(60);

    // Exclude forbidden cards
    relevantPoolCards = (relevantPoolCards ?? []).filter(
      (card) => banlist[card.name] !== "Forbidden"
    );

    // Dedupe by name and limit
    const relevantCards = onlyUniqueByName(relevantPoolCards).slice(0, 50);

    // --- Prompt context assembly ---
    const deckSummary = `
Format: ${banlist_format}
Deck Name: ${deckData.name}
Key cards: ${safeDeckCards
      .slice(0, 12)
      .map((c) => c.name)
      .join(", ")}
Archetypes: ${[...deckArchetypes].join(", ")}
Types: ${[...deckTypes].join(", ")}
Attributes: ${[...deckAttributes].join(", ")}
`;

    const deckDetailContext = safeDeckCards
      .slice(0, 10)
      .map(
        (card) =>
          `${card.name} (${card.type}${
            card.archetype ? ", " + card.archetype : ""
          }): ${card.desc}`
      )
      .join("\n\n");

    const relevantCardsContext = relevantCards
      .map(
        (card: Card) =>
          `${card.name} (${card.type}${
            card.archetype ? ", " + card.archetype : ""
          }): ${card.desc}`
      )
      .join("\n\n");

    const prompt = `
You are an expert Yu-Gi-Oh! ${
      banlist_format === "MASTER_DUEL" ? "Master Duel" : "TCG"
    } deckbuilder. Enforce card legality for the chosen format.

Deck summary:
${deckSummary}

Key deck cards (with effects):
${deckDetailContext}

Relevant legal pool cards ('not in deck', matching deck archetype/type/attribute):
${relevantCardsContext}

User question:
${question}

Final advice: suggest only legal cards for this format and explain any forbidden/illegal cards the user currently runs.
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
          max_tokens: 1024,
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

    return new Response(
      JSON.stringify({
        user,
        answer: aiContent,
        deck_cards: safeDeckCards,
        relevant_card_pool: relevantCards,
        banned_in_deck:
          deckCardDetails &&
          deckCardDetails
            .filter((card) => banlist[card.name] === "Forbidden")
            .map((card) => card.name),
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
