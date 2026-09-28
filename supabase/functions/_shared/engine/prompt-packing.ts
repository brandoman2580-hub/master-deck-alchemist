/**
 * Priority packing for Strategist prompts — DECK_CARDS + Facts caps.
 * Prefer collisions / locks / asked entities over blind slice(0, N).
 */

export type DeckSectionKey = "main" | "extra" | "side";

export interface PackableDeckCard {
  id: number;
  name: string;
  count: number;
  section: DeckSectionKey;
  /** Role tags e.g. starter, extender, hand_trap, board_breaker, endboard */
  roles?: string[];
}

export interface PackDeckCardsOptions {
  /** Include every unique name when at or below this count (default 60). */
  fullIncludeMax?: number;
  /** Max unique names when over budget (default 48). */
  priorityBudget?: number;
  priorityCardIds?: number[];
  priorityNames?: string[];
  /** Card IDs referenced by collisions / restrictions. */
  collisionCardIds?: number[];
  /** Include side cards even when trimming (default: keep if room / priority). */
  preferSide?: boolean;
}

export interface PackedDeckCards {
  lines: string[];
  uniqueCount: number;
  truncated: boolean;
  includedIds: number[];
}

export type QaFocusHint =
  | "consistency"
  | "resilience"
  | "construction"
  | "play_line"
  | "anti_synergy"
  | "meta_matchup"
  | "side_plan"
  | "general"
  | string;

export interface FactsPromptCaps {
  collisions: number;
  restrictions: number;
  matchups: number;
  combos: number;
  bosses: number;
  strategyNotes: number;
}

export interface FormatFactsOptions {
  qaFocus?: QaFocusHint | null;
  question?: string;
  caps?: Partial<FactsPromptCaps>;
}

