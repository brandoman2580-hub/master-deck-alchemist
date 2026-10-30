"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionLineType,
  ConnectionMode,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  getSmoothStepPath,
  useConnection,
  useReactFlow,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AlertTriangle, Maximize2, Minus, Plus, RotateCcw, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CardImage } from "@/components/ui/card-image";
import { LANE_LABEL } from "@/components/mda/combo-board-layout";
import {
  COMBO_FLOW_CARD_H,
  COMBO_FLOW_CARD_W,
  COMBO_FLOW_COL,
  END_ZONE_W,
  FLOW_ORIGIN_X,
  cardDropScreenPoint,
  endZoneFrames,
  flowRowY,
  reflowBoardColumns,
  fizzledNodeIds,
  type DeckComboGraph,
} from "@/lib/combos/deck-combo-graph";
import { ashClausePhrase, ashWarningsForSteps, type AshClause } from "@/lib/combos/ash-warnings";
import { comboLane } from "@/lib/engine/combos";
import type { ComboAnchorSide, ComboEdgeRelation } from "@/lib/engine/types";
import type { DeckCard } from "@/types/deck";
import { cn } from "@/lib/utils";

const KEYBOARD_RING = "focus-visible:shadow-[0_0_0_2px_#eef3f6,0_0_0_4px_#0c0e12]";
const ICON_BUTTON = `grid h-9 w-9 place-items-center text-[#0c0e12] transition-colors hover:bg-[#0c0e12] hover:text-[#eef3f6] ${KEYBOARD_RING}`;
/** Screen pixels kept clear under the top-left view controls and the top-right board name. */
const VIEW_CHROME_TOP = 72;
/** React Flow's node drag listener reads `document` through a path jsdom leaves null. */
const CARD_DRAGGABLE = process.env.NODE_ENV !== "test";
/** Every link, including the line while it is being drawn, uses this stroke and arrow. */
const LINK_STROKE = 1.5;
const MIN_SCALE = 0.45;
const MAX_SCALE = 1.8;
const ANCHOR_SIDES: ComboAnchorSide[] = ["top", "right", "bottom", "left"];
const HANDLE_DOT =
  "nodrag nopan !z-20 !h-3 !w-3 !min-h-0 !min-w-0 !rounded-full !border !border-[#0c0e12] !bg-[#eef3f6] opacity-0 transition-[background-color,opacity] duration-150 group-hover:opacity-100 focus-visible:opacity-100 hover:!bg-[#0c0e12] hover:outline hover:outline-2 hover:outline-[#0c0e12] hover:outline-offset-2";

function anchorSide(id: string | null | undefined): ComboAnchorSide | null {
  if (id === "top" || id === "right" || id === "bottom" || id === "left") return id;
  return null;
}

const RELATION_WORD: Record<string, string> = {
  play: "plays to",
  interrupts: "interrupts",
  material: "is material for",
};

type CardNodeData = {
  name: string;
  laneLabel: string;
  card?: DeckCard;
  missing: boolean;
  disrupted: boolean;
  fizzled: boolean;
  selected: boolean;
  linkable: boolean;
  ashClause: AshClause | null;
  armedHandle: { nodeId: string; side: ComboAnchorSide } | null;
  nodeId: string;
  onSelect?: (nodeId: string) => void;
  onArmHandle?: (nodeId: string, side: ComboAnchorSide) => void;
};

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function ashNote(clause: AshClause): string {
  return `If the opponent uses Ash Blossom here, this effect is negated because it ${ashClausePhrase(clause)}. Everything played after this card stops unless another card on the hand or a play row answers it.`;
}

