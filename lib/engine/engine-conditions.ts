/**
 * Mechanical engine-condition extractor (client mirror of edge module).
 * Temporary SoT until curated card_capabilities ships.
 */

import { EvidenceIds } from "./assistant-contract";

export interface EngineConditionCard {
  id: number;
  name: string;
  desc?: string;
  archetype?: string | null;
}

export interface EngineCondition {
  slug: string;
  label: string;
  genericCondition: string;
  retrievalQuery: string;
  satisfiedByDeck: string[];
  evidenceId: string;
}

interface ConditionRule {
  slug: string;
  label: string;
  genericCondition: string;
  retrievalQuery: string;
  deckDetectors: RegExp[];
  nameDetectors?: RegExp[];
}

const CONDITION_RULES: ConditionRule[] = [
  {
    slug: "tribute_opponent_for_cost",
    label: "Tribute opponent monsters",
    genericCondition:
      "Tribute or use opponent's monsters for costs, summons, or effects (e.g. Lair of Darkness packages)",
    // Neutral capability language — never bake a single staple name into the query.
    retrievalQuery:
      "tribute monster opponent controls special summon to opponent field tributing take control for tribute cost dark tribute destroy",
    deckDetectors: [
      /lair of darkness/i,
      /tribute\s+(?:1\s+)?(?:monster\s+)?(?:your\s+)?opponent\s+controls/i,
      /using\s+(?:a\s+)?monster\s+your\s+opponent\s+controls/i,
      /tribute\s+.*?opponent.*?monster/i,
    ],
    nameDetectors: [/lair of darkness/i],
  },
  {
    slug: "send_from_deck_to_gy",
    label: "Deck mill / send-to-GY engine",
    genericCondition:
      "Send cards from deck to GY to enable GY effects or setup",
    retrievalQuery:
      "send from deck to graveyard mill foolish burial setup gy effect",
    deckDetectors: [
      /send.{0,40}from\s+(?:your\s+)?deck\s+to\s+(?:the\s+)?(?:gy|graveyard)/i,
      /foolish burial/i,
    ],
  },
  {
    slug: "banish_for_cost_or_summon",
    label: "Banish cost / banish summon",
    genericCondition:
      "Banish cards from GY or field as cost or for Special Summon",
    retrievalQuery:
      "banish from gy special summon banished monster cost banish",
    deckDetectors: [
      /banish.{0,30}(?:from\s+(?:your\s+)?(?:gy|graveyard)|face-up)/i,
      /special summon.{0,40}banished/i,
    ],
  },
  {
    slug: "discard_for_advantage",
    label: "Discard outlet / hand advantage",
    genericCondition:
      "Discard as cost or effect to draw, search, or Special Summon",
    retrievalQuery:
      "discard 1 card draw search special summon from hand cost discard",
    deckDetectors: [/discard\s+\d+\s+card/i, /you\s+can\s+discard/i],
  },
  {
    slug: "link_arrow_pointing_zones",
    label: "Link zone / co-linked support",
    genericCondition:
      "Cards that care about Link Monsters pointing to zones or co-linked states",
    retrievalQuery:
      "link monster this card points to co-linked extra monster zone",
    deckDetectors: [
      /this\s+card\s+points\s+to/i,
      /co-linked/i,
      /monsters?\s+this\s+card\s+points\s+to/i,
    ],
  },
  {
    slug: "dark_field_wide_payoff",
    label: "DARK / field-wide DARK payoffs",
    genericCondition:
      "Cards that pay off when the field is DARK-heavy or under a DARK field spell (Lair-style)",
    retrievalQuery:
      "dark attribute fiend tribute dark monster destroy search dark monster field spell dark payoff lilith ahrima duke shade diabolos",
    deckDetectors: [
      /lair of darkness/i,
      /all\s+face-up\s+monsters.{0,40}dark/i,
      /become\s+dark/i,
      /dark\s+monster.{0,30}(?:field|you\s+control)/i,
    ],
    nameDetectors: [/lair of darkness/i],
  },
  {
    slug: "fusion_material_steal",
    label: "Fusion using opponent / Super Poly-style",
    genericCondition:
      "Fusion that can use the opponent's monsters as material (Super Polymerization payoffs)",
    retrievalQuery:
      "fusion summon using opponent's monsters super polymerization dark fusion material",
    deckDetectors: [
      /super polymerization/i,
      /fusion\s+summon.{0,60}opponent/i,
      /using\s+monsters?\s+from\s+either\s+field/i,
    ],
  },
];

