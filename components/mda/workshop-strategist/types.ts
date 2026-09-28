/**
 * Workshop Strategist message model (Facts Brain coach payload).
 */

import type {
  DeckCoachResponse,
  EvidenceClaim,
  RedirectHint,
  SynergyCandidate,
  TuningRecommendation,
} from "@/lib/engine/assistant-contract";

export interface StrategistMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  coach?: DeckCoachResponse | null;
  mode?: DeckCoachResponse["mode"];
  confidence?: DeckCoachResponse["confidence"];
  evidence?: EvidenceClaim[];
  tuning?: {
    recommendation: TuningRecommendation[];
    tradeoffs: string[];
  } | null;
  synergies?: SynergyCandidate[] | null;
  recommendations?: DeckCoachResponse["recommendations"];
  limitations?: string[];
  /** Soft CTA toward Workshop Matchups / Combos when Facts support it. */
  redirectHint?: RedirectHint | null;
}

/** @deprecated Prefer StrategistMessage */
export type WorkshopAssistantMessage = StrategistMessage;

/** @deprecated Alias for hooks migrating off glass chat types */
export type Message = StrategistMessage;