function ComboCardNode({ data }: NodeProps): ReactNode {
  const card = data as unknown as CardNodeData;
  const connecting = useConnection((state) => state.inProgress);
  const fromKey = useConnection((state) => (state.fromHandle ? `${state.fromHandle.nodeId}:${state.fromHandle.id ?? ""}` : ""));
  const toKey = useConnection((state) => (state.toHandle ? `${state.toHandle.nodeId}:${state.toHandle.id ?? ""}` : ""));
  const note = card.ashClause ? ashNote(card.ashClause) : "";
  const frame = (
    <button
      type="button"
      data-combo-card
      data-node-id={card.nodeId}
      data-ash-warning={card.ashClause ? "true" : undefined}
      aria-label={`${card.name}, ${card.laneLabel}${card.missing ? ", missing from this deck" : ""}`}
      className={cn(
        "combo-card-drag nopan absolute inset-0 cursor-grab overflow-hidden border bg-[#0c0e12] text-left active:cursor-grabbing",
        card.disrupted
          ? "border-[#8f2d2d] shadow-[0_0_0_2px_#8f2d2d,0_3px_6px_rgb(12_14_18/0.3),0_12px_22px_rgb(12_14_18/0.24)]"
          : card.ashClause
            ? "border-[#e6b325] shadow-[0_0_0_2px_#e6b325,0_0_0_4px_#0c0e12,0_3px_6px_rgb(12_14_18/0.3),0_12px_22px_rgb(12_14_18/0.24)]"
            : card.selected
              ? "border-[#28303b] shadow-[0_0_0_2px_#0c0e12,0_3px_6px_rgb(12_14_18/0.3),0_12px_22px_rgb(12_14_18/0.24)]"
              : "border-[#28303b] shadow-[0_3px_6px_rgb(12_14_18/0.3),0_12px_22px_rgb(12_14_18/0.24)]",
        KEYBOARD_RING,
      )}
      onClick={() => card.onSelect?.(card.nodeId)}
    >
      {card.card ? (
        <CardImage card={card.card} preferSmall fill alt="" className="pointer-events-none object-cover" sizes="96px" />
      ) : null}
      {card.disrupted ? (
        <span className="pointer-events-none absolute right-1 top-1 bg-[#8f2d2d] px-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#eef3f6]">
          Stop
        </span>
      ) : null}
    </button>
  );
  return (
    <div className="group relative h-full w-full" style={{ opacity: card.fizzled ? 0.4 : 1 }}>
      {frame}
      {card.ashClause ? (
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                className={`nodrag nopan absolute -left-2 -top-2 z-20 grid h-6 w-6 place-items-center border border-[#0c0e12] bg-[#e6b325] text-[#0c0e12] ${KEYBOARD_RING}`}
                aria-label={note}
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                sideOffset={8}
                className="z-[100] max-w-56 border border-[#28303b] bg-[#f7fcff] px-2 py-1.5 text-left font-spaceGrotesk text-xs leading-snug text-[#0c0e12]"
              >
                {note}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ) : null}
      {card.linkable
        ? ANCHOR_SIDES.map((side) => {
            const armed =
              (card.armedHandle?.nodeId === card.nodeId && card.armedHandle.side === side) ||
              fromKey === `${card.nodeId}:${side}` ||
              toKey === `${card.nodeId}:${side}`;
            const shown = connecting || armed;
            return (
              <span key={side}>
                <Handle
                  type="target"
                  id={side}
                  position={sidePosition(side)}
                  isConnectableStart={false}
                  aria-hidden
                  className="pointer-events-none !h-3 !w-3 !opacity-0"
                />
                <Handle
                  type="source"
                  id={side}
                  position={sidePosition(side)}
                  isConnectableEnd
                  aria-label={`Link from the ${side} of ${card.name}`}
                  aria-pressed={armed}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    HANDLE_DOT,
                    KEYBOARD_RING,
                    shown && "opacity-100",
                    armed && "!bg-[#0c0e12] outline outline-2 outline-[#0c0e12] outline-offset-2",
                  )}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.currentTarget.click();
                  }}
                />
              </span>
            );
          })
        : null}
    </div>
  );
}

function ComboRowNode({ data }: NodeProps): ReactNode {
  const label = data as unknown as { text: string };
  return (
    <p className="pointer-events-none whitespace-nowrap text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4754]">
      {label.text}
    </p>
  );
}

function ComboZoneNode({ data }: NodeProps): ReactNode {
  const zone = data as unknown as { label: string };
  return (
    <div className="pointer-events-none flex h-full w-full flex-col">
      <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4754]">{zone.label}</p>
      <div className="min-h-0 flex-1 border border-dashed border-[#3d4754]" />
    </div>
  );
}

