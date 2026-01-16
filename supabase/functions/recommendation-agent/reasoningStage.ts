/**
 * Phase 2: Reasoning Stage Handler
 * Generates structured reasoning about the deck and user request before making recommendations
 */

import type { IntentAnalysis } from "../_shared/intentClassifier.ts";
import type { EnhancedDeckAnalysis } from "../_shared/intentClassifier.ts";
import { selectRelevantExamples, formatExamplesForPrompt } from "./fewShotExamples.ts";

export interface ReasoningOutput {
  userIntent: string;
  deckWeaknesses: string[];
  deckStrengths: string[];
  strategicConsiderations: string[];
  metaContext?: string;
  recommendationStrategy: string;
  priorityCriteria: string[];
}

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const MODEL_NAME = Deno.env.get("MODEL_NAME") || "llama-3.3-70b-versatile";
const REASONING_TEMPERATURE = parseFloat(Deno.env.get("REASONING_TEMPERATURE") || "0.7");
const MAX_REASONING_TOKENS = 1000;

/**
 * Build reasoning prompt template
 * Phase 3: Added metaContext parameter
 */
function buildReasoningPrompt(
  question: string,
  deckAnalysis: EnhancedDeckAnalysis | undefined,
  intentAnalysis: IntentAnalysis | undefined,
  candidateSummary: string,
  metaContext?: string,
): string {
  let prompt = `You are an expert Yu-Gi-Oh! deck analyst. Your task is to ANALYZE a deck and user request WITHOUT making specific card recommendations yet.

DECK ANALYSIS:
`;

  if (deckAnalysis) {
    prompt += `- Primary Archetype: ${deckAnalysis.primaryArchetype || "Unknown"}
- Playstyle: ${deckAnalysis.playstyle}
- Deck Size: ${deckAnalysis.deckSize} cards (Main: ${deckAnalysis.mainDeckSize}, Extra: ${deckAnalysis.extraDeckSize})
- Ratios: ${deckAnalysis.ratios.monsters}M / ${deckAnalysis.ratios.spells}S / ${deckAnalysis.ratios.traps}T (${deckAnalysis.ratios.monstersPercent.toFixed(1)}% / ${deckAnalysis.ratios.spellsPercent.toFixed(1)}% / ${deckAnalysis.ratios.trapsPercent.toFixed(1)}%)
- Win Condition: ${deckAnalysis.winCondition}
- Estimated Brick Rate: ${(deckAnalysis.estimatedBrickRate * 100).toFixed(1)}%
- Card Roles: ${deckAnalysis.cardRoles.starters} starters, ${deckAnalysis.cardRoles.extenders} extenders, ${deckAnalysis.cardRoles.interruptions} interruptions, ${deckAnalysis.cardRoles.boardBreakers} board breakers
- Missing Staples: ${deckAnalysis.missingStaples.map(s => s.cardName).join(", ") || "None detected"}
`;
  } else {
    prompt += "- No detailed analysis provided\n";
  }

  if (intentAnalysis) {
    prompt += `
INTENT DETECTED: ${intentAnalysis.primary} (confidence: ${(intentAnalysis.confidence * 100).toFixed(0)}%)
`;
    if (intentAnalysis.secondary) {
      prompt += `SECONDARY INTENT: ${intentAnalysis.secondary}\n`;
    }
  }

  prompt += `
USER REQUEST: "${question}"

AVAILABLE CANDIDATES SUMMARY:
${candidateSummary}

YOUR TASK: Think step-by-step about this request and provide structured analysis.

STEP 1: What is the user really asking for?
- Identify the core problem or goal
- Consider any implicit needs not explicitly stated
- Note any constraints mentioned

STEP 2: What are the root causes of the problem they're describing?
- Analyze deck weaknesses related to the request
- Consider how deck composition contributes to the issue
- Identify specific metrics that indicate the problem

STEP 3: What are the deck's strengths to preserve?
- Identify what the deck does well
- Note cards/strategies that should be maintained
- Consider archetype identity and core strategy

STEP 4: How does playstyle affect recommendations?
- Consider how ${deckAnalysis?.playstyle || "the deck's"} playstyle impacts needs
- Think about deck size implications (${deckAnalysis?.mainDeckSize || 40}-card deck needs)
- Consider win condition alignment

STEP 5: What types of cards would best address the root causes?
- Identify card roles needed (starter, extender, interruption, etc.)
- Consider archetype-specific vs generic options
- Think about synergy requirements

STEP 6: Are there any constraints or trade-offs to consider?
- Meta considerations (current format, popular decks)
- Deck space constraints
- Budget or accessibility concerns
- Banlist restrictions

OUTPUT FORMAT: Provide your analysis as structured text. Do NOT make specific card recommendations yet. Focus on analysis.

${formatExamplesForPrompt(selectRelevantExamples(intentAnalysis?.primary, deckAnalysis?.playstyle))}

Structure your response as follows:

USER INTENT: [Clear description of what the user is really asking for]

DECK WEAKNESSES: [List 3-5 specific weaknesses related to the request, one per line]

DECK STRENGTHS: [List 2-3 strengths to preserve, one per line]

STRATEGIC CONSIDERATIONS: [2-3 considerations about how playstyle/deck size/archetype affects recommendations, one per line]

${metaContext ? `CURRENT META CONTEXT:
${metaContext}

` : ''}META CONTEXT: [${metaContext ? 'Use the meta context above' : 'Optional: Current meta considerations if relevant'}]

RECOMMENDATION STRATEGY: [Describe the overall approach for selecting cards - what roles to prioritize, what types of effects to look for]

PRIORITY CRITERIA: [List 3-5 criteria for ranking recommendations, one per line]
`;

  return prompt;
}

