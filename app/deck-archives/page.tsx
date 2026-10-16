"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, Plus } from "lucide-react";
import { MdaAppHeader } from "@/components/mda/app-header";
import { ClipButton } from "@/components/mda/clip-button";
import { MdaSearchField } from "@/components/mda/search-field";
import { MdaCollapse } from "@/components/mda/collapse";
import { DeckArchiveCard } from "@/components/mda/deck-archive-card";
import {
  DeckDetailsModal,
  FormatPickerPopover,
} from "@/components/mda/archives-dialogs";
import { DeckArchiveActionPopovers } from "@/components/mda/archives-popovers";
import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";
import { useUserStore } from "@/store/useUserStore";
import { useDeck } from "@/context/deck-context";
import { useUserDecks } from "@/hooks/useUserDecks";
import { deleteDeck, saveDeck, toggleDeckPin } from "@/lib/data/decks";
import {
  createDeckShare,
  getDeckShareFullUrl,
  toDeckShareRequest,
} from "@/lib/api/deckShare";
import { isDeckLegalForShare } from "@/lib/validation/deck-validator";
import {
  DECK_CAP_HARD,
  deckCapExceededMessage,
  deckCapSoftWarningMessage,
  getDeckCapStatus,
} from "@/lib/deck/deck-caps";
import { normalizeDeckName } from "@/lib/deck/normalize-deck-name";
import {
  ARCHIVE_DECK_SORTS,
  sortArchiveDecks,
  type ArchiveDeckSort,
} from "@/lib/deck/sort-archive-decks";
import { useLiveDeckStore } from "@/store/liveDeckStore";
import type { DeckFormat, DeckType } from "@/types/deck";
import { v4 as uuidv4 } from "uuid";

