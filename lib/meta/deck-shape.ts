import type { FactsEnvelope } from "@/lib/engine";
import {
  emptyTierFloors,
  type MetaGateBands,
  type TierFloors,
} from "./gate-bands";
import { normalizeCardName } from "./list-legality";
import type { MetaListRef, UserCardRef } from "./matchup-plan";
import type { MetaTier } from "./representation-tier";

export type DeckFormatLabel = "Master Duel" | "TCG";

export type ShapeLineId = "open" | "afterStop" | "stop" | "clear" | "pressure";

/**
 * Format priority for the five lines. The numbers are shares of attention.
 * They are not applied on top of each other, and they are not added into one score.
 */
export const FORMAT_EMPHASIS: Record<
  DeckFormatLabel,
  Record<ShapeLineId, number>
> = {
  "Master Duel": {
    open: 30,
    afterStop: 15,
    stop: 15,
    clear: 15,
    pressure: 25,
  },
  TCG: {
    open: 20,
    afterStop: 30,
    stop: 10,
    clear: 15,
    pressure: 25,
  },
};

const EMPHASIS_PHRASE: Record<ShapeLineId, string> = {
  open: "opening a play",
  afterStop: "keeping a play after one stop",
  stop: "cards that stop a turn",
  clear: "cards that clear a board",
  pressure: "how hard the turn is to play through",
};

/**
 * Cards that stop a search, a summon from the Deck, or a monster effect.
 * Draw effects such as Maxx "C" are left out on purpose.
 */
const STOP_THEIR_PLAY = [
  "Ash Blossom & Joyous Spring",
  "Effect Veiler",
  "Infinite Impermanence",
  "Droll & Lock Bird",
  "Ghost Mourner & Moonlit Chill",
  "Psy-Framegear Gamma",
  "Dominus Impulse",
] as const;

/**
 * Cards that answer a board that has already resolved.
 * Generic extra-deck outs sit here with the main-deck answers.
 */
const CLEAR_A_BOARD = [
  "Forbidden Droplet",
  "Dark Ruler No More",
  "Evenly Matched",
  "Raigeki",
  "Lightning Storm",
  "Harpie's Feather Duster",
  "Dark Hole",
  "Super Polymerization",
  "Ultimate Slayer",
  "Nibiru, the Primal Being",
  "Lava Golem",
  "The Winged Dragon of Ra - Sphere Mode",
  "Interrupted Kaiju Slumber",
  "Gameciel, the Sea Turtle Kaiju",
  "Gadarla, the Mystery Dust Kaiju",
  "Kumongous, the Sticky String Kaiju",
  "Radian, the Multidimensional Kaiju",
  "Dogoran, the Mad Flame Kaiju",
  "Jizukiru, the Star Destroying Kaiju",
  "Thunder King, the Lightningstrike Kaiju",
  "Super Starslayer TY-PHON - Sky Crisis",
  "Underworld Goddess of the Closed World",
] as const;

/** Continuous locks. They are an alternative to an end board, not an addition. */
const FLOODGATES = [
  "Skill Drain",
  "There Can Be Only One",
  "Rivalry of Warlords",
  "Gozen Match",
  "Summon Limit",
  "Anti-Spell Fragrance",
  "Dimensional Barrier",
  "Macro Cosmos",
  "Dimensional Fissure",
  "Fossil Dyna Pachycephalo",
  "Inspector Boarder",
  "Vanity's Fiend",
  "Vanity's Emptiness",
  "Jowgen the Spiritualist",
  "Denko Sekka",
  "Dimension Shifter",
  "Secret Village of the Spellcasters",
  "Imperial Order",
  "Royal Decree",
  "Soul Drain",
  "Banisher of the Radiance",
  "Synchro Zone",
  "Mystic Mine",
  "Barrier Statue of the Abyss",
  "Barrier Statue of the Torrent",
  "Barrier Statue of the Stormwinds",
  "Barrier Statue of the Drought",
  "Barrier Statue of the Inferno",
  "Barrier Statue of the Heavens",
] as const;

export interface CopyCard {
  name: string;
  zone: "main" | "extra" | "side";
  copies?: number;
}

export interface DeckShapeLine {
  id: ShapeLineId;
  title: string;
  value: number | null;
  floors: TierFloors;
  valueKind: "percent" | "count";
  detail: string;
}

function catalog(names: readonly string[]): Set<string> {
  return new Set(names.map((name) => normalizeCardName(name)));
}

const STOP_NAMES = catalog(STOP_THEIR_PLAY);
const CLEAR_NAMES = catalog(CLEAR_A_BOARD);
const FLOODGATE_NAMES = catalog(FLOODGATES);

function playable(format: DeckFormatLabel): Set<CopyCard["zone"]> {
  return format === "TCG"
    ? new Set(["main", "extra", "side"])
    : new Set(["main", "extra"]);
}

export function countNamedCopies(
  cards: CopyCard[],
  names: Set<string>,
  format: DeckFormatLabel,
): number {
  const zones = playable(format);
  let total = 0;
  for (const card of cards) {
    if (!zones.has(card.zone)) continue;
    if (!names.has(normalizeCardName(card.name))) continue;
    total += card.copies ?? 1;
  }
  return total;
}

function countSideCopies(cards: CopyCard[], names: Set<string>): number {
  let total = 0;
  for (const card of cards) {
    if (card.zone !== "side") continue;
    if (!names.has(normalizeCardName(card.name))) continue;
    total += card.copies ?? 1;
  }
  return total;
}

