/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card } from "../types/card";
import {
  BanStatus,
  CountedCard,
  DeckFormat1,
  DeckFormat2,
  DeckFormat3,
  DeckFormat4,
  ImportedDeck,
  NormalizedDeck,
  SearchParams,
} from "../types/types";
import { ATK_RANGE_MAP, DEF_RANGE_MAP } from "./constants";
import { useLoginModalStore } from "../store/useLoginModalStore";

function expandCardList(list?: (string | CountedCard)[]): string[] {
  if (!list) return [];
  return list.flatMap((card) =>
    typeof card === "string" ? card : Array(card.count).fill(card.name)
  );
}

export function normalizeImportedDeck(jsonString: string): NormalizedDeck {
  let data: ImportedDeck;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error("Invalid JSON format");
  }

  let mainNames: string[] = [];
  let extraNames: string[] = [];
  let sideNames: string[] = [];

  // Format 1: { Monster, Spell, Trap, Extra, Side }
  if (
    typeof data === "object" &&
    ("Monster" in data || "Spell" in data || "Trap" in data)
  ) {
    const d = data as DeckFormat1;
    mainNames = [...(d.Monster ?? []), ...(d.Spell ?? []), ...(d.Trap ?? [])];
    extraNames = d.Extra ?? [];
    sideNames = d.Side ?? [];
  }
  // Format 2: { mainDeck: { Monster, Spell, Trap }, extraDeck, sideDeck }
  else if (
    typeof data === "object" &&
    "mainDeck" in data &&
    typeof data.mainDeck === "object" &&
    !Array.isArray(data.mainDeck)
  ) {
    const d = data as DeckFormat2;
    mainNames = [
      ...(d.mainDeck.Monster ?? []),
      ...(d.mainDeck.Spell ?? []),
      ...(d.mainDeck.Trap ?? []),
    ];
    extraNames = d.extraDeck ?? [];
    sideNames = d.sideDeck ?? [];
  }
  // Format 3: { mainDeck: string[] | CountedCard[], extraDeck, sideDeck }
  else if (
    typeof data === "object" &&
    "mainDeck" in data &&
    Array.isArray(data.mainDeck)
  ) {
    const d = data as DeckFormat3;
    mainNames = expandCardList(d.mainDeck);
    extraNames = expandCardList(d.extraDeck);
    sideNames = expandCardList(d.sideDeck);
  }
  // Format 4: { main, extra, side }
  else if (
    typeof data === "object" &&
    ("main" in data || "extra" in data || "side" in data)
  ) {
    const d = data as DeckFormat4;
    mainNames = d.main ?? [];
    extraNames = d.extra ?? [];
    sideNames = d.side ?? [];
  }

  return {
    mainDeck: mainNames,
    extraDeck: extraNames,
    sideDeck: sideNames,
  };
}

// Maps ban status to allowed copies
export function getAllowedCopies(
  card: Card,
  banlist: Record<string, BanStatus>
): number {
  const status = banlist[card.name];
  switch (status) {
    case "Forbidden":
      return 0;
    case "Limited":
      return 1;
    case "Semi-Limited":
      return 2;
    default:
      return 3; // Unlimited or not listed
  }
}

export function getDisabledCards(
  card: Card,
  currentDeck: { mainDeck: Card[]; extraDeck: Card[]; sideDeck: Card[] },
  banlist: Record<string, BanStatus>
): {
  isMainDisabled: boolean;
  isExtraDisabled: boolean;
  isSideDisabled: boolean;
} {
  const allowed = getAllowedCopies(card, banlist);
  return {
    isMainDisabled:
      currentDeck.mainDeck.filter((c) => c.id === card.id).length >= allowed,
    isExtraDisabled:
      currentDeck.extraDeck.filter((c) => c.id === card.id).length >= allowed,
    isSideDisabled:
      currentDeck.sideDeck.filter((c) => c.id === card.id).length >= allowed,
  };
}

