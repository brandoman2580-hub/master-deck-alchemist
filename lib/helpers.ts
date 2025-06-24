/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card } from "@/types/card";
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
} from "@/types/types";
import { ATK_RANGE_MAP, DEF_RANGE_MAP } from "./constants";

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
    if (params.type && params.type !== "" && card.type !== params.type)
      return false;
    if (
      params.attribute &&
      params.attribute !== "" &&
      card.attribute !== params.attribute
    )
      return false;
    if (params.race && params.race !== "" && card.race !== params.race)
      return false;
    if (
      params.level &&
      params.level !== "" &&
      String(card.level) !== params.level
    )
      return false;
    if (
      params.archetype &&
      params.archetype !== "" &&
      card.archetype !== params.archetype
    )
      return false;
    if (
      params.effect &&
      params.effect !== "" &&
      !card.desc.toLowerCase().includes(params.effect.toLowerCase())
    )
      return false;
    return true;
  });
}