function floorsForCatalog(
  lists: MetaListRef[],
  names: Set<string>,
  format: DeckFormatLabel,
): TierFloors {
  const mins: Record<MetaTier, number | null> = { 1: null, 2: null, 3: null };
  for (const list of lists) {
    const value = countNamedCopies(list.cards, names, format);
    const current = mins[list.tier];
    mins[list.tier] = current == null ? value : Math.min(current, value);
  }
  return { tier1: mins[1], tier2: mins[2], tier3: mins[3] };
}

export function closestComparison(format: DeckFormatLabel): ShapeLineId {
  const table = FORMAT_EMPHASIS[format];
  const entries = Object.entries(table) as [ShapeLineId, number][];
  return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

export function deckShapeCaption(
  format: DeckFormatLabel,
  bands: MetaGateBands | null,
): string {
  const focus = EMPHASIS_PHRASE[closestComparison(format)];
  const where = format === "TCG" ? "The TCG" : "Master Duel";
  const counts = bands
    ? ` Tier 1 ${bands.listCounts[1]}, tier 2 ${bands.listCounts[2]}, tier 3 ${bands.listCounts[3]}.`
    : "";
  return `These lines compare this list with legal tier lists.${counts} ${where} looks hardest at ${focus}. Each line stands on its own. This is not a win rate. Recovery is not scored.`;
}

function zeroFloorNote(floors: TierFloors): string {
  if (floors.tier1 !== 0) return "";
  return " Tier 1 lists play none of these, so the floor is zero.";
}

function sideNote(
  cards: CopyCard[],
  names: Set<string>,
  format: DeckFormatLabel,
): string {
  if (format !== "Master Duel") return "";
  if (countSideCopies(cards, names) === 0) return "";
  return " Copies in the side deck are not in a Master Duel match.";
}

export function buildDeckShapeLines(input: {
  facts: FactsEnvelope;
  lists: MetaListRef[];
  bands: MetaGateBands | null;
  userCards: UserCardRef[];
  format: DeckFormatLabel;
}): DeckShapeLine[] {
  const { facts, lists, bands, userCards, format } = input;
  const sampled = facts.consistency.n > 0;
  const endboard = facts.diagnostics.roleCoverage.endboardPieces;
  const locks = countNamedCopies(userCards, FLOODGATE_NAMES, format);
  const lockMode = locks > endboard;
  const brick = sampled
    ? ` This list bricked in ${Math.round(facts.consistency.brickRate * 100)}% of sampled hands.`
    : "";

  const pressureFloors = lockMode
    ? floorsForCatalog(lists, FLOODGATE_NAMES, format)
    : (bands?.ceiling ?? emptyTierFloors());
  const stopFloors =
    lists.length > 0 ? floorsForCatalog(lists, STOP_NAMES, format) : emptyTierFloors();
  const clearFloors =
    lists.length > 0 ? floorsForCatalog(lists, CLEAR_NAMES, format) : emptyTierFloors();
  const pressureDetail = lockMode
    ? "Floodgates are named lock cards. They are not added to the end-board count."
    : "End-board cards use the Workshop role tags, the same count as the tier floors. Floodgates are not added on top.";

  return [
    {
      id: "open",
      title: "Open a play",
      value: sampled ? facts.consistency.starterAccess : null,
      floors: bands?.openPlay ?? emptyTierFloors(),
      valueKind: "percent",
      detail: `Chance the opening five cards include a starter. Cards that are not starters do not raise this chance.${brick}`,
    },
    {
      id: "afterStop",
      title: "After one stop",
      value: sampled ? facts.consistency.oneInterruptionSurvival : null,
      floors: bands?.floor ?? emptyTierFloors(),
      valueKind: "percent",
      detail: `Chance a play remains after one interruption. The sample does not cover a second interruption.${
        bands ? ` Tier floors use a sample of ${bands.sampleIterations}.` : ""
      }`,
    },
    {
      id: "stop",
      title: "Stop their play",
      value: countNamedCopies(userCards, STOP_NAMES, format),
      floors: stopFloors,
      valueKind: "count",
      detail: `Cards that stop a search, a summon from the Deck, or a monster effect.${zeroFloorNote(stopFloors)}${sideNote(userCards, STOP_NAMES, format)}`,
    },
    {
      id: "clear",
      title: "Clear a board",
      value: countNamedCopies(userCards, CLEAR_NAMES, format),
      floors: clearFloors,
      valueKind: "count",
      detail: `Cards that answer a board that has already resolved.${zeroFloorNote(clearFloors)}${sideNote(userCards, CLEAR_NAMES, format)}`,
    },
    {
      id: "pressure",
      title: lockMode
        ? "This deck stops the opponent from playing"
        : "This deck ends on several cards",
      value: lockMode ? locks : endboard,
      floors: pressureFloors,
      valueKind: "count",
      detail: `${pressureDetail}${zeroFloorNote(pressureFloors)}${sideNote(userCards, FLOODGATE_NAMES, format)}`,
    },
  ];
}

export function namedCopyCatalogs(): {
  stop: Set<string>;
  clear: Set<string>;
  floodgate: Set<string>;
} {
  return { stop: STOP_NAMES, clear: CLEAR_NAMES, floodgate: FLOODGATE_NAMES };
}
