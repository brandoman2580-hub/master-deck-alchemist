import { ASH_TRAP_NAME, type AshWarning } from "@/lib/combos/ash-warnings";
import type { DeckComboPlayRow } from "@/lib/combos/deck-combo-graph";
import { comboLane, projectComboLine } from "@/lib/engine/combos";
import type {
  ComboAnchorSide,
  ComboEdge,
  ComboEdgeRelation,
  ComboLane,
  ComboLine,
  ComboNode,
} from "@/lib/engine/types";

export const COMBO_CARD_W = 96;
export const COMBO_CARD_H = 140;

const ROW_LABEL = 22;
const ROW_GAP = 72;
const CARD_GAP = 20;
const GROUP_GAP = 36;
const PAD = 8;

const ROW_LANES = ["hand", "play", "interrupt"] as const;

export const END_BOARD_LANES = [
  "boss",
  "material",
  "trap",
  "spell",
  "gy",
  "banish",
] as const satisfies readonly ComboLane[];

export const LANE_LABEL: Record<ComboLane | "end", string> = {
  hand: "Opening hand",
  play: "Play",
  interrupt: "Interruptions",
  end: "End board",
  boss: "Boss",
  material: "XYZ material",
  trap: "Traps",
  spell: "Spells",
  gy: "Graveyard",
  banish: "Banish",
};

export interface PlacedComboNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lane: ComboLane;
  name: string;
  node: ComboNode;
  missing?: boolean;
  placementKey?: string;
  dropIndex?: number;
}

export interface PlacedComboEdge {
  id: string;
  from: string;
  to: string;
  relation: ComboEdgeRelation;
  d: string;
  fromName: string;
  toName: string;
}

