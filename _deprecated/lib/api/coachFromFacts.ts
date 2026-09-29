import { formatFactsForPrompt } from "@/lib/engine/build-facts";
import { buildCoachSystemPrompt } from "@/lib/engine/coaching";
import { getFacts, type GetFactsOptions } from "@/lib/engine/get-facts";
import type { DeckType } from "@/types/types";
import type { BanStatus } from "@/types/types";

export interface CoachFromFactsInput {
  deck: DeckType;
  baseSystemPrompt: string;
  banlist?: Record<string, BanStatus | string>;
  savedDeckIds?: ReadonlySet<string>;
  factsOptions?: GetFactsOptions;
}

export interface CoachFromFactsResult {
  facts: Awaited<ReturnType<typeof getFacts>>;
  systemPrompt: string;
  factsPromptBlock: string | null;
}

/**
 * Thin coach wrapper: getFacts → formatFacts → system prompt with hard rule.
 * Retrieve + Groq call stay in the calling agent; this only supplies grounded context.
 *
 * Assistant chat UX remains capped on a separate branch — use this for
 * recommendation / builder / synergy entrypoints that need Facts Brain context.
 */
export async function coachFromFacts(
  input: CoachFromFactsInput,
): Promise<CoachFromFactsResult> {
  const facts = await getFacts(input.deck, {
    banlist: input.banlist,
    savedDeckIds: input.savedDeckIds,
    writeCache: true,
    readCache: true,
    ...input.factsOptions,
  });

  const factsPromptBlock = facts ? formatFactsForPrompt(facts) : null;
  const systemPrompt = buildCoachSystemPrompt(
    input.baseSystemPrompt,
    factsPromptBlock ?? undefined,
  );

  return { facts, systemPrompt, factsPromptBlock };
}
