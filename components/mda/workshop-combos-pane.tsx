"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ComboBoard } from "@/components/mda/combo-board";
import { CardPreviewTooltipProvider, MdaCardPreview } from "@/components/mda/mda-card-preview";
import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";
import { CardImage } from "@/components/ui/card-image";
import {
  addCardToGraph,
  addComboLink,
  blankDeckComboGraph,
  clearComboBoard,
  insertPlayRowAt,
  linkRelationForLanes,
  missingCardNodeIds,
  moveCardToPoint,
  dropExceedsOpeningHand,
  placeCardAt,
  removeComboLink,
  removeEmptyPlayRow,
  removeNodeFromGraph,
  setEndboardSummary,
  type DeckComboGraph,
} from "@/lib/combos/deck-combo-graph";
import { comboLane } from "@/lib/engine/combos";
import type { ComboAnchorSide, ComboEdgeRelation } from "@/lib/engine/types";
import { Check, File, FolderOpen, Lightbulb, Pencil, Plus, Trash2, X } from "lucide-react";
import type { ComboSaveState } from "@/hooks/queries/useDeckComboLines";
import type { DeckCard, DeckFormat } from "@/types/deck";

const EMPTY_CARDS: DeckCard[] = [];
const KEYBOARD_RING = "focus-visible:shadow-[0_0_0_2px_#eef3f6,0_0_0_4px_#0c0e12]";
const FIELD = `border border-[#28303b] bg-[#f7fcff] px-2 py-1.5 text-xs text-[#0c0e12] ${KEYBOARD_RING}`;
const BUTTON = `border border-[#28303b] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${KEYBOARD_RING} disabled:opacity-40`;
const ICON_BUTTON = `grid h-9 w-9 shrink-0 place-items-center border border-[#28303b] bg-[#f7fcff] text-[#0c0e12] transition-colors enabled:hover:border-[#0c0e12] enabled:hover:bg-[#0c0e12] enabled:hover:text-[#eef3f6] ${KEYBOARD_RING} disabled:opacity-40`;
const ICON_BUTTON_DELETE = `grid h-9 w-9 shrink-0 place-items-center border border-[#28303b] bg-[#f7fcff] text-[#0c0e12] transition-colors enabled:hover:border-[#8f2d2d] enabled:hover:bg-[#8f2d2d] enabled:hover:text-[#eef3f6] ${KEYBOARD_RING} disabled:opacity-40`;

const EMPTY_COPY =
  "There are no saved combo boards yet. Name this board in the upper right, or save a name below, and it stays with this deck. The lightbulb in the header opens the build steps if you want them.";

const HOW_TO_STEPS = [
  "Drag a card from this deck onto the opening hand or a play row. The opening hand holds up to 6 cards, for going first or second. Enter on a card places it on play 1. Drag a board card back onto this list to return it. The list turns blue and shows a plus while the card is over it.",
  "Draw a link from a dot on one card to a dot on the next. The line keeps the sides you pick.",
  "Hover a link and use the X to remove it. Delete also removes the selected link.",
  "A yellow outline means Ash Blossom can negate that card. The warning icon explains what stops. That warning is drawn on the card and is not stored in the board file.",
  "Click the board name in the upper right and give it a name. A named board saves with this deck on its own.",
  "Boards opens your saved files so you can open, rename, or delete one.",
];

export interface WorkshopComboLineView {
  id: string;
  name: string;
  graph: DeckComboGraph;
}

export type WorkshopCombosPaneProps = {
  canSave: boolean;
  cards?: DeckCard[];
  sections?: { title: string; cards: DeckCard[] }[];
  /** Side Deck is a TCG zone. Master Duel boards do not show it. */
  deckFormat?: DeckFormat;
  lines: WorkshopComboLineView[];
  loading?: boolean;
  error?: string | null;
  saveState?: ComboSaveState;
  saveError?: string | null;
  onCreate: (name: string, graph: DeckComboGraph) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onChangeGraph: (id: string, graph: DeckComboGraph) => void;
};

