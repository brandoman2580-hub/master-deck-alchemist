import { comboLane, validateComboTemplate, type ComboTemplateRow, type DeckCardRef } from "@/lib/engine/combos";
import type { ComboAnchorSide, ComboEdge, ComboEdgeRelation, ComboLane, ComboNode } from "@/lib/engine/types";

export interface DeckComboPlayRow {
  id: string;
}

export interface DeckComboGraph {
  playRows: DeckComboPlayRow[];
  nodes: ComboNode[];
  edges: ComboEdge[];
  endboardSummary: string;
  /** Snapped canvas coordinates for each placed card. */
  positions?: Record<string, { x: number; y: number }>;
  /** Cards the player marked as the point where the line is disrupted. */
  disruptedNodeIds?: string[];
}

/** React Flow document stored inside the line's graph JSON. */
export interface ComboFlowPayload {
  nodes: {
    id: string;
    type: "cardNode";
    position: { x: number; y: number };
    data: { cardId: number; name: string; imageUrl: string; currentQuantity: number };
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    data: { isDisruption: boolean };
  }[];
}

/** Going first draws 5. Going second draws 6. The opening hand stops there. */
export const OPENING_HAND_LIMIT = 6;

export const COMBO_FLOW_CARD_W = 96;
export const COMBO_FLOW_CARD_H = 140;
const FLOW_ROW_STRIDE = 212;
/** Left gutter reserved for the row add and remove controls. */
export const FLOW_ORIGIN_X = 80;
const FLOW_ORIGIN_Y = 28;
/**
 * Column stride. Card art is 96px wide, so this leaves 64px of open space
 * for the link and the hover remove icon to sit clear of the cards.
 */
export const COMBO_FLOW_COL = 160;
const FLOW_COL = COMBO_FLOW_COL;
export const END_ZONE_W = 148;
export const END_ZONE_GAP = 16;
export const FLOW_END_LANES = ["boss", "material", "spell", "trap", "gy", "banish"] as const satisfies readonly EndBoardLane[];

export interface DeckComboLineRecord {
  id: string;
  deckId: string;
  name: string;
  graph: DeckComboGraph;
  position: number;
  updatedAt: string;
}

const END_LANES = new Set<ComboLane>(["boss", "material", "trap", "spell", "gy", "banish"]);

export type EndBoardLane = "boss" | "material" | "trap" | "spell" | "gy" | "banish";

export type ComboPlacement =
  | { kind: "hand" }
  | { kind: "play"; rowId: string }
  | { kind: "end"; lane: EndBoardLane };

function newId(): string {
  return crypto.randomUUID();
}

/** A named line starts with one empty play row between the hand and the end board. */
export function blankDeckComboGraph(playRowId: string = newId()): DeckComboGraph {
  return {
    playRows: [{ id: playRowId }],
    nodes: [],
    edges: [],
    endboardSummary: "",
    positions: {},
    disruptedNodeIds: [],
  };
}

export function flowRowY(playRows: readonly { id: string }[], placement: ComboPlacement): number {
  if (placement.kind === "hand") return FLOW_ORIGIN_Y;
  if (placement.kind === "play") {
    const index = Math.max(0, playRows.findIndex((row) => row.id === placement.rowId));
    return FLOW_ORIGIN_Y + (index + 1) * FLOW_ROW_STRIDE;
  }
  return FLOW_ORIGIN_Y + (playRows.length + 1) * FLOW_ROW_STRIDE;
}

export function endZoneX(lane: EndBoardLane): number {
  const index = Math.max(0, FLOW_END_LANES.indexOf(lane));
  return FLOW_ORIGIN_X + index * (END_ZONE_W + END_ZONE_GAP);
}

export interface EndZoneFrame {
  lane: EndBoardLane;
  x: number;
  width: number;
}

