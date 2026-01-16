/**
 * Phase 2: Few-Shot Examples Library
 * High-quality examples demonstrating good deck analysis and recommendations
 */

import type { EnhancedDeckAnalysis } from "../_shared/intentClassifier.ts";
import type { RecommendationIntent } from "../_shared/intentClassifier.ts";

export interface FewShotExample {
  deckSummary: string;
  userQuestion: string;
  intent: RecommendationIntent;
  playstyle: EnhancedDeckAnalysis["playstyle"];
  reasoning: {
    userIntent: string;
    deckWeaknesses: string[];
    deckStrengths: string[];
    strategicConsiderations: string[];
    recommendationStrategy: string;
    priorityCriteria: string[];
  };
  recommendations: Array<{
    cardName: string;
    rationale: string;
    priority: "must-have" | "highly-recommended" | "good-option";
  }>;
}

const EXAMPLES: FewShotExample[] = [
  {
    deckSummary: "Branded deck, 40 cards, 15 monsters, 15 spells, 10 traps. Primary archetype: Branded. Playstyle: Midrange. 3 starters, 5 extenders, 8 interruptions. Brick rate: 25%.",
    userQuestion: "I need more consistency, I'm bricking too often",
    intent: "consistency",
    playstyle: "Midrange",
    reasoning: {
      userIntent: "User needs to reduce brick rate and improve opening hand playability",
      deckWeaknesses: [
        "Only 3 starters means low opening play consistency",
        "25% brick rate indicates need for more search/draw effects",
        "Limited ways to access key combo pieces"
      ],
      deckStrengths: [
        "Strong midrange game with good interruptions",
        "Solid archetype core with Branded Fusion",
        "Good resource management"
      ],
      strategicConsiderations: [
        "As a 40-card Midrange deck, needs 5-7 starters for optimal consistency",
        "Branded archetype has specific searchers that synergize well",
        "Should prioritize cards that search Branded Fusion or Fallen of Albaz"
      ],
      recommendationStrategy: "Add 2-3 Branded-specific searchers and 1-2 generic consistency cards that don't conflict with deck strategy",
      priorityCriteria: [
        "Archetype-specific searchers (highest priority)",
        "Cards that search Branded Fusion",
        "Generic consistency that doesn't conflict",
        "Cards that reduce brick rate without diluting strategy"
      ]
    },
    recommendations: [
      {
        cardName: "Branded Opening",
        rationale: "Searches any Branded monster including Fallen of Albaz, directly addresses the starter count issue. Has synergy with existing Branded cards.",
        priority: "must-have"
      },
      {
        cardName: "Triple Tactics Talent",
        rationale: "Generic consistency card that works well in Midrange decks. Provides draw power when going second, which complements the deck's interruption strategy.",
        priority: "highly-recommended"
      }
    ]
  },
  {
    deckSummary: "Dragon Link deck, 40 cards, 25 monsters, 10 spells, 5 traps. Primary archetype: Dragon Link. Playstyle: Combo. 8 starters, 12 extenders, 5 interruptions. Brick rate: 20%.",
    userQuestion: "I need more interaction for going second",
    intent: "interaction",
    playstyle: "Combo",
    reasoning: {
      userIntent: "User needs more going-second tools and board breakers",
      deckWeaknesses: [
        "Only 5 interruptions is low for a combo deck that needs to go second",
        "Lacks board breakers to clear established boards",
        "No hand traps for turn 0 interaction"
      ],
      deckStrengths: [
        "Strong combo potential with 8 starters and 12 extenders",
        "Good going-first end boards",
        "Consistent combo execution"
      ],
      strategicConsiderations: [
        "Combo decks need both hand traps (for going second) and board breakers",
        "Dragon Link can use DARK hand traps that synergize with deck",
        "Should prioritize cards that don't conflict with combo lines"
      ],
      recommendationStrategy: "Add 3-4 hand traps (preferably DARK) and 2-3 board breakers that work with combo strategy",
      priorityCriteria: [
        "DARK hand traps for synergy",
        "Board breakers that don't require normal summon",
        "Cards that work in combo decks",
        "Meta-relevant interaction"
      ]
    },
    recommendations: [
      {
        cardName: "Infinite Impermanence",
        rationale: "DARK hand trap that synergizes with Dragon Link's DARK monsters. Provides turn 0 interaction and doesn't conflict with combo lines.",
        priority: "must-have"
      },
      {
        cardName: "Dark Ruler No More",
        rationale: "Board breaker that doesn't require normal summon, perfect for combo decks. Clears established boards so combo can proceed.",
        priority: "must-have"
      },
      {
        cardName: "Evenly Matched",
        rationale: "Powerful board breaker that works well going second. Can clear entire boards, giving combo deck opportunity to establish board.",
        priority: "highly-recommended"
      }
    ]
  },
  {
    deckSummary: "Control deck, 40 cards, 12 monsters, 18 spells, 10 traps. Primary archetype: Sky Striker. Playstyle: Control. 4 starters, 2 extenders, 15 interruptions. Brick rate: 15%.",
    userQuestion: "My deck already has 9 hand traps, recommend something else for interaction",
    intent: "interaction",
    playstyle: "Control",
    reasoning: {
      userIntent: "User needs interaction but already has many hand traps, wants different types",
      deckWeaknesses: [
        "Hand trap count is sufficient, but lacks other interaction types",
        "Control deck needs more removal and grind game tools",
        "Limited ways to deal with established boards"
      ],
      deckStrengths: [
        "Good hand trap count (9) provides turn 0 interaction",
        "Strong control game with Sky Striker engine",
        "Low brick rate indicates good consistency"
      ],
      strategicConsiderations: [
        "Deck already has 9 hand traps, so should focus on board breakers and removal",
        "Control decks benefit from cards that generate advantage over time",
        "Sky Striker synergizes with spell-based removal"
      ],
      recommendationStrategy: "Add board breakers and removal spells that complement hand traps, focus on cards that generate card advantage",
      priorityCriteria: [
        "Board breakers (not hand traps)",
        "Removal spells that generate advantage",
        "Cards that fit Control playstyle",
        "Sky Striker-compatible cards"
      ]
    },
    recommendations: [
      {
        cardName: "Lightning Storm",
        rationale: "Board breaker that works well in Control decks. Can clear backrow or monsters, providing flexibility. Doesn't conflict with hand trap strategy.",
        priority: "must-have"
      },
      {
        cardName: "Harpie's Feather Duster",
        rationale: "Powerful backrow removal that's essential for Control mirrors. Clears multiple cards at once, generating significant advantage.",
        priority: "highly-recommended"
      }
    ]
  },
  {
    deckSummary: "60-card deck, 35 monsters, 15 spells, 10 traps. Primary archetype: Grass. Playstyle: Combo. 6 starters, 8 extenders, 10 interruptions. Brick rate: 40%.",
    userQuestion: "I need consistency for my 60-card deck",
    intent: "consistency",
    playstyle: "Combo",
    reasoning: {
      userIntent: "60-card deck needs more starters to reduce high brick rate",
      deckWeaknesses: [
        "40% brick rate is very high, indicates insufficient starters",
        "60-card decks need 10-15 starters for optimal consistency",
        "Only 6 starters is far below optimal for deck size"
      ],
      deckStrengths: [
        "Grass strategy provides powerful late-game advantage",
        "Good extenders and interruptions once going",
        "Strong combo potential"
      ],
      strategicConsiderations: [
        "60-card decks require significantly more starters than 40-card decks",
        "Should prioritize cards that search key combo pieces",
        "Grass decks benefit from cards that mill or send to GY"
      ],
      recommendationStrategy: "Add 4-6 additional starters, prioritizing cards that search key combo pieces or enable Grass plays",
      priorityCriteria: [
        "Starters that search key combo pieces",
        "Cards that enable Grass strategy",
        "Generic consistency that works in 60-card decks",
        "Cards that reduce brick rate significantly"
      ]
    },
    recommendations: [
      {
        cardName: "Left Arm Offering",
        rationale: "Searches any spell including Grass, directly addresses the starter count issue in 60-card decks. High impact for Grass strategy.",
        priority: "must-have"
      },
      {
        cardName: "That Grass Looks Greener",
        rationale: "Core card for 60-card Grass strategy. Sends 20 cards to GY, enabling powerful GY-based combos. Essential for deck strategy.",
        priority: "must-have"
      }
    ]
  }
];