export default function DeckArchivesPage(): ReactNode {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const { loadDeck, clearDeck } = useDeck();
  const { decks, isLoading, error, invalidate } = useUserDecks();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ArchiveDeckSort>("newest");
  const [capError, setCapError] = useState<string | null>(null);

  const [detailsDeck, setDetailsDeck] = useState<DeckType | null>(null);
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [newDeckFormat, setNewDeckFormat] = useState<DeckFormat>("Master Duel");
  const [alertsOpen, setAlertsOpen] = useState(false);

  const capStatus = useMemo(() => getDeckCapStatus(decks.length), [decks.length]);

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? decks.filter((deck) => deck.name.toLowerCase().includes(q))
      : decks;
    return sortArchiveDecks(matched, sort);
  }, [decks, query, sort]);

  const pinnedCount = listed.filter((deck) => deck.isPinned).length;

  const requireAuth = (): boolean => {
    if (user) return true;
    router.push("/");
    return false;
  };

  const openWorkshop = async (deck: DeckType): Promise<void> => {
    if (!user) return;
    await loadDeck(deck.id);
    router.push("/workshop");
  };

  const handleNewDeckConfirm = (): void => {
    if (!requireAuth()) return;
    if (capStatus.hardExceeded) {
      setCapError(deckCapExceededMessage(capStatus.count));
      setNewDeckOpen(false);
      return;
    }
    setCapError(null);
    clearDeck(newDeckFormat);
    setNewDeckOpen(false);
    router.push(`/workshop?mode=${encodeURIComponent(newDeckFormat)}`);
  };

  const handleCopyConfirm = async (
    source: DeckType,
    format: DeckFormat,
  ): Promise<void> => {
    if (!user) return;
    if (capStatus.hardExceeded) {
      setCapError(deckCapExceededMessage(capStatus.count));
      return;
    }
    setCapError(null);
    const duplicate: DeckType = {
      ...source,
      id: uuidv4(),
      name: `${source.name} (Copy)`,
      deckFormat: format,
      isPinned: false,
    };
    try {
      await saveDeck(duplicate, user.id);
      await invalidate();
    } catch (err) {
      setCapError(
        err instanceof Error ? err.message : deckCapExceededMessage(capStatus.count),
      );
    }
  };

  const handleDeleteConfirm = async (deck: DeckType): Promise<void> => {
    if (!user) return;
    await deleteDeck(deck.id, user.id);
    await invalidate();
  };

  const handleRenameConfirm = async (
    deck: DeckType,
    nextName: string,
  ): Promise<void> => {
    if (!user) return;
    const name = normalizeDeckName(nextName);
    if (!name) throw new Error("Enter a deck name.");
    const updated: DeckType = { ...deck, name };
    await saveDeck(updated, user.id, { isNewDeckId: false });
    const live = useLiveDeckStore.getState().currentDeck;
    if (live.id === deck.id) {
      useLiveDeckStore.getState().renameDeck(name);
      useLiveDeckStore.getState().markClean();
    }
    setDetailsDeck((prev) =>
      prev && prev.id === deck.id ? { ...prev, name } : prev,
    );
    await invalidate();
  };

  const createShareUrl = async (deck: DeckType): Promise<string> => {
    if (!user) throw new Error("Auth required");
    const result = await createDeckShare({
      deck: toDeckShareRequest(deck),
    });
    return getDeckShareFullUrl(result.shareUrl);
  };

  const renderCard = (deck: DeckType): ReactNode => (
    <DeckArchiveCard
      key={deck.id}
      className="max-w-none"
      name={deck.name}
      deckFormat={deck.deckFormat}
      isPinned={Boolean(deck.isPinned)}
      mainCount={deck.mainDeck.length}
      extraCount={deck.extraDeck.length}
      sideCount={deck.sideDeck.length}
      coverCard={deck.mainDeck[0] ?? null}
      onOpen={() => {
        if (!requireAuth()) return;
        void openWorkshop(deck);
      }}
      onDetails={() => setDetailsDeck(deck)}
      onCopy={() => undefined}
      onShare={() => undefined}
      onDelete={() => undefined}
      onTogglePin={() => {
        if (!user) return;
        void toggleDeckPin(deck.id, user.id, !deck.isPinned).then(invalidate);
      }}
      actionControls={
        <DeckArchiveActionPopovers
          deckName={deck.name}
          deckFormat={deck.deckFormat}
          canShare={isDeckLegalForShare(deck)}
          onCopyConfirm={(mode) => {
            if (!requireAuth()) return;
            void handleCopyConfirm(deck, mode);
          }}
          onRenameConfirm={async (name) => {
            if (!requireAuth()) throw new Error("Auth required");
            await handleRenameConfirm(deck, name);
          }}
          onDeleteConfirm={() => {
            if (!requireAuth()) return;
            void handleDeleteConfirm(deck);
          }}
          onShareOpen={async () => {
            if (!requireAuth()) throw new Error("Auth required");
            return createShareUrl(deck);
          }}
        />
      }
    />
  );

  return (
    <div className="relative flex min-h-full flex-col bg-mda-bg text-mda-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[120px] z-0 select-none overflow-hidden"
      >
        <p className="whitespace-nowrap text-center font-display text-[clamp(4rem,18vw,14rem)] font-black uppercase leading-none tracking-tight text-mda-watermark">
          Archives
        </p>
      </div>

      {/* Only block UI on cold load — cached data skips the loading screen */}
      <MdaLoadingScreen
        open={Boolean(user) && isLoading}
        status="Syncing deck archives from your library…"
      />

      <MdaAppHeader theme="light" onLoginClick={() => router.push("/")} />

      <div className="relative z-10 flex flex-col gap-6 px-6 pb-10 pt-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="font-display text-3xl font-black uppercase tracking-wide text-mda-ink sm:text-4xl">
              Deck Archives
            </h1>
            <p className="font-open-sans text-sm text-mda-ink-muted">
              {listed.length} {listed.length === 1 ? "deck" : "decks"}
              {pinnedCount > 0 ? ` · ${pinnedCount} pinned` : ""}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <MdaSearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search decks"
              aria-label="Search decks"
              containerClassName="w-full lg:max-w-md lg:flex-1"
            />
            <label className="flex h-11 shrink-0 items-center gap-2 border border-mda-ink/15 bg-mda-surface px-3">
              <span className="font-mda text-xs font-bold uppercase tracking-wide text-mda-ink-muted">
                Sort
              </span>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as ArchiveDeckSort)
                }
                className="h-full bg-transparent font-mda text-sm font-semibold uppercase tracking-wide text-mda-ink focus:outline-none"
              >
                {ARCHIVE_DECK_SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2 lg:ml-auto">
              <button
                type="button"
                onClick={() => setAlertsOpen((value) => !value)}
                aria-label="Deck archives alerts"
                aria-expanded={alertsOpen}
                aria-controls="deck-archives-alerts"
                data-magnetic
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-mda-ink transition-colors duration-200 ease-in-out hover:bg-mda-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-focus"
              >
                <Bell className="h-5 w-5" aria-hidden />
              </button>
              <FormatPickerPopover
                title="New deck format"
                open={newDeckOpen}
                onOpenChange={(next) => {
                  if (next && !requireAuth()) return;
                  if (next && capStatus.hardExceeded) {
                    setCapError(deckCapExceededMessage(capStatus.count));
                    return;
                  }
                  setNewDeckOpen(next);
                }}
                deckFormat={newDeckFormat}
                onDeckFormatChange={setNewDeckFormat}
                onCancel={() => setNewDeckOpen(false)}
                onConfirm={handleNewDeckConfirm}
                side="bottom"
                align="end"
                trigger={
                  <ClipButton
                    size="sm"
                    variant="filled"
                    className="shrink-0 gap-2"
                    disabled={capStatus.hardExceeded}
                    aria-disabled={capStatus.hardExceeded}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    New Deck
                  </ClipButton>
                }
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {!user ? (
            <div
              className="border border-mda-ink/15 bg-mda-panel px-4 py-3 font-open-sans text-sm text-mda-ink"
              role="status"
            >
              Preview mode — sign in to sync and manage your decks.{" "}
              <button
                type="button"
                onClick={() => router.push("/")}
                className="font-mda font-bold uppercase text-mda-sky-strong underline"
              >
                Log in
              </button>
            </div>
          ) : null}

          {user && capStatus.softExceeded ? (
            <p
              className="border border-mda-ink/20 bg-mda-panel px-4 py-3 font-open-sans text-sm text-mda-ink"
              role="status"
            >
              {capStatus.hardExceeded
                ? deckCapExceededMessage(capStatus.count)
                : deckCapSoftWarningMessage(capStatus.count)}{" "}
              <span className="text-mda-ink-muted">
                ({capStatus.count}/{DECK_CAP_HARD})
              </span>
            </p>
          ) : null}

          {capError ? (
            <p
              className="border border-mda-danger/40 bg-mda-panel px-4 py-3 font-open-sans text-sm text-mda-danger"
              role="alert"
            >
              {capError}
            </p>
          ) : null}

          {error ? (
            <p
              className="border border-mda-danger/40 bg-mda-panel px-4 py-3 font-open-sans text-sm text-mda-danger"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <MdaCollapse open={alertsOpen}>
            <div
              id="deck-archives-alerts"
              className="max-w-xl border border-mda-ink/15 bg-mda-panel p-4"
            >
              <h2 className="font-mda text-sm font-bold uppercase tracking-wide text-mda-ink-strong">
                Deck Archives Alerts
              </h2>
              <p className="mt-2 font-open-sans text-sm text-mda-ink">
                Database and banlist sync status will appear here when available.
              </p>
              <p className="mt-1 font-open-sans text-sm text-mda-ink-muted">
                No outstanding legality issues detected.
              </p>
            </div>
          </MdaCollapse>
        </div>

        {listed.length === 0 ? (
          <div className="flex max-w-md flex-col items-start gap-3 border border-dashed border-mda-ink/20 bg-mda-surface px-6 py-8">
            <h2 className="font-mda text-sm font-bold uppercase tracking-wide text-mda-ink-strong">
              {query.trim() ? "No decks match that search" : "No decks yet"}
            </h2>
            <p className="font-open-sans text-sm text-mda-ink-muted">
              {query.trim()
                ? "Try another name, or clear the search to see the full library."
                : "Use New Deck to start a list, then refine it in Workshop."}
            </p>
            {query.trim() ? (
              <ClipButton
                size="sm"
                variant="ghost"
                onClick={() => setQuery("")}
              >
                Clear search
              </ClipButton>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listed.slice(0, pinnedCount).map((deck) => renderCard(deck))}
            {pinnedCount > 0 && pinnedCount < listed.length ? (
              <div
                className="col-span-full h-px bg-mda-ink/15"
                aria-hidden
              />
            ) : null}
            {listed.slice(pinnedCount).map((deck) => renderCard(deck))}
          </div>
        )}
      </div>

      <DeckDetailsModal
        open={Boolean(detailsDeck)}
        deck={detailsDeck}
        onClose={() => setDetailsDeck(null)}
        onOpenWorkshop={() => {
          if (detailsDeck) void openWorkshop(detailsDeck);
        }}
        onRename={async (name) => {
          if (!detailsDeck) return;
          if (!requireAuth()) throw new Error("Auth required");
          await handleRenameConfirm(detailsDeck, name);
        }}
      />
    </div>
  );
}
