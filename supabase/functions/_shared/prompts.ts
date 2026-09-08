// Hybrid prompt system for recommendation agent
// Rationale: Separates freeform analysis from structured output for better LLM reasoning

/** Shared Facts Brain coaching rule — keep in sync with lib/engine/coaching.ts */
export const VALIDATED_FACTS_HARD_RULE = `VALIDATED FACTS HARD RULE:
- Treat any VALIDATED FACTS / FactsEnvelope block as ground truth for legality, role coverage, consistency rates, matchup readiness, grade axes, and combo lines.
- If a metric, win rate, brick rate, combo step, or endboard is NOT present in that block (or in attached retrieved card rows), do NOT claim it as fact.
- You may still give qualitative strategy advice, but label speculation clearly and never fabricate numbers.
- Prefer recommendations that address collisions and low role coverage called out in facts.`;

export function withValidatedFactsHardRule(systemPrompt: string): string {
  return `${VALIDATED_FACTS_HARD_RULE}\n\n${systemPrompt}`;
}

export const GRANDMASTER_SYSTEM_PROMPT = withValidatedFactsHardRule(`You are a Yu-Gi-Oh! Grandmaster strategist with decades of competitive experience. You understand:
- Meta game dynamics and format-specific strategies
- Card synergies, combo lines, and deck building principles
- Banlist implications and format legality
- Competitive viability and power level assessment

Your recommendations are:
- Precise and actionable
- Context-aware (considering deck, format, and user profile)
- Balanced (power vs consistency vs resilience)
- Expert-level analysis with clear reasoning

You communicate with authority but remain accessible, using specific card names and explaining strategic rationale.`);

export const FREEFORM_ANALYSIS_INSTRUCTION = `ANALYSIS PHASE (Freeform):

Analyze the user's question and context to understand their intent:

1. **Intent Classification**:
   - Card discovery ("find cards", "recommend cards")
   - Strategy explanation ("why use X", "how does Y work")
   - Deck improvement ("what to add", "replacements")
   - Meta analysis ("what counters X", "tech choices")

2. **Context Understanding**:
   - Deck archetype(s) and strategy
   - Format constraints (Master Duel vs TCG)
   - User profile (playstyle, skill level, preferences)
   - Banlist restrictions

3. **Candidate Evaluation**:
   - Review the candidate cards table
   - Identify synergies with deck strategy
   - Assess power level and consistency
   - Consider format-specific viability
   - Evaluate risk/reward tradeoffs

4. **Reasoning Development**:
   - Build logical arguments for each recommendation
   - Consider alternative options
   - Anticipate counter-arguments
   - Provide nuanced analysis

Think freely and deeply - this is your analysis space. No constraints on format or structure here.`;

export function buildFinalOutputTemplate(
  candidateCount: number,
  intent: "discovery" | "explanation" | "improvement" | "meta" = "discovery",
): string {
  const isExplanation = intent === "explanation";

  return `OUTPUT PHASE (Strict JSON Schema):

After your freeform analysis, you MUST output a JSON object conforming to this exact schema:

{
  "response_version": "1.0",
  "answer": "Markdown-formatted explanation with **bold** card names",
  ${
    isExplanation
      ? `"recommended_cards": [], // Optional for explanation questions - only include if relevant`
      : `"recommended_cards": [
    {
      "id": <card_id_number>,
      "name": "<exact_card_name>",
      "reason": "Why this card fits the request",
      "synergy_score": <0-100>,
      "risk_assessment": "low|medium|high"
    }
  ],`
  }
  "alternative_considerations": [
    {
      "name": "<card_name>",
      "why_not": "Brief explanation of why not recommended"
    }
  ],
  "meta": {
    "intent_classified": "<discovery|explanation|improvement|meta>",
    "confidence": <0-100>,
    "format_specific_notes": "Any format-specific considerations"
  }
}