function ComboRowControlsNode({ data }: NodeProps): ReactNode {
  const row = data as unknown as {
    revealed: boolean;
    addLabel: string;
    removeLabel?: string;
    onAdd?: () => void;
    onRemove?: () => void;
  };
  const shown = row.revealed ? "opacity-100" : "opacity-0";
  return (
    <div className="nodrag nopan flex h-full items-center gap-1">
      <button
        type="button"
        aria-label={row.addLabel}
        title={row.addLabel}
        className={cn(ICON_BUTTON, "h-7 w-7 border border-[#28303b] bg-[#f7fcff]", shown)}
        onClick={row.onAdd}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
      {row.onRemove ? (
        <button
          type="button"
          aria-label={row.removeLabel}
          title={row.removeLabel}
          className={cn(ICON_BUTTON, "h-7 w-7 border border-[#28303b] bg-[#f7fcff]", shown)}
          onClick={row.onRemove}
        >
          <Minus className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function sidePosition(side: ComboAnchorSide): Position {
  if (side === "left") return Position.Left;
  if (side === "right") return Position.Right;
  if (side === "top") return Position.Top;
  return Position.Bottom;
}

function linkAnchor(origin: { x: number; y: number }, side: ComboAnchorSide): { x: number; y: number } {
  if (side === "left") return { x: origin.x, y: origin.y + COMBO_FLOW_CARD_H / 2 };
  if (side === "right") return { x: origin.x + COMBO_FLOW_CARD_W, y: origin.y + COMBO_FLOW_CARD_H / 2 };
  if (side === "top") return { x: origin.x + COMBO_FLOW_CARD_W / 2, y: origin.y };
  return { x: origin.x + COMBO_FLOW_CARD_W / 2, y: origin.y + COMBO_FLOW_CARD_H };
}

function ComboLinkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps): ReactNode {
  const link = (data ?? {}) as {
    fromSide?: ComboAnchorSide;
    toSide?: ComboAnchorSide;
    from?: { x: number; y: number };
    to?: { x: number; y: number };
    fromName?: string;
    toName?: string;
    onRemove?: () => void;
  };
  const fromSide = link.fromSide ?? "bottom";
  const toSide = link.toSide ?? "top";
  const source = link.from ? linkAnchor(link.from, fromSide) : { x: sourceX, y: sourceY };
  const target = link.to ? linkAnchor(link.to, toSide) : { x: targetX, y: targetY };
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    sourcePosition: link.from ? sidePosition(fromSide) : sourcePosition,
    targetPosition: link.to ? sidePosition(toSide) : targetPosition,
    borderRadius: 0,
  });
  const fromName = link.fromName ?? "the first card";
  const toName = link.toName ?? "the second card";
  const removeLabel = `Remove link from ${fromName} to ${toName}`;
  return (
    <g data-from-side={fromSide} data-to-side={toSide} className="group">
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerEnd={markerEnd}
        interactionWidth={28}
      />
      <foreignObject
        x={labelX - 14}
        y={labelY - 14}
        width={28}
        height={28}
        className="overflow-visible"
      >
        <button
          type="button"
          aria-label={removeLabel}
          title={removeLabel}
          className={cn(
            "pointer-events-none grid h-7 w-7 place-items-center border border-[#28303b] bg-[#f7fcff] text-[#0c0e12] opacity-0 transition-[opacity,background-color,color] hover:bg-[#0c0e12] hover:text-[#eef3f6] group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100",
            KEYBOARD_RING,
          )}
          onClick={(event) => {
            event.stopPropagation();
            link.onRemove?.();
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </foreignObject>
    </g>
  );
}

function ComboConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition }: ConnectionLineComponentProps): ReactNode {
  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
    borderRadius: 0,
  });
  return (
    <g>
      <path d={path} fill="none" stroke="#0c0e12" strokeWidth={LINK_STROKE} markerEnd="url(#combo-connection-arrow)" />
      <defs>
        <marker
          id="combo-connection-arrow"
          markerWidth="12.5"
          markerHeight="12.5"
          viewBox="-10 -10 20 20"
          markerUnits="strokeWidth"
          orient="auto-start-reverse"
          refX="0"
          refY="0"
        >
          <polyline points="-5,-4 0,0 -5,4 -5,-4" fill="#0c0e12" stroke="#0c0e12" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
    </g>
  );
}

const nodeTypes = {
  comboCard: ComboCardNode,
  comboRow: ComboRowNode,
  comboZone: ComboZoneNode,
  comboRowControls: ComboRowControlsNode,
};
const edgeTypes = { comboLink: ComboLinkEdge };

function edgeId(from: string, to: string, relation: ComboEdgeRelation): string {
  return `${from}-${to}-${relation}`;
}

export interface ComboBoardProps {
  graph: DeckComboGraph;
  cardsById: ReadonlyMap<number, DeckCard>;
  missingNodeIds?: ReadonlySet<string>;
  selectedNodeId?: string | null;
  armedHandle?: { nodeId: string; side: ComboAnchorSide } | null;
  onSelectNode?: (nodeId: string) => void;
  onSelectEdge?: (edgeId: string) => void;
  selectedEdgeId?: string | null;
  onRemoveLinks?: (links: { source: string; target: string; relation: ComboEdgeRelation }[]) => void;
  onDropCard?: (card: { id: number; name: string }, point: { x: number; y: number }) => void;
  onMoveNode?: (nodeId: string, point: { x: number; y: number }) => void;
  onReturnNode?: (nodeId: string) => void;
  onConnectCards?: (source: string, target: string, fromSide: ComboAnchorSide, toSide: ComboAnchorSide) => void;
  onAddRow?: (afterRowId: string | null) => void;
  onRemoveRow?: (rowId: string) => void;
  onClear?: () => void;
  onArmHandle?: (nodeId: string, side: ComboAnchorSide) => void;
  onDisarmHandle?: () => void;
  boardName?: string;
  onRenameBoard?: (name: string) => void;
}

function BoardName({ name, onRename }: { name: string; onRename?: (name: string) => void }): ReactNode {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const skipCommit = useRef(false);
  const open = () => {
    setDraft(name);
    setEditing(true);
  };
  const commit = () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === name) {
      setDraft(name);
      return;
    }
    onRename?.(trimmed);
  };
  if (editing) {
    return (
      <input
        aria-label="Combo board name"
        className={`nodrag nopan w-56 border border-[#0c0e12] bg-[#0c0e12] px-3 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#eef3f6] ${KEYBOARD_RING}`}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (skipCommit.current) {
            skipCommit.current = false;
            return;
          }
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            skipCommit.current = true;
            setDraft(name);
            setEditing(false);
          }
        }}
      />
    );
  }
  const label = name.trim() || "Name this board";
  return (
    <button
      type="button"
      className={`nodrag nopan max-w-64 truncate border border-[#0c0e12] bg-[#0c0e12] px-3 py-2 text-left text-sm font-semibold uppercase tracking-[0.12em] text-[#eef3f6] ${KEYBOARD_RING}`}
      aria-label={name.trim() ? `Combo board name, ${name}. Click to rename.` : "Name this board"}
      title="Click to rename"
      onClick={open}
    >
      {label}
    </button>
  );
}

