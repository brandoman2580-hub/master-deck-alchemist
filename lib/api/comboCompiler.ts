import { getAccessToken } from "../supabaseClient";
import type { ComboGraphSummary, ComboLine } from "@/lib/engine";

export interface CompileCombosResponse {
  combos: ComboGraphSummary;
  archetype: string | null;
  format: string;
  deck_id: string;
}

export interface ExplainComboResponse {
  line_id: string;
  explanation: string;
  combos: ComboGraphSummary;
  archetype: string | null;
  format: string;
}

async function postComboCompiler<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Authentication required to compile combos.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/combo-compiler`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Combo compiler failed (${response.status})`);
  }

  return (await response.json()) as T;
}

/** Server-side compile for a persisted deck. */
export function compileCombosForDeck(
  deckId: string,
): Promise<CompileCombosResponse> {
  return postComboCompiler({ action: "compile", deck_id: deckId });
}

/**
 * Groq explains one validated combo line only.
 */
export function explainComboLine(
  deckId: string,
  lineId: string,
): Promise<ExplainComboResponse> {
  return postComboCompiler({
    action: "explain",
    deck_id: deckId,
    line_id: lineId,
  });
}

export type { ComboLine };
