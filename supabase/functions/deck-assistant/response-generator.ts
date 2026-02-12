/**
 * LLM Response Generation
 * Generates natural language response with card recommendations
 * Uses optimized system prompt for high-quality Yu-Gi-Oh! deck building guidance.
 */

import type { DeckAnalysis, Card } from "./types.ts";
import type { Message } from "./self-query.ts";
import {
  DECK_ASSISTANT_SYSTEM_PROMPT,
  buildDeckContextText,
  buildConversationContext,
  toDeckContextForPrompt,
  type DeckFormat,
} from "./prompts.ts";

export interface Recommendation {
  cardId: number;
  cardName: string;
  reason: string; // Why this card helps
  priority: "high" | "medium" | "low";
  canAdd: boolean; // Based on deck limits (will be computed client-side)
  impactEst?: number; // 0.0-1.0 impact estimate
  synergyScore?: number; // 0.0-1.0 synergy score
}

export interface RatioSuggestion {
  cardName: string;
  currentCount: number;
  suggestedCount: number;
  reason: string;
}

export interface ResponseOutput {
  text: string;
  recommendations?: Recommendation[];
  ratioSuggestions?: RatioSuggestion[];
}

/**
 * Call Groq LLM API with configurable system and user messages
 */
async function callGroqLLM(
  messages: Array<{ role: "system" | "user"; content: string }>,
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
        messages,
        temperature: 0.7, // Slightly higher for conversational tone
        top_p: 0.9,
        max_tokens: 2000, // Support up to 15 cards
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
 * Detect if query is about card ratios
 */
function isRatioQuestion(query: string): boolean {
  const ratioKeywords = [
    'ratio', 'ratios', 'adjust', 'adjusting', 'optimize', 'optimization',
    'how many', 'count', 'copies', 'cut', 'reduce', 'increase', 'decrease'
  ];
  const lowerQuery = query.toLowerCase();
  return ratioKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Generate natural language response with card recommendations
 */
export async function generateRecommendations(
  userQuery: string,
  deckAnalysis: DeckAnalysis,
  candidates: Card[],
  history: Message[],
  apiKey: string,
  modelName: string = "llama-3.3-70b-versatile",
  deckCardIds: number[] = [],
  deckCards?: Array<{ cardId: number; cardName: string; count: number }>,
  deckFormat: DeckFormat = "Master Duel"
): Promise<ResponseOutput> {
  // Check if this is a ratio question
  const isRatio = isRatioQuestion(userQuery);

  if (isRatio && deckCards && deckCards.length > 0) {
    return await generateRatioSuggestions(
      userQuery,
      deckAnalysis,
      deckCards,
      history,
      apiKey,
      modelName,
      deckFormat,
    );
  }

  if (candidates.length === 0) {
    return {
      text: "I couldn't find any cards that match your request. Could you provide more details about what you're looking for?",
      recommendations: [],
    };
  }

  const allCardNames = deckCards?.map((dc) => dc.cardName) ?? [];
  const deckContext = toDeckContextForPrompt(deckAnalysis, deckFormat, allCardNames);
  const deckContextText = buildDeckContextText(deckContext);
  const conversationContext = buildConversationContext(history, 5);

  const candidateList = candidates.slice(0, 15).map((c, i) => {
    const archetypeInfo = c.archetype ? `, Archetype: ${c.archetype}` : "";
    const raceInfo = c.race ? `, Race: ${c.race}` : "";
    return `${i + 1}. ${c.name} (ID: ${c.id}, ${c.type}${archetypeInfo}${raceInfo}) - ${(c.desc || "").substring(0, 150)}`;
  }).join("\n");

  const numberMatch =
    userQuery.match(/\b(\d+)\s*(?:cards?|card|recommendations?|suggestions?)\b/i) ||
    userQuery.match(/\b(?:show|give|recommend|suggest)\s+(?:me\s+)?(\d+)\b/i) ||
    userQuery.match(/\b(\d+)\b/);
  const requestedCount = numberMatch ? parseInt(numberMatch[1], 10) : null;
  const recommendationCount =
    requestedCount && requestedCount > 0 && requestedCount <= 15
      ? requestedCount
      : requestedCount && requestedCount > 15
        ? 15
        : 5;

  const userPrompt = `${deckContextText}${conversationContext}

# USER REQUEST
"${userQuery}"

# AVAILABLE CANDIDATE CARDS (MUST use cardId from this list only - NEVER invent IDs or card names)
${candidateList}

Valid card IDs: [${candidates.slice(0, 15).map((c) => c.id).join(", ")}]
CRITICAL: Every recommendation MUST use a cardId from the valid list above. Any other cardId will be rejected.

# INSTRUCTIONS
1. Acknowledge the user's deck and request
2. Provide a brief, friendly response (2-3 sentences) explaining your recommendations
3. Recommend exactly ${recommendationCount} cards from the list above
4. For each recommendation: explain WHY it addresses their need, assign priority (high/medium/low), impactEst (0.0-1.0), synergyScore (0.0-1.0)
5. Synergy over power: prefer archetype-specific cards when the deck supports them
6. NEVER suggest cards already in the deck (see "Cards Currently in Deck" above)

Return JSON only:
{
  "text": "Your friendly response (2-3 sentences)",
  "recommendations": [
    {
      "cardId": 12345,
      "cardName": "Exact card name from list",
      "reason": "Why this helps their specific request",
      "priority": "high|medium|low",
      "impactEst": 0.7,
      "synergyScore": 0.8
    }
  ]
}`;

  const messages = [
    { role: "system" as const, content: DECK_ASSISTANT_SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    const response = await callGroqLLM(messages, apiKey, modelName);
    const parsed = extractJson(response);

    console.log(`🔍 LLM Response: ${JSON.stringify(parsed).substring(0, 500)}...`);
    console.log(`📋 Parsed recommendations count: ${parsed.recommendations?.length || 0}`);
    console.log(`📋 Available candidates count: ${candidates.length}`);

    // Validate and normalize recommendations - STRICT: only accept cardIds from candidate pool (anti-hallucination)
    const validCardIds = new Set(candidates.map((c) => c.id));
    const candidateById = new Map(candidates.map((c) => [c.id, c]));
    const seenCardIds = new Set<number>();
    const recommendations: Recommendation[] = (parsed.recommendations || []).map((rec: any) => {
      const recCardId = typeof rec.cardId === "number" ? rec.cardId : parseInt(rec.cardId, 10);
      if (!Number.isInteger(recCardId) || !validCardIds.has(recCardId)) {
        console.warn(`⚠️ Hallucination rejected: cardId ${rec.cardId} not in candidate pool`);
        return null;
      }
      const candidate = candidateById.get(recCardId);
      if (!candidate) {
        return null;
      }

      // Skip duplicates
      if (seenCardIds.has(candidate.id)) {
        console.warn(`⚠️ Duplicate card ID detected: ${candidate.id} (${candidate.name})`);
        return null;
      }
      seenCardIds.add(candidate.id);

      // Check if card is already in deck
      const canAdd = !deckCardIds.includes(candidate.id);

      return {
        cardId: candidate.id,
        cardName: candidate.name,
        reason: rec.reason || `This card may help with ${userQuery}`,
        priority: rec.priority === "high" || rec.priority === "medium" || rec.priority === "low"
          ? rec.priority
          : "medium",
        canAdd,
        impactEst: typeof rec.impactEst === "number" ? Math.max(0, Math.min(1, rec.impactEst)) : 0.5,
        synergyScore: typeof rec.synergyScore === "number" ? Math.max(0, Math.min(1, rec.synergyScore)) : 0.5,
      };
    }).filter((r: Recommendation | null): r is Recommendation => r !== null);

    console.log(`✅ Valid recommendations after filtering: ${recommendations.length}`);

    // Ensure we have at least some recommendations
    if (recommendations.length === 0 && candidates.length > 0) {
      // Fallback: create basic recommendations from top candidates
      const topCandidates = candidates.slice(0, Math.min(recommendationCount, candidates.length));
      const fallbackRecommendations: Recommendation[] = topCandidates.map((c, idx) => ({
        cardId: c.id,
        cardName: c.name,
        reason: `This card may help address your request for ${userQuery}.`,
        priority: idx < 2 ? "high" : idx < 4 ? "medium" : "low",
        canAdd: !deckCardIds.includes(c.id),
        impactEst: 0.6 - (idx * 0.1),
        synergyScore: 0.5,
      }));

      return {
        text: parsed.text || `I found ${candidates.length} cards that might help with your request. Here are the top recommendations:`,
        recommendations: fallbackRecommendations,
      };
    }

    // Log for debugging
    console.log(`📊 [response-generator.ts] Recommendation count: requested=${recommendationCount}, received=${recommendations.length}, candidates=${candidates.length}`);
    console.log(`🔧 [response-generator.ts] After deduplication: ${recommendations.length} unique recommendations`);
    
    // ALWAYS ensure we have the requested number of cards
    // If LLM returned fewer cards than requested, pad with additional candidates
    let finalRecommendations = [...recommendations];
    
    if (finalRecommendations.length < recommendationCount) {
      const usedCardIds = new Set(finalRecommendations.map(r => r.cardId));
      const needed = recommendationCount - finalRecommendations.length;
      
      // Get additional candidates, excluding ones already recommended or in deck
      const availableCandidates = candidates.filter(
        c => !usedCardIds.has(c.id) && !deckCardIds.includes(c.id)
      );
      
      console.log(`🔧 [response-generator.ts] Padding recommendations: needed=${needed}, available=${availableCandidates.length}, total candidates=${candidates.length}`);
      
      if (availableCandidates.length >= needed) {
        const additionalCandidates = availableCandidates.slice(0, needed);
        
        const additionalRecommendations: Recommendation[] = additionalCandidates.map((c) => ({
          cardId: c.id,
          cardName: c.name,
          reason: `This card may complement the other recommendations for ${userQuery}.`,
          priority: "medium",
          canAdd: true,
          impactEst: 0.5,
          synergyScore: 0.5,
        }));
        
        finalRecommendations.push(...additionalRecommendations);
        console.log(`✅ [response-generator.ts] Added ${additionalRecommendations.length} additional recommendations`);
      } else {
        // If we don't have enough candidates, use what we have
        console.warn(`⚠️ [response-generator.ts] Not enough candidates to pad: needed ${needed}, have ${availableCandidates.length}`);
        const additionalRecommendations: Recommendation[] = availableCandidates.map((c) => ({
          cardId: c.id,
          cardName: c.name,
          reason: `This card may complement the other recommendations for ${userQuery}.`,
          priority: "medium",
          canAdd: true,
          impactEst: 0.5,
          synergyScore: 0.5,
        }));
        finalRecommendations.push(...additionalRecommendations);
      }
    }

    // Final slice to ensure we don't exceed requested count
    finalRecommendations = finalRecommendations.slice(0, recommendationCount);
    console.log(`✅ [response-generator.ts] Final recommendations: ${finalRecommendations.length} cards`);

    return {
      text: parsed.text || `I found ${finalRecommendations.length} cards that should help with your request.`,
      recommendations: finalRecommendations,
    };
  } catch (error) {
    console.error("Failed to generate recommendations:", error);
    
    // Fallback: return basic recommendations without LLM
    const fallbackRecommendations: Recommendation[] = candidates.slice(0, Math.min(5, candidates.length)).map((c, idx) => ({
      cardId: c.id,
      cardName: c.name,
      reason: `This card may help address your request.`,
      priority: idx < 2 ? "high" : "medium",
      canAdd: !deckCardIds.includes(c.id),
      impactEst: 0.5,
      synergyScore: 0.5,
    }));

    return {
      text: `I found ${candidates.length} cards that match your search. Here are some recommendations:`,
      recommendations: fallbackRecommendations,
    };
  }
}

/**
 * Generate ratio suggestions for deck optimization
 */
async function generateRatioSuggestions(
  userQuery: string,
  deckAnalysis: DeckAnalysis,
  deckCards: Array<{ cardId: number; cardName: string; count: number }>,
  history: Message[],
  apiKey: string,
  modelName: string,
  deckFormat: DeckFormat = "Master Duel"
): Promise<ResponseOutput> {
  const deckCardList = deckCards
    .map((dc, i) => `${i + 1}. ${dc.cardName}: ${dc.count} copies`)
    .join("\n");

  const allCardNames = deckCards.map((dc) => dc.cardName);
  const deckContext = toDeckContextForPrompt(deckAnalysis, deckFormat, allCardNames);
  const deckContextText = buildDeckContextText(deckContext);
  const conversationContext = buildConversationContext(history, 5);

  const userPrompt = `${deckContextText}${conversationContext}

# USER REQUEST
"${userQuery}"

# CURRENT DECK COMPOSITION (with counts)
${deckCardList}

# INSTRUCTIONS
The user is asking about card ratios. Analyze their deck and provide specific ratio adjustment suggestions.
- Consider deck size: 40-card decks maximize consistency; 60-card decks need more starters
- Starters: aim for 9-12 in 40-card decks
- For combo decks: prioritize extenders and starters; avoid cutting key combo pieces
- For control decks: prioritize hand traps and removal

Return JSON only:
{
  "text": "Your friendly response explaining the ratio adjustments (2-3 sentences)",
  "ratioSuggestions": [
    {
      "cardName": "Exact card name from deck",
      "currentCount": 3,
      "suggestedCount": 2,
      "reason": "Why this adjustment helps"
    }
  ]
}

RULES:
1. Only suggest adjustments for cards that are actually in their deck (use exact card names from the list above)
2. Provide 3-8 ratio suggestions
3. Main deck must stay at ${deckAnalysis.deckSize.main} cards total
4. Return ONLY the JSON object, no markdown, no code blocks`;

  const messages = [
    { role: "system" as const, content: DECK_ASSISTANT_SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    const response = await callGroqLLM(messages, apiKey, modelName);
    const parsed = extractJson(response);

    const deckCardNames = new Set(deckCards.map((dc) => dc.cardName));
    const ratioSuggestions: RatioSuggestion[] = (parsed.ratioSuggestions || [])
      .map((rs: any) => ({
        cardName: String(rs.cardName || "").trim(),
        currentCount: typeof rs.currentCount === "number" ? rs.currentCount : 0,
        suggestedCount: typeof rs.suggestedCount === "number" ? rs.suggestedCount : 0,
        reason: rs.reason || "This adjustment may improve deck consistency.",
      }))
      .filter(
        (rs: RatioSuggestion) =>
          rs.cardName &&
          deckCardNames.has(rs.cardName) &&
          rs.currentCount > 0
      );

    return {
      text: parsed.text || `Here are some ratio adjustments that may improve your deck:`,
      ratioSuggestions: ratioSuggestions.slice(0, 10), // Limit to top 10
    };
  } catch (error) {
    console.error("Failed to generate ratio suggestions:", error);
    return {
      text: "I encountered an error analyzing your deck ratios. Please try rephrasing your question.",
      ratioSuggestions: [],
    };
  }
}