/**
 * Parse reasoning output from LLM response
 */
function parseReasoningOutput(response: string): ReasoningOutput {
  const output: Partial<ReasoningOutput> = {
    userIntent: "",
    deckWeaknesses: [],
    deckStrengths: [],
    strategicConsiderations: [],
    recommendationStrategy: "",
    priorityCriteria: [],
  };

  // Extract USER INTENT
  const intentMatch = response.match(/USER INTENT:\s*(.+?)(?:\n|DECK WEAKNESSES:|$)/is);
  if (intentMatch) {
    output.userIntent = intentMatch[1].trim();
  }

  // Extract DECK WEAKNESSES (multi-line list)
  const weaknessesMatch = response.match(/DECK WEAKNESSES:\s*([\s\S]+?)(?:\nDECK STRENGTHS:|$)/i);
  if (weaknessesMatch) {
    output.deckWeaknesses = weaknessesMatch[1]
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^[-•*]\s*$/))
      .map(line => line.replace(/^[-•*]\s*/, ""));
  }

  // Extract DECK STRENGTHS
  const strengthsMatch = response.match(/DECK STRENGTHS:\s*([\s\S]+?)(?:\nSTRATEGIC CONSIDERATIONS:|$)/i);
  if (strengthsMatch) {
    output.deckStrengths = strengthsMatch[1]
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^[-•*]\s*$/))
      .map(line => line.replace(/^[-•*]\s*/, ""));
  }

  // Extract STRATEGIC CONSIDERATIONS
  const considerationsMatch = response.match(/STRATEGIC CONSIDERATIONS:\s*([\s\S]+?)(?:\nMETA CONTEXT:|RECOMMENDATION STRATEGY:|$)/i);
  if (considerationsMatch) {
    output.strategicConsiderations = considerationsMatch[1]
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^[-•*]\s*$/))
      .map(line => line.replace(/^[-•*]\s*/, ""));
  }

  // Extract META CONTEXT (optional)
  const metaMatch = response.match(/META CONTEXT:\s*([\s\S]+?)(?:\nRECOMMENDATION STRATEGY:|$)/i);
  if (metaMatch) {
    output.metaContext = metaMatch[1].trim();
  }

  // Extract RECOMMENDATION STRATEGY
  const strategyMatch = response.match(/RECOMMENDATION STRATEGY:\s*([\s\S]+?)(?:\nPRIORITY CRITERIA:|$)/i);
  if (strategyMatch) {
    output.recommendationStrategy = strategyMatch[1].trim();
  }

  // Extract PRIORITY CRITERIA
  const criteriaMatch = response.match(/PRIORITY CRITERIA:\s*([\s\S]+?)(?:\n|$)/i);
  if (criteriaMatch) {
    output.priorityCriteria = criteriaMatch[1]
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^[-•*]\s*$/))
      .map(line => line.replace(/^[-•*]\s*/, ""));
  }

  // Fallback: if structured parsing fails, try to extract from free-form text
  if (!output.userIntent && response.length > 0) {
    const lines = response.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > 0) {
      output.userIntent = lines[0].substring(0, 200);
    }
  }

  // Ensure required fields have defaults
  return {
    userIntent: output.userIntent || "Improve deck based on user request",
    deckWeaknesses: (output.deckWeaknesses && output.deckWeaknesses.length > 0) ? output.deckWeaknesses : ["Deck analysis needed"],
    deckStrengths: (output.deckStrengths && output.deckStrengths.length > 0) ? output.deckStrengths : ["Preserve current strategy"],
    strategicConsiderations: (output.strategicConsiderations && output.strategicConsiderations.length > 0) ? output.strategicConsiderations : ["Consider deck playstyle and size"],
    metaContext: output.metaContext,
    recommendationStrategy: output.recommendationStrategy || "Select cards that address identified weaknesses while maintaining deck identity",
    priorityCriteria: (output.priorityCriteria && output.priorityCriteria.length > 0) ? output.priorityCriteria : ["Relevance to request", "Synergy with deck", "Meta relevance"],
  };
}

