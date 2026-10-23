"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouteHeadingFocus } from "@/hooks/useRouteHeadingFocus";
import { navigateWithViewTransition } from "@/lib/motion/view-transition";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, Gamepad2, Layers, LayoutGrid, List, MoreVertical, Pin, Play, Plus, Rows3, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useUserDecks } from "@/hooks/useUserDecks";
import { useUserStore } from "@/store/useUserStore";
import { useDeck } from "@/context/deck-context";
import { useLiveDeckStore } from "@/store/liveDeckStore";
import { deleteDeck, loadDeck as loadPersistedDeck, saveDeck, toggleDeckPin } from "@/lib/data/decks";
import { sortArchiveDecks, type ArchiveDeckSort } from "@/lib/deck/sort-archive-decks";
import { normalizeDeckName } from "@/lib/deck/normalize-deck-name";
import { isDeckLegalForShare } from "@/lib/validation/deck-validator";
import {
  DECK_CAP_HARD,
  deckCapExceededMessage,
  deckCapSoftWarningMessage,
  getDeckCapStatus,
} from "@/lib/deck/deck-caps";
import { CardImage } from "@/components/ui/card-image";
import type { ClientDeck, DeckCard, DeckFormat } from "@/types/deck";
import { cn } from "@/lib/utils";
import {
  cardLine,
  countsLabel,
  deckZones,
  editorialDeckCost,
  editorialRarity,
  formatUsd,
  groupCards,
  lineCraftPoints,
  modifiedLabel,
  mostRecentlyUpdated,
  shareBlockers,
  tcgUnitPrice,
  type EditorialRarity,
} from "./archives-data";
import {
  EditorialButton,
  EditorialDialog,
  EditorialDialogContent,
  EditorialDialogDescription,
  EditorialDialogTitle,
  EditorialMenu,
  EditorialMenuContent,
  EditorialMenuItem,
  EditorialMenuTrigger,
  EditorialTabs,
  EditorialTabsContent,
  EditorialTabsList,
  EditorialTabsTrigger,
  editorialButtonClass,
} from "./editorial-ui";
import "./stitch/fonts/families.css";
import "./archives-screen.css";

type SectionId = "top" | "pinned" | "tcg" | "master-duel";
type DialogId = "alerts" | "details" | "rename" | "copy" | "share" | "delete" | "new" | null;

const NAV: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "top", label: "ALL DECKS", icon: Rows3 },
  { id: "pinned", label: "PINNED", icon: Pin },
  { id: "tcg", label: "TCG", icon: Layers },
  { id: "master-duel", label: "MASTER DUEL", icon: Gamepad2 },
];

const SORT_OPTIONS: { id: ArchiveDeckSort; label: string }[] = [
  { id: "newest", label: "NEWEST" },
  { id: "oldest", label: "OLDEST" },
  { id: "az", label: "A–Z" },
  { id: "za", label: "Z–A" },
  { id: "format", label: "FORMAT" },
];

function ArchiveIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon aria-hidden className={cn("h-4 w-4", className)} strokeWidth={2} />;
}

function SectionHeading({ headingId, label, count }: { headingId: string; label: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="h-[10px] w-[2px] bg-[#bfe5f3]" />
      <h2 id={headingId} className="font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">{label}</h2>
      {count !== undefined ? (
        <span className="font-space text-[12px] font-semibold tracking-wider text-[#8a96a6]">[{count} DECKS]</span>
      ) : null}
    </div>
  );
}

function coverCard(card: DeckCard | undefined): DeckCard | null {
  const image = card?.card_images?.[0];
  if (!card || (!image?.image_url && !image?.image_url_small)) return null;
  return card;
}

function Cover({ card, className }: { card: DeckCard | null; className?: string }) {
  return (
    <div className={cn("relative flex select-none items-center justify-center overflow-hidden border border-[#28303b] bg-[#0c0e12]", className)}>
      {card ? (
        <CardImage card={card} preferSmall fill alt="" className="object-cover" sizes="180px" />
      ) : (
        <span className="font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">COVER</span>
      )}
    </div>
  );
}

function RarityBadge({ rarity }: { rarity: EditorialRarity }) {
  return (
    <span className={cn("absolute right-1 top-1 px-2 py-0.5 font-space text-[12px] font-bold uppercase leading-none tracking-wider", `rarity-${rarity.toLowerCase()}`)}>
      {rarity}
    </span>
  );
}

function DeckActions({
  deck,
  onTogglePin,
  onResume,
  onOpen,
}: {
  deck: ClientDeck;
  onTogglePin: () => void;
  onResume: () => void;
  onOpen: (dialog: "details" | "rename" | "copy" | "share" | "delete") => void;
}) {
  const pinned = Boolean(deck.isPinned);
  return (
    <div className="flex w-full items-center gap-2 border-t border-[#28303b] pt-3">
      <EditorialButton className="px-3" aria-label={`${pinned ? "Unpin" : "Pin"} ${deck.name}`} onClick={onTogglePin}>
        <Pin aria-hidden className="h-4 w-4 text-[#bfe5f3]" fill={pinned ? "currentColor" : "none"} strokeWidth={2} />
        <span>{pinned ? "UNPIN" : "PIN"}</span>
      </EditorialButton>
      <EditorialButton swipe className="flex-1" aria-label={`Resume ${deck.name}`} onClick={onResume}>
        <Play aria-hidden className="h-4 w-4" strokeWidth={2} />
        RESUME
      </EditorialButton>
      <EditorialMenu>
        <EditorialMenuTrigger className={cn(editorialButtonClass, "px-3")} title="More Options" aria-label={`More options for ${deck.name}`}>
          <MoreVertical aria-hidden className="h-4 w-4" strokeWidth={2} />
          <span className="sr-only">MORE</span>
        </EditorialMenuTrigger>
        <EditorialMenuContent align="end">
          <EditorialMenuItem onSelect={() => onOpen("details")}>DETAILS</EditorialMenuItem>
          <EditorialMenuItem onSelect={() => onOpen("rename")}>RENAME</EditorialMenuItem>
          <EditorialMenuItem onSelect={() => onOpen("copy")}>COPY</EditorialMenuItem>
          <EditorialMenuItem onSelect={() => onOpen("share")}>SHARE</EditorialMenuItem>
          <EditorialMenuItem className="text-red-400 data-[highlighted]:text-red-400" onSelect={() => onOpen("delete")}>
            DELETE
          </EditorialMenuItem>
        </EditorialMenuContent>
      </EditorialMenu>
    </div>
  );
}

