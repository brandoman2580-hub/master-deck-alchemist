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

// Deck Tester Agent specific types
export interface DeckTesterAgentRequest {
  deck_a: DeckType;
  deck_b: DeckType;
  test_type: "matchup_analysis" | "duel_simulation" | "strategic_insights";
  num_simulations?: number; // Max 20
  context?: string;
  banlist_format: "MASTER_DUEL" | "TCG";
}

export interface MatchupAssessment {
  deck_a_advantages: string[];
  deck_b_advantages: string[];
  key_factors: string[];
  difficulty_rating: "very_favorable" | "favorable" | "even" | "unfavorable" | "very_unfavorable";
}

export interface StrategicInsights {
  going_first_strategy: string;
  going_second_strategy: string;
  key_plays: string[];
  disruption_points: string[];
}

// Matchup Analysis specific analytics
export interface MatchupAnalytics {
  win_rate_estimates: {
    going_first: number; // 0-100
    going_second: number; // 0-100
    overall: number; // 0-100
  };
  card_effectiveness: Array<{
    card_name: string;
    impact_score: number; // 0-100
    description: string;
    frequency_mentioned: number;
  }>;
  matchup_strengths: Array<{
    archetype_or_deck_type: string;
    win_rate: number;
    reason: string;
  }>;
  matchup_weaknesses: Array<{
    archetype_or_deck_type: string;
    win_rate: number;
    reason: string;
  }>;
  side_deck_impact: Array<{
    card_name: string;
    matchup_improvement: number; // 0-100
    description: string;
  }>;
  resource_usage: {
    draw_consistency: number; // 0-100
    resource_depletion_rate: "fast" | "medium" | "slow";
    recovery_success_rate: number; // 0-100
    description: string;
  };
}

// Duel Simulation specific analytics
export interface SimulationAnalytics {
  games_simulated: number;
  wins_deck_a: number;
  wins_deck_b: number;
  draws: number;
  avg_turn_length: number;
  common_outcomes: Array<{
    outcome: string;
    frequency: number;
    explanation: string;
  }>;
  turn_by_turn_progression: Array<{
    turn: number;
    deck_a_state: string;
    deck_b_state: string;
    critical_play: string;
  }>;
  combo_success_rates: Array<{
    combo_name: string;
    success_rate: number; // 0-100
    impact_on_win_rate: number; // 0-100
    description: string;
  }>;
  decision_points: Array<{
    turn: number;
    decision: string;
    outcome: string;
    alternative: string;
    impact: "high" | "medium" | "low";
  }>;
  game_duration_stats: {
    fastest_win: number; // turns
    slowest_win: number; // turns
    average_duration: number; // turns
    tempo: "fast" | "medium" | "slow";
  };
  damage_trends: {
    avg_damage_per_turn: number;
    peak_damage_turn: number;
    damage_consistency: number; // 0-100
    description: string;
  };
}

// Strategic Insights specific analytics
export interface StrategicAnalytics {
  key_card_synergies: Array<{
    card_a: string;
    card_b: string;
    synergy_score: number; // 0-100
    description: string;
    win_rate_impact: number; // 0-100
  }>;
  vulnerabilities: Array<{
    weakness: string;
    exploitability_score: number; // 0-100
    exploitability_level: "high" | "medium" | "low";
    countermeasures: string[];
  }>;
  playstyle_profile: {
    primary_style: "control" | "aggro" | "combo" | "midrange" | "stun" | "rogue";
    style_confidence: number; // 0-100
    evidence: string[];
    description: string;
  };
  meta_adaptation: {
    current_meta_fit: number; // 0-100
    recommended_changes: Array<{
      card_to_add?: string;
      card_to_remove?: string;
      reason: string;
      expected_improvement: number; // 0-100
    }>;
    meta_trends: string[];
  };
  risk_reward_analysis: Array<{
    play: string;
    risk_level: "high" | "medium" | "low";
    reward_potential: "high" | "medium" | "low";
    success_rate: number; // 0-100
    description: string;
  }>;
}

export interface SimulationOutcome {
  outcome: string;
  frequency: number;
  explanation: string;
}

export interface SimulationResults {
  games_simulated: number;
  wins_deck_a: number;
  wins_deck_b: number;
  draws: number;
  avg_turn_length: number;
  common_outcomes: SimulationOutcome[];
}

export interface DeckTesterAgentResponse {
  analysis: string;
  predicted_win_rate: number; // 0-100
  matchup_assessment: MatchupAssessment;
  strategic_insights: StrategicInsights;
  // Test type specific analytics
  matchup_analytics?: MatchupAnalytics;
  simulation_analytics?: SimulationAnalytics;
  strategic_analytics?: StrategicAnalytics;
  // Legacy support (for duel_simulation)
  simulation_results?: SimulationResults;
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

