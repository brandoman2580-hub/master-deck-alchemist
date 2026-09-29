import { Card } from "./card";
import { DeckType } from "./types";

// Base request interface for all AI agents
export interface AIAgentRequest {
  user_id?: string;
  format?: "MASTER_DUEL" | "TCG";
  context?: Record<string, any>;
}

// Card recommendation interface
export interface CardRecommendation {
  candidate_id: number;
  card_name: string;
  reason: string;
  priority: "high" | "medium" | "low";
  section?: "main" | "extra" | "side";
  synergy_with?: number[];
  card_data?: Card | null;
}

// Deck assessment interface
export interface DeckAssessment {
  completeness_score: number; // 0-100
  archetype_coherence: number; // 0-100
  balance_score: number; // 0-100
  issues: string[];
  strengths: string[];
}

// Deck Builder Agent specific types
export interface DeckBuilderAgentRequest {
  current_deck: DeckType;
  user_goal?: string;
  archetype_preference?: string;
  playstyle?: string;
  context?: "initial_build" | "refining" | "completing";
  banlist_format?: "MASTER_DUEL" | "TCG";
}

export interface DeckBuilderAgentResponse {
  analysis: string;
  suggestions: CardRecommendation[];
  deck_assessment: DeckAssessment;
  next_steps: string[];
  deck_stats?: {
    mainCount: number;
    extraCount: number;
    sideCount: number;
    monsterCount: number;
    spellCount: number;
    trapCount: number;
    primaryArchetype: string | null;
    archetypeCount: number;
  };
  estimated_cost?: {
    tokens_used: number;
    cost_usd: number;
  };
}

// Usage tracking
export interface AgentUsage {
  tokens_used: number;
  cost_usd: number;
  requests_count: number;
}
