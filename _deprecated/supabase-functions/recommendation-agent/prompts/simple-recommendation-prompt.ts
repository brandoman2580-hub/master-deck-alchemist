import type { IntentAnalysis } from "../../_shared/intentClassifier.ts";

type DeckAnalysis = {
  primaryArchetype: string | null;
  playstyle: string;
  mainDeckSize: number;
  cardRoles: {
    starters: number;
    extenders: number;
    interruptions: number;
  };
};

type Card = {
  id: number;
  name: string;
  desc?: string;
  type?: string;
};

/**
 * Build a simplified, focused prompt for LLM recommendations
 * Reduces prompt size by ~60% compared to STRICT_SYSTEM_PROMPT
 */
export function buildSimplePrompt(
  question: string,
  deckAnalysis: DeckAnalysis | null,
  candidates: Card[],
  intent?: IntentAnalysis,
  format: "MASTER_DUEL" | "TCG" = "MASTER_DUEL",
  explainTo: "novice" | "intermediate" | "advanced" = "novice",
  numberConstraint?: { exact?: number; min?: number; max?: number }
): Array<{ role: string; content: string }> {
  // Build deck summary section
  const deckSummary = deckAnalysis
    ? `
DECK SUMMARY:
- Archetype: ${deckAnalysis.primaryArchetype || "Mixed"}
- Main deck: ${deckAnalysis.mainDeckSize} cards
- Starters: ${deckAnalysis.cardRoles.starters}
- Extenders: ${deckAnalysis.cardRoles.extenders}
- Hand traps/Interruptions: ${deckAnalysis.cardRoles.interruptions}
`
    : "No deck analysis available";

  // Build candidate cards list (limit to 50 to keep prompt size manageable)
  const candidateList = candidates
    .slice(0, 50)
    .map((c) => `ID ${c.id}: ${c.name}${c.desc ? ` - ${c.desc.substring(0, 100)}` : ""}`)
    .join("\n");

  // Build number constraint instruction
  let numberConstraintInstruction = "";
  if (numberConstraint) {
    if (numberConstraint.exact !== undefined) {
      numberConstraintInstruction = `\n\nIMPORTANT: Provide exactly ${numberConstraint.exact} recommendation(s).`;
    } else if (
      numberConstraint.min !== undefined &&
      numberConstraint.max !== undefined
    ) {
      numberConstraintInstruction = `\n\nIMPORTANT: Provide between ${numberConstraint.min} and ${numberConstraint.max} recommendations.`;
    } else if (numberConstraint.min !== undefined) {
      numberConstraintInstruction = `\n\nIMPORTANT: Provide at least ${numberConstraint.min} recommendation(s).`;
    } else if (numberConstraint.max !== undefined) {
      numberConstraintInstruction = `\n\nIMPORTANT: Provide at most ${numberConstraint.max} recommendation(s).`;
    }
  }

  // Build intent context if available
  const intentContext = intent
    ? `\nINTENT: ${intent.primary} (${Math.round(intent.confidence * 100)}% confidence)`
    : "";

  const systemPrompt = `You are a Yu-Gi-Oh deck advisor. The user asked: "${question}"
${intentContext}
${deckSummary}

AVAILABLE CARDS (choose from these IDs only):
${candidateList}

RESPOND WITH THIS EXACT JSON (no markdown, no code blocks, no text before or after):
{
  "recommendations": [
    {
      "cardId": 12345,
      "cardName": "Exact card name",
      "reason": "Why this helps the deck",
      "impactEst": 0.7,
      "synergyScore": 0.8
    }
  ],
  "summary": "Brief explanation of your picks"
}

RULES:
1. Pick 3-5 cards from the list above${numberConstraintInstruction}
2. Use ONLY the numeric IDs shown (e.g., 12345)
3. Explain how each card addresses "${question}"
4. Return ONLY the JSON object, nothing else
5. Do not wrap the JSON in markdown code blocks`;

  const userContent = JSON.stringify({
    question,
    format,
    explainTo,
    ...(numberConstraint && { numberConstraint }),
  });

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
}
