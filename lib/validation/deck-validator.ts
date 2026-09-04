import { z } from "zod";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DeckValidationOptions {
  checkCardIds?: boolean; // Check if card IDs exist (requires card list)
  checkBanlist?: boolean; // Check banlist compliance (requires banlist)
  cardList?: Array<{ id: number }>; // Card list for ID validation
  banlist?: Record<string, string>; // Banlist for compliance checking
  mode?: "Master Duel" | "TCG"; // Deck mode for banlist checking
}

const CardSchema = z.object({
  cardId: z.number().int().positive(),
  deckInstanceId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  type: z.string().optional(),
  desc: z.string().optional(),
});

const DeckSchema = z.object({
  name: z.string().min(1).max(200),
  mainDeck: z.array(CardSchema).max(100),
  extraDeck: z.array(CardSchema).max(100),
  sideDeck: z.array(CardSchema).max(100),
  mode: z.enum(["Master Duel", "TCG"]),
});

/**
 * Validate deck structure and basic constraints
 */
export function validateDeckStructure(deck: unknown): ValidationResult {
  const errors: string[] = [];

  // Basic structure validation
  const result = DeckSchema.safeParse(deck);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }

  const validatedDeck = result.data;

  // Check deck size limits (Yu-Gi-Oh! rules)
  if (validatedDeck.mainDeck.length < 40) {
    errors.push("Main deck must have at least 40 cards");
  }
  if (validatedDeck.mainDeck.length > 60) {
    errors.push("Main deck cannot exceed 60 cards");
  }
  if (validatedDeck.extraDeck.length > 15) {
    errors.push("Extra deck cannot exceed 15 cards");
  }
  if (validatedDeck.sideDeck.length > 15) {
    errors.push("Side deck cannot exceed 15 cards");
  }

  // Check total deck size
  const totalCards =
    validatedDeck.mainDeck.length +
    validatedDeck.extraDeck.length +
    validatedDeck.sideDeck.length;
  if (totalCards === 0) {
    errors.push("Deck cannot be empty");
  }
  if (totalCards > 200) {
    errors.push("Total deck size cannot exceed 200 cards");
  }

  // Check for prototype pollution vectors
  const allCards = [
    ...validatedDeck.mainDeck,
    ...validatedDeck.extraDeck,
    ...validatedDeck.sideDeck,
  ];

  for (const card of allCards) {
    const cardObj = card as Record<string, unknown>;
    
    // Check for dangerous properties
    if ("__proto__" in cardObj) {
      errors.push("Deck contains dangerous __proto__ property");
    }
    if ("constructor" in cardObj && typeof cardObj.constructor === "function") {
      errors.push("Deck contains dangerous constructor property");
    }
    if ("prototype" in cardObj) {
      errors.push("Deck contains dangerous prototype property");
    }

    // Validate card ID is a safe number
    if (!Number.isSafeInteger(card.cardId)) {
      errors.push(`Card ID ${card.cardId} is not a safe integer`);
    }

    // Validate card name is not empty and reasonable length
    if (!card.name || card.name.trim().length === 0) {
      errors.push("Card name cannot be empty");
    }
    if (card.name.length > 200) {
      errors.push(`Card name "${card.name.substring(0, 50)}..." exceeds 200 characters`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate card IDs exist in card database
 */
export function validateCardIds(
  deck: {
    mainDeck: Array<{ cardId: number }>;
    extraDeck: Array<{ cardId: number }>;
    sideDeck: Array<{ cardId: number }>;
  },
  cardList: Array<{ id: number }>,
): ValidationResult {
  const errors: string[] = [];
  const cardIdSet = new Set(cardList.map((c) => c.id));

  const allCards = [...deck.mainDeck, ...deck.extraDeck, ...deck.sideDeck];
  const invalidCardIds = new Set<number>();

  for (const card of allCards) {
    if (!cardIdSet.has(card.cardId)) {
      invalidCardIds.add(card.cardId);
    }
  }

  if (invalidCardIds.size > 0) {
    errors.push(
      `Invalid card IDs: ${Array.from(invalidCardIds).slice(0, 10).join(", ")}${invalidCardIds.size > 10 ? ` and ${invalidCardIds.size - 10} more` : ""}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate card count limits (max 3 per card)
 */
export function validateCardCounts(deck: {
  mainDeck: Array<{ cardId: number }>;
  extraDeck: Array<{ cardId: number }>;
  sideDeck: Array<{ cardId: number }>;
}): ValidationResult {
  const errors: string[] = [];
  const cardCounts = new Map<number, number>();

  const allCards = [...deck.mainDeck, ...deck.extraDeck, ...deck.sideDeck];

  for (const card of allCards) {
    const count = cardCounts.get(card.cardId) || 0;
    cardCounts.set(card.cardId, count + 1);
  }

  const violations: number[] = [];
  for (const [cardId, count] of cardCounts.entries()) {
    if (count > 3) {
      violations.push(cardId);
    }
  }

  if (violations.length > 0) {
    errors.push(
      `Cards exceed maximum count (3): ${violations.slice(0, 10).join(", ")}${violations.length > 10 ? ` and ${violations.length - 10} more` : ""}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Size / copy rules required by create-deck-share (legal shareable deck).
 * Accepts archived cards (`id`) or API cards (`cardId`).
 */
export function isDeckLegalForShare(deck: {
  mainDeck: Array<{ id?: number; cardId?: number }>;
  extraDeck: Array<{ id?: number; cardId?: number }>;
  sideDeck: Array<{ id?: number; cardId?: number }>;
}): boolean {
  const main = deck.mainDeck.length;
  const extra = deck.extraDeck.length;
  const side = deck.sideDeck.length;
  const total = main + extra + side;

  if (main < 40 || main > 60) return false;
  if (extra > 15 || side > 15) return false;
  if (total === 0 || total > 200) return false;

  const counts = new Map<number, number>();
  for (const card of [...deck.mainDeck, ...deck.extraDeck, ...deck.sideDeck]) {
    const cardId = card.cardId ?? card.id;
    if (
      typeof cardId !== "number" ||
      !Number.isSafeInteger(cardId) ||
      cardId <= 0
    ) {
      return false;
    }
    const next = (counts.get(cardId) ?? 0) + 1;
    if (next > 3) return false;
    counts.set(cardId, next);
  }

  return true;
}

/**
 * Comprehensive deck validation
 */
export function validateDeck(
  deck: unknown,
  options: DeckValidationOptions = {},
): ValidationResult {
  const errors: string[] = [];

  // Step 1: Structure validation
  const structureResult = validateDeckStructure(deck);
  if (!structureResult.valid) {
    errors.push(...structureResult.errors);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const validatedDeck = DeckSchema.parse(deck);

  // Step 2: Card count validation
  const countResult = validateCardCounts(validatedDeck);
  if (!countResult.valid) {
    errors.push(...countResult.errors);
  }

  // Step 3: Card ID validation (if card list provided)
  if (options.checkCardIds && options.cardList) {
    const idResult = validateCardIds(validatedDeck, options.cardList);
    if (!idResult.valid) {
      errors.push(...idResult.errors);
    }
  }

  // Step 4: Banlist validation (if banlist provided)
  if (options.checkBanlist && options.banlist) {
    const banlistResult = validateBanlistCompliance(
      validatedDeck,
      options.banlist,
    );
    if (!banlistResult.valid) {
      errors.push(...banlistResult.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate banlist compliance
 */
export function validateBanlistCompliance(
  deck: {
    mainDeck: Array<{ cardId: number; name: string }>;
    extraDeck: Array<{ cardId: number; name: string }>;
    sideDeck: Array<{ cardId: number; name: string }>;
  },
  banlist: Record<string, string>,
): ValidationResult {
  const errors: string[] = [];
  const allCards = [...deck.mainDeck, ...deck.extraDeck, ...deck.sideDeck];

  // Count cards by name (banlist uses card names)
  const cardCountsByName = new Map<string, number>();
  for (const card of allCards) {
    const count = cardCountsByName.get(card.name) || 0;
    cardCountsByName.set(card.name, count + 1);
  }

  // Check banlist restrictions
  for (const [cardName, banStatus] of Object.entries(banlist)) {
    const count = cardCountsByName.get(cardName) || 0;
    const allowedCount = getAllowedCountFromBanStatus(banStatus);

    if (count > allowedCount) {
      errors.push(
        `${cardName} is ${banStatus.toLowerCase()} (max ${allowedCount}), but deck contains ${count}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get allowed card count from ban status
 */
function getAllowedCountFromBanStatus(banStatus: string): number {
  switch (banStatus.toUpperCase()) {
    case "FORBIDDEN":
      return 0;
    case "LIMITED":
      return 1;
    case "SEMI-LIMITED":
    case "SEMI LIMITED":
      return 2;
    default:
      return 3; // Unlimited or not listed
  }
}

/**
 * Sanitize deck data to remove potentially malicious fields
 */
export function sanitizeDeckData<T extends Record<string, unknown>>(
  deck: T,
): T {
  // Remove dangerous properties recursively
  const sanitize = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (typeof obj === "object") {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip dangerous properties
        if (
          key === "__proto__" ||
          key === "constructor" ||
          key === "prototype"
        ) {
          continue;
        }

        // Only allow safe keys (alphanumeric, underscore, dash)
        if (/^[a-zA-Z0-9_-]+$/.test(key)) {
          sanitized[key] = sanitize(value);
        }
      }
      return sanitized;
    }

    return obj;
  };

  return sanitize(deck) as T;
}
