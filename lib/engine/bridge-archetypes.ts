/**
 * Resolve bridge / convert archetypes for optimize mode.
 * Combines question aliases, deck archetypes, and curated combo_templates names.
 */

export interface BridgeResolveArgs {
  question: string;
  /** Dominant / secondary archetypes already on the live deck. */
  deckArchetypes?: string[];
  /** Distinct archetype_name values from combo_templates (format-scoped). */
  knownTemplateArchetypes?: string[];
  max?: number;
}

/** Well-known aliases → canonical archetype labels used in templates / knowledge. */
export const BRIDGE_ARCHETYPE_ALIASES: Array<[RegExp, string]> = [
  [/\brda\b|red\s+dragon\s+archfiend|resonator/i, "Resonator"],
  [/\blair\b|dark\s+world|pure\s+darkness|lair\s+of\s+darkness/i, "Lair of Darkness"],
  [/\bbranded\b|despia|albaz|bystial/i, "Branded"],
  [/\bsnake[- ]?eye|diabellstar|wanted\b/i, "Snake-Eye"],
  [/\btearlaments?\b|ishizu|kelbek/i, "Tearlaments"],
  [/\blabrynth\b|lovely\s+labrynth|lady\s+labrynth/i, "Labrynth"],
  [/\bfiendsmith\b|lacrima|requiem/i, "Fiendsmith"],
  [/\byummy\b|cooky|lollipo/i, "Yummy"],
  [/\bmitsurugi\b/i, "Mitsurugi"],
  [/\bkashtira\b|fenrir|unicorn|ariseheart/i, "Kashtira"],
  [/\bspright\b|gigantic\s+spright/i, "Spright"],
  [/\brunick\b/i, "Runick"],
  [/\bpurrely\b/i, "Purrely"],
  [/\bswordsoul\b|mo\s+ye|taia/i, "Swordsoul"],
  [/\bmathmech\b|circular/i, "Mathmech"],
  [/\bsky\s+striker\b|raye|roze/i, "Sky Striker"],
  [/\bdragon\s+link\b|rokket|borrel/i, "Dragon Link"],
  [/\beldlich\b|golden\s+land|eldlixir/i, "Eldlich"],
  [/\bdrytron\b/i, "Drytron"],
  [/\btri[- ]?brigade\b/i, "Tri-Brigade"],
  [/\bdogmatika\b/i, "Dogmatika"],
  [/\bfloowandereeze\b/i, "Floowandereeze"],
];

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Pull "into/to/toward/bridge X" phrases from the question.
 */
