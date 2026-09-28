/**
 * Competitive Yu-Gi-Oh slang glossary — bidirectional (player → engine, engine → player).
 * Shared by intent heuristics, classifier prompts, and coach narration.
 */

export type SlangIntentTag =
  | "consistency"
  | "tune_copies"
  | "discover_synergy"
  | "play_line"
  | "resilience"
  | "construction"
  | "anti_synergy"
  | "meta_matchup"
  | "side_plan"
  | "going_first"
  | "going_second";

export interface SlangEntry {
  /** Canonical term */
  term: string;
  /** Aliases matched in user text (lowercase) */
  aliases: string[];
  /** One-line definition for prompt injection */
  definition: string;
  /** Engine intent tags this slang implies */
  intentTags: SlangIntentTag[];
  /** Preferred coach phrasing when narrating this concept */
  outputHint: string;
}

/** v1 competitive glossary seed. */
export const YUGIOH_SLANG_GLOSSARY: SlangEntry[] = [
  {
    term: "brick",
    aliases: ["brick", "bricking", "bricked", "unplayable hand"],
    definition:
      "Opening hand with no viable plays (high-level monsters, dead engines, or non-interacting cards).",
    intentTags: ["consistency"],
    outputHint: "brick / bricking",
  },
  {
    term: "garnet",
    aliases: ["garnet", "garnets"],
    definition:
      "Must-run engine piece you never want to draw raw in the opener.",
    intentTags: ["construction", "consistency"],
    outputHint: "garnet",
  },
  {
    term: "search",
    aliases: ["search", "searcher", "searchers", "tutor", "tutors"],
    definition: "Add a specific card from deck to hand.",
    intentTags: ["discover_synergy", "construction", "play_line"],
    outputHint: "search / searcher",
  },
  {
    term: "show cards",
    aliases: [
      "show me",
      "find me",
      "suggest",
      "suggestions",
      "recommend",
      "what cards",
      "which cards",
      "cards that",
      "card ideas",
    ],
    definition: "Player is asking for card recommendations to add or consider.",
    intentTags: ["discover_synergy"],
    outputHint: "card suggestions",
  },
  {
    term: "engine",
    aliases: ["engine", "package", "packages"],
    definition: "Small synergistic package splashed for a job (e.g. Resonator engine).",
    intentTags: ["construction", "tune_copies"],
    outputHint: "engine / package",
  },
  {
    term: "staple",
    aliases: ["staple", "staples"],
    definition: "Near-universal strong card (Ash, Imperm, etc.).",
    intentTags: ["discover_synergy", "construction"],
    outputHint: "staple",
  },
  {
    term: "hand trap",
    aliases: ["hand trap", "hand traps", "ht", "hts"],
    definition: "Monster effect from hand that disrupts either player's turn.",
    intentTags: ["resilience", "tune_copies"],
    outputHint: "hand trap",
  },
  {
    term: "board breaker",
    aliases: ["board breaker", "board breakers", "breaker", "breakers"],
    definition: "Going-second tool to clear an established board.",
    intentTags: ["discover_synergy", "going_second", "meta_matchup"],
    outputHint: "board breaker",
  },
  {
    term: "hopt",
    aliases: ["hopt", "hard once per turn", "hard opt"],
    definition: "Once-per-turn across all copies of that card name.",
    intentTags: ["construction"],
    outputHint: "HOPT",
  },
  {
    term: "sopt",
    aliases: ["sopt", "soft once per turn", "soft opt"],
    definition: "Once per turn per copy on field; can reuse after reset.",
    intentTags: ["construction"],
    outputHint: "SOPT",
  },
  {
    term: "pop",
    aliases: ["pop", "pops", "destroy"],
    definition: "Destroy a card on the field.",
    intentTags: ["play_line", "discover_synergy"],
    outputHint: "pop",
  },
  {
    term: "bounce",
    aliases: ["bounce", "bounces"],
    definition: "Return a field card to hand.",
    intentTags: ["play_line", "discover_synergy"],
    outputHint: "bounce",
  },
  {
    term: "spin",
    aliases: ["spin", "spins"],
    definition: "Return a card to deck / Extra Deck.",
    intentTags: ["play_line"],
    outputHint: "spin",
  },
  {
    term: "banish",
    aliases: ["banish", "banished", "remove from play", "rfp"],
    definition: "Send to banished zone instead of GY.",
    intentTags: ["play_line", "discover_synergy"],
    outputHint: "banish",
  },
  {
    term: "foolish",
    aliases: ["foolish", "foolish burial"],
    definition: "Send a card from deck straight to GY.",
    intentTags: ["discover_synergy", "play_line"],
    outputHint: "foolish",
  },
  {
    term: "mill",
    aliases: ["mill", "milling", "milled"],
    definition: "Send from top of deck to GY.",
    intentTags: ["discover_synergy", "play_line"],
    outputHint: "mill",
  },
  {
    term: "tribute",
    aliases: ["tribute", "tributes", "sac", "sacs", "tribute fodder"],
    definition: "Send a monster to GY as summon/cost fodder.",
    intentTags: ["discover_synergy", "play_line"],
    outputHint: "tribute / sac",
  },
  {
    term: "set",
    aliases: ["set", "sets", "backrow"],
    definition: "Face-down monster Defense or Spell/Trap in backrow.",
    intentTags: ["play_line", "side_plan"],
    outputHint: "set / backrow",
  },
  {
    term: "going first",
    aliases: ["going first", "go first", "first"],
    definition: "Deck built to lock in negates before opponent plays.",
    intentTags: ["play_line", "going_first", "meta_matchup"],
    outputHint: "going first",
  },
  {
    term: "going second",
    aliases: ["going second", "go second", "second"],
    definition: "Deck built with breakers and push-through for turn 2.",
    intentTags: ["going_second", "meta_matchup", "discover_synergy"],
    outputHint: "going second",
  },
  {
    term: "otk",
    aliases: ["otk", "one turn kill"],
    definition: "Reduce LP from full to 0 in one turn.",
    intentTags: ["play_line", "meta_matchup"],
    outputHint: "OTK",
  },
  {
    term: "ftk",
    aliases: ["ftk", "first turn kill"],
    definition: "Kill on turn 1 before opponent draws.",
    intentTags: ["play_line"],
    outputHint: "FTK",
  },
  {
    term: "towers",
    aliases: ["towers", "unaffected"],
    definition: "Monster unaffected by other card effects.",
    intentTags: ["meta_matchup", "anti_synergy"],
    outputHint: "towers",
  },
  {
    term: "floodgate",
    aliases: ["floodgate", "floodgates", "stun"],
    definition: "Continuous card that blocks a mechanic for one/both players.",
    intentTags: ["discover_synergy", "anti_synergy", "meta_matchup"],
    outputHint: "floodgate",
  },
  {
    term: "choke",
    aliases: ["choke", "chokepoint", "chokepoints", "choke point", "bottleneck"],
    definition: "Most vulnerable combo step; interrupting it ends the turn.",
    intentTags: ["play_line", "resilience"],
    outputHint: "choke / chokepoint",
  },
  {
    term: "meta",
    aliases: ["meta", "the meta", "tier 1", "tier-1"],
    definition: "Strongest decks dominating the competitive landscape.",
    intentTags: ["meta_matchup"],
    outputHint: "the meta",
  },
  {
    term: "rogue",
    aliases: ["rogue"],
    definition: "Competent non-meta deck that can steal wins.",
    intentTags: ["meta_matchup", "construction"],
    outputHint: "rogue",
  },
  {
    term: "banlist",
    aliases: ["banlist", "ban list", "forbidden", "limited list"],
    definition: "Official Forbidden & Limited list restricting copies.",
    intentTags: ["construction", "side_plan"],
    outputHint: "banlist",
  },
  {
    term: "pitch",
    aliases: ["pitch", "pitches", "cut", "cuts", "trim", "shave", "fat"],
    definition: "Remove or cut copies from the list (deck-building).",
    intentTags: ["tune_copies"],
    outputHint: "pitch / cut / trim",
  },
];

