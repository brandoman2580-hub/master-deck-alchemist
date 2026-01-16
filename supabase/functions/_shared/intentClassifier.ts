/**
 * Intent classification for recommendation requests
 * Shared between edge functions (Deno runtime)
 */

export type RecommendationIntent = 
  | 'consistency' 
  | 'power' 
  | 'interaction' 
  | 'meta' 
  | 'tech' 
  | 'archetype_support'
  | 'general';

export interface EnhancedDeckAnalysis {
  playstyle: 'Combo' | 'Midrange' | 'Control' | 'Stun' | 'Beatdown' | 'Balanced';
  tier: number | null;
  deckSize: number;
  mainDeckSize: number;
  extraDeckSize: number;
  sideDeckSize: number;
  ratios: {
    monsters: number;
    spells: number;
    traps: number;
    monstersPercent: number;
    spellsPercent: number;
    trapsPercent: number;
  };
  archetypes: {
    name: string;
    count: number;
    percentage: number;
  }[];
  primaryArchetype: string | null;
  cardRoles: {
    starters: number;
    extenders: number;
    interruptions: number;
    boardBreakers: number;
    endBoardPieces: number;
  };
  winCondition: 'OTK' | 'Control' | 'Grind' | 'Lock' | 'Burn' | 'Unknown';
  estimatedBrickRate: number;
  missingStaples: {
    cardName: string;
    reason: string;
  }[];
}

export interface IntentAnalysis {
  primary: RecommendationIntent;
  secondary?: RecommendationIntent;
  confidence: number;
  detectedFilters: {
    cardTypes?: string[];
    races?: string[];
    attributes?: string[];
    excludeArchetypes?: string[];
    includeArchetypes?: string[];
  };
  searchStrategy: {
    boostTerms: string[];
    excludeStaples: boolean;
    diversityLambda: number;
    archetypeSpecific: boolean;
    requireMetaData?: boolean; // Phase 3: Flag for meta data requirement
  };
  targetDeck?: string; // Phase 3: Extracted target deck name for counter requests
}

export function classifyIntent(
  question: string, 
  deckAnalysis?: EnhancedDeckAnalysis
): IntentAnalysis {
  const q = question.toLowerCase();
  const primaryArchetype = deckAnalysis?.primaryArchetype || null;
  
  // Intent keywords mapping
  // Phase 3: Enhanced meta keywords
  const intentKeywords: Record<RecommendationIntent, string[]> = {
    consistency: ['consistent', 'brick', 'draw', 'search', 'starter', 'ratio', 'opening hand', 'unplayable'],
    power: ['power', 'stronger', 'win', 'otk', 'end board', 'boss monster', 'ceiling', 'combo'],
    interaction: ['interact', 'hand trap', 'negate', 'stop', 'interrupt', 'going second', 'board breaker', 'disruption'],
    meta: ['meta', 'tier', 'compete', 'tournament', 'kashtira', 'purrely', 'current', 'competitive', 'ladder', 'ranked', "what's good right now", 'top decks', 'tournament ready'],
    tech: ['tech', 'counter', 'side deck', 'specific', 'against', 'beat', 'out'],
    archetype_support: ['archetype', 'support', primaryArchetype?.toLowerCase() || ''],
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
    general: 0.1,
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
  
  // Build search strategy
  const strategy = buildSearchStrategy(primary, deckAnalysis);

  // Detect filters
  const detectedFilters = extractFilters(question);

  // Phase 3: Extract target deck name for counter requests
  let targetDeck: string | undefined;
  if (primary === 'meta' || primary === 'tech') {
    // Try to extract deck name from question
    // Patterns: "counter X", "beat X", "against X", "side against X"
    const counterPatterns = [
      /counter\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i,
      /beat\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i,
      /against\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i,
      /side\s+(?:against|for)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i,
      /(?:vs|versus)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i,
    ];

    for (const pattern of counterPatterns) {
      const match = question.match(pattern);
      if (match && match[1]) {
        targetDeck = match[1].trim();
        break;
      }
    }

    // Also check for common meta deck names in question
    const commonMetaDecks = [
      'kashtira', 'purrely', 'labrynth', 'spright', 'tearlaments', 'tear',
      'snake-eye', 'snake eye', 'fire king', 'fireking',
      'branded', 'despia', 'swordsoul', 'sword soul',
      'mathmech', 'math mech', 'runick', 'floowandereeze', 'floo',
    ];

    for (const deckName of commonMetaDecks) {
      if (q.includes(deckName)) {
        targetDeck = deckName;
        break;
      }
    }
  }

  return {
    primary,
    secondary,
    confidence: sorted[0][1],
    detectedFilters,
    searchStrategy: strategy,
    targetDeck,
  };
}

function buildSearchStrategy(
  intent: RecommendationIntent,
  deckAnalysis?: EnhancedDeckAnalysis
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
      archetypeSpecific: false,
    },
    meta: {
      boostTerms: [],
      excludeStaples: false,
      diversityLambda: 0.5, // Phase 3: More focused for meta requests
      archetypeSpecific: false,
      requireMetaData: true, // Phase 3: Require meta data
    },
    tech: {
      boostTerms: ['prevent', 'cannot', 'specific', 'counter', 'out'],
      excludeStaples: true,
      diversityLambda: 0.9,
      archetypeSpecific: false,
    },
    archetype_support: {
      boostTerms: [deckAnalysis?.primaryArchetype || ''],
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
      if (t === 'xyz') return 'Xyz';
      return t.charAt(0).toUpperCase() + t.slice(1);
    });
  }
  
  // Race detection
  const races = ['dragon', 'spellcaster', 'warrior', 'fiend', 'zombie', 'machine', 'fairy', 'beast', 'winged beast'];
  const detectedRaces = races.filter(race => q.includes(race));
  if (detectedRaces.length > 0) {
    filters.races = detectedRaces.map(r => {
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
  
  // Archetype detection
  const archetypeMatch = question.match(/(?:for|in|with|against)\s+([A-Z][a-zA-Z\s-]+?)(?:\s+deck|$)/i);
  if (archetypeMatch) {
    filters.includeArchetypes = [archetypeMatch[1].trim()];
  }
  
  return filters;
}