type DragHold = { id: string; position: { x: number; y: number } };

/** True when the dragged card's screen box crosses the deck-list drop zone. */
export function cardOverlapsPool(
  card: { left: number; top: number; right: number; bottom: number },
  pool: { left: number; top: number; right: number; bottom: number } | null,
): boolean {
  if (!pool) return false;
  return card.left < pool.right && card.right > pool.left && card.top < pool.bottom && card.bottom > pool.top;
}

type GhostBox = { left: number; top: number; width: number; height: number; visible: boolean };
type GrabOffset = { x: number; y: number; width: number; height: number };

/** The canvas clips at the deck list, so the preview follows the pointer instead of the node. */
export function ghostFrame(
  pointer: { x: number; y: number },
  grab: GrabOffset,
  pool: { left: number; top: number; right: number; bottom: number } | null,
): GhostBox {
  const left = pointer.x - grab.x;
  const top = pointer.y - grab.y;
  return {
    left,
    top,
    width: grab.width,
    height: grab.height,
    visible: cardOverlapsPool(
      { left, top, right: left + grab.width, bottom: top + grab.height },
      pool,
    ),
  };
}

function paintGhost(ghost: HTMLDivElement | null, box: GhostBox | null) {
  if (!ghost || !box) return;
  ghost.style.left = `${box.left}px`;
  ghost.style.top = `${box.top}px`;
  ghost.style.width = `${box.width}px`;
  ghost.style.height = `${box.height}px`;
  ghost.style.visibility = box.visible ? "visible" : "hidden";
}

function markPoolDrop(active: boolean) {
  const pool = document.querySelector("[data-combo-pool]");
  if (!pool) return;
  if (active) pool.setAttribute("data-drop-active", "true");
  else pool.removeAttribute("data-drop-active");
}

/** The saved layout rebuilds while a card is moving. Keep that card at the pointer. */
export function holdDraggedCard(layout: Node[], drag: DragHold | null): Node[] {
  if (!drag) return layout;
  return layout.map((node) =>
    node.id === drag.id ? { ...node, position: { x: drag.position.x, y: drag.position.y }, dragging: true } : node,
  );
}

function CardDragGhost({
  name,
  card,
  armed,
  ghostRef,
}: {
  name: string;
  card?: DeckCard;
  armed: boolean;
  ghostRef: (node: HTMLDivElement | null) => void;
}): ReactNode {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ghostRef}
      data-combo-drag-ghost
      aria-hidden
      style={{ visibility: "hidden" }}
      className={cn(
        "pointer-events-none fixed z-[80] overflow-hidden border border-[#0c0e12] bg-[#0c0e12] shadow-[0_16px_36px_rgb(12_14_18/0.45)]",
        armed && "rotate-[1.5deg] shadow-[0_22px_44px_rgb(12_14_18/0.55)] ring-2 ring-[#0c0e12] ring-offset-2 ring-offset-[#eef3f6]",
      )}
    >
      {card ? (
        <CardImage card={card} preferSmall fill alt="" className="object-cover" sizes="96px" />
      ) : (
        <span className="flex h-full items-end p-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#eef3f6]">{name}</span>
      )}
    </div>,
    document.body,
  );
}