/**
 * Select relevant few-shot examples based on intent and playstyle
 */
export function selectRelevantExamples(
  intent: RecommendationIntent | undefined,
  playstyle: EnhancedDeckAnalysis["playstyle"] | undefined,
  maxExamples: number = 2,
): FewShotExample[] {
  if (!intent && !playstyle) {
    return EXAMPLES.slice(0, maxExamples);
  }

  // Score examples by relevance
  const scored = EXAMPLES.map(example => {
    let score = 0;
    
    if (intent && example.intent === intent) {
      score += 10;
    }
    
    if (playstyle && example.playstyle === playstyle) {
      score += 5;
    }
    
    return { example, score };
  });

  // Sort by score and return top examples
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExamples)
    .map(item => item.example);
}

/**
 * Format examples for prompt injection
 */
export function formatExamplesForPrompt(examples: FewShotExample[]): string {
  if (examples.length === 0) {
    return "";
  }

  let formatted = "\n\nEXAMPLES OF GOOD DECK ANALYSIS AND RECOMMENDATIONS:\n\n";

  examples.forEach((example, index) => {
    formatted += `EXAMPLE ${index + 1}:\n`;
    formatted += `Deck: ${example.deckSummary}\n`;
    formatted += `User Question: "${example.userQuestion}"\n`;
    formatted += `Intent: ${example.intent}, Playstyle: ${example.playstyle}\n\n`;
    
    formatted += `Reasoning Analysis:\n`;
    formatted += `- User Intent: ${example.reasoning.userIntent}\n`;
    formatted += `- Deck Weaknesses: ${example.reasoning.deckWeaknesses.join("; ")}\n`;
    formatted += `- Deck Strengths: ${example.reasoning.deckStrengths.join("; ")}\n`;
    formatted += `- Strategic Considerations: ${example.reasoning.strategicConsiderations.join("; ")}\n`;
    formatted += `- Recommendation Strategy: ${example.reasoning.recommendationStrategy}\n`;
    formatted += `- Priority Criteria: ${example.reasoning.priorityCriteria.join("; ")}\n\n`;
    
    formatted += `Recommendations:\n`;
    example.recommendations.forEach((rec, recIndex) => {
      formatted += `${recIndex + 1}. ${rec.cardName} (${rec.priority}): ${rec.rationale}\n`;
    });
    
    formatted += "\n---\n\n";
  });

  return formatted;
}
