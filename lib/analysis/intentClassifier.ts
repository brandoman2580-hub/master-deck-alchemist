import type { EnhancedDeckAnalysis } from "@/app/deck-builder/utils";

export type RecommendationIntent = 
  | 'consistency' 
  | 'power' 
  | 'interaction' 
  | 'meta' 
  | 'tech' 
  | 'archetype_support'
  | 'general';

export interface IntentAnalysis {
  primary: RecommendationIntent;
  secondary?: RecommendationIntent;
  confidence: number; // 0.0-1.0
  detectedFilters: {
    cardTypes?: string[]; // ['Spell', 'Trap']
    races?: string[]; // ['Dragon', 'Spellcaster']
    attributes?: string[];
    excludeArchetypes?: string[];
    includeArchetypes?: string[];
  };
  searchStrategy: {
    boostTerms: string[];
    excludeStaples: boolean;
    diversityLambda: number; // For MMR reranking
    archetypeSpecific: boolean;
  };
}

/**
 * Classify user intent from question and deck analysis
 */
export function classifyIntent(
  question: string, 
  deckAnalysis: EnhancedDeckAnalysis
): IntentAnalysis {
  const q = question.toLowerCase();
  
  // Intent keywords mapping
  const intentKeywords: Record<RecommendationIntent, string[]> = {
    consistency: ['consistent', 'brick', 'draw', 'search', 'starter', 'ratio', 'opening hand', 'unplayable'],
    power: ['power', 'stronger', 'win', 'otk', 'end board', 'boss monster', 'ceiling', 'combo'],
    interaction: ['interact', 'hand trap', 'negate', 'stop', 'interrupt', 'going second', 'board breaker', 'disruption'],
    meta: ['meta', 'tier', 'compete', 'tournament', 'kashtira', 'purrely', 'current', 'competitive'],
    tech: ['tech', 'counter', 'side deck', 'specific', 'against', 'beat', 'out'],
    archetype_support: ['archetype', 'support', deckAnalysis.primaryArchetype?.toLowerCase() || ''],
    general: [],
  };
  
  // Score each intent
  const scores: Record<RecommendationIntent, number> = {
    consistency: 0,
    power: 0,
    interaction: 0,
    meta: 0,
    tech: 0,
    archetype_support: 0,
    general: 0.1, // baseline
  };
  
  Object.entries(intentKeywords).forEach(([intent, keywords]) => {
    keywords.forEach(keyword => {
      if (keyword && q.includes(keyword)) {
        scores[intent as RecommendationIntent] += 0.3;
      }
    });
  });
  
  // Find primary and secondary intents
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0] as RecommendationIntent;
  const secondary = sorted[1][1] > 0.3 ? sorted[1][0] as RecommendationIntent : undefined;
  
  // Build search strategy based on intent
  const strategy = buildSearchStrategy(primary, deckAnalysis);
  
  // Detect filters from question
  const detectedFilters = extractFilters(question);
  
  return {
    primary,
    secondary,
    confidence: sorted[0][1],
    detectedFilters,
    searchStrategy: strategy,
  };
}

function buildSearchStrategy(
  intent: RecommendationIntent,
  deckAnalysis: EnhancedDeckAnalysis
): IntentAnalysis['searchStrategy'] {
  const strategies: Record<RecommendationIntent, IntentAnalysis['searchStrategy']> = {
    consistency: {
      boostTerms: ['draw', 'search', 'add', 'deck', 'excavate', 'mill'],
      excludeStaples: false,
      diversityLambda: 0.5,
      archetypeSpecific: true,
    },
    power: {
      boostTerms: ['summon', 'attack', 'unaffected', 'cannot be', 'negate', 'combo'],
      excludeStaples: false,
      diversityLambda: 0.6,
      archetypeSpecific: true,
    },
    interaction: {
      boostTerms: ['negate', 'destroy', 'banish', 'quick effect', 'opponent', 'hand trap'],
      excludeStaples: false,
      diversityLambda: 0.7,
      archetypeSpecific: false, // Generic interaction is often better
    },
    meta: {
      boostTerms: [], // Meta-specific, will use meta_relevance scores
      excludeStaples: false,
      diversityLambda: 0.6,
      archetypeSpecific: false,
    },
    tech: {
      boostTerms: ['prevent', 'cannot', 'specific', 'counter', 'out'],
      excludeStaples: true, // Tech cards are NOT staples
      diversityLambda: 0.9, // Maximum diversity
      archetypeSpecific: false,
    },
    archetype_support: {
      boostTerms: [deckAnalysis.primaryArchetype || ''],
      excludeStaples: false,
      diversityLambda: 0.5,
      archetypeSpecific: true,
    },
    general: {
      boostTerms: [],
      excludeStaples: false,
      diversityLambda: 0.6,
      archetypeSpecific: false,
    },
  };
  
  return strategies[intent];
}

function extractFilters(question: string): IntentAnalysis['detectedFilters'] {
  const filters: IntentAnalysis['detectedFilters'] = {};
  const q = question.toLowerCase();
  
  // Card type detection
  const types = ['monster', 'spell', 'trap', 'fusion', 'synchro', 'xyz', 'link'];
  const detectedTypes = types.filter(type => q.includes(type));
  if (detectedTypes.length > 0) {
    filters.cardTypes = detectedTypes.map(t => {
      // Capitalize first letter
      if (t === 'xyz') return 'Xyz';
      return t.charAt(0).toUpperCase() + t.slice(1);
    });
  }
  
  // Race detection
  const races = ['dragon', 'spellcaster', 'warrior', 'fiend', 'zombie', 'machine', 'fairy', 'beast', 'winged beast'];
  const detectedRaces = races.filter(race => q.includes(race));
  if (detectedRaces.length > 0) {
    filters.races = detectedRaces.map(r => {
      // Handle multi-word races
      if (r === 'winged beast') return 'Winged Beast';
      return r.charAt(0).toUpperCase() + r.slice(1);
    });
  }
  
  // Attribute detection
  const attributes = ['dark', 'light', 'earth', 'water', 'fire', 'wind', 'divine'];
  const detectedAttributes = attributes.filter(attr => q.includes(attr));
  if (detectedAttributes.length > 0) {
    filters.attributes = detectedAttributes.map(a => a.toUpperCase());
  }
  
  // Archetype detection (for include/exclude)
  // This is a simple heuristic - can be enhanced
  const archetypeMatch = question.match(/(?:for|in|with|against)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i);
  if (archetypeMatch) {
    filters.includeArchetypes = [archetypeMatch[1].trim()];
  }
  
  return filters;
}
