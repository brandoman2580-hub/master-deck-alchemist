/**
 * Phase 2: Recommendation Stage Handler
 * Generates structured recommendations using reasoning from stage 1
 */

import { toTOON } from "../_shared/toon.ts";
import type { IntentAnalysis } from "../_shared/intentClassifier.ts";
import type { EnhancedDeckAnalysis } from "../_shared/intentClassifier.ts";
import type { ReasoningOutput } from "./reasoningStage.ts";
import { selectRelevantExamples, formatExamplesForPrompt } from "./fewShotExamples.ts";

type Card = {
  id: number;
  name: string;
  type: string;
  desc: string;
  archetype?: string | null;
};

export interface RecommendationInput {
  reasoning: ReasoningOutput;
  candidates: Card[];
  deckAnalysis: EnhancedDeckAnalysis | undefined;
  intentAnalysis: IntentAnalysis | undefined;
  question: string;
  userPrefs?: {
    playstyle?: "aggro" | "control" | "combo" | "stall" | "hybrid";
    budget?: "low" | "mid" | "high";
  };
  explainTo: "novice" | "intermediate" | "advanced";
  format: "MASTER_DUEL" | "TCG";
  banlistText?: string;
  maxOutputTokens: number;
}

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const MODEL_NAME = Deno.env.get("MODEL_NAME") || "llama-3.3-70b-versatile";
const RECOMMENDATION_TEMPERATURE = parseFloat(Deno.env.get("RECOMMENDATION_TEMPERATURE") || "0.3");

const RECOMMENDER_SCHEMA = `{
  "schemaVersion": "string",
  "confidence": number,
  "explainTo": "novice"|"intermediate"|"advanced",
  "reasoning": {
    "userIntent": "string",
    "deckWeaknesses": "string",
    "strategicConsiderations": "string",
    "metaContext": "string",
    "candidateEvaluation": "string (optional)"
  },
  "summary": "string",
  "recommendations": [
    {
      "cardId": "string",
      "cardName": "string",
      "action": "add"|"remove"|"replace"|"tech"|"note",
      "reason": "string",
      "impactEst": number,
      "synergyScore": number,
      "evidence": ["string"],
      "banned": boolean (optional)
    }
  ],
  "ui": [
    {"id":"string","type":"text"|"list"|"card"|"table"|"suggestion","content": string | string[] | object}
  ],
  "actions": object,
  "meta": object
}`;

/**
 * Build recommendation prompt that includes reasoning from stage 1
 */
