import type { Card } from "../../types/card";
import { getArchetypeName } from "../../lib/helpers";

// ============================================================================
// CARD EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract card names from AI response text and match to actual cards
 */
export function extractCardsFromText(text: string, allCards: Card[]): Card[] {
  const foundCards: Card[] = [];
  const cardNameSet = new Set<string>();

  // Create a map for faster card lookup
  const cardMap = new Map<string, Card>();
  allCards.forEach((card) => {
    cardMap.set(card.name.toLowerCase(), card);
  });

  // Look for card names in various patterns
  const patterns = [
    // **Card Name** pattern
    /\*\*([^*]+)\*\*/g,
    // "Card Name" pattern (quoted)
    /"([^"]+)"/g,
    // Card names that are likely Yu-Gi-Oh cards (contain common keywords)
    /\b([A-Z][a-zA-Z\s\-']+(?:Dragon|Monster|Spell|Trap|Blue-Eyes|Dark|Light|Magician|Warrior|Beast|Machine|Fiend|Spellcaster|Zombie|Plant|Insect|Rock|Pyro|Thunder|Aqua|Psychic|Divine|Winged|Elemental|Creator|HERO|Cyber|Blackwing|Gladiator|Six|Samurai|Archfiend|Ojama|Harpie|Amazoness|Toon|Spirit|Union|Gemini|Tuner|Synchro|Xyz|Pendulum|Link|Fusion|Ritual|Ruler|Cardcar))\b/g,
    // Common Yu-Gi-Oh card patterns
    /\b([A-Z][a-zA-Z\s\-']*(?:of|the|in|from|to|with|and|or)\s+[A-Z][a-zA-Z\s\-']*)\b/g,
    // Specific patterns for cards like "Cardcar D" or "Dragon Ruler of Tempests"
    /\b([A-Z][a-zA-Z]*(?:\s+[A-Z])?(?:\s+(?:of|the|in|from|to|with|and|or)\s+[A-Z][a-zA-Z\s]*)?)\b/g,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const cardName = match[1].trim();
      const lowerCardName = cardName.toLowerCase();

      // Skip if already found, too short/generic, or common words
      if (cardNameSet.has(lowerCardName) || cardName.length < 3) continue;

      // Skip common words that aren't card names
      const commonWords = [
        "card",
        "deck",
        "effect",
        "monster",
        "spell",
        "trap",
        "summon",
        "attack",
        "defense",
        "level",
        "rank",
        "link",
        "fusion",
        "synchro",
        "xyz",
        "pendulum",
      ];
      if (commonWords.includes(lowerCardName)) continue;

      // Direct match
      if (cardMap.has(lowerCardName)) {
        foundCards.push(cardMap.get(lowerCardName)!);
        cardNameSet.add(lowerCardName);
        continue;
      }

      // Fuzzy matching for slight variations
      for (const [mapCardName, card] of cardMap.entries()) {
        // More precise fuzzy matching
        const similarity = calculateSimilarity(lowerCardName, mapCardName);
        if (similarity > 0.8 && !cardNameSet.has(mapCardName)) {
          foundCards.push(card);
          cardNameSet.add(mapCardName);
          break;
        }
      }
    }
  });

  // Additional pass: look for exact card names that might be mentioned
  allCards.forEach((card) => {
    const cardName = card.name.toLowerCase();
    if (text.toLowerCase().includes(cardName) && !cardNameSet.has(cardName)) {
      foundCards.push(card);
      cardNameSet.add(cardName);
    }
  });

  // Limit to reasonable number of cards
  return foundCards.slice(0, 8);
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Detect if a question is a recommendation request
 * Now treats ALL user prompts as recommendation requests to use the hybrid search card pool
 */
export function isRecommendationRequest(): boolean {
  // Always use recommendation agent for all prompts - it has better card search capabilities
  // The recommendation agent can handle both recommendation and analysis questions
  return true;
}

// ============================================================================
// TEXT CLEANUP UTILITIES
// ============================================================================

/**
 * Clean up LLM response text to remove common AI preambles and fix formatting issues
 */