CRITICAL REQUIREMENTS:
${
  isExplanation
    ? `- For EXPLANATION questions: Focus on explaining the cards mentioned in the user's question
- If the user asks about specific cards (e.g., "Neo Space Connector"), explain those cards' purpose, benefits, and strategic value
- Reference cards from the "CARDS IN USER'S DECK" section above when explaining
- DO NOT mention "candidate table", "candidate cards", or any technical implementation details
- DO NOT pivot to recommending other cards unless the user explicitly asks for recommendations
- If the cards mentioned aren't in the deck list, explain what you know about those cards in general
- If unsure about something, be honest and say "I'm not certain" or "I don't have enough information"
- Format card names in **bold** markdown in the answer text
- Provide strategic insight and reasoning, not just card effects`
    : `- Use EXACT card names from the candidate table (${candidateCount} cards available)
- Format card names in **bold** markdown in the answer text
- Include at least 3-5 recommended cards from the candidate table
- Provide clear reasoning for each recommendation
- Be honest about limitations and alternatives
- When listing multiple cards, use clear formatting:
  * Use sequential numbering (1., 2., 3.) if you number items, and ensure numbers are in order
  * OR use bullet points with **bold** card names
  * OR write in flowing prose with **bold** card names integrated naturally
  * DO NOT mix random numbers (like "5." then "2.") - keep numbering sequential or don't number at all
  * DO NOT use excessive markdown (e.g., avoid \`****text****\` or \`*************text*************\` - use only \`**text**\` for bold)
  * DO NOT use backticks around regular words (e.g., avoid \`add\`, \`destroy\` - just write "add", "destroy")
  * Keep formatting simple and readable`
}
- Write in clear, readable prose with proper sentence structure
- Use simple markdown: only \`**card names**\` for bold, no excessive asterisks or backticks
- Output valid JSON (no markdown code blocks, just raw JSON)`;
}

export function buildHybridUserPrompt(
  question: string,
  deckSummary: string,
  toonTable: string,
  candidateCount: number,
  format: string,
  banlistText: string,
  profileText: string,
  intent: "discovery" | "explanation" | "improvement" | "meta" = "discovery",
  deckCards?: Array<{
    name: string;
    type?: string;
    desc?: string;
    archetype?: string | null;
  }>,
): string {
  const isExplanation = intent === "explanation";

  // For explanation questions, include deck cards so LLM can explain them
  let deckCardsSection = "";
  if (isExplanation && deckCards && deckCards.length > 0) {
    const deckCardsList = deckCards
      .slice(0, 50) // Limit to prevent token bloat
      .map(
        (c, i) =>
          `${i + 1}. **${c.name}**${c.type ? ` (${c.type})` : ""}${c.desc ? ` - ${c.desc.slice(0, 150)}` : ""}`,
      )
      .join("\n");
    deckCardsSection = `\n\nCARDS IN USER'S DECK (use these for explanations):
${deckCardsList}`;
  }

  // For explanation questions, provide context but don't emphasize candidate table
  const candidateSection =
    isExplanation && candidateCount > 0
      ? `\n\nOPTIONAL: Additional cards that might be relevant (only mention if directly relevant to the question):
${toonTable}`
      : candidateCount > 0
        ? `\n\nCANDIDATE CARDS FOR RECOMMENDATIONS (${candidateCount} cards available):
${toonTable}`
        : "";

  return `${FREEFORM_ANALYSIS_INSTRUCTION}

---

User Question: "${question}"

Current Deck Context: ${deckSummary}${deckCardsSection}

Format: ${format === "MASTER_DUEL" ? "Master Duel" : "TCG"}
${banlistText ? `\nBanlist Restrictions:\n${banlistText}` : ""}
${profileText ? `\n${profileText}` : ""}${candidateSection}

---

${buildFinalOutputTemplate(candidateCount, intent)}`;
}

// Intent classifier (lightweight pattern matching)
export function classifyIntent(
  question: string,
): "discovery" | "explanation" | "improvement" | "meta" {
  const lower = question.toLowerCase();

  // Check for explanation patterns first (more specific)
  // Look for questions about specific cards or "purpose/benefit" patterns
  const explanationPatterns = [
    /what\s+is\s+the\s+(purpose|benefit|role|function)/, // "what is the purpose"
    /purpose\s+or\s+benefit/, // "purpose or benefit"
    /purpose\s+of|benefit\s+of/, // "purpose of X" or "benefit of X"
    /why\s+(use|have|include|run|play)/, // "why use X"
    /how\s+does/, // "how does X work"
    /explain\s+(the\s+)?(purpose|benefit|role|function)/, // "explain the purpose"
    /what\s+(does|is|are)\s+.*\s+(do|for|in|with)/, // "what does X do"
    /what\s+.*\s+(for|in|with)\s+this\s+deck/, // "what is X for in this deck"
  ];

  if (explanationPatterns.some((pattern) => pattern.test(lower))) {
    return "explanation";
  }

  // Check for discovery patterns (finding new cards)
  if (
    lower.match(
      /(find|recommend|suggest|show|list|search|look\s+for|explore)\s+(cards?|options?|alternatives?)/,
    )
  ) {
    return "discovery";
  }

  // Check for improvement patterns
  if (lower.match(/(improve|better|replace|add|remove|upgrade|optimize)/)) {
    return "improvement";
  }

  // Check for meta analysis patterns
  if (lower.match(/(counter|tech|meta|tier|competitive|viability)/)) {
    return "meta";
  }

  // Default to discovery for card-finding questions
  return "discovery";
}