function finishLink(
  graph: DeckComboGraph,
  fromId: string,
  toId: string,
  fromSide: ComboAnchorSide,
  toSide: ComboAnchorSide,
): { graph: DeckComboGraph; error: string | null } {
  const from = graph.nodes.find((node) => node.id === fromId);
  const to = graph.nodes.find((node) => node.id === toId);
  if (!from || !to) return { graph, error: "Choose two cards on this line." };
  const relation = linkRelationForLanes(comboLane(from), comboLane(to));
  if (!relation) {
    return { graph, error: "Links stay on the play rows, or on the end board." };
  }
  return addComboLink(graph, fromId, toId, relation, { fromSide, toSide });
}

function copiesUsed(graph: DeckComboGraph, cardId: number): number {
  return graph.nodes.filter((node) => {
    if (node.cardIds[0] !== cardId) return false;
    return node.kind !== "interruption" && node.kind !== "killer" && node.kind !== "choke";
  }).length;
}

function deckPool(cards: DeckCard[], graph: DeckComboGraph | null): ComboPoolCard[] {
  const byId = new Map<number, ComboPoolCard>();
  for (const card of cards) {
    const current = byId.get(card.id);
    if (current) current.owned += 1;
    else byId.set(card.id, { card, owned: 1, remaining: 1 });
  }
  for (const entry of byId.values()) {
    const used = graph ? copiesUsed(graph, entry.card.id) : 0;
    entry.remaining = Math.max(0, entry.owned - used);
  }
  return [...byId.values()];
}

interface ComboPoolCard {
  card: DeckCard;
  owned: number;
  remaining: number;
}

function poolLabel(entry: ComboPoolCard): string {
  if (entry.remaining <= 0) return `${entry.card.name}, no copies left in this deck`;
  return `Drag ${entry.card.name} onto the board, ${entry.remaining} remaining. Press Enter to add it to play 1.`;
}

function ComboPoolTile({
  entry,
  onPlace,
}: {
  entry: ComboPoolCard;
  onPlace: () => void;
}): ReactNode {
  const exhausted = entry.remaining <= 0;
  const peek = Math.min(Math.max(entry.remaining, 1), 3) - 1;
  const tile = (
    <button
      type="button"
      draggable={!exhausted}
      disabled={exhausted}
      aria-label={poolLabel(entry)}
      className={`flex h-full w-full min-w-0 flex-col border border-[#28303b] bg-[#f7fcff] p-1.5 text-left ${KEYBOARD_RING} disabled:cursor-not-allowed ${exhausted ? "opacity-40 grayscale" : ""}`}
      onDragStart={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.dataTransfer.setData(
          "application/x-mda-card",
          JSON.stringify({
            id: entry.card.id,
            name: entry.card.name,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
          }),
        );
        event.dataTransfer.effectAllowed = "copy";
      }}
      onKeyDown={(event) => {
        if (exhausted || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onPlace();
      }}
    >
      <span className="relative block w-full pt-1.5">
        {peek > 0 ? (
          <span aria-hidden="true" className="absolute left-0 right-1.5 top-0 h-1.5 border border-[#28303b] bg-[#d5dee4]" />
        ) : null}
        <span
          className={`relative block aspect-[59/86] w-full overflow-hidden border border-[#28303b] bg-[#0c0e12] ${exhausted ? "opacity-40 grayscale" : ""}`}
        >
          <CardImage card={entry.card} preferSmall fill alt="" sizes="120px" className="object-cover" />
        </span>
        {entry.remaining > 0 ? (
          <span className="absolute right-1 top-2.5 z-10 bg-[#0c0e12] px-1 text-xs font-semibold text-[#eef3f6]">
            {`${entry.remaining} remaining`}
          </span>
        ) : null}
      </span>
      <span className="mt-1 truncate text-xs font-semibold">{entry.card.name}</span>
    </button>
  );
  return (
    <MdaCardPreview card={entry.card} triggerClassName="block w-full min-w-0">
      {tile}
    </MdaCardPreview>
  );
}