export function extractTowardPhrases(question: string): string[] {
  const out: string[] = [];
  const patterns: RegExp[] = [
    /\b(?:into|toward|towards)\s+([A-Za-z][A-Za-z0-9' \-]{1,40}?)(?=\s+(?:for|with|and|or|\/|,|\.|!|\?|deck|list|package|engine|hybrid)\b|[?.!,/]|$)/gi,
    /\bconvert\s+(?:(?:this|my|the)\s+(?:list|deck)\s+)?(?:into|to)\s+([A-Za-z][A-Za-z0-9' \-]{1,40}?)(?=\s+(?:for|with|and|or|\/|,|\.|!|\?|deck|list)\b|[?.!,/]|$)/gi,
    /\brework\s+(?:(?:this|my|the)\s+(?:list|deck)\s+)?toward\s+([A-Za-z][A-Za-z0-9' \-]{1,40}?)(?=\s+(?:for|with|and|or|\/|,|\.|!|\?|deck|list)\b|[?.!,/]|$)/gi,
    /\bbridge(?:\s+into)?\s+([A-Za-z][A-Za-z0-9' \-]{1,40}?)(?=\s+(?:for|with|and|or|\/|,|\.|!|\?|deck|list|package|engine)\b|[?.!,/]|$)/gi,
    /\bsplash\s+([A-Za-z][A-Za-z0-9'\-]{2,24})(?:\s+(?:engine|package|cards?))?\b/gi,
  ];
  for (const re of patterns) {
    for (const m of question.matchAll(re)) {
      const phrase = (m[1] || "")
        .trim()
        .replace(/[?.!,].*$/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (phrase.length >= 3 && !/^(this|that|my|the|a|an|it)$/i.test(phrase)) {
        out.push(phrase);
      }
    }
  }
  return [...new Set(out)];
}

function matchKnownName(
  needle: string,
  known: string[],
): string | null {
  const key = normalizeKey(needle);
  if (key.length < 3) return null;
  let best: { name: string; score: number } | null = null;
  for (const name of known) {
    const hay = normalizeKey(name);
    if (!hay) continue;
    let score = 0;
    if (hay === key) score = 1;
    else if (hay.includes(key) || key.includes(hay)) {
      score =
        Math.min(key.length, hay.length) / Math.max(key.length, hay.length);
    }
    if (score >= 0.55 && (!best || score > best.score)) {
      best = { name, score };
    }
  }
  return best?.name ?? null;
}

/**
 * Resolve bridge archetypes for optimize / combo-template loading.
 */
export function resolveBridgeArchetypes(args: BridgeResolveArgs): string[] {
  const max = args.max ?? 4;
  const question = args.question || "";
  const deckArchetypes = (args.deckArchetypes ?? [])
    .map((a) => a.trim())
    .filter((a) => a.length >= 2);
  const known = [
    ...new Set([
      ...(args.knownTemplateArchetypes ?? []),
      ...deckArchetypes,
      ...BRIDGE_ARCHETYPE_ALIASES.map(([, name]) => name),
    ]),
  ];

  const found: string[] = [];
  const push = (name: string | null | undefined) => {
    const n = name?.trim();
    if (!n || n.length < 2) return;
    if (found.some((f) => normalizeKey(f) === normalizeKey(n))) return;
    found.push(n);
  };

  for (const [re, name] of BRIDGE_ARCHETYPE_ALIASES) {
    if (re.test(question)) push(name);
  }

  for (const phrase of extractTowardPhrases(question)) {
    const matched = matchKnownName(phrase, known);
    if (matched) push(matched);
    else {
      // Keep short title-cased tokens from the phrase when plausible
      const cleaned = phrase
        .split(/\s+/)
        .filter((w) => !/^(the|a|an|my|this|deck|list|package|engine|hybrid|splash|bridge)$/i.test(w))
        .join(" ")
        .trim();
      // Only accept unmatched free-form if it looks like a proper name (not filler)
      if (
        cleaned.length >= 3 &&
        cleaned.length <= 32 &&
        /[A-Za-z]/.test(cleaned) &&
        !/^(should|what|which|add|more|into|toward)$/i.test(cleaned)
      ) {
        push(cleaned);
      }
    }
  }

  // Direct mentions of known template / deck archetypes in the question
  const qKey = question.toLowerCase();
  for (const name of known) {
    if (name.length < 4) continue;
    if (qKey.includes(name.toLowerCase())) push(name);
  }

  // Splash / bridge without a clear target: offer non-primary deck archetypes
  if (
    found.length === 0 &&
    /\b(splash|bridge|hybrid|engine\s+package)\b/i.test(question) &&
    deckArchetypes.length > 1
  ) {
    for (const a of deckArchetypes.slice(1, 3)) push(a);
  }

  return found.slice(0, max);
}

/**
 * Collect unique non-empty archetype strings from card rows.
 */
export function collectDeckArchetypes(
  cards: Array<{ archetype?: string | null }>,
  primary?: string | null,
): string[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const name = card.archetype?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  if (primary?.trim()) {
    return [
      primary.trim(),
      ...ranked.filter(
        (n) => normalizeKey(n) !== normalizeKey(primary.trim()),
      ),
    ].slice(0, 6);
  }
  return ranked.slice(0, 6);
}
