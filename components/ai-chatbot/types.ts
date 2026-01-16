import type { LucideIcon } from "lucide-react";
import type { Card } from "../../types/card";
import type { BanStatus, DeckSection } from "../../types/types";
import type { RecommenderResponse } from "../../types/recommender";

// ============================================================================
// DECK ANALYSIS TYPES
// ============================================================================

export type DeckAnalysisStructured = {
  overview: string;
  strategic_identity: {
    playstyle: string;
    description: string;
  };
  power_level: {
    score: number;
    explanation: string;
    suggestions: string[];
  };
  consistency: {
    score: number;
    explanation: string;
    suggestions: string[];
  };
  resilience_and_grind: {
    score: number;
    explanation: string;
    suggestions: string[];
  };
  matchup_profile: {
    score: number;
    explanation: string;
    suggestions: string[];
  };
  complexity_and_skill: {
    score: number;
    explanation: string;
    skill_floor: string;
    skill_ceiling: string;
  };
  illegal_cards: {
    forbidden: string[];
    notes: string;
  };
};

export type DeckStats = {
  mainCount: number;
  extraCount: number;
  sideCount: number;
  monsterCount: number;
  spellCount: number;
  trapCount: number;
  averageLevel?: number | null;
  archetypeCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  attributeCounts: Record<string, number>;
};

// ============================================================================
// ANALYSIS TYPES
// ============================================================================

export type AnalysisType =
  | "summary"
  | "power_level"
  | "consistency"
  | "resilience"
  | "matchup"
  | "complexity"
  | "card_suggestions"
  | "custom";

export type AnalysisCategoryType = "consistency" | "power" | "interaction" | "meta";

// ============================================================================
// CARD SUGGESTION TYPES
// ============================================================================

export interface CandidateCard {
  candidateId: number;
  name: string;
  type: string;
  race?: string;
  desc: string;
  archetype?: string | null;
}

export interface CardSuggestionMeta {
  candidateId: number;
  reason: string;
  synergy_with_candidateIds?: number[];
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestedCards?: Card[];
  // Phase 3: New strict schema response fields
  recommenderResponse?: RecommenderResponse;
  recommendation_id?: string; // For feedback tracking
  response_version?: string; // Schema version
  cardSuggestionsMeta?: CardSuggestionMeta[]; // For card_suggestions analysis type
  candidateCards?: CandidateCard[]; // For card_suggestions analysis type
  recommendedCards?: Array<{
    id?: number;
    name: string;
    reason?: string;
    synergy_score?: number;
    risk_assessment?: "low" | "medium" | "high";
  }>; // NEW: Structured recommended cards from JSON response
  alternativeConsiderations?: Array<{
    name: string;
    why_not?: string;
  }>; // NEW: Alternative considerations from JSON response
  recommendationMeta?: {
    intent_classified?: string;
    confidence?: number;
    format_specific_notes?: string;
  }; // NEW: Meta information from JSON response
  type?: "quick-prompt" | "deck-analysis" | "analysis-mode" | "error";
  analysisCategory?: AnalysisCategoryType;
  categoryRecommendation?: CategoryRecommendationResponseType;
  meta?: {
    deckId?: string | number;
    banlistFormat?: string;
    analysisType?: AnalysisType;
    structuredAnalysis?:
      | DeckAnalysisStructured
      | Record<string, unknown>
      | {
          suggested_cards?: {
            card_name: string;
            section: "main" | "side" | "extra";
            reason: string;
          }[];
          notes?: string;
        }; // mode-specific shape
    deckStats?: DeckStats | null;
  };
}

// ============================================================================
// CATEGORY RECOMMENDATION TYPES
// ============================================================================

export type CategoryRecommendation = {
  categoryAnalysis?: {
    category: string;
    mode: string;
    score?: number;
    summary?: string;
    specificIssues?: string[];
    opportunities?: string[];
    formatSpecificNotes?: string;
  };
  recommendations?: Array<{
    cardName: string;
    reason: string;
    location: "main" | "extra" | "side";
    priority?: "critical" | "high" | "medium" | "low";
    quantity?: number;
    replacesCards?: string[];
    synergies?: string[];
    impact?: string;
    banlistLegal?: boolean;
  }>;
  cutsRecommendations?: Array<{
    cardName: string;
    reason?: string;
    quantity?: number;
  }>;
  ratioAdjustments?: Array<{
    cardName: string;
    currentQuantity?: number;
    recommendedQuantity?: number;
    reason?: string;
  }>;
};

export type CategoryRecommendationResponseType = {
  category: AnalysisCategoryType;
  mode: string;
  recommendations: CategoryRecommendation;
  sessionId?: string | null;
  error?: string;
};

export type CategoryRecommendationRequestLocal = {
  deckId: string;
  category: AnalysisCategoryType;
  prompt: string;
};

// ============================================================================
// ANALYSIS MODE TYPES
// ============================================================================

export type AnalysisMode = {
  id: AnalysisCategoryType;
  label: string;
  description: string;
  prompt: string;
  accent: string;
  icon: LucideIcon;
};

// ============================================================================
// QUOTA TYPES
// ============================================================================

export interface Quota {
  requests_left: number;
  max_requests: number;
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface AIChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuestion?: string;
}

export interface AIResponseCardProps {
  content: string;
  suggestedCards?: Card[];
  cardSuggestionsMeta?: CardSuggestionMeta[];
  candidateCards?: CandidateCard[];
  banlist?: Record<string, BanStatus>;
  currentDeckMode?: string;
  addingCardId?: string | null;
  addedCards?: Set<string>;
  canAddCardToDeck?: (card: Card, deckType: DeckSection) => boolean;
  getOptimalDeckType?: (card: Card) => DeckSection;
  handleAddCardToDeck?: (card: Card, selectedDeckType?: DeckSection) => void;
  allCards?: Card[];
  isCardSuggestionMode?: boolean;
}