/**
 * Generate reasoning analysis for the deck and user request
 * Phase 3: Added metaContext parameter
 */
export async function generateReasoning(
  question: string,
  deckAnalysis: EnhancedDeckAnalysis | undefined,
  intentAnalysis: IntentAnalysis | undefined,
  candidateSummary: string,
  metaContext?: string,
): Promise<ReasoningOutput> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const prompt = buildReasoningPrompt(question, deckAnalysis, intentAnalysis, candidateSummary, metaContext);

  console.log("[REASONING] Generating reasoning analysis...");
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
          messages: [
            {
              role: "system",
              content: "You are an expert Yu-Gi-Oh! deck analyst. Provide structured analysis without making specific card recommendations.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: REASONING_TEMPERATURE,
          top_p: 0.9,
          max_tokens: MAX_REASONING_TOKENS,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Reasoning stage failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    const duration = Date.now() - startTime;
    console.log(`[REASONING] Completed in ${duration}ms`);

    const reasoning = parseReasoningOutput(content);
    console.log("[REASONING] Parsed reasoning:", {
      userIntent: reasoning.userIntent.substring(0, 100),
      weaknessesCount: reasoning.deckWeaknesses.length,
      strengthsCount: reasoning.deckStrengths.length,
      considerationsCount: reasoning.strategicConsiderations.length,
    });

    return reasoning;
  } catch (error) {
    console.error("[REASONING] Error:", error);
    // Return fallback reasoning on error
    return {
      userIntent: question || "Improve deck",
      deckWeaknesses: ["Analysis unavailable"],
      deckStrengths: ["Preserve current strategy"],
      strategicConsiderations: ["Consider deck composition"],
      recommendationStrategy: "Select relevant cards based on request",
      priorityCriteria: ["Relevance", "Synergy", "Meta relevance"],
    };
  }
}