const CANDIDATE_MATCHERS: Record<string, RegExp[]> = {
  tribute_opponent_for_cost: [
    /tribute.{0,50}opponent/i,
    /opponent\s+controls?.{0,30}tribute/i,
    /using.{0,20}opponent.?s?\s+monster/i,
    /treat.{0,30}opponent.?s?\s+monster/i,
    /take\s+control.{0,40}tribute/i,
    /special\s+summon.{0,40}opponent.?s?\s+field/i,
    /tributing\s+1\s+monster\s+they\s+control/i,
    /tribute\s+1\s+monster\s+your\s+opponent\s+controls/i,
  ],
  send_from_deck_to_gy: [
    /send.{0,40}from\s+(?:your\s+)?deck\s+to\s+(?:the\s+)?(?:gy|graveyard)/i,
    /mill/i,
  ],
  banish_for_cost_or_summon: [
    /banish.{0,40}(?:gy|graveyard)/i,
    /special summon.{0,40}banished/i,
  ],
  discard_for_advantage: [/discard\s+\d+/i, /discard.{0,20}(?:draw|search)/i],
  link_arrow_pointing_zones: [/points\s+to/i, /co-linked/i],
  dark_field_wide_payoff: [
    /tribute\s+1\s+dark/i,
    /dark\s+monster/i,
    /become\s+dark/i,
    /all\s+face-up\s+monsters/i,
    /fiend/i,
    /attribute.{0,12}dark|dark.{0,12}attribute/i,
  ],
  fusion_material_steal: [
    /fusion.{0,40}opponent/i,
    /super polymerization/i,
    /either\s+field/i,
  ],
};

/** Soft keyword tokens per condition — boosts (does not hard-gate alone at full weight). */
const SOFT_KEYWORDS: Record<string, string[]> = {
  tribute_opponent_for_cost: [
    "tribute",
    "opponent",
    "controls",
    "take control",
    "opponent's field",
  ],
  dark_field_wide_payoff: [
    "dark",
    "fiend",
    "tribute",
    "field spell",
    "destroy",
  ],
  send_from_deck_to_gy: ["deck", "graveyard", "gy", "send"],
  banish_for_cost_or_summon: ["banish", "banished"],
  discard_for_advantage: ["discard", "draw", "search"],
  link_arrow_pointing_zones: ["points to", "co-linked", "link"],
  fusion_material_steal: ["fusion", "polymerization", "either field"],
};

/**
 * Extract engine conditions present in deck card metadata.
 */
export function extractEngineConditions(
  cards: EngineConditionCard[],
): EngineCondition[] {
  const found: EngineCondition[] = [];

  for (const rule of CONDITION_RULES) {
    const satisfiedBy: string[] = [];
    for (const card of cards) {
      const blob = `${card.name}\n${card.desc || ""}`;
      const nameHit = rule.nameDetectors?.some((re) => re.test(card.name));
      const textHit = rule.deckDetectors.some((re) => re.test(blob));
      if (nameHit || textHit) {
        if (!satisfiedBy.includes(card.name)) satisfiedBy.push(card.name);
      }
    }
    if (satisfiedBy.length === 0) continue;
    found.push({
      slug: rule.slug,
      label: rule.label,
      genericCondition: rule.genericCondition,
      retrievalQuery: rule.retrievalQuery,
      satisfiedByDeck: satisfiedBy,
      evidenceId: EvidenceIds.condition(rule.slug),
    });
  }

  return found;
}

/**
 * Prefer off-archetype techs: penalize candidates that share the primary archetype name.
 */
export function archetypeOverlapPenalty(
  card: { archetype?: string | null },
  primaryArchetype: string | null,
): number {
  if (!primaryArchetype) return 0;
  const arch = (card.archetype || "").toLowerCase();
  const primary = primaryArchetype.toLowerCase();
  if (!arch) return 0;
  if (arch === primary) return 0.55;
  if (arch.includes(primary) || primary.includes(arch)) return 0.4;
  return 0;
}