function DeckTile(props: {
  deck: ClientDeck;
  onTogglePin: () => void;
  onResume: () => void;
  onOpen: (dialog: "details" | "rename" | "copy" | "share" | "delete") => void;
}) {
  const reducedMotion = useReducedMotion();
  const { deck } = props;
  return (
    <motion.article
      layout
      initial={false}
      transition={{ layout: reducedMotion ? { duration: 0 } : { type: "tween", duration: 0.16, ease: "easeOut" } }}
      className="flex flex-col justify-between border border-[#28303b] bg-[#14181f] p-6"
    >
      <div>
        <Cover card={coverCard(deck.mainDeck[0])} className="mb-4 aspect-square max-h-[180px] w-full" />
        <h3 className="mb-2 min-h-[2.5rem] font-space text-[16px] font-semibold uppercase leading-snug tracking-normal text-white">{deck.name}</h3>
        <span className="mb-2 inline-block border border-[#28303b] px-2 py-0.5 font-space text-[12px] font-semibold uppercase tracking-wider text-[#bfe5f3]">
          {deck.deckFormat}
        </span>
        <div className="mb-4 font-space text-[12px] uppercase tracking-wider text-[#8a96a6]">{countsLabel(deck)}</div>
      </div>
      <DeckActions {...props} />
    </motion.article>
  );
}

function CardCost({ deck, card, quantity }: { deck: ClientDeck; card: DeckCard; quantity: number }) {
  if (deck.deckFormat === "Master Duel") {
    return <span className="font-mono text-[12px] text-[#8a96a6]">{lineCraftPoints(quantity)} CP</span>;
  }
  const unit = tcgUnitPrice(card);
  if (unit === null) return null;
  return <span className="font-mono text-[12px] text-[#8a96a6]">{formatUsd(unit)} ea · {formatUsd(unit * quantity)}</span>;
}

