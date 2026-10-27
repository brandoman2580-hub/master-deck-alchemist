import { ARCHETYPE_KNOWLEDGE } from "@/lib/engine/archetype-knowledge";
import { normalizeCardName } from "./list-legality";
import type { MetaTier } from "./representation-tier";

export interface MetaListCardRef {
  name: string;
  copies: number;
  zone: "main" | "extra" | "side";
}

export interface MetaListRef {
  name: string;
  tier: MetaTier;
  cards: MetaListCardRef[];
}

export interface UserCardRef {
  name: string;
  zone: "main" | "extra" | "side";
}

export interface MatchupPlan {
  name: string;
  tier: MetaTier;
  aim: string;
  goingSecond: string;
  goingFirst: string;
  group: "missing" | "unknown" | "covered";
  theirMain: string[];
  theirExtra: string[];
  yourCards: string[];
  sideNote: string | null;
}

interface StopRule {
  theirCard: string;
  yourCard: string;
  moment: "stop-play" | "answer-board";
  whenYouHaveIt: string;
  whenYouLackIt: string;
  goingFirst: string;
}

/**
 * A stop is listed only when both cards are named here and both are in the
 * lists being compared. Card text, not the broad role tagger, is the check.
 * Ash Blossom stops Branded Fusion because that spell uses a monster from
 * the Deck. Forbidden Droplet and Dark Ruler No More turn Mirrorjade off
 * for the turn without making it leave the field.
 */
const STOP_RULES: StopRule[] = [
  {
    theirCard: "Branded Fusion",
    yourCard: "Ash Blossom & Joyous Spring",
    moment: "stop-play",
    whenYouHaveIt: "Ash Blossom can stop Branded Fusion before they Fusion Summon.",
    whenYouLackIt:
      "They play Branded Fusion, and this deck has no Ash Blossom & Joyous Spring to stop it.",
    goingFirst: "Keep Ash Blossom & Joyous Spring for Branded Fusion on their turn.",
  },
  {
    theirCard: "Mirrorjade the Iceblade Dragon",
    yourCard: "Forbidden Droplet",
    moment: "answer-board",
    whenYouHaveIt:
      "Forbidden Droplet can turn off Mirrorjade the Iceblade Dragon for the turn you play it.",
    whenYouLackIt:
      "If Branded Fusion resolves, Mirrorjade the Iceblade Dragon is still there. This deck has no Forbidden Droplet or Dark Ruler No More to turn it off for the turn.",
    goingFirst:
      "Forbidden Droplet is for the game where you play into their board.",
  },
  {
    theirCard: "Mirrorjade the Iceblade Dragon",
    yourCard: "Dark Ruler No More",
    moment: "answer-board",
    whenYouHaveIt:
      "Dark Ruler No More can turn off Mirrorjade the Iceblade Dragon for this turn. You cannot deal damage on the turn you play it.",
    whenYouLackIt:
      "If Branded Fusion resolves, Mirrorjade the Iceblade Dragon is still there. This deck has no Forbidden Droplet or Dark Ruler No More to turn it off for the turn.",
    goingFirst:
      "Dark Ruler No More is for the game where you play into their board.",
  },
];

const GENERIC_TOKENS = new Set([
  "warrior",
  "dragon",
  "knight",
  "knights",
  "magician",
  "engine",
]);

function copiesOf(
  cards: Iterable<{ name: string; zone: UserCardRef["zone"] }>,
  name: string,
  zones: ReadonlySet<UserCardRef["zone"]>,
): number {
  const key = normalizeCardName(name);
  let count = 0;
  for (const card of cards) {
    if (!zones.has(card.zone)) continue;
    if (normalizeCardName(card.name) === key) count += 1;
  }
  return count;
}

function listHas(
  list: MetaListRef,
  name: string,
  zones: ReadonlySet<MetaListCardRef["zone"]>,
): boolean {
  const key = normalizeCardName(name);
  return list.cards.some(
    (card) => zones.has(card.zone) && normalizeCardName(card.name) === key,
  );
}