export function cleanupLLMResponse(content: string, suggestedCards: Card[]): string {
  let cleaned = content;

  // Step 1: Remove common AI preambles
  cleaned = cleaned.replace(
    /^(Based on your (?:question|request|deck|analysis),?\s*)?(I\s+)?(would\s+)?(recommend|suggest)(?:ing)?[:.]?\s*/gim,
    ""
  );
  cleaned = cleaned.replace(
    /^(Here\s+(?:are|is)\s+)?(some\s+)?(card\s+)?(recommendations|suggestions|options|additions)[:.]?\s*/gim,
    ""
  );
  cleaned = cleaned.replace(
    /^(To\s+(?:increase|improve|enhance)\s+(?:the\s+)?(?:power|consistency|strength)\s+of\s+(?:this\s+)?deck,?\s*(?:consider\s+)?(?:adding\s+)?(?:the\s+)?(?:following\s+)?(?:cards?)?:?\s*)/gim,
    ""
  );

  // Step 2: Create a set of actual suggested card names (case-insensitive)
  const suggestedCardNames = new Set(
    suggestedCards.map((c) => c.name.toLowerCase().trim())
  );

  // Step 3: Fix malformed list items with "this card" fragments
  // Pattern: "1. CardName is already present, but you could also add more this card like OtherCard"
  // Fix: "1. CardName - is already present, but you could also add OtherCard"
  cleaned = cleaned.replace(
    /(\d+)\.\s+([A-Z][^\n]*?)\s+(?:more\s+)?this\s+card\s+(?:like\s+)?([A-Z][a-zA-Z\s'-]+)/g,
    (_match, num, firstPart, secondCard) => {
      const secondCardLower = secondCard.trim().toLowerCase();
      // Check if secondCard is actually in suggested cards
      if (suggestedCardNames.has(secondCardLower)) {
        return `${num}. ${firstPart.trim()}\n\n${parseInt(num) + 1}. ${secondCard.trim()}`;
      }
      // Otherwise, clean up the fragment
      return `${num}. ${firstPart.trim()}`;
    }
  );

  // Step 4: Fix nested numbering (e.g., "2. 1. CardName" → "2. CardName")
  cleaned = cleaned.replace(/(\d+)\.\s+\d+\.\s+/g, "$1. ");

  // Step 5: Remove standalone "this card" references that don't make sense
  // Pattern: "since Roar of the allows for the this card of a Blue-Eyes"
  // Fix: "since Roar allows for a Blue-Eyes"
  cleaned = cleaned.replace(/\b(?:the\s+)?this\s+card\s+(?:of\s+)?(?:a\s+)?/gi, "");

  // Step 6: Fix sentences starting with "which/that/since" after numbering
  // Pattern: "3. since Roar..." → "3. Roar..." (find card name and prepend)
  cleaned = cleaned.replace(
    /^(\d+)\.\s+((?:since|which|that|because)\s+)([A-Z][^\n]+)/gim,
    (_match, num, connector, rest) => {
      // Try to extract a card name from the rest of the text
      const cardMatch = rest.match(/([A-Z][a-zA-Z\s'-]{3,}?)(?=\s+(?:allows|can|is|provides|monster|lets|helps|works|enables))/);
      if (cardMatch) {
        const cardName = cardMatch[1].trim();
        const remainingText = rest.replace(cardName, "").trim();
        return `${num}. ${cardName} - ${connector}${remainingText}`;
      }
      // If no card name found, just clean up the connector
      return `${num}. ${rest}`;
    }
  );

  // Step 7: Fix list items that have card names embedded in middle
  // Pattern: "1. which can be CardName to do something"
  cleaned = cleaned.replace(
    /^(\d+)\.\s+(which|that|since)\s+([^\n]*?)(\*\*[^*]+\*\*|[A-Z][a-zA-Z\s'-]{3,})([^\n]*)/gim,
    (_match, num, connector, before, cardName, after) => {
      const cleanCardName = cardName.replace(/\*\*/g, "").trim();
      const beforeText = before.trim();
      const afterText = after.trim();
      
      if (beforeText.length > 0) {
        return `${num}. **${cleanCardName}** - ${connector} ${beforeText} ${afterText}`;
      }
      return `${num}. **${cleanCardName}** ${afterText}`;
    }
  );

  // Step 8: Ensure all list items start with a card name
  // If we find a list item without a card name at the start, try to extract it
  cleaned = cleaned.replace(
    /^(\d+)\.\s+([^*\n][^\n]+?)(\*\*[^*]+\*\*)/gim,
    (_match, num, prefix, cardName) => {
      const cleanCardName = cardName.replace(/\*\*/g, "").trim();
      const cleanPrefix = prefix.trim();
      
      // If prefix contains filler words, move card name to front
      if (/^(which|that|since|because|this|it)\s+/i.test(cleanPrefix)) {
        return `${num}. **${cleanCardName}** - ${cleanPrefix}`;
      }
      return `${num}. ${cleanPrefix} **${cleanCardName}**`;
    }
  );

  // Step 9: Remove duplicate card names in same line
  // Pattern: "CardName ... CardName" (when both are same)
  suggestedCards.forEach((card) => {
    const name = card.name;
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    // Remove duplicates where card name appears twice
    const duplicatePattern = new RegExp(
      `(\\*\\*${escapedName}\\*\\*[^\\n]*?)\\*\\*${escapedName}\\*\\*`,
      "gi"
    );
    cleaned = cleaned.replace(duplicatePattern, "$1");
  });

  // Step 10: Clean up whitespace and normalize formatting
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n"); // Max 2 newlines
  cleaned = cleaned.replace(/\s+/g, " "); // Normalize spaces
  cleaned = cleaned.replace(/\n\s+/g, "\n"); // Remove leading spaces after newlines

  // Step 11: Ensure proper spacing after list numbers
  cleaned = cleaned.replace(/(\d+)\.\s*/g, "$1. ");

  // Step 12: Fix remaining malformed sentences with card name fragments
  // Pattern: "to utilize the Tuner monsters in the deck" -> just clean it up
  cleaned = cleaned.replace(/\bthe\s+this\s+card\b/gi, "");
  cleaned = cleaned.replace(/\bin\s+the\s+it\s+can\b/gi, "which can");

  return cleaned;
}

// ============================================================================
// KEYWORD HIGHLIGHTING UTILITIES
// ============================================================================

const KEYWORDS_TO_HIGHLIGHT = {
  effects: [
    "banish",
    "negate",
    "destroy",
    "draw",
    "special summon",
    "tribute",
    "discard",
    "add",
    "send",
    "reveal",
    "target",
    "activate",
  ],
  extraDeckTypes: ["fusion", "synchro", "xyz", "link", "ritual", "pendulum"],
  attributes: ["dark", "light", "earth", "water", "fire", "wind", "divine"],
  cardTypes: [
    "monster",
    "spell",
    "trap",
    "normal",
    "effect",
    "ritual",
    "fusion",
    "synchro",
    "xyz",
    "pendulum",
    "link",
    "tuner",
    "union",
    "gemini",
    "spirit",
    "toon",
    "flip",
  ],
};

/**
 * Highlight keywords in text (card names, archetypes, effects, etc.)
 */
export function highlightKeywords(text: string, allCards: Card[]): string {
  const allCardNames = new Set<string>();
  allCards.forEach((card) => {
    allCardNames.add(card.name.toLowerCase());
    const archetypeName = getArchetypeName(card);
    if (archetypeName) {
      allCardNames.add(archetypeName.toLowerCase());
    }
  });

  let highlighted = text;

  const boldedCardNames: string[] = [];
  highlighted = highlighted.replace(/\*\*([^*]+)\*\*/g, (_match, cardName) => {
    boldedCardNames.push(cardName);
    return `__BOLDED_${boldedCardNames.length - 1}__`;
  });

  allCardNames.forEach((cardName) => {
    const regex = new RegExp(
      `\\b${cardName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi"
    );
    highlighted = highlighted.replace(regex, (match) => {
      if (match.includes("__BOLDED_")) return match;
      return `**${match}**`;
    });
  });

  allCards.forEach((card) => {
    const archetypeName = getArchetypeName(card);
    if (archetypeName) {
      const archetypeRegex = new RegExp(
        `\\b${archetypeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "gi"
      );
      highlighted = highlighted.replace(archetypeRegex, (match) => {
        if (match.includes("__BOLDED_") || match.startsWith("**")) return match;
        return `*${match}*`;
      });
    }
  });

  KEYWORDS_TO_HIGHLIGHT.effects.forEach((effect) => {
    const regex = new RegExp(`\\b${effect}\\b`, "gi");
    highlighted = highlighted.replace(regex, (match) => {
      if (
        match.includes("__BOLDED_") ||
        match.startsWith("**") ||
        match.startsWith("*")
      )
        return match;
      return `\`${match}\``;
    });
  });

  KEYWORDS_TO_HIGHLIGHT.extraDeckTypes.forEach((type) => {
    const regex = new RegExp(`\\b${type}\\b`, "gi");
    highlighted = highlighted.replace(regex, (match) => {
      if (
        match.includes("__BOLDED_") ||
        match.startsWith("**") ||
        match.startsWith("*") ||
        match.startsWith("`")
      )
        return match;
      return `\`${match}\``;
    });
  });

  boldedCardNames.forEach((cardName, index) => {
    highlighted = highlighted.replace(`__BOLDED_${index}__`, `**${cardName}**`);
  });

  return highlighted;
}