/**
 * Mechanical fit score. Regex hits dominate; soft keyword overlap prevents
 * empty buckets when hybrid search surfaces legitimate but loosely worded techs.
 */
export function scoreConditionFit(
  card: EngineConditionCard,
  condition: EngineCondition,
): number {
  const matchers = CANDIDATE_MATCHERS[condition.slug] ?? [];
  const blob = `${card.name}\n${card.desc || ""}`;
  let hits = 0;
  for (const re of matchers) {
    if (re.test(blob)) hits += 1;
  }
  if (hits > 0) {
    return Math.min(1, hits / Math.max(1, matchers.length));
  }

  const soft = SOFT_KEYWORDS[condition.slug] ?? [];
  if (soft.length === 0) return 0;
  const lower = blob.toLowerCase();
  let softHits = 0;
  for (const token of soft) {
    if (lower.includes(token.toLowerCase())) softHits += 1;
  }
  if (softHits === 0) return 0;
  // Soft-only passes land in 0.15–0.45 so they rank below hard mechanical fits.
  return Math.min(0.45, 0.12 + softHits * 0.08);
}

/**
 * Collapse near-duplicate tribute/Kaiju techs so retrieval can surface variety.
 */
export function synergyFamilyKey(card: {
  id?: number;
  name: string;
  desc?: string | null;
}): string {
  const n = card.name.toLowerCase();
  if (
    /kaiju|gameciel|interrupted kaiju|kyoutou|jiizukiru|gadoaron|kumongous|dogoran|gadarla|radoshguul|thunder king, the lightningstrike kaiju/i.test(
      n,
    )
  ) {
    return "family:kaiju";
  }
  if (/lava golem|santa claws|volcanic queen/i.test(n)) {
    return "family:summon_to_opp_tribute";
  }
  if (
    /enemy controller|the monarchs stormforth|soul exchange|creature swap|mind control/i.test(
      n,
    )
  ) {
    return "family:control_for_tribute";
  }
  if (/super polymerization|predaplant vertebr|starving venom/i.test(n)) {
    return "family:super_poly_package";
  }
  return `card:${card.id ?? n}`;
}

/**
 * Keep highest-ranked card per family while preserving overall score order.
 */
export function diversifyByFamily<
  T extends { card: { id?: number; name: string; desc?: string | null } },