/** End-board zones grow wide enough for every card in that zone to sit in its own column. */
export function endZoneFrames(graph: DeckComboGraph): EndZoneFrame[] {
  const counts = new Map<EndBoardLane, number>();
  for (const node of graph.nodes) {
    const lane = comboLane(node);
    if (!END_LANES.has(lane)) continue;
    const key = lane as EndBoardLane;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let x = FLOW_ORIGIN_X;
  return FLOW_END_LANES.map((lane) => {
    const count = counts.get(lane) ?? 0;
    const span = count <= 1 ? END_ZONE_W : (count - 1) * FLOW_COL + COMBO_FLOW_CARD_W + 8;
    const width = Math.max(END_ZONE_W, span);
    const frame = { lane, x, width };
    x += width + END_ZONE_GAP;
    return frame;
  });
}

function frameAt(x: number, frames: readonly EndZoneFrame[]): EndZoneFrame {
  const match = frames.find((frame, index) => {
    const next = frames[index + 1];
    const left = index === 0 ? Number.NEGATIVE_INFINITY : frame.x - END_ZONE_GAP / 2;
    const right = next ? next.x - END_ZONE_GAP / 2 : Number.POSITIVE_INFINITY;
    return x >= left && x < right;
  });
  return match ?? frames[0] ?? { lane: "boss", x: FLOW_ORIGIN_X, width: END_ZONE_W };
}

/** Packs end-board cards into columns and shifts later zones out of the way. */
export function reflowEndZones(graph: DeckComboGraph, preferId?: string): DeckComboGraph {
  const frames = endZoneFrames(graph);
  const positions = { ...(graph.positions ?? {}) };
  const y = flowRowY(graph.playRows, { kind: "end", lane: "boss" });
  let changed = false;
  for (const frame of frames) {
    const cards = graph.nodes
      .filter((node) => comboLane(node) === frame.lane)
      .sort((a, b) => {
        const ax = positions[a.id]?.x ?? frame.x;
        const bx = positions[b.id]?.x ?? frame.x;
        if (ax !== bx) return ax - bx;
        if (a.id === preferId) return -1;
        if (b.id === preferId) return 1;
        return (a.order ?? 0) - (b.order ?? 0);
      });
    cards.forEach((node, column) => {
      const next = { x: frame.x + column * FLOW_COL, y };
      const current = positions[node.id];
      if (!current || current.x !== next.x || current.y !== next.y) {
        positions[node.id] = next;
        changed = true;
      }
    });
  }
  return changed ? { ...graph, positions } : graph;
}

/**
 * Packs each opening-hand and play row onto the current column stride.
 * Cards saved on an older, tighter stride keep their left-to-right order and spread apart.
 */
export function reflowBoardColumns(graph: DeckComboGraph): DeckComboGraph {
  const next = reflowEndZones(graph);
  const positions = { ...(next.positions ?? {}) };
  let changed = next !== graph;
  const pack = (ids: string[], y: number) => {
    const sorted = [...ids].sort((a, b) => {
      const ax = positions[a]?.x ?? FLOW_ORIGIN_X;
      const bx = positions[b]?.x ?? FLOW_ORIGIN_X;
      if (ax !== bx) return ax - bx;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    sorted.forEach((id, column) => {
      const packed = { x: FLOW_ORIGIN_X + column * FLOW_COL, y };
      const current = positions[id];
      if (!current || current.x !== packed.x || current.y !== packed.y) {
        positions[id] = packed;
        changed = true;
      }
    });
  };
  pack(
    graph.nodes.filter((node) => comboLane(node) === "hand").map((node) => node.id),
    flowRowY(graph.playRows, { kind: "hand" }),
  );
  for (const row of graph.playRows) {
    pack(
      graph.nodes
        .filter((node) => comboLane(node) === "play" && node.rowId === row.id)
        .map((node) => node.id),
      flowRowY(graph.playRows, { kind: "play", rowId: row.id }),
    );
  }
  return changed ? { ...next, positions } : next;
}

export function slotPosition(
  graph: DeckComboGraph,
  placement: ComboPlacement,
  order: number,
): { x: number; y: number } {
  const y = flowRowY(graph.playRows, placement);
  if (placement.kind === "end") {
    const frame = endZoneFrames(graph).find((item) => item.lane === placement.lane);
    return { x: (frame?.x ?? endZoneX(placement.lane)) + order * FLOW_COL, y };
  }
  return { x: FLOW_ORIGIN_X + order * FLOW_COL, y };
}

/**
 * Screen point of a dragged card's top-left.
 * The cursor is the grab point inside the sidebar tile, so snapping that cursor
 * lands one slot to the right of the tile the player is holding.
 */
export function cardDropScreenPoint(
  client: { x: number; y: number },
  grabOffset?: { x: number; y: number } | null,
): { x: number; y: number } {
  if (!grabOffset) return client;
  return { x: client.x - grabOffset.x, y: client.y - grabOffset.y };
}

/** Snaps a drop point onto the nearest opening-hand, play, or end-board row. */
export function snapFlowPoint(
  graph: DeckComboGraph,
  point: { x: number; y: number },
): { placement: ComboPlacement; position: { x: number; y: number } } {
  const rows: { placement: ComboPlacement; y: number }[] = [
    { placement: { kind: "hand" }, y: flowRowY(graph.playRows, { kind: "hand" }) },
    ...graph.playRows.map((row) => ({
      placement: { kind: "play" as const, rowId: row.id },
      y: flowRowY(graph.playRows, { kind: "play", rowId: row.id }),
    })),
    {
      placement: { kind: "end" as const, lane: "boss" as const },
      y: flowRowY(graph.playRows, { kind: "end", lane: "boss" }),
    },
  ];
  let best = rows[0];
  let distance = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const next = Math.abs(point.y - (row.y + COMBO_FLOW_CARD_H / 2));
    if (next < distance) {
      best = row;
      distance = next;
    }
  }
  if (best.placement.kind === "end") {
    const frame = frameAt(point.x, endZoneFrames(graph));
    const column = Math.max(0, Math.round((point.x - frame.x) / FLOW_COL));
    return {
      placement: { kind: "end", lane: frame.lane },
      position: { x: frame.x + column * FLOW_COL, y: best.y },
    };
  }
  const column = Math.max(0, Math.round((point.x - FLOW_ORIGIN_X) / FLOW_COL));
  return {
    placement: best.placement,
    position: { x: FLOW_ORIGIN_X + column * FLOW_COL, y: best.y },
  };
}

export function placeCardAt(
  graph: DeckComboGraph,
  card: { id: number; name: string },
  point: { x: number; y: number },
  nodeId: string = newId(),
): DeckComboGraph {
  const snapped = snapFlowPoint(graph, point);
  if (dropExceedsOpeningHand(graph, point)) return graph;
  const next = addCardToGraph(graph, snapped.placement, card, nodeId);
  return reflowEndZones(
    { ...next, positions: { ...(next.positions ?? {}), [nodeId]: snapped.position } },
    nodeId,
  );
}

export function moveCardToPoint(
  graph: DeckComboGraph,
  nodeId: string,
  point: { x: number; y: number },
): DeckComboGraph {
  const snapped = snapFlowPoint(graph, point);
  if (dropExceedsOpeningHand(graph, point, nodeId)) return graph;
  const moved = moveNodeInGraph(graph, nodeId, snapped.placement);
  return reflowEndZones(
    { ...moved, positions: { ...(moved.positions ?? {}), [nodeId]: snapped.position } },
    nodeId,
  );
}

function placementOf(node: ComboNode): ComboPlacement | null {
  const lane = comboLane(node);
  if (lane === "hand") return { kind: "hand" };
  if (lane === "play" && node.rowId) return { kind: "play", rowId: node.rowId };
  if (END_LANES.has(lane)) return { kind: "end", lane: lane as EndBoardLane };
  return null;
}

function realignRows(graph: DeckComboGraph): DeckComboGraph {
  const positions = { ...(graph.positions ?? {}) };
  for (const node of graph.nodes) {
    const placement = placementOf(node);
    if (!placement) continue;
    const current = positions[node.id] ?? slotPosition(graph, placement, node.order ?? 0);
    positions[node.id] = { x: current.x, y: flowRowY(graph.playRows, placement) };
  }
  return { ...graph, positions };
}

export function addPlayRowBelow(
  graph: DeckComboGraph,
  rowId: string,
  nextId: string = newId(),
): DeckComboGraph {
  const index = graph.playRows.findIndex((row) => row.id === rowId);
  if (index < 0) return graph;
  const playRows = [...graph.playRows];
  playRows.splice(index + 1, 0, { id: nextId });
  return realignRows({ ...graph, playRows });
}

/** Inserts a play row after `afterRowId`. A null id inserts it under the opening hand. */
export function insertPlayRowAt(
  graph: DeckComboGraph,
  afterRowId: string | null,
  nextId: string = newId(),
): DeckComboGraph {
  if (afterRowId == null) {
    return realignRows({ ...graph, playRows: [{ id: nextId }, ...graph.playRows] });
  }
  return addPlayRowBelow(graph, afterRowId, nextId);
}

/** Removes a play row only when it has no cards and another play row remains. */
export function removeEmptyPlayRow(graph: DeckComboGraph, rowId: string): DeckComboGraph {
  if (graph.playRows.length <= 1) return graph;
  if (!graph.playRows.some((row) => row.id === rowId)) return graph;
  if (graph.nodes.some((node) => node.rowId === rowId)) return graph;
  return realignRows({ ...graph, playRows: graph.playRows.filter((row) => row.id !== rowId) });
}

function placementLane(placement: ComboPlacement): ComboLane {
  if (placement.kind === "hand") return "hand";
  if (placement.kind === "play") return "play";
  return placement.lane;
}

function matchesPlacement(node: ComboNode, placement: ComboPlacement): boolean {
  if (placement.kind === "play") return comboLane(node) === "play" && node.rowId === placement.rowId;
  return comboLane(node) === placementLane(placement);
}

function withOrders(nodes: ComboNode[]): ComboNode[] {
  return nodes.map((node, index) => ({ ...node, order: index }));
}

/** A card already on the hand can still be reordered. A new arrival cannot pass the limit. */
export function openingHandIsFull(graph: DeckComboGraph, movingNodeId?: string): boolean {
  const hand = graph.nodes.filter((node) => comboLane(node) === "hand");
  if (movingNodeId && hand.some((node) => node.id === movingNodeId)) return false;
  return hand.length >= OPENING_HAND_LIMIT;
}

export function dropExceedsOpeningHand(
  graph: DeckComboGraph,
  point: { x: number; y: number },
  movingNodeId?: string,
): boolean {
  return snapFlowPoint(graph, point).placement.kind === "hand" && openingHandIsFull(graph, movingNodeId);
}

export function addCardToGraph(
  graph: DeckComboGraph,
  placement: ComboPlacement,
  card: { id: number; name: string },
  nodeId: string = newId(),
  beforeNodeId?: string,
): DeckComboGraph {
  if (placement.kind === "play" && !graph.playRows.some((row) => row.id === placement.rowId)) {
    return graph;
  }
  if (placement.kind === "hand" && openingHandIsFull(graph)) return graph;
  const lane = placementLane(placement);
  const kind = placement.kind === "hand" ? "hand" : placement.kind === "play" ? "step" : "endboard";
  const node: ComboNode = {
    id: nodeId,
    label: card.name,
    cardName: card.name,
    cardIds: [card.id],
    kind,
    lane,
    order: 0,
    rowId: placement.kind === "play" ? placement.rowId : undefined,
  };
  const siblings = graph.nodes.filter((item) => matchesPlacement(item, placement));
  node.order = siblings.reduce((max, item) => Math.max(max, (item.order ?? 0) + 1), 0);
  const placed = {
    ...graph,
    nodes: [...graph.nodes, node],
    positions: {
      ...(graph.positions ?? {}),
      [nodeId]: slotPosition(graph, placement, node.order),
    },
  };
  if (beforeNodeId) return moveNodeInGraph(placed, nodeId, placement, beforeNodeId);
  return placed;
}

/**
 * Moves a hand, play, or end-board card into a zone.
 * `beforeNodeId` inserts it before that card. Omitting it appends the card.
 */
export function moveNodeInGraph(
  graph: DeckComboGraph,
  nodeId: string,
  placement: ComboPlacement,
  beforeNodeId?: string,
): DeckComboGraph {
  if (beforeNodeId === nodeId) return graph;
  const current = graph.nodes.find((node) => node.id === nodeId);
  if (!current) return graph;
  if (
    current.kind === "interruption" ||
    current.kind === "killer" ||
    current.kind === "choke" ||
    comboLane(current) === "interrupt"
  ) {
    return graph;
  }
  if (placement.kind === "play" && !graph.playRows.some((row) => row.id === placement.rowId)) {
    return graph;
  }
  if (placement.kind === "hand" && openingHandIsFull(graph, nodeId)) return graph;
  const lane = placementLane(placement);
  const kind = placement.kind === "hand" ? "hand" : placement.kind === "play" ? "step" : "endboard";
  const moved: ComboNode = {
    ...current,
    lane,
    kind,
    rowId: placement.kind === "play" ? placement.rowId : undefined,
  };
  const others = graph.nodes.filter((node) => node.id !== nodeId);
  const group = others
    .filter((node) => matchesPlacement(node, placement))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const at = beforeNodeId ? group.findIndex((node) => node.id === beforeNodeId) : group.length;
  group.splice(at < 0 ? group.length : at, 0, moved);
  const ordered = withOrders(group);
  const rest = others.filter((node) => !matchesPlacement(node, placement));
  const index = ordered.findIndex((node) => node.id === nodeId);
  return {
    ...graph,
    nodes: [...rest, ...ordered],
    positions: {
      ...(graph.positions ?? {}),
      [nodeId]: slotPosition(graph, placement, Math.max(0, index)),
    },
  };
}

export function removeNodeFromGraph(graph: DeckComboGraph, nodeId: string): DeckComboGraph {
  const positions = { ...(graph.positions ?? {}) };
  delete positions[nodeId];
  return reflowEndZones({
    ...graph,
    nodes: graph.nodes.filter((node) => node.id !== nodeId),
    edges: graph.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
    positions,
    disruptedNodeIds: (graph.disruptedNodeIds ?? []).filter((id) => id !== nodeId),
  });
}

/** Drops every placed card and link, and leaves one empty play row. */
export function clearComboBoard(graph: DeckComboGraph): DeckComboGraph {
  return {
    ...blankDeckComboGraph(graph.playRows[0]?.id),
    endboardSummary: graph.endboardSummary,
  };
}

/** Removes every empty play row while keeping at least one. */
export function removeEmptyPlayRows(graph: DeckComboGraph): DeckComboGraph {
  const filled = new Set(graph.nodes.map((node) => node.rowId).filter((id): id is string => Boolean(id)));
  const kept = graph.playRows.filter((row) => filled.has(row.id));
  const playRows = kept.length > 0 ? kept : [graph.playRows[0] ?? { id: newId() }];
  if (playRows.length === graph.playRows.length && playRows.every((row, index) => row.id === graph.playRows[index]?.id)) {
    return graph;
  }
  return realignRows({ ...graph, playRows });
}

export function toggleNodeDisruption(graph: DeckComboGraph, nodeId: string): DeckComboGraph {
  const current = graph.disruptedNodeIds ?? [];
  const disruptedNodeIds = current.includes(nodeId)
    ? current.filter((id) => id !== nodeId)
    : [...current, nodeId];
  return { ...graph, disruptedNodeIds };
}

export function toggleEdgeDisruption(graph: DeckComboGraph, fromId: string, toId: string): DeckComboGraph {
  return {
    ...graph,
    edges: graph.edges.map((edge) =>
      edge.from === fromId && edge.to === toId ? { ...edge, isDisruption: !edge.isDisruption } : edge,
    ),
  };
}

/** Cards that come after a disrupted card or a disrupted link. */
export function fizzledNodeIds(graph: DeckComboGraph): Set<string> {
  const roots = new Set<string>(graph.disruptedNodeIds ?? []);
  for (const edge of graph.edges) {
    if (edge.isDisruption) roots.add(edge.from);
  }
  const fizzled = new Set<string>();
  const queue = [...roots];
  const seen = new Set(roots);
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    for (const edge of graph.edges) {
      if (edge.from !== id || seen.has(edge.to)) continue;
      seen.add(edge.to);
      fizzled.add(edge.to);
      queue.push(edge.to);
    }
  }
  return fizzled;
}

export function comboFlowPayload(
  graph: DeckComboGraph,
  cardsById: ReadonlyMap<number, { card_images?: { image_url_small?: string; image_url?: string }[] }>,
  remainingFor: (cardId: number) => number,
): ComboFlowPayload {
  return {
    nodes: graph.nodes
      .filter((node) => node.kind !== "interruption" && node.kind !== "killer" && node.kind !== "choke")
      .map((node) => {
        const cardId = node.cardIds[0] ?? 0;
        const images = cardsById.get(cardId)?.card_images;
        const placement = placementOf(node);
        return {
          id: node.id,
          type: "cardNode" as const,
          position:
            graph.positions?.[node.id] ??
            (placement ? slotPosition(graph, placement, node.order ?? 0) : { x: FLOW_ORIGIN_X, y: FLOW_ORIGIN_Y }),
          data: {
            cardId,
            name: node.cardName ?? node.label,
            imageUrl: images?.[0]?.image_url_small || images?.[0]?.image_url || "",
            currentQuantity: remainingFor(cardId),
          },
        };
      }),
    edges: graph.edges
      .filter((edge) => (edge.relation ?? "play") !== "interrupts")
      .map((edge, index) => ({
        id: `${edge.from}-${edge.to}-${index}`,
        source: edge.from,
        target: edge.to,
        data: { isDisruption: Boolean(edge.isDisruption) },
      })),
  };
}

const PLAY_LANES = new Set<ComboLane>(["hand", "play"]);

/** Play links stay on the hand and play rows. Material links stay on the end board. */
export function linkRelationForLanes(
  from: ComboLane,
  to: ComboLane,
): "play" | "material" | null {
  if (PLAY_LANES.has(from) && PLAY_LANES.has(to)) return "play";
  if (END_LANES.has(from) && END_LANES.has(to)) return "material";
  return null;
}

export function addComboLink(
  graph: DeckComboGraph,
  fromId: string,
  toId: string,
  relation: "play" | "material",
  sides?: { fromSide?: ComboAnchorSide; toSide?: ComboAnchorSide },
): { graph: DeckComboGraph; error: string | null } {
  if (fromId === toId) return { graph, error: "Choose two different cards." };
  const from = graph.nodes.find((node) => node.id === fromId);
  const to = graph.nodes.find((node) => node.id === toId);
  if (!from || !to) return { graph, error: "Choose two cards on this line." };
  const fromLane = comboLane(from);
  const toLane = comboLane(to);
  if (relation === "play" && !(PLAY_LANES.has(fromLane) && PLAY_LANES.has(toLane))) {
    return { graph, error: "Play links stay on the opening hand and play rows." };
  }
  if (relation === "material" && !(END_LANES.has(fromLane) && END_LANES.has(toLane))) {
    return { graph, error: "Material links stay on the end board." };
  }
  const nextEdge: ComboEdge = {
    from: fromId,
    to: toId,
    relation,
    fromSide: sides?.fromSide,
    toSide: sides?.toSide,
  };
  const index = graph.edges.findIndex(
    (edge) => edge.from === fromId && edge.to === toId && (edge.relation ?? "play") === relation,
  );
  if (index >= 0) {
    if (!sides) return { graph, error: null };
    const edges = graph.edges.slice();
    edges[index] = {
      ...edges[index],
      fromSide: sides.fromSide ?? edges[index].fromSide,
      toSide: sides.toSide ?? edges[index].toSide,
    };
    return { graph: { ...graph, edges }, error: null };
  }
  return {
    graph: { ...graph, edges: [...graph.edges, nextEdge] },
    error: null,
  };
}

/** Drops one drawn link. A different relation between the same cards stays. */
export function removeComboLink(
  graph: DeckComboGraph,
  fromId: string,
  toId: string,
  relation: "play" | "material" | "interrupts" = "play",
): DeckComboGraph {
  return {
    ...graph,
    edges: graph.edges.filter(
      (edge) => edge.from !== fromId || edge.to !== toId || (edge.relation ?? "play") !== relation,
    ),
  };
}

export function setEndboardSummary(graph: DeckComboGraph, endboardSummary: string): DeckComboGraph {
  return { ...graph, endboardSummary };
}

/**
 * Saved hand, play, and end-board cards must currently be in the deck.
 * Interruptions are derived at read time and are rejected if a client tries to store them.
 */
export function graphSaveError(
  graph: DeckComboGraph,
  deckCardIds: ReadonlySet<number>,
): string | null {
  if (graph.playRows.length === 0) return "A board needs a play row.";
  const rowIds = new Set(graph.playRows.map((row) => row.id));
  for (const node of graph.nodes) {
    if (
      node.kind === "interruption" ||
      node.kind === "killer" ||
      node.kind === "choke" ||
      comboLane(node) === "interrupt"
    ) {
      return "Interruptions are calculated and are not saved.";
    }
    if (node.kind !== "hand" && node.kind !== "step" && node.kind !== "endboard") {
      return "This board has a card that cannot be saved.";
    }
    const cardId = node.cardIds[0];
    if (cardId == null || !deckCardIds.has(cardId)) {
      return "A saved board can only contain cards from this deck.";
    }
    if (comboLane(node) === "play" && (node.rowId == null || !rowIds.has(node.rowId))) {
      return "A play card is missing its row.";
    }
  }
  return null;
}

/**
 * The document written for one combo board.
 * Ash warnings and other derived marks stay off this object.
 */
export function storedBoardGraph(graph: DeckComboGraph): DeckComboGraph {
  return {
    playRows: graph.playRows.map((row) => ({ id: row.id })),
    nodes: graph.nodes.filter(
      (node) => node.kind !== "interruption" && node.kind !== "killer" && node.kind !== "choke" && comboLane(node) !== "interrupt",
    ),
    edges: graph.edges.filter((edge) => (edge.relation ?? "play") !== "interrupts"),
    endboardSummary: graph.endboardSummary,
    positions: graph.positions,
    disruptedNodeIds: graph.disruptedNodeIds ?? [],
  };
}

/** Cards that were on the board and later cut from the deck stay visible. */
export function missingCardNodeIds(
  graph: DeckComboGraph,
  deckCardIds: ReadonlySet<number>,
): string[] {
  return graph.nodes
    .filter((node) => {
      if (node.kind === "interruption" || node.kind === "killer" || node.kind === "choke") {
        return false;
      }
      const cardId = node.cardIds[0];
      return cardId == null || !deckCardIds.has(cardId);
    })
    .map((node) => node.id);
}

/**
 * Copies a curated template into a builder graph.
 * Cards that are not in this deck are left out. Opponent interruptions are not copied.
 * Returns null when a required template card is missing.
 */
export function graphFromTemplate(
  template: ComboTemplateRow,
  deckCards: DeckCardRef[],
  playRowId: string = newId(),
): DeckComboGraph | null {
  const line = validateComboTemplate(template, deckCards);
  if (!line) return null;
  const idMap = new Map<string, string>();
  const nodes: ComboNode[] = [];
  for (const node of line.nodes) {
    const lane = comboLane(node);
    if (lane === "interrupt" || node.cardIds.length === 0) continue;
    const id = newId();
    idMap.set(node.id, id);
    nodes.push({
      id,
      label: node.cardName ?? node.label,
      cardName: node.cardName ?? node.label,
      cardIds: node.cardIds.slice(0, 1),
      kind: lane === "hand" ? "hand" : lane === "play" ? "step" : "endboard",
      lane,
      order: node.order,
      rowId: lane === "play" ? playRowId : undefined,
    });
  }
  const edges: ComboEdge[] = [];
  for (const edge of line.edges) {
    if ((edge.relation ?? "play") === "interrupts") continue;
    const from = idMap.get(edge.from);
    const to = idMap.get(edge.to);
    if (!from || !to) continue;
    edges.push({ from, to, relation: edge.relation ?? "play" });
  }
  return realignRows({
    playRows: [{ id: playRowId }],
    nodes,
    edges,
    endboardSummary: line.endboardSummary,
    positions: {},
    disruptedNodeIds: [],
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const ANCHOR_SIDES = new Set<ComboAnchorSide>(["top", "right", "bottom", "left"]);

function anchorSide(value: unknown): ComboAnchorSide | undefined {
  return typeof value === "string" && ANCHOR_SIDES.has(value as ComboAnchorSide)
    ? (value as ComboAnchorSide)
    : undefined;
}

/** Reads a stored JSON graph. A broken document opens as one empty play row. */
export function parseDeckComboGraph(value: unknown): DeckComboGraph {
  if (!isRecord(value)) return blankDeckComboGraph();
  const playRows = Array.isArray(value.playRows)
    ? value.playRows.flatMap((row) => {
        if (!isRecord(row) || typeof row.id !== "string" || row.id.length === 0) return [];
        return [{ id: row.id }];
      })
    : [];
  const nodes = Array.isArray(value.nodes)
    ? value.nodes.filter((node): node is ComboNode => {
        if (!isRecord(node)) return false;
        return typeof node.id === "string" && typeof node.label === "string" && Array.isArray(node.cardIds);
      })
    : [];
  const edges = Array.isArray(value.edges)
    ? value.edges.flatMap((edge) => {
        if (!isRecord(edge) || typeof edge.from !== "string" || typeof edge.to !== "string") return [];
        const relation: ComboEdgeRelation =
          edge.relation === "interrupts" || edge.relation === "material" || edge.relation === "play"
            ? edge.relation
            : "play";
        const fromSide = anchorSide(edge.fromSide);
        const toSide = anchorSide(edge.toSide);
        return [
          {
            from: edge.from,
            to: edge.to,
            relation,
            fromSide,
            toSide,
            isDisruption: edge.isDisruption === true,
          },
        ];
      })
    : [];
  const positions: Record<string, { x: number; y: number }> = {};
  if (isRecord(value.positions)) {
    for (const [id, point] of Object.entries(value.positions)) {
      if (isRecord(point) && typeof point.x === "number" && typeof point.y === "number") {
        positions[id] = { x: point.x, y: point.y };
      }
    }
  }
  if (isRecord(value.flow) && Array.isArray(value.flow.nodes)) {
    for (const node of value.flow.nodes) {
      if (!isRecord(node) || typeof node.id !== "string" || !isRecord(node.position)) continue;
      if (typeof node.position.x === "number" && typeof node.position.y === "number" && !positions[node.id]) {
        positions[node.id] = { x: node.position.x, y: node.position.y };
      }
    }
  }
  return {
    playRows: playRows.length > 0 ? playRows : [{ id: newId() }],
    nodes,
    edges,
    endboardSummary: typeof value.endboardSummary === "string" ? value.endboardSummary : "",
    positions,
    disruptedNodeIds: Array.isArray(value.disruptedNodeIds)
      ? value.disruptedNodeIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}
