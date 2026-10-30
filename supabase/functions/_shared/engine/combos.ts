/**
 * Deno mirror of lib/engine/combos.ts (template validate + compile).
 */

import type {
  ComboEdge,
  ComboGraphSummary,
  ComboLane,
  ComboLine,
  ComboNode,
  EngineFormat,
} from "./types.ts";

export interface ComboTemplateNode {
  id: string;
  label: string;
  cardNames: string[];
  kind: ComboNode["kind"];
  lane?: ComboLane;
  order?: number;
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

function isInterruptKind(kind: ComboNode["kind"]): boolean {
  return kind === "interruption" || kind === "killer" || kind === "choke";
}

/** Lane used by the combo board. Explicit lanes win; older kinds map onto the four rows. */
export function comboLane(node: Pick<ComboNode, "kind" | "lane">): ComboLane {
  if (node.lane) return node.lane;
  if (node.kind === "hand") return "hand";
  if (node.kind === "step") return "play";
  if (node.kind === "endboard") return "boss";
  return "interrupt";
}

/**
 * One card per node, with lanes and edge relations filled in.
 * Killer names become interruption nodes when the line has none of its own.
 * Safe to run more than once.
 */
export function projectComboLine(
  line: ComboLine,
  namesById: ReadonlyMap<number, string> = new Map(),
): ComboLine {
  const emitted = new Map<string, string[]>();
  const nodes: ComboNode[] = [];

  line.nodes.forEach((node, sourceIndex) => {
    const lane = comboLane(node);
    const pieces: ComboNode[] = [];
    const cardIds = node.cardIds.length > 0 ? node.cardIds : [null];
    cardIds.forEach((cardId, index) => {
      if (cardId == null && lane !== "interrupt" && !isInterruptKind(node.kind)) {
        return;
      }
      const cardName =
        (cardId != null ? namesById.get(cardId) : undefined) ??
        node.cardName ??
        node.label;
      pieces.push({
        ...node,
        id: node.cardIds.length > 1 ? `${node.id}~${index}` : node.id,
        cardIds: cardId == null ? [] : [cardId],
        cardName,
        lane,
        order: (node.order ?? sourceIndex * 100) + index,
      });
    });
    if (pieces.length === 0) return;
    emitted.set(node.id, pieces.map((piece) => piece.id));
    nodes.push(...pieces);
  });

  const edges: ComboEdge[] = [];
  for (const ids of emitted.values()) {
    const lane = nodes.find((node) => node.id === ids[0])?.lane;
    if (ids.length > 1 && lane === "play") {
      for (let index = 0; index < ids.length - 1; index += 1) {
        edges.push({
          from: ids[index]!,
          to: ids[index + 1]!,
          relation: "play",
        });
      }
    }
  }
  for (const edge of line.edges) {
    const fromIds = emitted.get(edge.from);
    const toIds = emitted.get(edge.to);
    if (!fromIds?.length || !toIds?.length) continue;
    edges.push({
      ...edge,
      from: fromIds[fromIds.length - 1]!,
      to: toIds[0]!,
      relation: edge.relation ?? "play",
    });
  }

  const hasInterrupt = nodes.some((node) => comboLane(node) === "interrupt");
  if (!hasInterrupt) {
    line.killers.forEach((name, index) => {
      nodes.push({
        id: `killer-${index}`,
        label: name,
        cardName: name,
        cardIds: [],
        kind: "interruption",
        lane: "interrupt",
        order: 10000 + index,
      });
    });
  }

  return { ...line, nodes, edges };
}

export function validateComboTemplate(
  template: ComboTemplateRow,
  deckCards: DeckCardRef[],
): ComboLine | null {
  const byName = buildNameIndex(deckCards);
  const nodes: ComboNode[] = [];

  for (const node of template.graph.nodes) {
    const cardIds = resolveCardIds(node.cardNames, byName);
    const lane = node.lane ?? comboLane(node);
    const interrupt = lane === "interrupt" || isInterruptKind(node.kind);
    const required =
      node.required === true ||
      (node.required === undefined &&
        !interrupt &&
        (node.kind === "hand" ||
          node.kind === "step" ||
          node.kind === "endboard"));
    if (required && cardIds.length === 0) return null;
    nodes.push({
      id: node.id,
      label: node.label,
      cardIds,
      cardName: node.cardNames[0],
      kind: node.kind,
      lane: node.lane,
      order: node.order,
    });
  }

  const namesById = new Map(deckCards.map((card) => [card.id, card.name]));
  return projectComboLine(
    {
      id: template.id,
      name: template.name,
      nodes,
      edges: template.graph.edges,
      killers: template.killers,
      endboardSummary: template.graph.endboardSummary,
      fallbackSummary: template.graph.fallbackSummary,
    },
    namesById,
  );
}

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

  const namesById = new Map<number, string>();
  for (const card of deckCards) namesById.set(card.id, card.name);
  for (const boss of bosses) namesById.set(boss.cardId, boss.name);

  return projectComboLine(
    {
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
    },
    namesById,
  );
}

export interface CompileCombosInput {
  format: EngineFormat;
  archetype: string | null;
  deckCards: DeckCardRef[];
  templates: ComboTemplateRow[];
  bosses: Array<{ cardId: number; name: string }>;
  starterNames?: string[];
}

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