export interface PlacedComboLabel {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface ComboDropZone {
  id: string;
  placementKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComboInsertSlot {
  id: string;
  afterRowId: string | null;
  label: string;
  x: number;
  y: number;
  width: number;
}

export interface ComboRowAction {
  id: string;
  rowId: string;
  label: string;
  x: number;
  y: number;
}

export interface ComboBoardLayout {
  width: number;
  height: number;
  nodes: PlacedComboNode[];
  edges: PlacedComboEdge[];
  labels: PlacedComboLabel[];
  dropZones: ComboDropZone[];
  insertSlots: ComboInsertSlot[];
  rowActions: ComboRowAction[];
}

function byOrder(a: ComboNode, b: ComboNode): number {
  return (a.order ?? 0) - (b.order ?? 0);
}

function rowY(index: number): number {
  return PAD + ROW_LABEL + index * (COMBO_CARD_H + ROW_GAP + ROW_LABEL);
}

function nodeName(node: ComboNode): string {
  return node.cardName ?? node.label;
}

function horizontalLink(from: PlacedComboNode, to: PlacedComboNode): string {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

function verticalLink(from: PlacedComboNode, to: PlacedComboNode): string {
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height;
  const x2 = to.x + to.width / 2;
  const y2 = to.y;
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
}

function interruptLink(from: PlacedComboNode, to: PlacedComboNode): string {
  const x1 = from.x + from.width / 2;
  const y1 = from.y;
  const x2 = to.x + to.width / 2;
  const y2 = to.y + to.height;
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
}

function materialLink(from: PlacedComboNode, to: PlacedComboNode): string {
  const x1 = from.x + from.width / 2;
  const y1 = from.y;
  const x2 = to.x + to.width / 2;
  const y2 = to.y;
  const lift = 32;
  return `M ${x1} ${y1} C ${x1} ${y1 - lift}, ${x2} ${y2 - lift}, ${x2} ${y2}`;
}

function anchorPoint(node: PlacedComboNode, side: ComboAnchorSide): { x: number; y: number } {
  if (side === "top") return { x: node.x + node.width / 2, y: node.y };
  if (side === "bottom") return { x: node.x + node.width / 2, y: node.y + node.height };
  if (side === "left") return { x: node.x, y: node.y + node.height / 2 };
  return { x: node.x + node.width, y: node.y + node.height / 2 };
}

function sideLink(
  from: PlacedComboNode,
  to: PlacedComboNode,
  fromSide: ComboAnchorSide,
  toSide: ComboAnchorSide,
): string {
  const start = anchorPoint(from, fromSide);
  const end = anchorPoint(to, toSide);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const control1 = fromSide === "left" || fromSide === "right" ? { x: midX, y: start.y } : { x: start.x, y: midY };
  const control2 = toSide === "left" || toSide === "right" ? { x: midX, y: end.y } : { x: end.x, y: midY };
  return `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`;
}

function edgePath(from: PlacedComboNode, to: PlacedComboNode, edge: ComboEdge, relation: ComboEdgeRelation): string {
  if (edge.fromSide && edge.toSide) return sideLink(from, to, edge.fromSide, edge.toSide);
  return linkPath(from, to, relation);
}

function linkPath(
  from: PlacedComboNode,
  to: PlacedComboNode,
  relation: ComboEdgeRelation,
): string {
  if (relation === "interrupts") return interruptLink(from, to);
  if (relation === "material") return materialLink(from, to);
  if (Math.abs(from.y - to.y) < 4) return horizontalLink(from, to);
  if (from.y + from.height <= to.y) return verticalLink(from, to);
  return interruptLink(from, to);
}

/**
 * Places a projected combo line on a fixed poster: opening hand, play, interruptions, then the end-board lanes.
 */
export function layoutComboBoard(line: ComboLine): ComboBoardLayout {
  const projected = projectComboLine(line);
  const placed: PlacedComboNode[] = [];
  const labels: PlacedComboLabel[] = [];
  let width = PAD;

  ROW_LANES.forEach((lane, rowIndex) => {
    const y = rowY(rowIndex);
    labels.push({
      id: `label-${lane}`,
      text: LANE_LABEL[lane],
      x: PAD,
      y: y - ROW_LABEL,
    });
    const row = projected.nodes.filter((node) => comboLane(node) === lane).sort(byOrder);
    row.forEach((node, index) => {
      const x = PAD + index * (COMBO_CARD_W + CARD_GAP);
      placed.push({
        id: node.id,
        x,
        y,
        width: COMBO_CARD_W,
        height: COMBO_CARD_H,
        lane,
        name: nodeName(node),
        node,
      });
      width = Math.max(width, x + COMBO_CARD_W + PAD);
    });
  });

  const byId = new Map(placed.map((node) => [node.id, node]));
  const interruptY = rowY(2);
  const usedX = new Map<number, number>();
  for (const node of placed.filter((item) => item.lane === "interrupt")) {
    const targetId = projected.edges.find(
      (edge) => edge.from === node.id && (edge.relation ?? "play") === "interrupts",
    )?.to;
    const target = targetId ? byId.get(targetId) : undefined;
    if (!target) continue;
    const stack = usedX.get(target.x) ?? 0;
    usedX.set(target.x, stack + 1);
    node.x = target.x + stack * (COMBO_CARD_W + 8);
    node.y = interruptY;
    width = Math.max(width, node.x + COMBO_CARD_W + PAD);
  }

  const endY = rowY(3);
  labels.push({
    id: "label-end",
    text: LANE_LABEL.end,
    x: PAD,
    y: endY - ROW_LABEL,
  });
  let cursor = PAD;
  for (const lane of END_BOARD_LANES) {
    labels.push({
      id: `label-${lane}`,
      text: LANE_LABEL[lane],
      x: cursor,
      y: endY - 2,
    });
    const group = projected.nodes.filter((node) => comboLane(node) === lane).sort(byOrder);
    if (group.length === 0) {
      labels.push({
        id: `empty-${lane}`,
        text: "—",
        x: cursor,
        y: endY + 16,
      });
    }
    const cards = group.length > 0 ? group : [null];
    cards.forEach((node, index) => {
      const x = cursor + index * (COMBO_CARD_W + CARD_GAP);
      if (node) {
        placed.push({
          id: node.id,
          x,
          y: endY + 16,
          width: COMBO_CARD_W,
          height: COMBO_CARD_H,
          lane,
          name: nodeName(node),
          node,
        });
      }
      width = Math.max(width, x + COMBO_CARD_W + PAD);
    });
    const span = Math.max(cards.length, 1) * (COMBO_CARD_W + CARD_GAP) - CARD_GAP;
    cursor += span + GROUP_GAP;
  }

  const placedById = new Map(placed.map((node) => [node.id, node]));
  const edges: PlacedComboEdge[] = [];
  projected.edges.forEach((edge, index) => {
    const from = placedById.get(edge.from);
    const to = placedById.get(edge.to);
    if (!from || !to) return;
    const relation = edge.relation ?? "play";
    edges.push({
      id: `${edge.from}-${edge.to}-${relation}-${index}`,
      from: edge.from,
      to: edge.to,
      relation,
      d: edgePath(from, to, edge, relation),
      fromName: from.name,
      toName: to.name,
    });
  });

  const height = endY + 16 + COMBO_CARD_H + PAD;
  return {
    width: Math.max(width, cursor),
    height,
    nodes: placed,
    edges,
    labels,
    dropZones: [],
    insertSlots: [],
    rowActions: [],
  };
}

const WARNING_H = 88;
const WARNING_GAP = 40;

export interface BuilderBoardInput {
  playRows: DeckComboPlayRow[];
  nodes: ComboNode[];
  edges: ComboEdge[];
  warnings: AshWarning[];
  missingNodeIds?: ReadonlySet<string>;
}

function placeCards(
  nodes: ComboNode[],
  y: number,
  lane: ComboLane,
  missingNodeIds: ReadonlySet<string>,
  placementKey: string,
  originX = PAD,
): PlacedComboNode[] {
  return [...nodes].sort(byOrder).map((node, index) => ({
    id: node.id,
    x: originX + index * (COMBO_CARD_W + CARD_GAP),
    y,
    width: COMBO_CARD_W,
    height: COMBO_CARD_H,
    lane,
    name: node.cardName ?? node.label,
    node,
    missing: missingNodeIds.has(node.id),
    placementKey,
    dropIndex: index,
  }));
}

function dropSpan(count: number): number {
  return Math.max(count, 1) * (COMBO_CARD_W + CARD_GAP) + COMBO_CARD_W;
}

function warningNodes(
  row: PlacedComboNode[],
  warnings: AshWarning[],
  y: number,
): { nodes: PlacedComboNode[]; edges: ComboEdge[] } {
  const nodes: PlacedComboNode[] = [];
  const edges: ComboEdge[] = [];
  row.forEach((step) => {
    const warning = warnings.find((item) => item.stepNodeId === step.id);
    if (!warning) return;
    const id = `ash-${step.id}`;
    const node: ComboNode = {
      id,
      label: "Ash Blossom",
      cardName: ASH_TRAP_NAME,
      cardIds: [],
      kind: "interruption",
      lane: "interrupt",
    };
    nodes.push({
      id,
      x: step.x,
      y,
      width: COMBO_CARD_W,
      height: WARNING_H,
      lane: "interrupt",
      name: ASH_TRAP_NAME,
      node,
    });
    edges.push({ from: id, to: step.id, relation: "interrupts" });
  });
  return { nodes, edges };
}

/**
 * Opening hand, then each play row the player inserted, then the end board.
 * Ash warnings hang under the step they match and are not stored on the graph.
 */
export function layoutBuilderBoard(input: BuilderBoardInput): ComboBoardLayout {
  const missingNodeIds = input.missingNodeIds ?? new Set<string>();
  const warnings = input.warnings;
  const playRows = input.playRows.length > 0 ? input.playRows : [{ id: "play-1" }];
  const placed: PlacedComboNode[] = [];
  const labels: PlacedComboLabel[] = [];
  const dropZones: ComboDropZone[] = [];
  const insertSlots: ComboInsertSlot[] = [];
  const rowActions: ComboRowAction[] = [];
  const derivedEdges: ComboEdge[] = [];
  let width = PAD;
  let y = PAD + ROW_LABEL;

  const noteWidth = (cards: PlacedComboNode[]) => {
    for (const card of cards) width = Math.max(width, card.x + card.width + PAD);
  };

  const pushGap = (afterRowId: string | null, label: string, gapTop: number) => {
    insertSlots.push({
      id: afterRowId ? `insert-after-${afterRowId}` : "insert-after-hand",
      afterRowId,
      label,
      x: PAD,
      y: gapTop + 8,
      width: 280,
    });
  };

  const hand = input.nodes.filter((node) => comboLane(node) === "hand");
  labels.push({ id: "label-hand", text: LANE_LABEL.hand, x: PAD, y: y - ROW_LABEL });
  const handPlaced = placeCards(hand, y, "hand", missingNodeIds, "hand");
  if (handPlaced.length === 0) {
    labels.push({ id: "empty-hand", text: "—", x: PAD, y });
  }
  dropZones.push({
    id: "drop-hand",
    placementKey: "hand",
    x: PAD,
    y,
    width: dropSpan(handPlaced.length),
    height: COMBO_CARD_H,
  });
  placed.push(...handPlaced);
  noteWidth(handPlaced);
  const handWarnings = warningNodes(handPlaced, warnings, y + COMBO_CARD_H + WARNING_GAP);
  const handWarned = handWarnings.nodes.length > 0;
  placed.push(...handWarnings.nodes);
  derivedEdges.push(...handWarnings.edges);
  noteWidth(handWarnings.nodes);
  const handGap = y + COMBO_CARD_H + (handWarned ? WARNING_GAP + WARNING_H : 0);
  pushGap(null, "Add row below opening hand", handGap);
  y += COMBO_CARD_H + (handWarned ? WARNING_GAP + WARNING_H : 0) + ROW_GAP + ROW_LABEL;

  playRows.forEach((row, index) => {
    const steps = input.nodes.filter(
      (node) => comboLane(node) === "play" && (node.rowId ?? playRows[0]?.id) === row.id,
    );
    labels.push({ id: `label-play-${row.id}`, text: `Play ${index + 1}`, x: PAD, y: y - ROW_LABEL });
    const stepPlaced = placeCards(steps, y, "play", missingNodeIds, `play:${row.id}`);
    if (stepPlaced.length === 0) {
      labels.push({ id: `empty-play-${row.id}`, text: "—", x: PAD, y });
      if (playRows.length > 1) {
        rowActions.push({
          id: `remove-${row.id}`,
          rowId: row.id,
          label: `Remove play ${index + 1}`,
          x: PAD + 88,
          y: y - ROW_LABEL,
        });
      }
    }
    dropZones.push({
      id: `drop-play-${row.id}`,
      placementKey: `play:${row.id}`,
      x: PAD,
      y,
      width: dropSpan(stepPlaced.length),
      height: COMBO_CARD_H,
    });
    placed.push(...stepPlaced);
    noteWidth(stepPlaced);
    const rowWarnings = warningNodes(stepPlaced, warnings, y + COMBO_CARD_H + WARNING_GAP);
    const warned = rowWarnings.nodes.length > 0;
    placed.push(...rowWarnings.nodes);
    derivedEdges.push(...rowWarnings.edges);
    noteWidth(rowWarnings.nodes);
    const gapTop = y + COMBO_CARD_H + (warned ? WARNING_GAP + WARNING_H : 0);
    pushGap(row.id, `Add row below play ${index + 1}`, gapTop);
    y += COMBO_CARD_H + (warned ? WARNING_GAP + WARNING_H : 0) + ROW_GAP + ROW_LABEL;
  });

  const endY = y;
  labels.push({ id: "label-end", text: LANE_LABEL.end, x: PAD, y: endY - ROW_LABEL });
  let cursor = PAD;
  for (const lane of END_BOARD_LANES) {
    labels.push({ id: `label-${lane}`, text: LANE_LABEL[lane], x: cursor, y: endY });
    const group = input.nodes.filter((node) => comboLane(node) === lane).sort(byOrder);
    if (group.length === 0) {
      labels.push({ id: `empty-${lane}`, text: "—", x: cursor, y: endY + 16 });
    }
    const laneCards = placeCards(group, endY + 16, lane, missingNodeIds, `end:${lane}`, cursor);
    placed.push(...laneCards);
    noteWidth(laneCards);
    const span = Math.max(group.length, 1) * (COMBO_CARD_W + CARD_GAP) - CARD_GAP;
    dropZones.push({
      id: `drop-${lane}`,
      placementKey: `end:${lane}`,
      x: cursor,
      y: endY + 16,
      width: Math.max(span, COMBO_CARD_W) + COMBO_CARD_W,
      height: COMBO_CARD_H,
    });
    cursor += span + GROUP_GAP;
  }

  const placedById = new Map(placed.map((node) => [node.id, node]));
  const edges: PlacedComboEdge[] = [];
  [...input.edges, ...derivedEdges].forEach((edge, index) => {
    if ((edge.relation ?? "play") === "interrupts" && !edge.from.startsWith("ash-")) return;
    const from = placedById.get(edge.from);
    const to = placedById.get(edge.to);
    if (!from || !to) return;
    const relation = edge.relation ?? "play";
    edges.push({
      id: `${edge.from}-${edge.to}-${relation}-${index}`,
      from: edge.from,
      to: edge.to,
      relation,
      d: edgePath(from, to, edge, relation),
      fromName: from.name,
      toName: to.name,
    });
  });

  const height = endY + 16 + COMBO_CARD_H + PAD;
  return {
    width: Math.max(width, cursor),
    height,
    nodes: placed,
    edges,
    labels,
    dropZones,
    insertSlots,
    rowActions,
  };
}