const SECTION_PREFIX: Record<DeckSectionKey, string> = {
  main: "M",
  extra: "E",
  side: "S",
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Resolve raised / intent-aware caps for Facts prompt slices.
 */
export function resolveFactsPromptCaps(
  options: FormatFactsOptions = {},
): FactsPromptCaps {
  const focus = (options.qaFocus ?? "general").toString();
  const q = (options.question ?? "").toLowerCase();

  let base: FactsPromptCaps = {
    collisions: 10,
    restrictions: 10,
    matchups: 8,
    combos: 5,
    bosses: 8,
    strategyNotes: 5,
  };

  if (focus === "anti_synergy" || /\b(lock|anti[- ]?synergy|conflict)\b/.test(q)) {
    base = {
      collisions: 14,
      restrictions: 14,
      matchups: 4,
      combos: 3,
      bosses: 6,
      strategyNotes: 5,
    };
  } else if (focus === "play_line" || /\b(combo|line|endboard|choke)\b/.test(q)) {
    base = {
      collisions: 6,
      restrictions: 8,
      matchups: 4,
      combos: 8,
      bosses: 10,
      strategyNotes: 4,
    };
  } else if (
    focus === "meta_matchup" ||
    focus === "side_plan" ||
    /\b(matchup|side\s+deck|side\s+plan|going\s+second)\b/.test(q)
  ) {
    base = {
      collisions: 6,
      restrictions: 6,
      matchups: 12,
      combos: 4,
      bosses: 6,
      strategyNotes: 4,
    };
  } else if (
    focus === "consistency" ||
    focus === "resilience" ||
    /\b(brick|opener|consistency|hand\s+trap)\b/.test(q)
  ) {
    base = {
      collisions: 10,
      restrictions: 8,
      matchups: 5,
      combos: 4,
      bosses: 6,
      strategyNotes: 5,
    };
  } else if (focus === "construction" || /\b(ratio|copies|cut|trim|40)\b/.test(q)) {
    base = {
      collisions: 12,
      restrictions: 10,
      matchups: 4,
      combos: 3,
      bosses: 8,
      strategyNotes: 6,
    };
  }

  return { ...base, ...options.caps };
}

function scoreCard(
  card: PackableDeckCard,
  opts: {
    priorityIds: Set<number>;
    priorityNames: Set<string>;
    collisionIds: Set<number>;
    preferSide: boolean;
  },
): number {
  let score = 0;
  if (opts.priorityIds.has(card.id)) score += 100;
  if (opts.priorityNames.has(normalizeName(card.name))) score += 100;
  if (opts.collisionIds.has(card.id)) score += 50;

  const roles = (card.roles ?? []).map((r) => r.toLowerCase());
  if (roles.some((r) => /starter|search/.test(r))) score += 22;
  if (roles.some((r) => /hand_trap|interruption|hand trap/.test(r))) score += 20;
  if (roles.some((r) => /board_breaker|board breaker/.test(r))) score += 18;
  if (roles.some((r) => /endboard|boss|end_board/.test(r))) score += 18;
  if (roles.some((r) => /extender|lock/.test(r))) score += 12;

  if (card.section === "main") score += 6;
  else if (card.section === "extra") score += 4;
  else if (card.section === "side") score += opts.preferSide ? 8 : 2;

  // Prefer higher counts slightly (engine staples)
  score += Math.min(3, card.count);

  return score;
}

function formatDeckCardLine(card: PackableDeckCard): string {
  const prefix = SECTION_PREFIX[card.section];
  const rolePart =
    card.roles && card.roles.length > 0
      ? ` [${card.roles.slice(0, 3).join(",")}]`
      : "";
  return `${prefix}${card.count} ${card.name}${rolePart}`;
}

/**
 * Build DECK_CARDS lines with section + count (+ optional roles).
 * Under fullIncludeMax → include all; otherwise priority-select.
 */
export function packDeckCardsForPrompt(
  cards: PackableDeckCard[],
  options: PackDeckCardsOptions = {},
): PackedDeckCards {
  const fullIncludeMax = options.fullIncludeMax ?? 60;
  const priorityBudget = options.priorityBudget ?? 48;
  const priorityIds = new Set(
    (options.priorityCardIds ?? []).filter((id) => Number.isFinite(id)),
  );
  const priorityNames = new Set(
    (options.priorityNames ?? []).map(normalizeName).filter(Boolean),
  );
  const collisionIds = new Set(
    (options.collisionCardIds ?? []).filter((id) => Number.isFinite(id)),
  );
  const preferSide = options.preferSide === true;

  const deduped = new Map<string, PackableDeckCard>();
  for (const card of cards) {
    if (!card.name?.trim() || !Number.isFinite(card.id)) continue;
    const key = `${card.section}:${card.id}`;
    const existing = deduped.get(key);
    if (existing) {
      existing.count = Math.min(3, existing.count + Math.max(1, card.count));
      if (card.roles?.length) {
        existing.roles = [
          ...new Set([...(existing.roles ?? []), ...card.roles]),
        ];
      }
    } else {
      deduped.set(key, {
        ...card,
        count: Math.max(1, Math.min(3, card.count || 1)),
        roles: card.roles ? [...card.roles] : undefined,
      });
    }
  }

  const all = Array.from(deduped.values());
  const uniqueNames = new Set(all.map((c) => normalizeName(c.name)));
  const uniqueCount = uniqueNames.size;

  const orderedSections: DeckSectionKey[] = ["main", "extra", "side"];
  const sortStable = (list: PackableDeckCard[]) =>
    [...list].sort((a, b) => {
      const sa = orderedSections.indexOf(a.section);
      const sb = orderedSections.indexOf(b.section);
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });

  if (uniqueCount <= fullIncludeMax) {
    const sorted = sortStable(all);
    return {
      lines: sorted.map(formatDeckCardLine),
      uniqueCount,
      truncated: false,
      includedIds: sorted.map((c) => c.id),
    };
  }

  const scored = all
    .map((card) => ({
      card,
      score: scoreCard(card, {
        priorityIds,
        priorityNames,
        collisionIds,
        preferSide,
      }),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.card.name.localeCompare(b.card.name);
    });

  const picked: PackableDeckCard[] = [];
  const seenNames = new Set<string>();
  for (const row of scored) {
    const key = normalizeName(row.card.name);
    if (seenNames.has(key) && picked.some((p) => p.id === row.card.id && p.section === row.card.section)) {
      continue;
    }
    if (seenNames.size >= priorityBudget && !seenNames.has(key)) continue;
    picked.push(row.card);
    seenNames.add(key);
    if (seenNames.size >= priorityBudget) {
      // Allow same-name other sections already counted; stop new names
      const remainingSameName = scored.filter(
        (s) =>
          normalizeName(s.card.name) === key &&
          !picked.some(
            (p) => p.id === s.card.id && p.section === s.card.section,
          ),
      );
      for (const extra of remainingSameName) picked.push(extra.card);
      break;
    }
  }

  const sorted = sortStable(picked);
  return {
    lines: sorted.map(formatDeckCardLine),
    uniqueCount,
    truncated: true,
    includedIds: sorted.map((c) => c.id),
  };
}

/**
 * Priority-select list items using a score fn (higher first).
 */
export function prioritySlice<T>(
  items: T[],
  limit: number,
  score: (item: T, index: number) => number,
): T[] {
  if (items.length <= limit) return items;
  return items
    .map((item, index) => ({ item, index, score: score(item, index) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((row) => row.item);
}