function CardRows({ deck }: { deck: ClientDeck }) {
  return (
    <div className="archives-scroll flex max-h-[50vh] flex-1 flex-col gap-4 overflow-y-auto pr-1">
      {deckZones(deck).map((zone) => (
        <div key={zone.id}>
          <div className="mb-2 border-b border-[#28303b] pb-1 font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">
            {zone.id} DECK ({zone.cards.length})
          </div>
          {zone.cards.length === 0 ? (
            <p className="font-space text-[12px] uppercase tracking-wider text-[#8a96a6]">EMPTY</p>
          ) : (
            <div className="space-y-1">
              {groupCards(zone.cards).map(({ card, quantity }) => {
                const rarity = editorialRarity(card, deck.deckFormat);
                return (
                  <div key={`${zone.id}-${card.id}-${card.name}`} className="flex items-center justify-between border border-[#28303b] bg-[#0c0e12] px-3 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-12 w-9 shrink-0 overflow-hidden border border-[#28303b] bg-[#14181f]">
                        <CardImage card={card} preferSmall fill alt="" className="object-contain" sizes="48px" />
                        {rarity ? <RarityBadge rarity={rarity} /> : null}
                      </div>
                      <span className="truncate font-medium text-white">{card.name}</span>
                      <span className="hidden font-space text-[12px] uppercase tracking-wider text-[#8a96a6] sm:inline">{cardLine(card)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <CardCost deck={deck} card={card} quantity={quantity} />
                      <span className="font-space font-semibold text-[#bfe5f3]">×{quantity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CardGrid({ deck }: { deck: ClientDeck }) {
  return (
    <div className="archives-scroll flex max-h-[50vh] flex-1 flex-col gap-4 overflow-y-auto pr-1">
      {deckZones(deck).map((zone) => (
        <div key={zone.id}>
          <div className="mb-2 border-b border-[#28303b] pb-1 font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">
            {zone.id} DECK ({zone.cards.length})
          </div>
          {zone.cards.length === 0 ? (
            <p className="font-space text-[12px] uppercase tracking-wider text-[#8a96a6]">EMPTY</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {groupCards(zone.cards).map(({ card, quantity }) => {
                const rarity = editorialRarity(card, deck.deckFormat);
                return (
                  <div key={`${zone.id}-${card.id}-${card.name}`} className="border border-[#28303b] bg-[#0c0e12]">
                    <div className="relative aspect-[59/86] w-full">
                      <CardImage card={card} preferSmall={false} fill alt="" className="object-contain" sizes="240px" />
                      {rarity ? <RarityBadge rarity={rarity} /> : null}
                    </div>
                    <div className="space-y-1 border-t border-[#28303b] p-2">
                      <p className="line-clamp-2 font-space text-[12px] font-semibold text-white">{card.name}</p>
                      <div className="flex items-center justify-between gap-2">
                        <CardCost deck={deck} card={card} quantity={quantity} />
                        <span className="font-space text-[12px] text-[#bfe5f3]">×{quantity}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DeckCostPanel({ deck }: { deck: ClientDeck }) {
  const cost = editorialDeckCost(deck);
  if (cost.format === "Master Duel") {
    return (
      <div className="mb-4 w-fit max-w-full border border-[#28303b] bg-[#0c0e12] p-4">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">CRAFT POINTS</span>
          <span className="font-space text-[20px] font-bold leading-none text-white">{cost.totalCP} CP</span>
        </p>
        {cost.lines.length > 0 ? (
          <table className="mt-4 w-fit border-collapse">
            <caption className="sr-only">Craft points by rarity</caption>
            <thead>
              <tr className="font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">
                <th scope="col" className="pb-2 pr-8 text-left">Rarity</th>
                <th scope="col" className="pb-2 pr-8 text-right">Cards</th>
                <th scope="col" className="pb-2 text-right">CP</th>
              </tr>
            </thead>
            <tbody>
              {cost.lines.map((line) => (
                <tr key={line.rarity} className="border-t border-[#28303b]">
                  <th scope="row" className="py-2 pr-8 text-left font-normal">
                    <span className={cn("inline-block min-w-8 px-1.5 py-0.5 text-center font-space text-[12px] font-bold leading-none tracking-wider", `rarity-${line.rarity.toLowerCase()}`)}>{line.rarity}</span>
                  </th>
                  <td className="py-2 pr-8 text-right font-space text-[14px] font-semibold text-[#e2e8f0]">{line.count}</td>
                  <td className="py-2 text-right font-space text-[14px] font-semibold text-white">{line.cp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    );
  }
  return (
    <div className="mb-4 border border-[#28303b] bg-[#0c0e12] p-3">
      <span className="block font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">TCGPLAYER</span>
      <span className="font-space text-[20px] font-bold text-white">{cost.usd === null ? "—" : `${formatUsd(cost.usd)} USD`}</span>
      {cost.usd !== null && cost.priced < cost.copies ? (
        <span className="mt-1 block font-space text-[12px] uppercase tracking-wider text-[#8a96a6]">{cost.priced} of {cost.copies} cards priced</span>
      ) : null}
    </div>
  );
}

export function ArchivesScreen() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const { loadDeck, clearDeck } = useDeck();
  const { decks, isLoading, error, invalidate } = useUserDecks();
  useRouteHeadingFocus();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ArchiveDeckSort>("newest");
  const [section, setSection] = useState<SectionId>("top");
  const [dialog, setDialog] = useState<DialogId>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [copyFormat, setCopyFormat] = useState<DeckFormat>("Master Duel");
  const [newFormat, setNewFormat] = useState<DeckFormat>("Master Duel");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const capStatus = useMemo(() => getDeckCapStatus(decks.length), [decks.length]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q ? decks.filter((deck) => deck.name.toLowerCase().includes(q)) : decks;
    return sortArchiveDecks(matched, sort);
  }, [decks, query, sort]);
  const pinned = visible.filter((deck) => deck.isPinned);
  const tcg = sortArchiveDecks(visible.filter((deck) => deck.deckFormat === "TCG"), sort);
  const masterDuel = sortArchiveDecks(visible.filter((deck) => deck.deckFormat === "Master Duel"), sort);
  const liveDeck = useLiveDeckStore((state) => state.currentDeck);
  const selected = decks.find((deck) => deck.id === activeId) ?? null;
  const active = selected && liveDeck.id === selected.id
    ? {
        ...selected,
        name: liveDeck.name,
        deckFormat: liveDeck.deckFormat,
        mainDeck: liveDeck.mainDeck,
        extraDeck: liveDeck.extraDeck,
        sideDeck: liveDeck.sideDeck,
      }
    : selected;
  const continueDeck = mostRecentlyUpdated(decks);
  const legality = useMemo(() => decks.flatMap(shareBlockers), [decks]);
  const sortLabel = SORT_OPTIONS.find((option) => option.id === sort)?.label ?? "NEWEST";
  const reducedMotion = useReducedMotion();
  const focusReturn = useRef<HTMLElement | null>(null);
  const focusTimer = useRef<number | null>(null);
  const actionSeq = useRef(0);

  useEffect(() => () => {
    if (focusTimer.current !== null) window.clearTimeout(focusTimer.current);
  }, []);

  function clearFocusTimer() {
    if (focusTimer.current !== null) {
      window.clearTimeout(focusTimer.current);
      focusTimer.current = null;
    }
  }

  function noteOpener() {
    const menuTrigger = document.querySelector<HTMLElement>('[aria-haspopup="menu"][data-state="open"]');
    const opener = document.activeElement;
    focusReturn.current = menuTrigger ?? (opener instanceof HTMLElement ? opener : null);
  }

  function closeDialog() {
    const back = focusReturn.current;
    clearFocusTimer();
    setDialog(null);
    focusTimer.current = window.setTimeout(() => {
      focusTimer.current = null;
      if (back && document.contains(back)) {
        back.focus({ focusVisible: true } as FocusOptions);
      }
    }, reducedMotion === false ? 200 : 0);
  }

  async function deckSource(cached: ClientDeck, userId: string): Promise<ClientDeck> {
    const live = useLiveDeckStore.getState().currentDeck;
    if (live.id === cached.id) {
      return {
        ...cached,
        name: live.name,
        deckFormat: live.deckFormat,
        mainDeck: live.mainDeck,
        extraDeck: live.extraDeck,
        sideDeck: live.sideDeck,
      };
    }
    const fresh = await loadPersistedDeck(cached.id, userId);
    return {
      ...cached,
      name: fresh.name,
      deckFormat: fresh.deckFormat,
      isPinned: fresh.isPinned ?? cached.isPinned,
      mainDeck: fresh.mainDeck,
      extraDeck: fresh.extraDeck,
      sideDeck: fresh.sideDeck,
      updated_at: fresh.updated_at,
    };
  }

  function requireAuth(): boolean {
    if (user) return true;
    router.push("/");
    return false;
  }

  function jump(id: SectionId) {
    setSection(id);
    document.getElementById(id)?.scrollIntoView({
      block: "start",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  function openFor(deck: ClientDeck, next: Exclude<DialogId, "alerts" | "new" | null>) {
    actionSeq.current += 1;
    setBusy(false);
    clearFocusTimer();
    noteOpener();
    setActiveId(deck.id);
    setDraftName(deck.name);
    setCopyFormat(deck.deckFormat);
    setShareUrl(null);
    setActionError(null);
    setDialog(next);
  }

  async function resume(deck: ClientDeck) {
    if (!requireAuth()) return;
    setActionError(null);
    const live = useLiveDeckStore.getState();
    if (live.currentDeck.id === deck.id) {
      navigateWithViewTransition(() => router.push("/workshop"));
      return;
    }
    if (live.isDirty && live.currentDeck.name !== "New Deck") {
      setActionError("Workshop still has unsaved edits. Open that deck and let it save before resuming another list.");
      return;
    }
    await loadDeck(deck.id);
    const after = useLiveDeckStore.getState();
    if (after.error || after.currentDeck.id !== deck.id) {
      setActionError(after.error ?? "Could not open this deck.");
      return;
    }
    navigateWithViewTransition(() => router.push("/workshop"));
  }

  async function togglePin(deck: ClientDeck) {
    if (!user || !requireAuth()) return;
    setActionError(null);
    try {
      await toggleDeckPin(deck.id, user.id, !deck.isPinned);
      await invalidate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the pin.");
    }
  }

  async function saveName() {
    if (busy || !requireAuth() || !user || !active) return;
    const name = normalizeDeckName(draftName);
    if (!name) {
      setActionError("Enter a deck name.");
      return;
    }
    const deckId = active.id;
    const seq = actionSeq.current;
    const generation = useLiveDeckStore.getState().editGeneration;
    setBusy(true);
    setActionError(null);
    try {
      const source = await deckSource(active, user.id);
      if (seq !== actionSeq.current) return;
      await saveDeck({ ...source, name }, user.id, { isNewDeckId: false });
      if (seq !== actionSeq.current) return;
      const store = useLiveDeckStore.getState();
      if (store.currentDeck.id === deckId) {
        const unchanged = store.editGeneration === generation;
        store.renameDeck(name);
        if (unchanged) useLiveDeckStore.getState().markClean();
      }
      await invalidate();
      if (seq === actionSeq.current) closeDialog();
    } catch (err) {
      if (seq === actionSeq.current) {
        setActionError(err instanceof Error ? err.message : "Could not rename this deck.");
      }
    } finally {
      if (seq === actionSeq.current) setBusy(false);
    }
  }

  async function copyDeck() {
    if (busy || !requireAuth() || !user || !active) return;
    if (capStatus.hardExceeded) {
      setActionError(deckCapExceededMessage(capStatus.count));
      return;
    }
    const seq = actionSeq.current;
    setBusy(true);
    setActionError(null);
    try {
      const source = await deckSource(active, user.id);
      if (seq !== actionSeq.current) return;
      const name = normalizeDeckName(`${source.name} (Copy)`);
      if (!name) {
        setActionError("Enter a deck name.");
        return;
      }
      await saveDeck(
        { ...source, id: uuidv4(), name, deckFormat: copyFormat, isPinned: false },
        user.id,
        { isNewDeckId: true },
      );
      if (seq !== actionSeq.current) return;
      await invalidate();
      if (seq === actionSeq.current) closeDialog();
    } catch (err) {
      if (seq === actionSeq.current) {
        setActionError(err instanceof Error ? err.message : "Could not copy this deck.");
      }
    } finally {
      if (seq === actionSeq.current) setBusy(false);
    }
  }

  async function removeDeck() {
    if (busy || !requireAuth() || !user || !active) return;
    const deckId = active.id;
    const seq = actionSeq.current;
    setBusy(true);
    setActionError(null);
    try {
      if (useLiveDeckStore.getState().currentDeck.id === deckId) clearDeck();
      await deleteDeck(deckId, user.id);
      if (seq !== actionSeq.current) return;
      await invalidate();
      if (seq === actionSeq.current) closeDialog();
    } catch (err) {
      if (seq === actionSeq.current) {
        setActionError(err instanceof Error ? err.message : "Could not delete this deck.");
      }
    } finally {
      if (seq === actionSeq.current) setBusy(false);
    }
  }

  async function createShare() {
    if (busy || !requireAuth() || !user || !active) return;
    const seq = actionSeq.current;
    setBusy(true);
    setActionError(null);
    try {
      const source = await deckSource(active, user.id);
      if (seq !== actionSeq.current) return;
      if (!isDeckLegalForShare(source)) {
        setActionError(shareBlockers(source)[0] ?? "This deck is not a legal size.");
        return;
      }
      const { createDeckShare, getDeckShareFullUrl, toDeckShareRequest } = await import("@/lib/api/deckShare");
      const result = await createDeckShare({ deck: toDeckShareRequest(source) });
      if (seq !== actionSeq.current) return;
      setShareUrl(getDeckShareFullUrl(result.shareUrl));
    } catch (err) {
      if (seq === actionSeq.current) {
        setActionError(err instanceof Error ? err.message : "Could not create a share link.");
      }
    } finally {
      if (seq === actionSeq.current) setBusy(false);
    }
  }

  function startNewDeck() {
    if (!requireAuth()) return;
    if (capStatus.hardExceeded) {
      setActionError(deckCapExceededMessage(capStatus.count));
      return;
    }
    actionSeq.current += 1;
    setBusy(false);
    clearFocusTimer();
    setActionError(null);
    noteOpener();
    setDialog("new");
  }

  function confirmNewDeck() {
    clearDeck(newFormat);
    closeDialog();
    navigateWithViewTransition(() => router.push(`/workshop?mode=${encodeURIComponent(newFormat)}`));
  }

  return (
    <div className="archives-shell fixed inset-0 z-20 flex flex-col overflow-hidden bg-[#0c0e12] text-[#e2e8f0]">
      <header className="z-40 flex h-16 w-full shrink-0 items-center border-b border-[#28303b] bg-[#0c0e12] px-12">
        <div className="font-orbitron whitespace-nowrap text-left text-[14px] font-semibold uppercase tracking-[0.25em] text-[#f1f5f9]">
          MASTER DECK ALCHEMIST
        </div>
      </header>
      <div className="flex min-h-0 w-full flex-1 flex-row overflow-hidden">
        <aside aria-label="Archives" className="archives-scroll flex h-full w-[260px] min-w-[260px] max-w-[260px] shrink-0 flex-col justify-between overflow-y-auto border-r border-[#28303b] bg-[#0c0e12]">
          <nav className="flex flex-col gap-1.5 p-2" aria-label="Archives sections">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={section === item.id ? "true" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center border border-transparent px-4 font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6] transition-colors hover:bg-[#28303b] hover:text-[#e2e8f0] focus:border-[#bfe5f3] focus:outline-none focus-visible:border-[#bfe5f3]",
                  section === item.id && "bg-[#28303b] text-[#e2e8f0]",
                )}
                onClick={() => jump(item.id)}
              >
                {section === item.id ? (
                  <motion.span
                    layoutId="archives-nav-ice"
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 left-0 top-0 w-[2px] bg-[#bfe5f3]"
                    transition={reducedMotion ? { duration: 0 } : { type: "tween", duration: 0.16, ease: "easeOut" }}
                  />
                ) : null}
                <ArchiveIcon icon={item.icon} className="mr-2.5" />
                {item.label}
              </button>
            ))}
            <EditorialButton swipe className="mt-2 w-full justify-between px-4 text-left" disabled={capStatus.hardExceeded} onClick={startNewDeck}>
              <span className="flex items-center">
                <Plus aria-hidden className="mr-2 h-4 w-4" strokeWidth={2} />
                NEW DECK
              </span>
              <span className="accent-mark h-[10px] w-[2px]" />
            </EditorialButton>
          </nav>
          <div className="border-t border-[#28303b] bg-[#0c0e12] p-4">
            <div className="flex items-center justify-between font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">
              <span>{user ? "STATUS: ONLINE" : "STATUS: SIGNED OUT"}</span>
              <span className="h-[10px] w-[2px] bg-[#bfe5f3]" />
            </div>
            <div className="mt-2 font-space text-[12px] tracking-wider text-[#8a96a6]">
              {decks.length}/{DECK_CAP_HARD} DECKS
            </div>
          </div>
        </aside>
        <main id="main-content" tabIndex={-1} className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#0c0e12] focus-visible:outline-none">
          <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#28303b] bg-[#0c0e12] px-4 py-2 lg:px-8">
            <div className="relative flex min-w-[200px] max-w-sm flex-1 items-center">
              <Search aria-hidden className="pointer-events-none absolute left-3 h-4 w-4 text-[#8a96a6]" strokeWidth={2} />
              <input
                aria-label="Search decks"
                value={query}
                placeholder="Search decks"
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-11 w-full border border-[#28303b] bg-[#0c0e12] py-2 pl-10 pr-4 text-[15px] font-normal leading-6 text-[#e2e8f0] placeholder:text-[#8a96a6] focus:border-[#bfe5f3] focus:outline-none focus-visible:border-[#bfe5f3]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">
                {visible.length} DECKS · {pinned.length} PINNED
              </span>
              <span className="hidden h-6 w-px bg-[#28303b] sm:block" />
              <EditorialMenu>
                <EditorialMenuTrigger className={editorialButtonClass} aria-label={`Sort: ${sortLabel}`}>
                  SORT: {sortLabel} ▾
                </EditorialMenuTrigger>
                <EditorialMenuContent align="start" className="min-w-[160px]">
                  {SORT_OPTIONS.map((option) => (
                    <EditorialMenuItem
                      key={option.id}
                      className="bg-[#14181f] data-[highlighted]:!bg-[#e2e8f0] data-[highlighted]:!text-[#0c0e12]"
                      onSelect={() => setSort(option.id)}
                    >
                      {option.label}
                    </EditorialMenuItem>
                  ))}
                </EditorialMenuContent>
              </EditorialMenu>
              <EditorialButton swipe onClick={() => { clearFocusTimer(); noteOpener(); setDialog("alerts"); }}>
                <Bell aria-hidden className="h-4 w-4" strokeWidth={2} />
                ALERTS ({legality.length})
              </EditorialButton>
            </div>
          </header>
          <motion.div layoutScroll className="archives-scroll relative flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            <div id="top" className="scroll-mt-6" />
            <div className="mb-6 flex flex-col justify-between gap-2 border-b border-[#28303b] pb-3 md:flex-row md:items-baseline">
              <div>
                <h1 data-page-heading tabIndex={-1} className="font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6] outline-none">ARCHIVES // DECKLISTS</h1>
                <p className="mt-1 text-[15px] font-normal leading-6 text-[#e2e8f0]">Resume editing a decklist or initiate a new build.</p>
              </div>
            </div>
            {actionError ? <p role="alert" className="mb-4 border border-[#28303b] px-3 py-2 font-space text-[12px] uppercase tracking-wider text-red-400">{actionError}</p> : null}
            {error ? <p role="alert" className="mb-4 border border-[#28303b] px-3 py-2 font-space text-[12px] uppercase tracking-wider text-red-400">{error}</p> : null}
            {!user ? (
              <p role="status" className="mb-4 border border-[#28303b] px-3 py-2 text-[15px] leading-6 text-[#e2e8f0]">
                Sign in to sync and manage your decks.{" "}
                <button type="button" className="font-space text-[12px] font-semibold uppercase tracking-wider text-[#bfe5f3]" onClick={() => router.push("/")}>Log in</button>
              </p>
            ) : null}
            {user && capStatus.softExceeded ? (
              <p role="status" className="mb-4 border border-[#28303b] px-3 py-2 text-[15px] leading-6 text-[#e2e8f0]">
                {capStatus.hardExceeded ? deckCapExceededMessage(capStatus.count) : deckCapSoftWarningMessage(capStatus.count)} ({capStatus.count}/{DECK_CAP_HARD})
              </p>
            ) : null}
            {user && isLoading ? <p role="status" className="mb-6 font-space text-[12px] uppercase tracking-wider text-[#8a96a6]">SYNCING DECK ARCHIVES</p> : null}

            <section className="mb-10 scroll-mt-6" aria-labelledby="continue-heading">
              <SectionHeading headingId="continue-heading" label="CONTINUE" />
              {continueDeck ? (
                <div className="flex flex-col items-stretch justify-between gap-6 border border-[#28303b] bg-[#14181f] p-6 lg:flex-row">
                  <div className="flex flex-col items-start gap-6 sm:flex-row">
                    <Cover card={coverCard(continueDeck.mainDeck[0])} className="h-[140px] w-[140px] min-w-[140px]" />
                    <div className="flex flex-col justify-between py-1">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="border border-[#28303b] px-2 py-1 font-space text-[12px] font-semibold uppercase tracking-wider text-white">{continueDeck.deckFormat}</span>
                          <span className="font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">{modifiedLabel(continueDeck.updated_at)}</span>
                        </div>
                        <h3 className="mt-2 font-space text-[24px] font-semibold uppercase tracking-normal text-white">{continueDeck.name}</h3>
                        <div className="mt-2 font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">{countsLabel(continueDeck)}</div>
                      </div>
                      <div className="mt-4 pt-2">
                        <EditorialButton swipe className="px-5" aria-label={`Resume ${continueDeck.name}`} onClick={() => void resume(continueDeck)}>
                          <Play aria-hidden className="h-4 w-4" strokeWidth={2} />
                          RESUME
                          <span className="accent-mark ml-2 h-[10px] w-[2px]" />
                        </EditorialButton>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between border border-[#28303b] bg-[#14181f] p-6 lg:min-w-[360px]">
                    <div>
                      <div className="mb-3 border-b border-[#28303b] pb-2 font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">DIAGNOSTIC MATRIX</div>
                      <p className="font-space text-[12px] uppercase leading-6 tracking-wider text-[#e2e8f0]">Strategist readout is not connected for this deck.</p>
                    </div>
                  </div>
                </div>
              ) : user && isLoading ? null : (
                <p className="border border-[#28303b] bg-[#14181f] p-6 font-space text-[12px] uppercase tracking-wider text-[#8a96a6]">NO DECK TO RESUME.</p>
              )}
            </section>

            <section id="pinned" className="mb-10 scroll-mt-6" aria-labelledby="pinned-heading">
              <SectionHeading headingId="pinned-heading" label="PINNED" count={pinned.length} />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pinned.map((deck) => (
                  <DeckTile key={`pinned-${deck.id}`} deck={deck} onTogglePin={() => void togglePin(deck)} onResume={() => void resume(deck)} onOpen={(next) => openFor(deck, next)} />
                ))}
              </div>
            </section>
            <section id="tcg" className="mb-10 scroll-mt-6" aria-labelledby="tcg-heading">
              <SectionHeading headingId="tcg-heading" label="TCG" count={tcg.length} />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tcg.map((deck) => (
                  <DeckTile key={`tcg-${deck.id}`} deck={deck} onTogglePin={() => void togglePin(deck)} onResume={() => void resume(deck)} onOpen={(next) => openFor(deck, next)} />
                ))}
              </div>
            </section>
            <section id="master-duel" className="mb-10 scroll-mt-6" aria-labelledby="md-heading">
              <SectionHeading headingId="md-heading" label="MASTER DUEL" count={masterDuel.length} />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {masterDuel.map((deck) => (
                  <DeckTile key={`md-${deck.id}`} deck={deck} onTogglePin={() => void togglePin(deck)} onResume={() => void resume(deck)} onOpen={(next) => openFor(deck, next)} />
                ))}
              </div>
            </section>
            {user && !isLoading && visible.length === 0 ? (
              <p className="font-space text-[12px] uppercase tracking-wider text-[#8a96a6]">
                {query.trim() ? "NO DECKS MATCH THAT SEARCH." : "NO DECKS YET. USE NEW DECK TO START A LIST."}
              </p>
            ) : null}
          </motion.div>
        </main>
      </div>
      <footer className="flex h-[52px] min-h-12 w-full shrink-0 flex-row items-center justify-between border-t border-[#28303b] bg-[#0c0e12] px-6">
        <div className="font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">© 2025 MASTER DECK ALCHEMIST. TECHNICAL MANUSCRIPT SPECIFICATION.</div>
        <div className="font-space text-[12px] uppercase tracking-wider text-[#8a96a6]">YU-GI-OH! IS THE INTELLECTUAL PROPERTY OF KONAMI AND 4K TV.</div>
      </footer>

      <EditorialDialog open={dialog === "alerts"} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <EditorialDialogContent className="max-w-lg">
          <div className="mb-4 flex items-center justify-between border-b border-[#28303b] pb-3">
            <div className="flex items-center gap-2">
              <span className="h-[10px] w-[2px] bg-[#bfe5f3]" />
              <EditorialDialogTitle>ALERTS // SYSTEM DIAGNOSTICS</EditorialDialogTitle>
            </div>
            <EditorialButton swipe className="min-h-8 min-w-8 px-2" aria-label="Close" onClick={() => closeDialog()}><X aria-hidden className="h-4 w-4" strokeWidth={2} /></EditorialButton>
          </div>
          <EditorialDialogDescription className="sr-only">Deck size and copy-limit issues from your saved decks.</EditorialDialogDescription>
          <div className="mb-2 font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">LEGALITY</div>
          <div className="space-y-2 border border-[#28303b] bg-[#0c0e12] p-3">
            {legality.length === 0 ? (
              <p className="font-space text-[12px] text-[#8a96a6]">No legality issues in the saved decks.</p>
            ) : (
              legality.map((issue, index) => (
                <p key={`${index}:${issue}`} className="font-space text-[12px] uppercase text-[#e2e8f0]">{issue}</p>
              ))
            )}
          </div>
          <p className="mt-3 font-space text-[12px] uppercase tracking-wider text-[#8a96a6]">Banlist sync time is not available from this screen.</p>
          <div className="mt-6 border-t border-[#28303b] pt-4">
            <EditorialButton swipe className="w-full" onClick={() => closeDialog()}>CLOSE</EditorialButton>
          </div>
        </EditorialDialogContent>
      </EditorialDialog>

      <EditorialDialog open={dialog === "details" && active !== null} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        {active ? (
          <EditorialDialogContent className="max-w-3xl">
            <div className="mb-4 flex items-start justify-between border-b border-[#28303b] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-[10px] w-[2px] bg-[#bfe5f3]" />
                  <EditorialDialogTitle className="text-[#8a96a6]">DECK LIST // {active.deckFormat.toUpperCase()} ARCHIVE</EditorialDialogTitle>
                </div>
                <EditorialDialogDescription className="mt-1 text-[20px] font-semibold normal-case tracking-normal text-white">{active.name}</EditorialDialogDescription>
                <div className="mt-0.5 font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">{active.deckFormat} · {countsLabel(active)}</div>
              </div>
              <EditorialButton swipe className="min-h-8 min-w-8 px-2" aria-label="Close" onClick={() => closeDialog()}><X aria-hidden className="h-4 w-4" strokeWidth={2} /></EditorialButton>
            </div>
            <DeckCostPanel deck={active} />
            <EditorialTabs defaultValue="list" className="flex min-h-0 flex-1 flex-col">
              <EditorialTabsList className="inline-flex w-fit gap-0 border border-[#28303b] p-0" aria-label="Deck list layout">
                <EditorialTabsTrigger value="list" aria-label="List view" className="w-11 border-0 border-r border-[#28303b] px-0">
                  <List aria-hidden className="h-4 w-4" strokeWidth={2} />
                </EditorialTabsTrigger>
                <EditorialTabsTrigger value="grid" aria-label="Grid view" className="w-11 border-0 px-0">
                  <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={2} />
                </EditorialTabsTrigger>
              </EditorialTabsList>
              <EditorialTabsContent value="list" className="flex min-h-0 flex-1 flex-col"><CardRows deck={active} /></EditorialTabsContent>
              <EditorialTabsContent value="grid" className="min-h-0 flex-1"><CardGrid deck={active} /></EditorialTabsContent>
            </EditorialTabs>
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#28303b] pt-4">
              <EditorialButton swipe onClick={() => closeDialog()}>CLOSE</EditorialButton>
              <EditorialButton swipe onClick={() => void resume(active)}>
                RESUME
                <span className="accent-mark ml-2 h-[10px] w-[2px]" />
              </EditorialButton>
            </div>
          </EditorialDialogContent>
        ) : null}
      </EditorialDialog>

      <EditorialDialog open={dialog === "rename" && active !== null} onOpenChange={(open) => { if (!open && !busy) closeDialog(); }}>
        <EditorialDialogContent className="max-w-md">
          <div className="mb-4 flex items-center justify-between border-b border-[#28303b] pb-3">
            <div className="flex items-center gap-2">
              <span className="h-[10px] w-[2px] bg-[#bfe5f3]" />
              <EditorialDialogTitle>RENAME DECK</EditorialDialogTitle>
            </div>
            <EditorialButton swipe disabled={busy} className="min-h-8 min-w-8 px-2" aria-label="Close" onClick={() => closeDialog()}><X aria-hidden className="h-4 w-4" strokeWidth={2} /></EditorialButton>
          </div>
          <EditorialDialogDescription className="sr-only">Enter a new deck name.</EditorialDialogDescription>
          <label className="mb-2 block font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]" htmlFor="rename-deck">NEW IDENTIFIER</label>
          <input
            id="rename-deck"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveName();
            }}
            className="w-full border border-[#28303b] bg-[#0c0e12] p-2 font-space text-[14px] text-white focus-visible:border-[#bfe5f3] focus-visible:outline-none"
          />
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#28303b] pt-4">
            <EditorialButton swipe disabled={busy} onClick={() => closeDialog()}>CANCEL</EditorialButton>
            <EditorialButton swipe disabled={busy} onClick={() => void saveName()}>SAVE</EditorialButton>
          </div>
        </EditorialDialogContent>
      </EditorialDialog>

      <EditorialDialog open={dialog === "copy" && active !== null} onOpenChange={(open) => { if (!open && !busy) closeDialog(); }}>
        <EditorialDialogContent className="max-w-md">
          <div className="mb-4 flex items-center justify-between border-b border-[#28303b] pb-3">
            <div className="flex items-center gap-2">
              <span className="h-[10px] w-[2px] bg-[#bfe5f3]" />
              <EditorialDialogTitle>COPY DECK</EditorialDialogTitle>
            </div>
            <EditorialButton swipe disabled={busy} className="min-h-8 min-w-8 px-2" aria-label="Close" onClick={() => closeDialog()}><X aria-hidden className="h-4 w-4" strokeWidth={2} /></EditorialButton>
          </div>
          <EditorialDialogDescription className="mb-4 text-[14px] normal-case tracking-normal text-[#e2e8f0]">
            Copy {active?.name ?? "this deck"} into a new deck.
          </EditorialDialogDescription>
          <div className="font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]">TARGET FORMAT</div>
          <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Target format">
            {(["Master Duel", "TCG"] as const).map((format) => (
              <EditorialButton key={format} role="radio" aria-checked={copyFormat === format} className={cn("w-full px-4 py-3", copyFormat === format && "bg-[#e2e8f0] text-[#0c0e12]")} onClick={() => setCopyFormat(format)}>
                {format}
              </EditorialButton>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#28303b] pt-4">
            <EditorialButton swipe disabled={busy} onClick={() => closeDialog()}>CANCEL</EditorialButton>
            <EditorialButton swipe disabled={busy} onClick={() => void copyDeck()}>COPY</EditorialButton>
          </div>
        </EditorialDialogContent>
      </EditorialDialog>

      <EditorialDialog open={dialog === "share" && active !== null} onOpenChange={(open) => { if (!open && !busy) closeDialog(); }}>
        <EditorialDialogContent className="max-w-md">
          <div className="mb-4 flex items-center justify-between border-b border-[#28303b] pb-3">
            <div className="flex items-center gap-2">
              <span className="h-[10px] w-[2px] bg-[#bfe5f3]" />
              <EditorialDialogTitle>SHARE DECK</EditorialDialogTitle>
            </div>
            <EditorialButton swipe disabled={busy} className="min-h-8 min-w-8 px-2" aria-label="Close" onClick={() => closeDialog()}><X aria-hidden className="h-4 w-4" strokeWidth={2} /></EditorialButton>
          </div>
          <EditorialDialogDescription className="sr-only">Share link for a legal deck.</EditorialDialogDescription>
          {active && isDeckLegalForShare(active) ? (
            <>
              <label className="mb-1 block font-space text-[12px] font-semibold uppercase tracking-wider text-[#8a96a6]" htmlFor="share-url">PUBLIC VAULT URL</label>
              <input id="share-url" readOnly value={shareUrl ?? ""} placeholder="Create a link" className="w-full border border-[#28303b] bg-[#0c0e12] p-2 font-mono text-[12px] text-[#e2e8f0]" />
              {!shareUrl ? (
                <EditorialButton swipe className="mt-3" disabled={busy} onClick={() => void createShare()}>CREATE LINK</EditorialButton>
              ) : null}
            </>
          ) : (
            <div className="space-y-2">
              {(active ? shareBlockers(active) : []).map((issue) => (
                <p key={issue} className="font-space text-[12px] uppercase text-[#e2e8f0]">{issue}</p>
              ))}
              <p className="font-space text-[12px] uppercase tracking-wider text-[#8a96a6]">A share link is available when the deck is a legal size.</p>
            </div>
          )}
          <div className="mt-6 border-t border-[#28303b] pt-4">
            <EditorialButton swipe className="w-full" onClick={() => closeDialog()}>CLOSE</EditorialButton>
          </div>
        </EditorialDialogContent>
      </EditorialDialog>

      <EditorialDialog open={dialog === "delete" && active !== null} onOpenChange={(open) => { if (!open && !busy) closeDialog(); }}>
        <EditorialDialogContent className="max-w-md">
          <div className="mb-4 flex items-center justify-between border-b border-[#28303b] pb-3">
            <div className="flex items-center gap-2">
              <span className="h-[10px] w-[2px] bg-red-400" />
              <EditorialDialogTitle className="text-red-400">DELETE DECK</EditorialDialogTitle>
            </div>
            <EditorialButton swipe disabled={busy} className="min-h-8 min-w-8 px-2" aria-label="Close" onClick={() => closeDialog()}><X aria-hidden className="h-4 w-4" strokeWidth={2} /></EditorialButton>
          </div>
          <EditorialDialogDescription className="mb-2 text-[14px] normal-case tracking-normal text-[#e2e8f0]">
            Delete {active?.name ?? "this deck"}? This cannot be undone.
          </EditorialDialogDescription>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#28303b] pt-4">
            <EditorialButton swipe disabled={busy} onClick={() => closeDialog()}>CANCEL</EditorialButton>
            <EditorialButton swipe disabled={busy} className="text-red-400 hover:text-red-600" onClick={() => void removeDeck()}>DELETE</EditorialButton>
          </div>
        </EditorialDialogContent>
      </EditorialDialog>

      <EditorialDialog open={dialog === "new"} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <EditorialDialogContent className="max-w-md">
          <div className="mb-4 flex items-center justify-between border-b border-[#28303b] pb-3">
            <div className="flex items-center gap-2">
              <span className="h-[10px] w-[2px] bg-[#bfe5f3]" />
              <EditorialDialogTitle>NEW DECK</EditorialDialogTitle>
            </div>
            <EditorialButton swipe className="min-h-8 min-w-8 px-2" aria-label="Close" onClick={() => closeDialog()}><X aria-hidden className="h-4 w-4" strokeWidth={2} /></EditorialButton>
          </div>
          <EditorialDialogDescription className="mb-4 text-[14px] normal-case tracking-normal text-[#e2e8f0]">
            Choose a format. The new list opens in Workshop.
          </EditorialDialogDescription>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="New deck format">
            {(["Master Duel", "TCG"] as const).map((format) => (
              <EditorialButton key={format} role="radio" aria-checked={newFormat === format} className={cn("w-full px-4 py-3", newFormat === format && "bg-[#e2e8f0] text-[#0c0e12]")} onClick={() => setNewFormat(format)}>
                {format}
              </EditorialButton>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#28303b] pt-4">
            <EditorialButton swipe onClick={() => closeDialog()}>CANCEL</EditorialButton>
            <EditorialButton swipe onClick={confirmNewDeck}>CREATE</EditorialButton>
          </div>
        </EditorialDialogContent>
      </EditorialDialog>
    </div>
  );
}