const ENGINEER_METRIC_DENYLIST = [
  /Δstarter/i,
  /Δbrick/i,
  /Δsurvive/i,
  /starterAccess\s*[≈=~]/i,
  /brickRate\s*[≈=~]/i,
  /FactsEnvelope/i,
  /facts envelope/i,
  /Monte Carlo/i,
  /evidenceId/i,
  /Validated Δ/i,
];

/**
 * Compact dictionary for Groq system prompts (token-budgeted).
 */
export function formatSlangDictionaryForPrompt(): string {
  const lines = YUGIOH_SLANG_GLOSSARY.map(
    (e) => `- ${e.term}: ${e.definition}`,
  );
  return `# YUGIOH SLANG (use these terms; understand them in user questions)\n${lines.join("\n")}`;
}

/**
 * Annotate a user question with matched slang → engine intent (not shown in UI).
 */
export function buildSlangHintBlock(question: string): string {
  const q = question.toLowerCase();
  const hits: SlangEntry[] = [];
  for (const entry of YUGIOH_SLANG_GLOSSARY) {
    if (entry.aliases.some((a) => q.includes(a.toLowerCase()))) {
      hits.push(entry);
    }
  }
  if (hits.length === 0) return "";
  const tags = [...new Set(hits.flatMap((h) => h.intentTags))];
  const terms = hits.map((h) => h.term).join(", ");
  return `# SLANG\nmatched=${terms}\nengine_intent_tags=${JSON.stringify(tags)}`;
}

/**
 * Collect intent tags implied by slang in the question.
 */
export function slangIntentTagsFromQuestion(question: string): SlangIntentTag[] {
  const q = question.toLowerCase();
  const tags = new Set<SlangIntentTag>();
  for (const entry of YUGIOH_SLANG_GLOSSARY) {
    if (entry.aliases.some((a) => q.includes(a.toLowerCase()))) {
      for (const t of entry.intentTags) tags.add(t);
    }
  }
  return [...tags];
}

/**
 * True if player-facing text still contains engineer metric dumps.
 */
export function containsEngineerMetrics(text: string): boolean {
  return ENGINEER_METRIC_DENYLIST.some((re) => re.test(text));
}

/**
 * Strip common engineer substrings for defense-in-depth sanitization.
 */
export function stripEngineerMetrics(text: string): string {
  let out = text;
  out = out.replace(
    /Validated\s*Δstarter=[^,]+,\s*Δbrick=[^,]+,\s*Δsurvive=[^.]+\.?/gi,
    "",
  );
  out = out.replace(/\(Δbrick\s*-?\d+\.\d+\)/gi, "");
  out = out.replace(/starterAccess\s*[≈=~]\s*-?\d+\.?\d*/gi, "");
  out = out.replace(/brickRate\s*[≈=~]\s*-?\d+\.?\d*/gi, "");
  out = out.replace(/Δ(?:starter|brick|survive)\s*=\s*-?\d+\.?\d*/gi, "");
  out = out.replace(/\bFactsEnvelope\b/gi, "saved-deck facts");
  out = out.replace(/\bfacts envelope\b/gi, "saved-deck facts");
  return out.replace(/\s{2,}/g, " ").trim();
}