function playableZones(format: "Master Duel" | "TCG"): Set<UserCardRef["zone"]> {
  return format === "TCG"
    ? new Set(["main", "extra", "side"])
    : new Set(["main", "extra"]);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function knowledgeFor(listName: string) {
  const name = normalizeCardName(listName);
  return ARCHETYPE_KNOWLEDGE.find((entry) => {
    const entryName = normalizeCardName(entry.name);
    return name === entryName || name.split(" ").includes(entryName);
  });
}

function primaryToken(listName: string): string {
  const words = normalizeCardName(listName)
    .split(" ")
    .filter((word) => word.length >= 5 && !GENERIC_TOKENS.has(word));
  words.sort((a, b) => b.length - a.length);
  return words[0] ?? normalizeCardName(listName);
}

function signatureCards(
  list: MetaListRef,
  zones: ReadonlySet<MetaListCardRef["zone"]>,
): string[] {
  const knowledge = knowledgeFor(list.name);
  const fromKnowledge = (knowledge?.coreCards ?? []).filter((card) =>
    listHas(list, card, zones),
  );
  if (fromKnowledge.length > 0) return fromKnowledge.slice(0, 3);

  const token = primaryToken(list.name);
  const named = list.cards.filter(
    (card) => zones.has(card.zone) && normalizeCardName(card.name).includes(token),
  );
  named.sort((a, b) => b.copies - a.copies || a.name.localeCompare(b.name));
  const unique: string[] = [];
  for (const card of named) {
    if (!unique.includes(card.name)) unique.push(card.name);
    if (unique.length === 3) break;
  }
  return unique;
}

function aimFor(
  list: MetaListRef,
  zones: ReadonlySet<MetaListCardRef["zone"]>,
): string {
  const knowledge = knowledgeFor(list.name);
  const played = signatureCards(list, zones);
  const verb = (knowledge?.keyMechanics ?? []).some((item) =>
    item.toLowerCase().includes("fusion"),
  )
    ? "They try to Fusion Summon."
    : (knowledge?.keyMechanics ?? []).some((item) => item.toLowerCase().includes("synchro"))
      ? "They try to Synchro Summon."
      : (knowledge?.keyMechanics ?? []).some((item) => item.toLowerCase().includes("xyz"))
        ? "They try to Xyz Summon."
        : (knowledge?.keyMechanics ?? []).some((item) => item.toLowerCase().includes("link"))
          ? "They try to Link Summon."
          : (knowledge?.keyMechanics ?? []).some((item) => item.toLowerCase().includes("trap"))
            ? "They play a lot of Traps."
            : null;

  const own = played.length > 0 ? `This list plays ${joinNames(played)}.` : "This list is legal on the current banlist.";
  const others = crossEngineCards(list, zones);
  const mixed =
    others.length > 0
      ? ` This list also plays ${joinNames(others)}, so it is not a pure ${list.name} list.`
      : "";
  return [verb, own].filter(Boolean).join(" ") + mixed;
}

function crossEngineCards(
  list: MetaListRef,
  zones: ReadonlySet<MetaListCardRef["zone"]>,
): string[] {
  const own = knowledgeFor(list.name);
  const ownNames = new Set(
    [own?.name, ...(own?.relatedTerms ?? [])]
      .filter((name): name is string => Boolean(name))
      .map((name) => normalizeCardName(name)),
  );
  const markers = new Set(
    STOP_RULES.map((rule) => normalizeCardName(rule.theirCard)),
  );
  const found: string[] = [];
  for (const entry of ARCHETYPE_KNOWLEDGE) {
    const entryName = normalizeCardName(entry.name);
    if (ownNames.has(entryName)) continue;
    const named = entry.coreCards.filter(
      (card) => listHas(list, card, zones) && normalizeCardName(card).includes(entryName),
    );
    const definesEngine = named.some((card) => markers.has(normalizeCardName(card)));
    if (named.length < 2 && !definesEngine) continue;
    for (const card of named) {
      if (!found.includes(card)) found.push(card);
      if (found.length === 3) return found;
    }
  }
  return found;
}

function applicableRules(
  list: MetaListRef,
  zones: ReadonlySet<MetaListCardRef["zone"]>,
): StopRule[] {
  return STOP_RULES.filter((rule) => listHas(list, rule.theirCard, zones));
}

function hasAnswer(
  rule: StopRule,
  userCards: UserCardRef[],
  zones: Set<UserCardRef["zone"]>,
): boolean {
  return copiesOf(userCards, rule.yourCard, zones) > 0;
}

function coveredTheirCards(
  rules: StopRule[],
  userCards: UserCardRef[],
  zones: Set<UserCardRef["zone"]>,
): Set<string> {
  const covered = new Set<string>();
  for (const rule of rules) {
    if (hasAnswer(rule, userCards, zones)) covered.add(normalizeCardName(rule.theirCard));
  }
  return covered;
}

function sentenceFor(
  rules: StopRule[],
  moment: StopRule["moment"],
  userCards: UserCardRef[],
  zones: Set<UserCardRef["zone"]>,
  field: "whenYouHaveIt" | "whenYouLackIt" | "goingFirst",
): string | null {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (rule.moment !== moment) continue;
    const key = normalizeCardName(rule.theirCard);
    if (seen.has(key) && field === "whenYouLackIt") continue;
    const owned = hasAnswer(rule, userCards, zones);
    if (field === "whenYouHaveIt" && owned) return rule.whenYouHaveIt;
    if (field === "goingFirst" && owned && moment === "stop-play") return rule.goingFirst;
    if (field === "whenYouLackIt" && !owned) {
      const siblings = rules.filter(
        (other) => normalizeCardName(other.theirCard) === key,
      );
      const anyOwned = siblings.some((other) => hasAnswer(other, userCards, zones));
      if (anyOwned) continue;
      seen.add(key);
      return rule.whenYouLackIt;
    }
  }
  return null;
}

