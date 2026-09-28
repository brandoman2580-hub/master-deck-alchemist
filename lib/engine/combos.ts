import type {
  ComboEdge,
  ComboGraphSummary,
  ComboLine,
  ComboNode,
  EngineFormat,
} from "./types";

/** Stored in combo_templates.graph JSONB */
export interface ComboTemplateNode {
  id: string;
  label: string;
  /** Preferred match keys — resolved against deck card names (case-insensitive). */
  cardNames: string[];
  kind: ComboNode["kind"];
  /** If true, line is dropped when none of cardNames are in the deck. */
  required?: boolean;
}

export interface ComboTemplateGraph {
  nodes: ComboTemplateNode[];
  edges: ComboEdge[];
  endboardSummary: string;
  fallbackSummary?: string;
}

export interface ComboTemplateRow {
  id: string;
  archetypeName: string;
  format: EngineFormat;
  name: string;
  bosses: string[];
  graph: ComboTemplateGraph;
  killers: string[];
}

export interface DeckCardRef {
  id: number;
  name: string;
  zone: "main" | "extra" | "side";
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function buildNameIndex(deckCards: DeckCardRef[]): Map<string, DeckCardRef[]> {
  const map = new Map<string, DeckCardRef[]>();
  for (const card of deckCards) {
    const key = normalizeName(card.name);
    const list = map.get(key) ?? [];
    list.push(card);
    map.set(key, list);
  }
  return map;
}

function resolveCardIds(
  cardNames: string[],
  byName: Map<string, DeckCardRef[]>,
): number[] {
  const ids: number[] = [];
  for (const name of cardNames) {
    const hits = byName.get(normalizeName(name));
    if (!hits?.length) continue;
    for (const hit of hits) {
      if (!ids.includes(hit.id)) ids.push(hit.id);
    }
  }
  return ids;
}

/**
 * Validate a curated template against the active deck list.
 * Required nodes without a deck match cause the line to be rejected.
 */
export function validateComboTemplate(
  template: ComboTemplateRow,
  deckCards: DeckCardRef[],
): ComboLine | null {
  const byName = buildNameIndex(deckCards);
  const nodes: ComboNode[] = [];

  for (const node of template.graph.nodes) {
    const cardIds = resolveCardIds(node.cardNames, byName);
    if (node.required !== false && cardIds.length === 0) {
      // Default required=true for hand/step/endboard unless explicitly optional
      const required =
        node.required === true ||
        (node.required === undefined &&
          (node.kind === "hand" ||
            node.kind === "step" ||
            node.kind === "endboard"));
      if (required) return null;
    }
    nodes.push({
      id: node.id,
      label: node.label,
      cardIds,
      kind: node.kind,
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = template.graph.edges.filter(
    (e) => nodeIds.has(e.from) && nodeIds.has(e.to),
  );

  return {
    id: template.id,
    name: template.name,
    nodes,
    edges,
    killers: template.killers,
    endboardSummary: template.graph.endboardSummary,
    fallbackSummary: template.graph.fallbackSummary,
  };
}

/**
 * Match templates by primary archetype (exact, then partial).
 */
export function selectTemplatesForArchetype(
  templates: ComboTemplateRow[],
  archetype: string | null,
  format: EngineFormat,
): ComboTemplateRow[] {
  const scoped = templates.filter((t) => t.format === format);
  if (!archetype) return scoped.slice(0, 3);

  const needle = normalizeName(archetype);
  const exact = scoped.filter(
    (t) => normalizeName(t.archetypeName) === needle,
  );
  if (exact.length) return exact;

  const partial = scoped.filter(
    (t) =>
      needle.includes(normalizeName(t.archetypeName)) ||
      normalizeName(t.archetypeName).includes(needle),
  );
  return partial.length ? partial : scoped.slice(0, 2);
}

/**
 * Deterministic fallback line from bosses + starter-tagged names in deck.
 * Used when no curated template matches.
 */
export function compileFallbackLine(
  deckCards: DeckCardRef[],
  bosses: Array<{ cardId: number; name: string }>,
  starterNames: string[],
): ComboLine | null {
  const mains = deckCards.filter((c) => c.zone === "main");
  const extras = deckCards.filter((c) => c.zone === "extra");
  if (mains.length < 5) return null;

  const hand = mains.slice(0, 5);
  const steps = starterNames.length
    ? mains
        .filter((c) =>
          starterNames.some(
            (n) => normalizeName(n) === normalizeName(c.name),
          ),
        )
        .slice(0, 3)
    : mains.slice(5, 8);

  const end =
    bosses.length > 0
      ? bosses.slice(0, 3).map((b) => ({
          id: b.cardId,
          name: b.name,
          zone: "extra" as const,
        }))
      : extras.slice(0, 3);

  if (end.length === 0) return null;

  const nodes: ComboNode[] = [
    {
      id: "hand",
      label: "Opening hand",
      cardIds: hand.map((c) => c.id),
      kind: "hand",
    },
    {
      id: "line",
      label: "Core line",
      cardIds: (steps.length ? steps : hand.slice(0, 2)).map((c) => c.id),
      kind: "step",
    },
    {
      id: "end",
      label: "End board",
      cardIds: end.map((c) => c.id),
      kind: "endboard",
    },
  ];

  return {
    id: "compiled-fallback",
    name: "Compiled Core Line",
    nodes,
    edges: [
      { from: "hand", to: "line", label: "develop" },
      { from: "line", to: "end", label: "close" },
    ],
    killers: [
      "Ash Blossom & Joyous Spring",
      "Infinite Impermanence",
      "Nibiru, the Primal Being",
    ],
    endboardSummary: end.map((c) => c.name).join(" + "),
  };
}

export interface CompileCombosInput {
  format: EngineFormat;
  archetype: string | null;
  deckCards: DeckCardRef[];
  templates: ComboTemplateRow[];
  bosses: Array<{ cardId: number; name: string }>;
  starterNames?: string[];
}

/**
 * Hybrid combo compile: curated templates first, deterministic fallback second.
 */
export function compileCombos(input: CompileCombosInput): ComboGraphSummary {
  const selected = selectTemplatesForArchetype(
    input.templates,
    input.archetype,
    input.format,
  );

  const lines: ComboLine[] = [];
  const seen = new Set<string>();
  for (const template of selected) {
    const line = validateComboTemplate(template, input.deckCards);
    if (line) {
      lines.push(line);
      seen.add(template.id);
    }
  }

  // Hybrid coverage: also accept other format templates that fully validate.
  if (lines.length < 3) {
    const scoped = input.templates.filter((t) => t.format === input.format);
    for (const template of scoped) {
      if (seen.has(template.id)) continue;
      const line = validateComboTemplate(template, input.deckCards);
      if (line) {
        lines.push(line);
        seen.add(template.id);
        if (lines.length >= 3) break;
      }
    }
  }

  if (lines.length > 0) {
    return { lines, source: "template" };
  }

  const fallback = compileFallbackLine(
    input.deckCards,
    input.bosses,
    input.starterNames ?? [],
  );
  if (fallback) {
    return { lines: [fallback], source: "compiled" };
  }

  return { lines: [], source: "empty" };
}

/** Resolve deck cards for a combo node (UI helpers). */
export function cardsForNode(
  node: ComboNode,
  deckCards: DeckCardRef[],
): DeckCardRef[] {
  const byId = new Map(deckCards.map((c) => [c.id, c]));
  const out: DeckCardRef[] = [];
  for (const id of node.cardIds) {
    const card = byId.get(id);
    if (card) out.push(card);
  }
  return out;
}
