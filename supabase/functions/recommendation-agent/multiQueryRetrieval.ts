/**
 * Phase 2: Multi-Query Retrieval
 * Generates multiple alternative query phrasings to improve candidate diversity
 */

import { generateQueryEmbedding } from "./embeddingHelper.ts";

// Type assertion to ensure correct function signature
type GenerateQueryEmbeddingFn = (
  text: string,
  supabaseUrl?: string,
  serviceRoleKey?: string,
) => Promise<number[]>;
const generateEmbedding: GenerateQueryEmbeddingFn = generateQueryEmbedding;
import { hybridSearch, type CardCandidate } from "../_shared/cardSearch.ts";
import type { IntentAnalysis } from "../_shared/intentClassifier.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const MODEL_NAME = Deno.env.get("MODEL_NAME") || "llama-3.3-70b-versatile";
const ENABLE_MULTI_QUERY = Deno.env.get("ENABLE_MULTI_QUERY") !== "false"; // Default: true
const MULTI_QUERY_COUNT = parseInt(Deno.env.get("MULTI_QUERY_COUNT") || "3", 10);
const CANDIDATE_COUNT_PER_QUERY = parseInt(Deno.env.get("CANDIDATE_COUNT_PER_QUERY") || "50", 10);

/**
 * Generate multiple alternative phrasings of the user's question
 */
export async function generateMultipleQueries(
  question: string,
  intentAnalysis: IntentAnalysis | undefined,
): Promise<string[]> {
  if (!ENABLE_MULTI_QUERY || !GROQ_API_KEY) {
    return [question]; // Return original question if disabled
  }

  console.log("[MULTI-QUERY] Generating alternative queries...");

  try {
    const intentContext = intentAnalysis
      ? `The user's intent is: ${intentAnalysis.primary}. `
      : "";

    const prompt = `You are a search query optimizer. Given a Yu-Gi-Oh! deck building question, generate ${MULTI_QUERY_COUNT} alternative phrasings that would find different but related cards.

Original question: "${question}"
${intentContext}

Generate ${MULTI_QUERY_COUNT} alternative phrasings that:
1. Express the same core need but use different terminology
2. Focus on different aspects (e.g., if asking for consistency, one might focus on "draw power", another on "search effects", another on "deck thinning")
3. Use Yu-Gi-Oh! specific terminology where appropriate

Return ONLY a JSON array of strings, one query per string. No explanations, no markdown, just the array.

Example:
Input: "I need consistency"
Output: ["cards that improve draw power", "search effects for this deck", "ways to reduce bricking"]

Your output:`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            {
              role: "system",
              content: "You are a search query optimizer. Return only JSON arrays.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3, // Low temperature for focused query generation
          top_p: 0.8,
          max_tokens: 200,
        }),
      },
    );

    if (!response.ok) {
      console.warn("[MULTI-QUERY] Failed to generate alternative queries, using original");
      return [question];
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Parse JSON array from response
    try {
      // Extract JSON array from response (may have markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const queries = JSON.parse(jsonMatch[0]) as string[];
        if (Array.isArray(queries) && queries.length > 0) {
          // Ensure we have the original question plus alternatives
          const allQueries = [question, ...queries.filter(q => q !== question && q.trim().length > 0)];
          console.log(`[MULTI-QUERY] Generated ${allQueries.length} queries:`, allQueries);
          return allQueries.slice(0, MULTI_QUERY_COUNT + 1); // +1 for original
        }
      }
    } catch (parseErr) {
      console.warn("[MULTI-QUERY] Failed to parse alternative queries:", parseErr);
    }

    return [question];
  } catch (error) {
    console.error("[MULTI-QUERY] Error generating alternative queries:", error);
    return [question];
  }
}

/**
 * Perform multi-query retrieval and merge results
 */
export async function performMultiQueryRetrieval(
  queries: string[],
  deckContextText: string,
  excludeIds: number[],
  excludeArchetypes: string[],
  format: "MASTER_DUEL" | "TCG",
  supabaseClient: any,
  supabaseUrl?: string,
  serviceRoleKey?: string,
): Promise<CardCandidate[]> {
  if (!ENABLE_MULTI_QUERY || queries.length <= 1) {
    // Single query: use standard retrieval
    const queryEmbedding = await generateEmbedding(
      `${queries[0]}. ${deckContextText}`,
      supabaseUrl,
      serviceRoleKey,
    );
    return await hybridSearch(
      {
        queryEmbedding,
        queryText: queries[0],
        excludeIds,
        excludeArchetypes,
        banlistFormat: format,
        matchCount: CANDIDATE_COUNT_PER_QUERY * queries.length, // Scale with query count
      },
      supabaseClient,
    );
  }

  console.log(`[MULTI-QUERY] Performing retrieval for ${queries.length} queries...`);

  // Generate embeddings and perform search for each query in parallel
  const searchPromises = queries.map(async (query, index) => {
    try {
      const fullQuery = `${query}. ${deckContextText}`;
      const queryEmbedding = await generateEmbedding(
        fullQuery,
        supabaseUrl,
        serviceRoleKey,
      );
      const results = await hybridSearch(
        {
          queryEmbedding,
          queryText: query,
          excludeIds,
          excludeArchetypes,
          banlistFormat: format,
          matchCount: CANDIDATE_COUNT_PER_QUERY,
        },
        supabaseClient,
      );

      console.log(`[MULTI-QUERY] Query ${index + 1} ("${query.substring(0, 50)}..."): ${results.length} results`);
      return results;
    } catch (err) {
      console.error(`[MULTI-QUERY] Error in query ${index + 1}:`, err);
      return [];
    }
  });

  const allResults = await Promise.all(searchPromises);

  // Merge and deduplicate by card ID
  const cardMap = new Map<number, CardCandidate & { scores: number[] }>();

  allResults.forEach((results) => {
    results.forEach((card) => {
      const existing = cardMap.get(card.id);
      if (existing) {
        // Card appears in multiple results: aggregate scores
        existing.scores.push(card.hybrid_score ?? card.vector_sim ?? 0);
        // Use max score or weighted average (here using max for simplicity)
        existing.hybrid_score = Math.max(
          existing.hybrid_score ?? 0,
          card.hybrid_score ?? card.vector_sim ?? 0,
        );
      } else {
        // New card: add to map
        cardMap.set(card.id, {
          ...card,
          scores: [card.hybrid_score ?? card.vector_sim ?? 0],
        });
      }
    });
  });

  // Convert to array and re-rank by aggregated score
  const mergedCandidates = Array.from(cardMap.values()).map(({ scores, ...card }) => ({
    ...card,
    // Boost score if card appeared in multiple queries (diversity bonus)
    hybrid_score: (card.hybrid_score ?? 0) * (1 + (scores.length - 1) * 0.1),
  }));

  // Sort by aggregated score
  mergedCandidates.sort((a, b) => (b.hybrid_score ?? 0) - (a.hybrid_score ?? 0));

  console.log(
    `[MULTI-QUERY] Merged ${mergedCandidates.length} unique candidates from ${allResults.length} query results`,
  );

  // Log diversity metrics
  const cardsInMultipleQueries = mergedCandidates.filter((c) => {
    const card = cardMap.get(c.id);
    return card && card.scores.length > 1;
  }).length;
  console.log(
    `[MULTI-QUERY] Diversity: ${cardsInMultipleQueries} cards appeared in multiple queries`,
  );

  return mergedCandidates;
}