function formatList(cards: MetaListCardRef[], zone: MetaListCardRef["zone"]): string[] {
  return cards
    .filter((card) => card.zone === zone)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((card) => `${card.name} ×${card.copies}`);
}

function yourCardLines(
  rules: StopRule[],
  userCards: UserCardRef[],
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    const key = normalizeCardName(rule.yourCard);
    if (seen.has(key)) continue;
    const main = copiesOf(userCards, rule.yourCard, new Set(["main"]));
    const extra = copiesOf(userCards, rule.yourCard, new Set(["extra"]));
    const side = copiesOf(userCards, rule.yourCard, new Set(["side"]));
    const inMatch = main + extra;
    if (inMatch === 0 && side === 0) continue;
    seen.add(key);
    if (inMatch > 0) lines.push(`${rule.yourCard} ×${inMatch}`);
    if (side > 0) lines.push(`${rule.yourCard} ×${side} in your side deck`);
  }
  return lines;
}

function sideNoteFor(
  rules: StopRule[],
  userCards: UserCardRef[],
  format: "Master Duel" | "TCG",
): string | null {
  if (format === "TCG") return null;
  const onlySide = rules.filter((rule) => {
    const main = copiesOf(userCards, rule.yourCard, new Set(["main", "extra"]));
    const side = copiesOf(userCards, rule.yourCard, new Set(["side"]));
    return main === 0 && side > 0;
  });
  if (onlySide.length === 0) return null;
  return `${onlySide[0].yourCard} is in your side deck. Master Duel plays one game, so it is not in this match.`;
}

function planFor(
  list: MetaListRef,
  userCards: UserCardRef[],
  format: "Master Duel" | "TCG",
): MatchupPlan {
  const zones = playableZones(format);
  const rules = applicableRules(list, zones);
  const covered = coveredTheirCards(rules, userCards, zones);
  const theirCards = [...new Set(rules.map((rule) => normalizeCardName(rule.theirCard)))];
  const missing = theirCards.filter((card) => !covered.has(card)).length;
  const group: MatchupPlan["group"] =
    rules.length === 0 ? "unknown" : missing > 0 ? "missing" : "covered";

  const stop = sentenceFor(rules, "stop-play", userCards, zones, "whenYouHaveIt");
  const answer = sentenceFor(rules, "answer-board", userCards, zones, "whenYouHaveIt");
  const missingStop = sentenceFor(rules, "stop-play", userCards, zones, "whenYouLackIt");
  const missingAnswer = sentenceFor(rules, "answer-board", userCards, zones, "whenYouLackIt");
  const firstStop = sentenceFor(rules, "stop-play", userCards, zones, "goingFirst");

  const goingSecond =
    rules.length === 0
      ? "We don't have a checked stop for this deck yet."
      : ["You are playing into their board.", stop, answer, missingStop, missingAnswer]
          .filter((line): line is string => Boolean(line))
          .join(" ");

  const goingFirst =
    rules.length === 0
      ? "We don't have a checked stop for this deck yet."
      : ["You set up first.", firstStop ?? missingStop]
          .filter((line): line is string => Boolean(line))
          .join(" ");

  return {
    name: list.name,
    tier: list.tier,
    aim: aimFor(list, zones),
    goingSecond,
    goingFirst,
    group,
    theirMain: formatList(list.cards, "main"),
    theirExtra: formatList(list.cards, "extra"),
    yourCards: yourCardLines(rules, userCards),
    sideNote: [goingSecond, goingFirst].some((line) => line.includes("side deck"))
      ? null
      : sideNoteFor(rules, userCards, format),
  };
}

const GROUP_ORDER = { missing: 0, covered: 1, unknown: 2 };

/**
 * One plain-language plan per stored legal list.
 * Lists where a named card has no named answer come first.
 * Lists with a checked plan come next. Lists with no checked stop come last.
 */
export function buildMatchupPlans(
  lists: MetaListRef[],
  userCards: UserCardRef[],
  format: "Master Duel" | "TCG",
): MatchupPlan[] {
  return lists
    .map((list) => planFor(list, userCards, format))
    .sort(
      (a, b) =>
        GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
        a.tier - b.tier ||
        a.name.localeCompare(b.name),
    );
}