function ComboFlow({
  graph,
  cardsById,
  missingNodeIds,
  selectedNodeId = null,
  armedHandle = null,
  onSelectNode,
  onSelectEdge,
  selectedEdgeId = null,
  onRemoveLinks,
  onDropCard,
  onMoveNode,
  onReturnNode,
  onConnectCards,
  onAddRow,
  onRemoveRow,
  onClear,
  onArmHandle,
  onDisarmHandle,
  boardName = "",
  onRenameBoard,
}: ComboBoardProps): ReactNode {
  const frameRef = useRef<HTMLDivElement>(null);
  const { getViewport, setViewport, screenToFlowPosition, fitView } = useReactFlow();
  const fizzled = useMemo(() => fizzledNodeIds(graph), [graph]);
  const ashByNode = useMemo(() => {
    const next = new Map<string, AshClause>();
    for (const warning of ashWarningsForSteps(graph.nodes, cardsById)) next.set(warning.stepNodeId, warning.clause);
    return next;
  }, [graph.nodes, cardsById]);
  const laidOut = useMemo(() => reflowBoardColumns(graph), [graph]);
  const playRows = graph.playRows.length > 0 ? graph.playRows : [{ id: "play-1" }];
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);

  const trackRow = (clientX: number, clientY: number) => {
    const point = screenToFlowPosition({ x: clientX, y: clientY });
    const rows = [
      { id: "hand", y: flowRowY(playRows, { kind: "hand" }) },
      ...playRows.map((row) => ({ id: row.id, y: flowRowY(playRows, { kind: "play", rowId: row.id }) })),
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
    const next = distance <= COMBO_FLOW_CARD_H ? (best?.id ?? null) : null;
    if (hoverRef.current === next) return;
    hoverRef.current = next;
    setHoverRow(next);
  };

  const fit = () => {
    const frame = frameRef.current;
    if (!frame) return;
    const height = flowRowY(playRows, { kind: "end", lane: "boss" }) + COMBO_FLOW_CARD_H + 48;
    const frames = endZoneFrames(graph);
    const last = frames[frames.length - 1];
    const width = (last ? last.x + last.width : END_ZONE_W) + 32;
    const pad = 32;
    const scale = clampScale(
      Math.min(1, (frame.clientWidth - pad) / width, (frame.clientHeight - pad - VIEW_CHROME_TOP) / height),
    );
    // The top band is reserved for the view controls and the board name.
    // "Opening hand" starts below that band at the default zoom.
    setViewport({ zoom: scale, x: 16, y: VIEW_CHROME_TOP });
  };

  useLayoutEffect(() => {
    fit();
    // Refit when the row count changes. `fit` reads the live frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playRows.length]);

  const cardLayout = useMemo(() => {
    const endY = flowRowY(playRows, { kind: "end", lane: "boss" });
    const rowChrome = (id: string, y: number, addLabel: string, removeLabel?: string, onRemove?: () => void): Node => ({
      id: `controls-${id}`,
      type: "comboRowControls",
      position: { x: 4, y },
      width: 68,
      height: COMBO_FLOW_CARD_H,
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      style: { width: 68, height: COMBO_FLOW_CARD_H, pointerEvents: "all", zIndex: 6 },
      data: {
        revealed: false,
        addLabel,
        removeLabel,
        onAdd: () => onAddRow?.(id === "hand" ? null : id),
        onRemove,
      },
    });
    const next: Node[] = [
      rowChrome("hand", flowRowY(playRows, { kind: "hand" }), "Add a row below the opening hand"),
      {
        id: "label-hand",
        type: "comboRow",
        position: { x: FLOW_ORIGIN_X, y: flowRowY(playRows, { kind: "hand" }) - 22 },
        data: { text: "Opening hand" },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        style: { pointerEvents: "none", width: 180, height: 20 },
      },
      ...playRows.flatMap((row, index) => {
        const y = flowRowY(playRows, { kind: "play", rowId: row.id });
        const empty = !graph.nodes.some((node) => node.rowId === row.id);
        const removable = playRows.length > 1 && empty;
        return [
          rowChrome(
            row.id,
            y,
            `Add a row below play ${index + 1}`,
            removable ? `Remove play ${index + 1}` : undefined,
            removable ? () => onRemoveRow?.(row.id) : undefined,
          ),
          {
            id: `label-play-${row.id}`,
            type: "comboRow",
            position: { x: FLOW_ORIGIN_X, y: y - 22 },
            data: { text: `Play ${index + 1}` },
            draggable: false,
            selectable: false,
            connectable: false,
            focusable: false,
            style: { pointerEvents: "none" as const, width: 180, height: 20 },
          },
        ];
      }),
      {
        id: "label-end",
        type: "comboRow",
        position: { x: FLOW_ORIGIN_X, y: endY - 40 },
        data: { text: "End board" },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        style: { pointerEvents: "none", width: 180, height: 20 },
      },
      ...endZoneFrames(graph).map((frame) => ({
        id: `zone-${frame.lane}`,
        type: "comboZone",
        position: { x: frame.x, y: endY - 18 },
        width: frame.width,
        height: COMBO_FLOW_CARD_H + 18,
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        style: { pointerEvents: "none" as const, width: frame.width, height: COMBO_FLOW_CARD_H + 18, zIndex: 0 },
        data: { label: LANE_LABEL[frame.lane] },
      })),
    ];
    for (const node of graph.nodes) {
      if (node.kind === "interruption" || node.kind === "killer" || node.kind === "choke") continue;
      const lane = comboLane(node);
      const cardId = node.cardIds[0];
      const placement =
        lane === "hand"
          ? { kind: "hand" as const }
          : lane === "play" && node.rowId
            ? { kind: "play" as const, rowId: node.rowId }
            : { kind: "end" as const, lane: "boss" as const };
      const position =
        laidOut.positions?.[node.id] ??
        { x: FLOW_ORIGIN_X + (node.order ?? 0) * COMBO_FLOW_COL, y: flowRowY(playRows, placement) };
      const disrupted = (graph.disruptedNodeIds ?? []).includes(node.id);
      next.push({
        id: node.id,
        type: "comboCard",
        position,
        width: COMBO_FLOW_CARD_W,
        height: COMBO_FLOW_CARD_H,
        draggable: CARD_DRAGGABLE,
        dragHandle: ".combo-card-drag",
        selectable: true,
        deletable: false,
        style: { width: COMBO_FLOW_CARD_W, height: COMBO_FLOW_CARD_H, pointerEvents: "all" },
        data: {
          nodeId: node.id,
          name: node.cardName ?? node.label,
          laneLabel: LANE_LABEL[lane],
          card: cardId != null ? cardsById.get(cardId) : undefined,
          missing: missingNodeIds?.has(node.id) ?? false,
          disrupted,
          fizzled: fizzled.has(node.id),
          ashClause: ashByNode.get(node.id) ?? null,
          selected: selectedNodeId === node.id,
          linkable: true,
          armedHandle,
          onSelect: onSelectNode,
          onArmHandle,
        } satisfies CardNodeData,
      });
    }
    return next;
  }, [
    graph,
    laidOut,
    playRows,
    cardsById,
    missingNodeIds,
    fizzled,
    ashByNode,
    selectedNodeId,
    armedHandle,
    onAddRow,
    onRemoveRow,
    onSelectNode,
    onArmHandle,
  ]);

  const layoutNodes = useMemo(
    () =>
      cardLayout.map((node) => {
        if (node.type !== "comboRowControls") return node;
        const rowId = node.id.slice("controls-".length);
        const revealed = hoverRow === rowId;
        const data = node.data as { revealed?: boolean };
        if (data.revealed === revealed) return node;
        return { ...node, data: { ...data, revealed } };
      }),
    [cardLayout, hoverRow],
  );
  const dragHold = useRef<DragHold | null>(null);
  const dropPending = useRef(false);
  const ghostNode = useRef<{ el: HTMLDivElement | null }>({ el: null });
  const setGhostNode = useCallback((node: HTMLDivElement | null) => {
    ghostNode.current.el = node;
  }, []);
  const ghostBox = useRef<GhostBox | null>(null);
  const liftGrab = useRef<GrabOffset | null>(null);
  const returnReadyRef = useRef(false);
  const [dragLift, setDragLift] = useState<{ name: string; card?: DeckCard } | null>(null);
  const [returnReady, setReturnReady] = useState(false);
  const [flowNodes, setFlowNodes] = useState<Node[]>(layoutNodes);
  useLayoutEffect(() => {
    paintGhost(ghostNode.current.el, ghostBox.current);
    const id = dragHold.current?.id;
    const host = id
      ? document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`)
      : null;
    if (host instanceof HTMLElement) host.style.opacity = ghostBox.current?.visible ? "0" : "";
  }, [returnReady, dragLift, flowNodes]);
  useLayoutEffect(() => () => markPoolDrop(false), []);
  // Row hover rebuilds the layout while a card is in the air. Hold that card
  // at the pointer. A finished drop snaps only after the card layout changes,
  // so a hover update in the same moment cannot put the card back in its old slot.
  useLayoutEffect(() => {
    if (dropPending.current) return;
    setFlowNodes(holdDraggedCard(layoutNodes, dragHold.current));
  }, [layoutNodes]);
  useLayoutEffect(() => {
    if (!dropPending.current) return;
    dropPending.current = false;
    dragHold.current = null;
    setFlowNodes(layoutNodes);
    // layoutNodes is the layout for this cardLayout render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardLayout]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const kept = changes.filter((change) => change.type !== "remove");
    for (const change of kept) {
      if (change.type === "position" && dragHold.current?.id === change.id && change.position) {
        dragHold.current = { id: change.id, position: change.position };
      }
    }
    if (kept.length === 0) return;
    setFlowNodes((current) => applyNodeChanges(kept, current));
  }, []);

  const edges = useMemo(() => {
    const disruptedNodes = new Set(graph.disruptedNodeIds ?? []);
    return graph.edges
      .filter((edge) => (edge.relation ?? "play") !== "interrupts")
      .map((edge) => {
        const relation = edge.relation ?? "play";
        const id = edgeId(edge.from, edge.to, relation);
        const disrupted = Boolean(edge.isDisruption) || disruptedNodes.has(edge.from);
        const faded = fizzled.has(edge.from) || fizzled.has(edge.to);
        const stroke = disrupted ? "#8f2d2d" : relation === "material" ? "#3d4754" : "#0c0e12";
        const fromNode = graph.nodes.find((node) => node.id === edge.from);
        const toNode = graph.nodes.find((node) => node.id === edge.to);
        const fromName = fromNode?.cardName ?? fromNode?.label ?? "the first card";
        const toName = toNode?.cardName ?? toNode?.label ?? "the second card";
        return {
          id,
          source: edge.from,
          target: edge.to,
          sourceHandle: edge.fromSide ?? "bottom",
          targetHandle: edge.toSide ?? "top",
          type: "comboLink",
          selectable: true,
          deletable: true,
          selected: selectedEdgeId === id,
          ariaLabel: `${fromName} ${RELATION_WORD[relation] ?? "plays to"} ${toName}`,
          data: {
            isDisruption: disrupted,
            relation,
            fromSide: edge.fromSide ?? "bottom",
            toSide: edge.toSide ?? "top",
            from: laidOut.positions?.[edge.from],
            to: laidOut.positions?.[edge.to],
            fromName,
            toName,
            onRemove: () => onRemoveLinks?.([{ source: edge.from, target: edge.to, relation }]),
          },
          style: {
            stroke,
            strokeWidth: LINK_STROKE,
            opacity: faded ? 0.35 : 1,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 12.5, height: 12.5 },
        } satisfies Edge;
      });
  }, [graph, laidOut, fizzled, selectedEdgeId, onRemoveLinks]);

  const sentences = graph.edges
    .filter((edge) => (edge.relation ?? "play") !== "interrupts")
    .map((edge) => {
      const from = graph.nodes.find((node) => node.id === edge.from);
      const to = graph.nodes.find((node) => node.id === edge.to);
      if (!from || !to) return null;
      const word = RELATION_WORD[edge.relation ?? "play"] ?? "plays to";
      const route = edge.fromSide && edge.toSide ? `, from the ${edge.fromSide} to the ${edge.toSide}` : "";
      return `${from.cardName ?? from.label} ${word} ${to.cardName ?? to.label}${route}`;
    })
    .filter((sentence): sentence is string => sentence != null);

  const zoomBy = (factor: number) => {
    const frame = frameRef.current;
    const current = getViewport();
    const scale = clampScale(current.zoom * factor);
    if (!frame) {
      setViewport({ ...current, zoom: scale });
      return;
    }
    const cx = frame.clientWidth / 2;
    const cy = frame.clientHeight / 2;
    const ratio = scale / current.zoom;
    setViewport({ zoom: scale, x: cx - (cx - current.x) * ratio, y: cy - (cy - current.y) * ratio });
  };

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      onMouseMove={(event) => trackRow(event.clientX, event.clientY)}
      onMouseLeave={() => {
        hoverRef.current = null;
        setHoverRow(null);
      }}
    >
      <ReactFlow
        ref={frameRef}
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={MIN_SCALE}
        maxZoom={MAX_SCALE}
        defaultViewport={{ x: 16, y: VIEW_CHROME_TOP, zoom: 1 }}
        nodesDraggable
        nodesConnectable
        nodesFocusable={false}
        selectNodesOnDrag={false}
        onNodesChange={onNodesChange}
        elementsSelectable
        panOnDrag
        autoPanOnNodeDrag={false}
        zoomOnDoubleClick={false}
        connectOnClick
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineComponent={ComboConnectionLine}
        connectionRadius={36}
        connectionDragThreshold={1}
        isValidConnection={(connection) => connection.source !== connection.target}
        deleteKeyCode={["Backspace", "Delete"]}
        onBeforeDelete={async ({ edges: doomed }) => ({ nodes: [], edges: doomed })}
        onEdgesDelete={(deleted) => {
          onRemoveLinks?.(
            deleted.map((edge) => ({
              source: edge.source,
              target: edge.target,
              relation: ((edge.data as { relation?: ComboEdgeRelation } | undefined)?.relation ?? "play") as ComboEdgeRelation,
            })),
          );
        }}
        selectionOnDrag={false}
        colorMode="light"
        tabIndex={0}
        aria-label="Combo progression. Drag to pan. Arrow keys pan while this board is focused."
        className={`min-h-[420px] flex-1 border border-[#28303b] bg-[#eef3f6] ${KEYBOARD_RING} [&_.react-flow__edge:hover]:!z-[1000] [&_.react-flow__node.dragging]:!z-[1000] [&_.react-flow__node]:border-0 [&_.react-flow__node]:bg-transparent [&_.react-flow__node]:p-0 [&_.react-flow__node]:shadow-none [&_.react-flow__pane]:cursor-grab`}
        onPaneMouseMove={(event) => trackRow(event.clientX, event.clientY)}
        onPaneMouseLeave={() => {
          hoverRef.current = null;
          setHoverRow(null);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const raw = event.dataTransfer.getData("application/x-mda-card");
          if (!raw) return;
          const card = JSON.parse(raw) as {
            id: number;
            name: string;
            offsetX?: unknown;
            offsetY?: unknown;
          };
          if (typeof card.id !== "number" || typeof card.name !== "string") return;
          const grab =
            typeof card.offsetX === "number" && typeof card.offsetY === "number"
              ? { x: card.offsetX, y: card.offsetY }
              : null;
          const screen = cardDropScreenPoint({ x: event.clientX, y: event.clientY }, grab);
          onDropCard?.(card, screenToFlowPosition(screen));
        }}
        onConnect={(connection) => {
          const fromSide = anchorSide(connection.sourceHandle);
          const toSide = anchorSide(connection.targetHandle);
          if (!connection.source || !connection.target || !fromSide || !toSide) return;
          onConnectCards?.(connection.source, connection.target, fromSide, toSide);
          onDisarmHandle?.();
        }}
        onConnectStart={(_event, params) => {
          const side = anchorSide(params.handleId);
          if (params.nodeId && side) onArmHandle?.(params.nodeId, side);
        }}
        onConnectEnd={() => onDisarmHandle?.()}
        onClickConnectStart={(_event, params) => {
          const side = anchorSide(params.handleId);
          if (params.nodeId && side) onArmHandle?.(params.nodeId, side);
        }}
        onClickConnectEnd={() => onDisarmHandle?.()}
        onNodeClick={(event, node) => {
          const target = event.target;
          if (target instanceof Element && target.closest(".react-flow__handle")) return;
          if (node.type === "comboCard") onSelectNode?.(node.id);
        }}
        onEdgeClick={(_event, edge) => onSelectEdge?.(edge.id)}
        onNodeDragStart={(event, node) => {
          if (node.type !== "comboCard") return;
          dragHold.current = { id: node.id, position: { x: node.position.x, y: node.position.y } };
          const host = document.querySelector(`.react-flow__node[data-id="${CSS.escape(node.id)}"]`);
          if (host instanceof HTMLElement && "clientX" in event) {
            const rect = host.getBoundingClientRect();
            liftGrab.current = {
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              width: rect.width,
              height: rect.height,
            };
          }
          const data = node.data as CardNodeData;
          returnReadyRef.current = false;
          setReturnReady(false);
          setDragLift({ name: data.name, card: data.card });
        }}
        onNodeDrag={(event, node) => {
          if (node.type !== "comboCard") return;
          const grab = liftGrab.current;
          const pool = document.querySelector("[data-combo-pool]");
          const poolRect = pool instanceof HTMLElement ? pool.getBoundingClientRect() : null;
          const clientX = "clientX" in event ? event.clientX : 0;
          const clientY = "clientY" in event ? event.clientY : 0;
          const host = document.querySelector(`.react-flow__node[data-id="${CSS.escape(node.id)}"]`);
          const rect = host instanceof HTMLElement ? host.getBoundingClientRect() : null;
          const box = grab
            ? ghostFrame({ x: clientX, y: clientY }, grab, poolRect)
            : rect
              ? {
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  visible: cardOverlapsPool(rect, poolRect),
                }
              : null;
          if (!box) return;
          ghostBox.current = box;
          paintGhost(ghostNode.current.el, box);
          if (host instanceof HTMLElement) host.style.opacity = box.visible ? "0" : "";
          const ready = Boolean(document.elementFromPoint(clientX, clientY)?.closest("[data-combo-pool]"));
          if (ready === returnReadyRef.current) return;
          returnReadyRef.current = ready;
          markPoolDrop(ready);
          setReturnReady(ready);
        }}
        onNodeDragStop={(event, node) => {
          if (node.type !== "comboCard") return;
          dropPending.current = true;
          const clientX = "clientX" in event ? event.clientX : 0;
          const clientY = "clientY" in event ? event.clientY : 0;
          const hit = document.elementFromPoint(clientX, clientY);
          const host = document.querySelector(`.react-flow__node[data-id="${CSS.escape(node.id)}"]`);
          if (host instanceof HTMLElement) host.style.opacity = "";
          ghostBox.current = null;
          liftGrab.current = null;
          returnReadyRef.current = false;
          markPoolDrop(false);
          setReturnReady(false);
          setDragLift(null);
          if (hit?.closest("[data-combo-pool]")) {
            onReturnNode?.(node.id);
            return;
          }
          onMoveNode?.(node.id, node.position);
        }}
        onKeyDown={(event) => {
          const current = getViewport();
          if (event.key === "ArrowRight") setViewport({ ...current, x: current.x - 48 });
          else if (event.key === "ArrowLeft") setViewport({ ...current, x: current.x + 48 });
          else if (event.key === "ArrowDown") setViewport({ ...current, y: current.y - 48 });
          else if (event.key === "ArrowUp") setViewport({ ...current, y: current.y + 48 });
          else if (event.key === "+" || event.key === "=") zoomBy(1.12);
          else if (event.key === "-" || event.key === "_") zoomBy(1 / 1.12);
          else if (event.key === "0") fit();
          else return;
          event.preventDefault();
        }}
      >
        <Panel position="top-left" className="flex items-center gap-2">
          <div role="group" aria-label="View" className="flex overflow-hidden border border-[#28303b] bg-[#f7fcff]">
            <button type="button" className={ICON_BUTTON} aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / 1.12)}>
              <ZoomOut className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" className={`${ICON_BUTTON} border-l border-[#28303b]`} aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.12)}>
              <ZoomIn className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              className={`${ICON_BUTTON} border-l border-[#28303b]`}
              aria-label="Fit view"
              title="Fit view"
              onClick={() => {
                void Promise.resolve(fitView({ duration: 0, padding: 0.15, maxZoom: 1 })).then(() => {
                  const view = getViewport();
                  if (view.y < VIEW_CHROME_TOP) setViewport({ ...view, y: VIEW_CHROME_TOP });
                });
              }}
            >
              <Maximize2 className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" className={`${ICON_BUTTON} border-l border-[#28303b]`} aria-label="Reset view" title="Reset view" onClick={fit}>
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            className={`flex h-9 items-center gap-1 border border-[#28303b] bg-[#f7fcff] px-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[#0c0e12] hover:text-[#eef3f6] ${KEYBOARD_RING}`}
            aria-label="Clear board"
            title="Clear board"
            onClick={onClear}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Clear
          </button>
        </Panel>
        <Panel position="top-right">
          <BoardName name={boardName} onRename={onRenameBoard} />
        </Panel>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#28303b" />
      </ReactFlow>
      <ul className="sr-only">
        {sentences.map((sentence) => (
          <li key={sentence}>{sentence}</li>
        ))}
      </ul>
      <p className="sr-only" role="status">
        {returnReady && dragLift ? `Release to return ${dragLift.name} to this deck.` : ""}
      </p>
      {dragLift ? (
        <CardDragGhost
          name={dragLift.name}
          card={dragLift.card}
          armed={returnReady}
          ghostRef={setGhostNode}
        />
      ) : null}
    </div>
  );
}

export function ComboBoard(props: ComboBoardProps): ReactNode {
  return (
    <ReactFlowProvider>
      <ComboFlow {...props} />
    </ReactFlowProvider>
  );
}