export function filterCards(cards: Card[], params: SearchParams): Card[] {
  return cards.filter((card) => {
    // ATK Range
    if (params.atkRange) {
      if (params.atkRange === "?") {
        if (card.atk !== "?") return false;
      } else if (ATK_RANGE_MAP[params.atkRange]) {
        const [min, max] = ATK_RANGE_MAP[params.atkRange];
        if (typeof card.atk === "number") {
          if (card.atk < min || card.atk > max) return false;
        } else {
          return false;
        }
      }
    }
    // DEF Range
    if (params.defRange) {
      if (params.defRange === "?") {
        if (card.def !== "?") return false;
      } else if (DEF_RANGE_MAP[params.defRange]) {
        const [min, max] = DEF_RANGE_MAP[params.defRange];
        if (typeof card.def === "number") {
          if (card.def < min || card.def > max) return false;
        } else {
          return false;
        }
      }
    }
    // Master Duel Rarity
    if (params.rarity) {
      const rarities = params.rarity
        .split(",")
        .map((r) => r.trim().toLowerCase());
      const mdRarity = card.misc_info?.[0]?.md_rarity?.toLowerCase();
      if (!mdRarity || !rarities.includes(mdRarity)) {
        return false;
      }
    }

    // ...other filters (type, attribute, etc)...
    if (params.type && params.type !== "") {
      const types = params.type
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (!card.type || !types.includes(card.type)) {
        return false;
      }
    }
    if (
      params.attribute &&
      params.attribute !== "" &&
      card.attribute !== params.attribute
    )
      return false;
    if (params.race && params.race !== "") {
      const races = params.race
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (!card.race || !races.includes(card.race)) {
        return false;
      }
    }
    if (
      params.level &&
      params.level !== "" &&
      String(card.level) !== params.level
    )
      return false;
    if (params.archetype && params.archetype !== "") {
      const archetypes = params.archetype
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const cardArchetype = getArchetypeName(card);
      if (!cardArchetype || !archetypes.includes(cardArchetype)) {
        return false;
      }
    }
    if (
      params.effect &&
      params.effect !== "" &&
      !card.desc.toLowerCase().includes(params.effect.toLowerCase())
    )
      return false;
    return true;
  });
}

// This function can be imported and called anywhere (client-side)
export function openLoginModal() {
  // Directly set the Zustand state
  useLoginModalStore.getState().openLoginModal()
}

/**
 * Safely normalize archetype from a Card or raw value into a clean string.
 * This MUST NEVER return "[object Object]".
 */
export function getArchetypeName(cardOrRaw: { archetype?: any } | Card | any): string {
  const raw = (cardOrRaw as any)?.archetype ?? cardOrRaw;

  if (!raw) return "";

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "[object Object]") return "";
    return trimmed;
  }

  if (typeof raw === "object" && raw !== null) {
    const name = (raw as any).name;
    if (typeof name === "string") {
      const trimmed = name.trim();
      if (trimmed === "[object Object]") return "";
      return trimmed;
    }
  }

  // Any other weird case: never surface it
  return "";
}

/**
 * Sanitize AI text so that:
 * - Any "[object Object]" is replaced with "this archetype".
 * - Any card-like name not in allowedCardNames is replaced with "this card".
 */
export function sanitizeAiText(content: string, allowedCardNames: string[]): string {
  if (!content) return "";
  let cleaned = content.replace(/\[object Object\]/g, "this archetype");

  if (!allowedCardNames || allowedCardNames.length === 0) {
    return cleaned;
  }

  const allowed = new Set(allowedCardNames.map((n) => n.toLowerCase()));

  // Capitalized multi-word phrases that look like card names
  const cardLikeRegex = /\b([A-Z][A-Za-z0-9'&]+)(?:\s+[A-Z][A-Za-z0-9'&]+)+\b/g;

  cleaned = cleaned.replace(cardLikeRegex, (match) => {
    const normalized = match.trim().toLowerCase();
    if (allowed.has(normalized)) return match;
    return "this card";
  });

  return cleaned;
}