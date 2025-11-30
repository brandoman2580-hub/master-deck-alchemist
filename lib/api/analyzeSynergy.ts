import { getAccessToken } from "../supabaseClient.ts";
import { Card } from "../../types/card.ts";
import process from "node:process";

export interface SynergyAnalysisRequest {
  selectedCards: string[];
  userGoal?: string;
}

export interface SynergyCardRecommendation {
  card_name: string;
  reason: string;
  priority: "high" | "medium" | "low";
  card_data?: Card | null;
}

export interface SynergyAnalysisResponse {
  strategy: string; // sanitized AI text
  recommendations: SynergyCardRecommendation[];
}

export async function analyzeSynergy(
  request: SynergyAnalysisRequest
): Promise<SynergyAnalysisResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-synergy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to analyze synergy");
  }

  return (await response.json()) as SynergyAnalysisResponse;
}