function buildRecommendationPrompt(input: RecommendationInput): Array<{ role: string; content: string }> {
  const { reasoning, candidates, deckAnalysis, intentAnalysis, question, explainTo, banlistText } = input;

  let systemPrompt = `You are an expert Yu-Gi-Oh! deck builder providing strategic recommendations.

VALIDATED FACTS HARD RULE: Do not invent brick rates, win rates, or combo lines. Prefer any VALIDATED FACTS block over heuristic deckAnalysis fields.

PREVIOUS ANALYSIS:
Based on your analysis above, you identified:
- User Intent: ${reasoning.userIntent}
- Deck Weaknesses: ${reasoning.deckWeaknesses.join("; ")}
- Deck Strengths: ${reasoning.deckStrengths.join("; ")}
- Strategic Considerations: ${reasoning.strategicConsiderations.join("; ")}
${reasoning.metaContext ? `- Meta Context: ${reasoning.metaContext}` : ""}
- Recommendation Strategy: ${reasoning.recommendationStrategy}
- Priority Criteria: ${reasoning.priorityCriteria.join("; ")}

DECK ANALYSIS:
`;

  if (deckAnalysis) {
    systemPrompt += `- Primary Archetype: ${deckAnalysis.primaryArchetype || "Unknown"}
- Playstyle: ${deckAnalysis.playstyle}
- Deck Size: ${deckAnalysis.deckSize} cards (Main: ${deckAnalysis.mainDeckSize}, Extra: ${deckAnalysis.extraDeckSize})
- Ratios: ${deckAnalysis.ratios.monsters}M / ${deckAnalysis.ratios.spells}S / ${deckAnalysis.ratios.traps}T (${deckAnalysis.ratios.monstersPercent.toFixed(1)}% / ${deckAnalysis.ratios.spellsPercent.toFixed(1)}% / ${deckAnalysis.ratios.trapsPercent.toFixed(1)}%)
- Win Condition: ${deckAnalysis.winCondition}
- Heuristic Brick Hint: ${(deckAnalysis.estimatedBrickRate * 100).toFixed(1)}% (override with VALIDATED FACTS consistency.brickRate when present)
- Card Roles: ${deckAnalysis.cardRoles.starters} starters, ${deckAnalysis.cardRoles.extenders} extenders, ${deckAnalysis.cardRoles.interruptions} interruptions, ${deckAnalysis.cardRoles.boardBreakers} board breakers
- Missing Staples: ${deckAnalysis.missingStaples.map(s => s.cardName).join(", ") || "None detected"}
`;
  }

  if (intentAnalysis) {
    systemPrompt += `
INTENT: ${intentAnalysis.primary} (confidence: ${(intentAnalysis.confidence * 100).toFixed(0)}%)
`;
  }

  systemPrompt += `
USER REQUEST: "${question}"

CANDIDATE CARDS AVAILABLE:
${toTOON({
  name: "candidate_cards",
  items: candidates.map((c) => ({
    id: c.id,
    name: c.name,
    archetype: c.archetype || "",
    type: c.type || "",
    desc: (c.desc || "").slice(0, 320),
  })),
  fields: ["id", "name", "archetype", "type", "desc"],
  truncate: { desc: 320 },
})}
`;

  if (banlistText) {
    systemPrompt += `
BANLIST RESTRICTIONS:
${banlistText}
`;
  }

  systemPrompt += `
INSTRUCTIONS:

Based on your step-by-step analysis above, select specific cards from the candidate pool that best address the identified weaknesses and align with your recommendation strategy.

For each recommendation, explain which step(s) from your analysis it addresses (e.g., "This addresses Step 2's root cause of low starter count by providing a search effect").

${formatExamplesForPrompt(selectRelevantExamples(intentAnalysis?.primary, deckAnalysis?.playstyle))}

For each recommendation:
1. Reference your reasoning when explaining how the card addresses the specific weakness
2. Explain synergy with the deck's archetype and strategy
3. Consider the deck's current state (e.g., don't recommend cards that duplicate existing roles)
4. Assign appropriate priority based on your priority criteria
5. Provide specific evidence from the card's effect text

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. **YOU MUST PROVIDE AT LEAST 3-8 SPECIFIC CARD RECOMMENDATIONS** - This is REQUIRED, not optional
2. **NEVER invent card names or IDs** - ONLY use cards from the candidate pool provided above
3. **Each recommendation MUST reference exact cardIds from the candidate pool** - Check the candidate_cards table for valid IDs
4. **If the candidate pool seems limited, still provide recommendations from what's available** - Even if cards aren't perfect matches, recommend the best options available
5. **Confidence scores must reflect how well the card addresses the specific request (0.0-1.0)**
6. **Reference your reasoning analysis when explaining each recommendation**
7. **For ${explainTo} players, adjust explanation complexity accordingly**
8. **ALWAYS include a "ui" array with at least one UI block** - This is required for the response schema
9. **DO NOT return empty recommendations array** - You must provide actual card recommendations

OUTPUT FORMAT: Strict JSON only, no markdown, no comments. Follow the schema exactly. The "recommendations" array MUST contain 3-8 items, and the "ui" array MUST contain at least 1 item.

RECOMMENDER_SCHEMA:
${RECOMMENDER_SCHEMA}

IMPORTANT: Even if the candidate pool seems limited or not perfectly matched, you MUST still provide 3-8 recommendations from the available candidates. It is better to recommend cards that are "good enough" than to return an empty recommendations array. Users need actionable suggestions, not just analysis.

FAIL-FAST: Only return confidence:0 if you truly cannot make ANY safe recommendation. Otherwise, provide recommendations with appropriate confidence scores.`;

  const userPrompt = `Based on your analysis above, you MUST provide 3-8 specific card recommendations from the candidate pool. Each recommendation must:
1. Use a cardId from the candidate_cards table above
2. Explain how it addresses the identified weaknesses
3. Include specific evidence from the card's effect text
4. Assign appropriate impactEst and synergyScore

You have ${candidates.length} candidate cards available. You MUST select at least 3-5 of them for recommendations. Do not return an empty recommendations array.`;

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];
}

/**
 * Generate recommendations using reasoning from stage 1
 */
export async function generateRecommendations(
  input: RecommendationInput,
): Promise<{ content: string; raw: any }> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const messages = buildRecommendationPrompt(input);

  console.log("[RECOMMENDATION] Generating recommendations with reasoning...");
  const startTime = Date.now();

  try {
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
          messages,
          temperature: RECOMMENDATION_TEMPERATURE,
          top_p: 0.8,
          max_tokens: input.maxOutputTokens,
          stop: ["<<END>>"],
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Recommendation stage failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    const duration = Date.now() - startTime;
    console.log(`[RECOMMENDATION] Completed in ${duration}ms`);

    return { content, raw: result };
  } catch (error) {
    console.error("[RECOMMENDATION] Error:", error);
    throw error;
  }
}
