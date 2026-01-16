/**
 * Self-Querying Retrieval: LLM generates structured query from natural language
 */

import type { DeckAnalysis } from "./types.ts";

export interface StructuredQuery {
  searchTerms: string[]; // Keywords to search for
  filters: {
    type?: string[];
    attribute?: string[];
    race?: string[];
    archetype?: string[];
    level?: { min?: number; max?: number };
    atk?: { min?: number; max?: number };
  };
  excludeCardIds: number[]; // Cards already in deck
  excludeArchetypes: string[]; // Archetypes already present
  intent: "consistency" | "power" | "interaction" | "tech" | "optimization" | "general";
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Call Groq LLM API
 */
async function callGroqLLM(
  prompt: string,
  apiKey: string,
  modelName: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("API key not provided");
  }

  // Validate API key format (Groq keys start with "gsk_")
  if (apiKey && !apiKey.startsWith("gsk_")) {
    console.warn(`⚠️ API Key format may be incorrect. Expected to start with "gsk_", got: ${apiKey.substring(0, 10)}...`);
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: "You are a Yu-Gi-Oh card search assistant. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Groq API error: ${response.status}`, {
      status: response.status,
      statusText: response.statusText,
      errorText,
      apiKeyPresent: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey?.substring(0, 10) || "N/A",
      modelName: modelName,
    });
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "{}";
}

/**
 * Extract JSON from LLM response (handles markdown code blocks)
 */
function extractJson(response: string): any {
  // Remove markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Failed to parse JSON:", cleaned);
    throw new Error(`Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate structured query from natural language user query
 */
export async function generateStructuredQuery(
  userQuery: string,
  deckAnalysis: DeckAnalysis,
  conversationHistory: Message[],
  apiKey: string,
  modelName: string = "llama-3.3-70b-versatile",
  deckCardIds: number[] = [],
  deckArchetypes: string[] = []
): Promise<StructuredQuery> {
  // Check if query is too vague
  const vaguePatterns = [
    /^(help|improve|fix|make better|optimize|what|how|suggest)/i,
    /^(what|how)\s+(should|can|do|to)/i,
  ];
  
  const isVague = vaguePatterns.some(pattern => pattern.test(userQuery.trim()));
  
  if (isVague && conversationHistory.length === 0) {
    // First message and vague - ask for clarification
    return {
      searchTerms: [],
      filters: {},
      excludeCardIds: deckCardIds,
      excludeArchetypes: deckArchetypes,
      intent: "general",
      needsClarification: true,
      clarificationQuestion: "What specific aspect of your deck would you like to improve? For example:\n- Consistency (draw power, search effects)\n- Power (stronger combos, boss monsters)\n- Interaction (hand traps, interruptions)\n- Tech choices (side deck options, counters)",
    };
  }

  const prompt = `You are a Yu-Gi-Oh card search assistant. The user asked: "${userQuery}"

Current deck context:
- Archetype: ${deckAnalysis.archetype || "Mixed"}
- Playstyle: ${deckAnalysis.playstyle}
- Main deck: ${deckAnalysis.deckSize.main} cards
- Card roles: ${JSON.stringify(deckAnalysis.cardRoles)}
- Weaknesses: ${deckAnalysis.weaknesses.join(', ') || 'None identified'}

${conversationHistory.length > 0 ? `Recent conversation:\n${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}\n` : ''}

Generate a structured query to search for cards. Return JSON:
{
  "searchTerms": ["keyword1", "keyword2"], // What to search for (extract from user query)
  "filters": {
    "type": ["Monster", "Spell"], // Optional card types
    "attribute": ["DARK"], // Optional attributes
    "race": ["Fiend"], // Optional races
    "archetype": ["Dark World"], // Optional archetypes
    "level": { "min": 4, "max": 8 }, // Optional level range
    "atk": { "min": 2000 } // Optional ATK range
  },
  "excludeCardIds": [], // Will be populated automatically
  "excludeArchetypes": [], // Will be populated automatically
  "intent": "consistency|power|interaction|tech|optimization|general",
  "needsClarification": false, // true if query is too vague
  "clarificationQuestion": "" // if needsClarification=true
}

Rules:
1. Extract search terms from the user query (e.g., "hand trap" -> ["hand trap", "negate"])
2. Only include filters if explicitly mentioned in the query
3. Set intent based on query focus:
   - "consistency" for draw/search/starter requests
   - "power" for stronger cards/boss monsters
   - "interaction" for hand traps/interruptions
   - "tech" for side deck/counter cards
   - "optimization" for ratio/balance improvements
   - "general" for unclear requests
4. If query is vague (e.g., "help me", "improve deck"), set needsClarification=true
5. Consider deck context when generating search terms (e.g., if deck is combo-focused, search terms should relate to combo support)`;

  try {
    const response = await callGroqLLM(prompt, apiKey, modelName);
    const parsed = extractJson(response);
    
    // Merge exclude lists
    const structuredQuery: StructuredQuery = {
      searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [],
      filters: parsed.filters || {},
      excludeCardIds: deckCardIds,
      excludeArchetypes: deckArchetypes,
      intent: parsed.intent || "general",
      needsClarification: parsed.needsClarification === true,
      clarificationQuestion: parsed.clarificationQuestion || undefined,
    };

    // Validate intent
    const validIntents = ["consistency", "power", "interaction", "tech", "optimization", "general"];
    if (!validIntents.includes(structuredQuery.intent)) {
      structuredQuery.intent = "general";
    }

    return structuredQuery;
  } catch (error) {
    console.error("Failed to generate structured query:", error);
    
    // Fallback: extract basic search terms from query
    const words = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    return {
      searchTerms: words.slice(0, 5),
      filters: {},
      excludeCardIds: deckCardIds,
      excludeArchetypes: deckArchetypes,
      intent: "general",
      needsClarification: false,
    };
  }
}
