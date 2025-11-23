import { getAccessToken } from "@/lib/supabaseClient";
import { Card } from "@/types/card";

export type AnalysisType =
  | "summary"
  | "power_level"
  | "consistency"
  | "resilience"
  | "matchup"
  | "complexity"
  | "card_suggestions"
  | "custom";

export interface AnalyzeDeckRequest {
  deck_id: string | number;
  banlist_format?: "MASTER_DUEL" | "TCG";
  analysis_type?: AnalysisType;
  quick_prompt?: string;
  custom_prompt?: string;
}

export interface AnalyzeDeckResult {
  user?: any;
  analysis_type: AnalysisType;
  raw_answer: string; // sanitized AI text
  structured_analysis?: any;
  suggestions?: any;
  recommendedCards?: Card[];
}

export async function analyzeDeck(
  request: AnalyzeDeckRequest
): Promise<AnalyzeDeckResult> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deck-analysis`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        deck_id: request.deck_id,
        banlist_format: request.banlist_format ?? "MASTER_DUEL",
        analysis_type: request.analysis_type ?? "summary",
        quick_prompt: request.quick_prompt,
        custom_prompt: request.custom_prompt,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to analyze deck");
  }

  return (await response.json()) as AnalyzeDeckResult;
}
