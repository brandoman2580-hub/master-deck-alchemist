/**
 * Coaching hard rules for Facts Brain consumers.
 * Groq / LLM layers must not invent metrics or combo steps.
 */

export const VALIDATED_FACTS_HARD_RULE = `VALIDATED FACTS HARD RULE:
- Treat any VALIDATED FACTS / FactsEnvelope block as ground truth for legality, role coverage, consistency rates, matchup readiness, grade axes, and combo lines.
- If a metric, win rate, brick rate, combo step, or endboard is NOT present in that block (or in attached retrieved card rows), do NOT claim it as fact.
- You may still give qualitative strategy advice, but label speculation clearly and never fabricate numbers.
- Prefer recommendations that address collisions and low role coverage called out in facts.`;

/**
 * Prefix a system prompt with the Facts Brain hard rule.
 */
export function withValidatedFactsHardRule(systemPrompt: string): string {
  return `${VALIDATED_FACTS_HARD_RULE}\n\n${systemPrompt}`;
}

/**
 * Build a coach system prompt that always includes the hard rule + optional facts block.
 */
export function buildCoachSystemPrompt(
  basePrompt: string,
  factsPromptBlock?: string,
): string {
  const factsSection = factsPromptBlock?.trim()
    ? `\n\n${factsPromptBlock.trim()}\n`
    : "\n\n(No VALIDATED FACTS block attached — do not invent quantitative deck metrics.)\n";
  return withValidatedFactsHardRule(`${basePrompt}${factsSection}`);
}

/**
 * Heuristic guard used in tests / sanitizers: flags invented-rate language
 * when no facts block was provided to the model.
 */
export function mentionsInventedQuantitativeClaims(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b\d{1,3}\s*%\s*(brick|win\s*rate|readiness)\b/.test(lower) ||
    /\bestimated brick rate\b/.test(lower) ||
    /\bsimulated\s+\d+\s+duels?\b/.test(lower)
  );
}
