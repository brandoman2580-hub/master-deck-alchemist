import {
  countNamedCopies,
  namedCopyCatalogs,
  type CopyCard,
  type DeckFormatLabel,
} from "./deck-shape";
import type { MetaGateBands, StoredDeckScore } from "./gate-bands";
import { normalizeCardName } from "./list-legality";

export const DECK_SCORE_VERSION = 2;

export type DeckScoreLetter = "S" | "A" | "B" | "C" | "D" | "F";

export type CeilingMode = "endboard" | "lock";

export interface DeckScore {
  consistency: number;
  resilience: number;
  interaction: number;
  ceiling: number;
  outing: number;
  composite: number;
  ceilingMode: CeilingMode;
  letter: DeckScoreLetter;
}

/** The first four end-board cards are a finished board. Further cards are toolbox. */
const FULL_BOARD_PIECES = 4;
const ENDBOARD_POINTS = 25;

/** Master Duel turn-0 cards. They draw rather than negate, and they are legal there. */
const MASTER_DUEL_DRAW_STOPS = [
  "Maxx \"C\"",
  "Mulcharmy Fuwalos",
  "Mulcharmy Purulia",
  "Mulcharmy Meowls",
].map((name) => normalizeCardName(name));

/** An Extra Deck generic that answers a board without being drawn. */
const EXTRA_OUT_POINTS = 25;

const EXTRA_OUTS = [
  "Super Starslayer TY-PHON - Sky Crisis",
  "Underworld Goddess of the Closed World",
].map((name) => normalizeCardName(name));

export const GATE_WEIGHTS: Record<
  DeckFormatLabel,
  Record<"consistency" | "resilience" | "interaction" | "ceiling" | "outing", number>
> = {
  "Master Duel": {
    consistency: 35,
    resilience: 15,
    interaction: 25,
    ceiling: 15,
    outing: 10,
  },
  TCG: {
    consistency: 20,
    resilience: 25,
    interaction: 20,
    ceiling: 20,
    outing: 15,
  },
};

