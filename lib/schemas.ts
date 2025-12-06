import { z } from "zod";

// Schema for card candidate returned from Supabase (truncated effect text)
export const CardCandidateSchema = z.object({
  id: z.number(),
  name: z.string(),
  archetype: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  desc: z.string().nullable().optional(), // truncated description/effect
});

export type CardCandidate = z.infer<typeof CardCandidateSchema>;

// Schema of the LLM output we expect (strict)
export const LlmPickSchema = z.object({
  name: z.string(),
  // ideally include the card ID to make matching unambiguous
  id: z.number().optional(),
  reason: z.string(), // <= 40 words (enforced by prompt; not by Zod)
  combo: z.string(), // <= 20 words (enforced by prompt)
  risk: z.string().optional(),
});

export const LlmResponseSchema = z.object({
  picks: z.array(LlmPickSchema).min(1).max(10),
});

export type LlmResponse = z.infer<typeof LlmResponseSchema>;