>(items: T[], limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = synergyFamilyKey(item.card);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Rank / narrow engine conditions using the user question so synergy
 * retrieval does not always dump the same mill/banish pool.
 * Open-ended asks keep up to 4 conditions for broader candidate coverage.
 */
export function rankConditionsForQuestion(
  conditions: EngineCondition[],
  question: string,
): EngineCondition[] {
  if (conditions.length <= 1) return conditions;

  const q = question.toLowerCase();
  const openEnded =
    /\b(synerg|tech|recommend|suggest|what\s+(else|cards?)|add\s+cards?|help|splash|package|hidden)\b/i.test(
      q,
    ) &&
    !/\b(only|just|specifically)\b/i.test(q);

  const scored = conditions.map((condition) => {
    let score = 1;
    for (const name of condition.satisfiedByDeck) {
      if (q.includes(name.toLowerCase())) score += 6;
    }
    if (
      condition.slug === "tribute_opponent_for_cost" &&
      /\b(tribute|lair|kaiju|lava\s+golem|santa\s+claws|enemy\s+controller|control\s+of|stormforth)\b/i.test(
        q,
      )
    ) {
      score += 5;
    }
    if (
      condition.slug === "send_from_deck_to_gy" &&
      /\b(mill|foolish|send.{0,12}deck|gy\s+setup|graveyard\s+setup)\b/i.test(q)
    ) {
      score += 5;
    }
    if (
      condition.slug === "banish_for_cost_or_summon" &&
      /\b(banish|banished|macro|dimensional|bystial)\b/i.test(q)
    ) {
      score += 5;
    }
    if (
      condition.slug === "dark_field_wide_payoff" &&
      /\b(dark|lair|field\s+spell|fiend|ahrima|lilith|diabolos)\b/i.test(q)
    ) {
      score += 4;
    }
    if (
      condition.slug === "fusion_material_steal" &&
      /\b(super\s+poly|fusion|polymer)/i.test(q)
    ) {
      score += 5;
    }
    if (
      condition.slug === "discard_for_advantage" &&
      /\b(discard|hand\s+trap|draw|search\s+outlet)\b/i.test(q)
    ) {
      score += 4;
    }
    if (
      condition.slug === "link_arrow_pointing_zones" &&
      /\b(link|co-?linked|arrow|points?\s+to)\b/i.test(q)
    ) {
      score += 4;
    }
    // Going-second / breaker asks: prefer engines that enable disruption packages
    if (
      /\b(going\s+second|board\s+breaker|break(ing)?\s+boards?)\b/i.test(q) &&
      (condition.slug === "tribute_opponent_for_cost" ||
        condition.slug === "fusion_material_steal" ||
        condition.slug === "banish_for_cost_or_summon")
    ) {
      score += 3.5;
    }
    // Consistency asks: prefer mill / discard / search-adjacent conditions
    if (
      /\b(brick|consistency|opener|starter)\b/i.test(q) &&
      (condition.slug === "send_from_deck_to_gy" ||
        condition.slug === "discard_for_advantage")
    ) {
      score += 3;
    }
    // Mild preference only — do not hard-lock every Lair ask onto tribute alone.
    if (condition.slug === "tribute_opponent_for_cost") score += 0.25;
    if (condition.slug === "dark_field_wide_payoff") score += 0.2;
    score += Math.min(2, condition.satisfiedByDeck.length * 0.15);
    return { condition, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const cap = openEnded ? 4 : 3;
  const top = scored[0]?.score ?? 0;
  if (top >= 5) {
    return scored
      .filter((s) => s.score >= Math.max(4, top - 2))
      .map((s) => s.condition)
      .slice(0, cap);
  }
  return scored.map((s) => s.condition).slice(0, cap);
}

/**
 * Card-specific synergy blurb (never reuse bare genericCondition alone).
 */
export function buildSynergyFitSummary(
  card: { name: string; desc?: string | null },
  condition: EngineCondition,
): string {
  const engines = condition.satisfiedByDeck.slice(0, 2).join(" / ");
  const desc = (card.desc || "").replace(/\s+/g, " ").trim();
  const snippet = desc.slice(0, 160);
  if (snippet) {
    return `With ${engines || condition.label}: ${snippet}${
      desc.length > 160 ? "…" : ""
    }`;
  }
  return `${card.name} supports ${condition.label}${
    engines ? ` (from ${engines})` : ""
  }.`;
}

const DISCOVERY_ATTRIBUTES = [
  "DARK",
  "LIGHT",
  "EARTH",
  "WATER",
  "FIRE",
  "WIND",
  "DIVINE",
] as const;

const DISCOVERY_RACES = [
  "Aqua",
  "Beast",
  "Beast-Warrior",
  "Cyberse",
  "Dinosaur",
  "Divine-Beast",
  "Dragon",
  "Fairy",
  "Fiend",
  "Fish",
  "Insect",
  "Machine",
  "Plant",
  "Psychic",
  "Pyro",
  "Reptile",
  "Rock",
  "Sea Serpent",
  "Spellcaster",
  "Thunder",
  "Warrior",
  "Winged Beast",
  "Wyrm",
  "Zombie",
] as const;

export interface DiscoveryFilters {
  attributes: string[];
  races: string[];
  wantsSearcher: boolean;
}

/**
 * Parse attribute / race / searcher intent from a free-form card ask.
 */
export function parseDiscoveryFilters(question: string): DiscoveryFilters {
  const q = question.toLowerCase();
  const attributes = DISCOVERY_ATTRIBUTES.filter((a) =>
    q.includes(a.toLowerCase()),
  );
  const races = DISCOVERY_RACES.filter((r) => q.includes(r.toLowerCase()));
  const wantsSearcher =
    /\b(searcher|searchers|tutor|tutors|search|searches)\b/i.test(question);
  return { attributes, races, wantsSearcher };
}

/**
 * Soft rank boost when a candidate matches explicit discovery filters.
 */
export function discoveryFilterBoost(
  card: {
    attribute?: string | null;
    race?: string | null;
    desc?: string | null;
    name?: string;
  },
  filters: DiscoveryFilters,
): number {
  if (
    filters.attributes.length === 0 &&
    filters.races.length === 0 &&
    !filters.wantsSearcher
  ) {
    return 0;
  }
  let boost = 0;
  const attr = (card.attribute || "").toUpperCase();
  const race = (card.race || "").toLowerCase();
  if (
    filters.attributes.length > 0 &&
    filters.attributes.some((a) => a.toUpperCase() === attr)
  ) {
    boost += 0.35;
  }
  if (
    filters.races.length > 0 &&
    filters.races.some((r) => r.toLowerCase() === race)
  ) {
    boost += 0.35;
  }
  if (filters.wantsSearcher) {
    const blob = `${card.name || ""}\n${card.desc || ""}`.toLowerCase();
    if (
      /add .{0,40}(?:from (?:your )?deck|to (?:your )?hand)/i.test(blob) ||
      /search .{0,30}deck/i.test(blob) ||
      /\btutor\b/i.test(blob)
    ) {
      boost += 0.4;
    }
  }
  return boost;
}

/**
 * Boost synergy candidates that match going-second / hand trap / floodgate / name asks.
 * Mirrors supabase/functions/strategist/synergy-retrieval.ts askIntentBoost.
 */
export function askIntentBoost(
  card: {
    name: string;
    type?: string;
    desc?: string | null;
  },
  userQuery?: string,
): number {
  const q = (userQuery || "").toLowerCase();
  if (!q) return 0;
  let boost = 0;
  const blob = `${card.name}\n${card.desc || ""}`.toLowerCase();
  const type = (card.type || "").toLowerCase();

  if (q.includes(card.name.toLowerCase())) boost += 0.55;

  if (/\b(going\s+second|board\s+breaker|break\s+board|kaiju)\b/.test(q)) {
    if (
      /destroy all|banish all|return all|unaffected by|opponent controls/.test(
        blob,
      )
    ) {
      boost += 0.4;
    }
  }
  if (/\b(hand\s+trap|interaction|ash|imperm|nibiru|veiler)\b/.test(q)) {
    if (
      /quick effect|during either player's turn|discard this card|negate the activation/
        .test(blob) ||
      type.includes("trap")
    ) {
      boost += 0.4;
    }
  }
  if (/\b(floodgate|stun|lock|skill\s+drain)\b/.test(q)) {
    if (
      /neither player can|each player can only|cannot special summon|floodgate/
        .test(blob)
    ) {
      boost += 0.35;
    }
  }
  if (/\b(searcher|tutor|starter|consistency)\b/.test(q)) {
    if (/add .{0,40}from (?:your )?deck|search .{0,30}deck/.test(blob)) {
      boost += 0.35;
    }
  }
  if (/\b(extender|extend|continue)\b/.test(q)) {
    if (/special summon this card from (?:your )?hand|from (?:your )?gy/.test(blob)) {
      boost += 0.25;
    }
  }
  return boost;
}

/**
 * Synthetic condition when the user names attribute/race/searcher intent.
 */
export function buildDiscoveryCondition(
  filters: DiscoveryFilters,
  satisfiedByDeck: string[],
): EngineCondition | null {
  if (
    filters.attributes.length === 0 &&
    filters.races.length === 0 &&
    !filters.wantsSearcher
  ) {
    return null;
  }
  const bits = [
    ...filters.attributes,
    ...filters.races,
    filters.wantsSearcher ? "searcher tutor add from deck to hand" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    slug: "card_discovery",
    label: "Requested card discovery",
    genericCondition: `Cards matching the ask (${bits})`,
    retrievalQuery: bits || "off archetype tech cards",
    satisfiedByDeck: satisfiedByDeck.slice(0, 4),
    evidenceId: EvidenceIds.condition("card_discovery"),
  };
}