export function letterFromComposite(score: number): DeckScoreLetter {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function combinations(n: number, k: number): number {
  if (k < 0 || n < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const choose = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= choose; i += 1) {
    result = (result * (n - choose + i)) / i;
  }
  return result;
}

/** Chance a 5-card hand from the main deck includes at least one of `copies`. */
export function chanceToOpenAtLeastOne(mainSize: number, copies: number, handSize = 5): number {
  if (copies <= 0 || mainSize < handSize) return 0;
  if (copies >= mainSize) return 1;
  const misses = mainSize - copies;
  if (misses < handSize) return 1;
  const total = combinations(mainSize, handSize);
  if (total === 0) return 0;
  return 1 - combinations(misses, handSize) / total;
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function countInZone(cards: CopyCard[], names: Set<string>, zone: CopyCard["zone"]): number {
  let total = 0;
  for (const card of cards) {
    if (card.zone !== zone) continue;
    if (!names.has(normalizeCardName(card.name))) continue;
    total += card.copies ?? 1;
  }
  return total;
}

/**
 * Score one list on five gates that share a 0–100 scale.
 * Consistency and resilience come from the existing opening-hand sample.
 * Interaction, ceiling, and outing use named cards and the main-deck size.
 * Side-deck cards are not drawn and are not part of the score.
 */
export function scoreDeck(input: {
  format: DeckFormatLabel;
  mainSize: number;
  starterAccess: number;
  oneInterruptionSurvival: number;
  endboardPieces: number;
  cards: CopyCard[];
}): DeckScore {
  const catalogs = namedCopyCatalogs();
  const mainCards = input.cards.filter((card) => card.zone === "main");
  const stopNames =
    input.format === "Master Duel"
      ? new Set([...catalogs.stop, ...MASTER_DUEL_DRAW_STOPS])
      : catalogs.stop;
  const stopCopies = countNamedCopies(mainCards, stopNames, input.format);
  const clearCopies = countNamedCopies(mainCards, catalogs.clear, input.format);
  const floodgateCopies = countNamedCopies(mainCards, catalogs.floodgate, input.format);
  const extraOuts = EXTRA_OUTS.reduce(
    (sum, name) => sum + countInZone(input.cards, new Set([name]), "extra"),
    0,
  );

  const consistency = clampScore(input.starterAccess * 100);
  const resilience = clampScore(input.oneInterruptionSurvival * 100);
  const interaction = clampScore(chanceToOpenAtLeastOne(input.mainSize, stopCopies) * 100);
  const endboardScore = clampScore(
    Math.min(Math.max(input.endboardPieces, 0), FULL_BOARD_PIECES) * ENDBOARD_POINTS,
  );
  const lockScore = clampScore(chanceToOpenAtLeastOne(input.mainSize, floodgateCopies) * 100);
  const ceilingMode: CeilingMode = lockScore > endboardScore ? "lock" : "endboard";
  const ceiling = ceilingMode === "lock" ? lockScore : endboardScore;
  const outing = clampScore(
    chanceToOpenAtLeastOne(input.mainSize, clearCopies) * 100 + extraOuts * EXTRA_OUT_POINTS,
  );

  const weights = GATE_WEIGHTS[input.format];
  const composite = clampScore(
    (consistency * weights.consistency +
      resilience * weights.resilience +
      interaction * weights.interaction +
      ceiling * weights.ceiling +
      outing * weights.outing) /
      100,
  );

  return {
    consistency,
    resilience,
    interaction,
    ceiling,
    outing,
    composite,
    ceilingMode,
    letter: letterFromComposite(composite),
  };
}

const STORED_SCORE_KEYS = [
  "consistency",
  "resilience",
  "interaction",
  "ceiling",
  "outing",
  "composite",
] as const;

function isStoredDeck(value: unknown): value is StoredDeckScore {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<StoredDeckScore>;
  if (typeof deck.name !== "string" || deck.name.trim().length === 0) return false;
  if (deck.tier !== 1 && deck.tier !== 2 && deck.tier !== 3) return false;
  return STORED_SCORE_KEYS.every(
    (key) => typeof deck[key] === "number" && Number.isFinite(deck[key]),
  );
}

export function currentStoredDecks(bands: MetaGateBands | null): StoredDeckScore[] {
  if (!bands || bands.scoreVersion !== DECK_SCORE_VERSION) return [];
  return (bands.decks ?? []).filter(isStoredDeck);
}

export function scoreExplanation(format: DeckFormatLabel): {
  title: string;
  intro: string;
  lines: Array<{ label: string; text: string }>;
  weights: string;
} {
  const weights =
    format === "TCG"
      ? "The TCG is a match with a side deck, so resilience carries the most weight."
      : "Master Duel is one game with no side deck, so consistency and interaction carry the most weight.";
  return {
    title: "What this score means",
    intro: "The grade is a weighted average of five measures. It is not a win rate.",
    lines: [
      {
        label: "Consistency",
        text: "How often your first five cards include a starter. A card that cannot start a play does not raise this.",
      },
      {
        label: "Resilience",
        text: "How often a play is still there after one interruption. This does not measure a second interruption.",
      },
      {
        label: "Interaction",
        text: "How often your first five cards include a card you can use on the opponent's turn. In Master Duel that includes Maxx \"C\" and the Mulcharmies. Interruptions on your own finished board count as ceiling.",
      },
      {
        label: "Ceiling",
        text: `The higher of two plans. The first ${FULL_BOARD_PIECES} end-board cards are ${ENDBOARD_POINTS} points each. Further end-board cards do not add points. If floodgates are the stronger plan, this is the chance your first five cards include a floodgate.`,
      },
      {
        label: "Outing",
        text: `How often your first five cards include a card that clears a finished board. Ty-Phon or Underworld Goddess in the Extra Deck adds ${EXTRA_OUT_POINTS} points each, up to 100.`,
      },
    ],
    weights,
  };
}