function ComboStackPanel({ children }: { children: ReactNode }): ReactNode {
  return (
    <aside
      data-combo-pool
      aria-label="Deck card stacks. Drop a board card here to return that copy."
      className="group/pool relative flex w-72 shrink-0"
    >
      <div className="relative z-0 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-r border-[#28303b] bg-[#eef3f6] p-4">
        {children}
      </div>
      <div
        data-combo-drop-plus
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 hidden items-center justify-center bg-[#2b74e8]/55 group-data-[drop-active=true]/pool:flex"
      >
        <Plus className="h-24 w-24 text-[#f7fcff] drop-shadow-[0_2px_12px_rgb(12_14_18/0.65)]" strokeWidth={2.75} />
      </div>
    </aside>
  );
}

function LineNameForm({
  label,
  action,
  onSubmit,
}: {
  label: string;
  action: string;
  onSubmit: (name: string) => void;
}): ReactNode {
  const [name, setName] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setName("");
  };
  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4754]">
        {label}
        <input className={FIELD} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button
        type="submit"
        className={`${BUTTON} bg-[#f7fcff] transition-colors enabled:hover:border-[#0c0e12] enabled:hover:bg-[#0c0e12] enabled:hover:text-[#eef3f6]`}
        disabled={name.trim().length === 0}
      >
        {action}
      </button>
    </form>
  );
}

function BoardFileRow({
  name,
  detail,
  disabled = false,
  onOpen,
  onRename,
  onDelete,
}: {
  name: string;
  detail?: string;
  disabled?: boolean;
  onOpen?: () => void;
  onRename?: (name: string) => void;
  onDelete?: () => void;
}): ReactNode {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const renameId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const renameButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const cancelRenameRef = useRef<() => void>(() => {});

  const cancelRename = () => {
    returnFocus.current = true;
    setDraft(name);
    setRenaming(false);
  };
  cancelRenameRef.current = cancelRename;

  useEffect(() => {
    const input = inputRef.current;
    if (!renaming || !input) return;
    input.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelRenameRef.current();
    };
    input.addEventListener("keydown", onKeyDown);
    return () => input.removeEventListener("keydown", onKeyDown);
  }, [renaming]);

  useEffect(() => {
    if (!renaming && returnFocus.current) {
      returnFocus.current = false;
      renameButtonRef.current?.focus();
    }
  }, [renaming]);

  return (
    <li className="flex w-full min-w-0 items-center gap-3 border border-[#28303b] bg-[#f7fcff] px-3 py-2">
      <File className="h-8 w-8 shrink-0" strokeWidth={1.25} aria-hidden />
      {renaming ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = draft.trim();
            if (!trimmed || trimmed === name) return;
            onRename?.(trimmed);
            returnFocus.current = true;
            setRenaming(false);
          }}
        >
          <label className="sr-only" htmlFor={renameId}>
            {`Rename ${name}`}
          </label>
          <input
            ref={inputRef}
            id={renameId}
            data-rename-board=""
            className={`${FIELD} min-w-0 flex-1`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className={ICON_BUTTON} aria-label="Save name" title="Save name" disabled={draft.trim().length === 0 || draft.trim() === name}>
            <Check className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className={ICON_BUTTON} aria-label={`Cancel rename ${name}`} title={`Cancel rename ${name}`} onClick={cancelRename}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </form>
      ) : (
        <>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-[0.12em]">{name}</p>
          {detail ? <span className="sr-only">{detail}</span> : null}
          <div className="flex shrink-0 gap-2">
            <button type="button" className={ICON_BUTTON} disabled={disabled} aria-label={`Open ${name}`} title={`Open ${name}`} onClick={onOpen}>
              <FolderOpen className="h-4 w-4" aria-hidden />
            </button>
            <button
              ref={renameButtonRef}
              type="button"
              className={ICON_BUTTON}
              disabled={disabled || !onRename}
              aria-label={`Rename ${name}`}
              title={`Rename ${name}`}
              onClick={() => {
                setDraft(name);
                setRenaming(true);
              }}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" className={ICON_BUTTON_DELETE} disabled={disabled} aria-label={`Delete ${name}`} title={`Delete ${name}`} onClick={onDelete}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </>
      )}
    </li>
  );
}

function HowToDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): ReactNode {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-[#0c0e12]/40" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-[101] flex max-h-[min(40rem,calc(100%-2rem))] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto border border-[#28303b] bg-[#eef3f6] p-6 font-spaceGrotesk text-[#0c0e12] ${KEYBOARD_RING}`}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-sm font-semibold uppercase tracking-[0.12em]">How to build your combo board</Dialog.Title>
            <Dialog.Close className={`grid h-9 w-9 shrink-0 place-items-center border border-[#28303b] ${KEYBOARD_RING}`} aria-label="Close how to build your combo board">
              <X className="h-4 w-4" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-xs text-[#3d4754]">
            Place cards from this deck, link them in order, and name the board to save it.
          </Dialog.Description>
          <ol className="flex list-decimal flex-col gap-2 pl-4 text-xs text-[#0c0e12]">
            {HOW_TO_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Dialog.Close className={BUTTON}>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function WorkshopCombosPane({
  canSave,
  cards = EMPTY_CARDS,
  sections,
  deckFormat = "Master Duel",
  lines,
  loading = false,
  error = null,
  saveState = "idle",
  saveError = null,
  onCreate,
  onRename,
  onDelete,
  onChangeGraph,
}: WorkshopCombosPaneProps): ReactNode {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [handError, setHandError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DeckComboGraph>(() => blankDeckComboGraph());
  const [dismissed, setDismissed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [armed, setArmed] = useState<{ nodeId: string; side: ComboAnchorSide } | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{
    from: string;
    to: string;
    relation: ComboEdgeRelation;
  } | null>(null);
  const active = lines.find((line) => line.id === activeId) ?? lines[0] ?? null;
  const starting = canSave && !loading && !active;
  const graph = active?.graph ?? (starting ? draft : null);
  const boardsOpen = menuOpen || (starting && !dismissed);

  const cardsById = useMemo(() => {
    const map = new Map<number, DeckCard>();
    for (const card of cards) map.set(card.id, card);
    return map;
  }, [cards]);
  const pool = useMemo(() => deckPool(cards, graph), [cards, graph]);

  const deckCardIds = useMemo(() => new Set(cards.map((card) => card.id)), [cards]);
  const missingIds = useMemo(
    () => new Set(graph ? missingCardNodeIds(graph, deckCardIds) : []),
    [graph, deckCardIds],
  );
  const groups = useMemo(() => {
    const source = (sections && sections.length > 0 ? sections : [{ title: "Deck", cards }]).filter(
      (section) => deckFormat === "TCG" || section.title !== "Side Deck",
    );
    const seen = new Set<number>();
    return source.map((section) => {
      const entries: ComboPoolCard[] = [];
      for (const card of section.cards) {
        if (seen.has(card.id)) continue;
        seen.add(card.id);
        const entry = pool.find((item) => item.card.id === card.id);
        if (entry) entries.push(entry);
      }
      return { title: section.title, entries };
    });
  }, [sections, cards, pool, deckFormat]);

  const commit = (next: DeckComboGraph) => {
    if (active) {
      onChangeGraph(active.id, next);
      return;
    }
    setDraft(next);
  };

  const selected = graph?.nodes.find((node) => node.id === selectedNodeId) ?? null;

  const closeBoards = () => {
    setMenuOpen(false);
    setDismissed(true);
  };

  const placeFromKeyboard = (entry: ComboPoolCard) => {
    if (!graph || entry.remaining <= 0) return;
    const rowId = graph.playRows[0]?.id;
    if (!rowId) return;
    commit(addCardToGraph(graph, { kind: "play", rowId }, { id: entry.card.id, name: entry.card.name }));
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden font-spaceGrotesk text-[#0c0e12]">
      <MdaLoadingScreen open={loading} scoped status="Loading combo boards…" />
      {!canSave ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="text-xl font-semibold uppercase tracking-wide">Save this deck to store combo boards</p>
          <p className="max-w-md text-sm text-[#3d4754]">
            Boards are kept with this deck and load again the next time you open it.
          </p>
        </div>
      ) : null}
      {canSave && graph ? (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-[#28303b] px-4 py-3">
            <h2 className="min-w-0 truncate text-sm font-semibold uppercase tracking-[0.12em]">Combos</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-[0.12em] text-[#3d4754]" role="status">
                {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveError ?? ""}
              </p>
              <button
                type="button"
                className={`grid h-9 w-9 place-items-center border border-[#28303b] ${KEYBOARD_RING}`}
                aria-label="How to build your combo board"
                title="How to build your combo board"
                onClick={() => setHelpOpen(true)}
              >
                <Lightbulb className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className={BUTTON} onClick={() => setMenuOpen(true)}>
                Boards
              </button>
            </div>
          </div>
          <HowToDialog open={helpOpen} onOpenChange={setHelpOpen} />
          <div className="flex min-h-0 flex-1">
            <CardPreviewTooltipProvider>
            <ComboStackPanel>
              {groups.map((group) => (
                <section key={group.title} className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4754]">{group.title}</h3>
                  <ul aria-label={group.title} className="grid grid-cols-2 items-start gap-2">
                    {group.entries.length === 0 ? (
                      <li className="col-span-2 text-xs text-[#3d4754]">No cards in this deck</li>
                    ) : null}
                    {group.entries.map((entry) => (
                      <li key={entry.card.id} className="min-w-0">
                        <ComboPoolTile entry={entry} onPlace={() => placeFromKeyboard(entry)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {selected ? (
                <button
                  type="button"
                  className={BUTTON}
                  onClick={() => {
                    commit(removeNodeFromGraph(graph, selected.id));
                    setSelectedNodeId(null);
                  }}
                >
                  {`Remove ${selected.cardName ?? selected.label}`}
                </button>
              ) : null}
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4754]">
                End board note
                <textarea
                  className={FIELD}
                  rows={3}
                  value={graph.endboardSummary}
                  onChange={(event) => commit(setEndboardSummary(graph, event.target.value))}
                />
              </label>
              {linkError ? (
                <p className="text-xs text-[#8f2d2d]" role="alert">
                  {linkError}
                </p>
              ) : null}
              {handError ? (
                <p className="text-xs text-[#8f2d2d]" role="alert">
                  {handError}
                </p>
              ) : null}
              {missingIds.size > 0 ? (
                <p className="text-xs text-[#8f2d2d]" role="status">
                  A card left this deck. Remove it before the board can be saved.
                </p>
              ) : null}
            </ComboStackPanel>
            </CardPreviewTooltipProvider>
            <ComboBoard
              graph={graph}
              cardsById={cardsById}
              missingNodeIds={missingIds}
              selectedNodeId={selectedNodeId}
              armedHandle={armed}
              onAddRow={(afterRowId) => commit(insertPlayRowAt(graph, afterRowId))}
              onRemoveRow={(rowId) => commit(removeEmptyPlayRow(graph, rowId))}
              onClear={() => {
                commit(clearComboBoard(graph));
                setSelectedNodeId(null);
                setSelectedEdge(null);
                setHandError(null);
              }}
              onDropCard={(card, point) => {
                const owned = cards.filter((item) => item.id === card.id).length;
                if (copiesUsed(graph, card.id) >= owned) return;
                if (dropExceedsOpeningHand(graph, point)) {
                  setHandError("The opening hand holds 6 cards.");
                  return;
                }
                setHandError(null);
                commit(placeCardAt(graph, card, point));
              }}
              onMoveNode={(nodeId, point) => {
                if (dropExceedsOpeningHand(graph, point, nodeId)) {
                  setHandError("The opening hand holds 6 cards.");
                  commit({ ...graph });
                  return;
                }
                setHandError(null);
                commit(moveCardToPoint(graph, nodeId, point));
              }}
              onReturnNode={(nodeId) => {
                commit(removeNodeFromGraph(graph, nodeId));
                if (selectedNodeId === nodeId) setSelectedNodeId(null);
              }}
              selectedEdgeId={
                selectedEdge ? `${selectedEdge.from}-${selectedEdge.to}-${selectedEdge.relation}` : null
              }
              onConnectCards={(source, target, fromSide, toSide) => {
                const result = finishLink(graph, source, target, fromSide, toSide);
                setLinkError(result.error);
                if (result.error) return;
                commit(result.graph);
                const edge = result.graph.edges.find((item) => item.from === source && item.to === target);
                setSelectedNodeId(null);
                setSelectedEdge(
                  edge
                    ? { from: edge.from, to: edge.to, relation: edge.relation ?? "play" }
                    : null,
                );
              }}
              onRemoveLinks={(links) => {
                const next = links.reduce(
                  (current, link) => removeComboLink(current, link.source, link.target, link.relation),
                  graph,
                );
                commit(next);
                setSelectedEdge(null);
              }}
              onSelectEdge={(id) => {
                const edge = graph.edges.find((item) => `${item.from}-${item.to}-${item.relation ?? "play"}` === id);
                setSelectedEdge(
                  edge ? { from: edge.from, to: edge.to, relation: edge.relation ?? "play" } : null,
                );
                setSelectedNodeId(null);
              }}
              onArmHandle={(nodeId, side) => setArmed({ nodeId, side })}
              onDisarmHandle={() => setArmed(null)}
              boardName={active?.name ?? ""}
              onRenameBoard={(name) => {
                if (active) {
                  onRename(active.id, name);
                  return;
                }
                onCreate(name, draft);
                closeBoards();
              }}
              onSelectNode={(nodeId) => {
                if (!graph.nodes.some((node) => node.id === nodeId)) return;
                setSelectedEdge(null);
                setSelectedNodeId(nodeId);
              }}
            />
          </div>
          <Dialog.Root
            open={boardsOpen}
            onOpenChange={(open) => {
              if (open) setMenuOpen(true);
              else closeBoards();
            }}
          >
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[98] bg-[#0c0e12]/40" />
              <Dialog.Content
                className={`fixed left-1/2 top-1/2 z-[99] flex max-h-[min(40rem,calc(100%-2rem))] w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto border border-[#28303b] bg-[#eef3f6] p-6 font-spaceGrotesk text-[#0c0e12] ${KEYBOARD_RING}`}
                onEscapeKeyDown={(event) => {
                  const active = document.activeElement;
                  if (active instanceof HTMLInputElement && active.hasAttribute("data-rename-board")) event.preventDefault();
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <Dialog.Title className="text-sm font-semibold uppercase tracking-[0.12em]">
                    {starting ? "No saved combo boards" : "Combo boards"}
                  </Dialog.Title>
                  <Dialog.Close className={`grid h-9 w-9 shrink-0 place-items-center border border-[#28303b] ${KEYBOARD_RING}`} aria-label="Close boards">
                    <X className="h-4 w-4" aria-hidden />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="text-xs text-[#3d4754]">
                  {starting ? EMPTY_COPY : "Open a saved board, or save a new one with this deck."}
                </Dialog.Description>
                {error ? (
                  <p className="text-xs text-[#8f2d2d]" role="alert">
                    {error}
                  </p>
                ) : null}
                <ul aria-label="Saved boards" className="flex w-full flex-col gap-2">
                  {starting ? (
                    <BoardFileRow name="Opening board" detail="Example" disabled />
                  ) : (
                    lines.map((line) => (
                      <BoardFileRow
                        key={line.id}
                        name={line.name}
                        detail={line.id === active?.id ? "Open on the canvas" : "Saved with this deck"}
                        onOpen={() => {
                          setActiveId(line.id);
                          setSelectedNodeId(null);
                          closeBoards();
                        }}
                        onRename={(name) => onRename(line.id, name)}
                        onDelete={() => onDelete(line.id)}
                      />
                    ))
                  )}
                </ul>
                <LineNameForm
                  label={starting ? "Board name" : "New board"}
                  action="Save board"
                  onSubmit={(name) => {
                    onCreate(name, starting ? draft : blankDeckComboGraph());
                    closeBoards();
                  }}
                />
                <Dialog.Close className={BUTTON}>Close</Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ) : null}
    </div>
  );
}
