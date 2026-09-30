"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, Pin, Plus } from "lucide-react";
import { MdaAppHeader } from "@/components/mda/app-header";
import { ClipButton } from "@/components/mda/clip-button";
import { MdaSearchField } from "@/components/mda/search-field";
import { SectionCollapse } from "@/components/mda/section-collapse";
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
import { useLiveDeckStore } from "@/store/liveDeckStore";
import type { DeckFormat, DeckType } from "@/types/deck";
import { v4 as uuidv4 } from "uuid";

export default function DeckArchivesPage(): ReactNode {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const { loadDeck, clearDeck } = useDeck();
  const { decks, isLoading, error, invalidate } = useUserDecks();

  const [query, setQuery] = useState("");
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [tcgOpen, setTcgOpen] = useState(true);
  const [mdOpen, setMdOpen] = useState(true);
  const [capError, setCapError] = useState<string | null>(null);

  const [detailsDeck, setDetailsDeck] = useState<DeckType | null>(null);
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [newDeckFormat, setNewDeckFormat] = useState<DeckFormat>("Master Duel");
  const [alertsOpen, setAlertsOpen] = useState(false);

  const capStatus = useMemo(() => getDeckCapStatus(decks.length), [decks.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter((deck) => deck.name.toLowerCase().includes(q));
  }, [decks, query]);

  const pinned = filtered.filter((deck) => deck.isPinned);
  const tcg = filtered.filter((deck) => deck.deckFormat === "TCG" && !deck.isPinned);
  const masterDuel = filtered.filter(
    (deck) => deck.deckFormat !== "TCG" && !deck.isPinned,
  );

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

  const renderGrid = (list: DeckType[]): ReactNode => (
    <div className="grid grid-cols-1 justify-items-center gap-6 px-6 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {list.map((deck) => (
        <DeckArchiveCard
          key={deck.id}
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
            void toggleDeckPin(deck.id, user.id, !deck.isPinned).then(
              invalidate,
            );
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
      ))}
    </div>
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

      <div className="relative z-10 flex flex-col gap-2 pb-10">
        <div className="flex flex-nowrap items-center justify-between gap-4 px-6 py-4">
          <h1 className="shrink-0 font-display text-3xl font-black uppercase tracking-wide text-mda-ink sm:text-4xl">
            Deck Archives
          </h1>
          <div className="flex min-w-0 flex-nowrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAlertsOpen((value) => !value)}
              aria-label="Deck archives alerts"
              aria-expanded={alertsOpen}
              data-magnetic
              className="shrink-0 rounded p-2 text-mda-ink transition-colors duration-200 ease-in-out hover:bg-mda-ink/10"
            >
              <Bell className="h-6 w-6" aria-hidden />
            </button>
            <MdaSearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search decks"
              containerClassName="min-w-[200px] w-[min(100%,400px)] flex-1"
            />
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
                  variant="surface"
                  className="shrink-0 gap-2 pl-4 pr-7"
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

        {!user ? (
          <div className="mx-6 rounded-md border border-mda-ink/15 bg-mda-panel px-4 py-6 font-mda text-mda-ink">
            Preview mode — sign in to sync and manage your decks.{" "}
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-mda-sky-strong underline"
            >
              Log in
            </button>
          </div>
        ) : null}

        {user && capStatus.softExceeded ? (
          <p
            className="mx-6 border border-mda-ink/20 bg-mda-panel px-4 py-3 font-mda text-sm text-mda-ink"
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
          <p className="px-6 font-mda text-sm text-mda-danger" role="alert">
            {capError}
          </p>
        ) : null}

        {error ? (
          <p className="px-6 font-mda text-sm text-mda-danger" role="alert">
            {error}
          </p>
        ) : null}

        <MdaCollapse open={alertsOpen}>
          <div className="mx-6 mb-2 max-w-xl border border-mda-ink/15 bg-mda-panel p-4 shadow-mda-soft">
            <div className="mb-3 bg-mda-chrome px-3 py-2 font-mda text-lg font-bold uppercase text-mda-inverse-text">
              Deck Archives Alerts
            </div>
            <div className="space-y-2 font-mda text-sm text-mda-ink">
              <p>
                Database and banlist sync status will appear here when
                available.
              </p>
              <p className="text-mda-ink-muted">
                No outstanding legality issues detected.
              </p>
            </div>
          </div>
        </MdaCollapse>

        <SectionCollapse
          title="Pinned"
          icon={Pin}
          iconClassName="fill-mda-cyan text-mda-cyan"
          open={pinnedOpen}
          onToggle={() => setPinnedOpen((value) => !value)}
        >
          {pinned.length === 0 ? (
            <p className="px-6 pb-4 font-mda text-sm text-mda-ink-muted">
              No pinned decks
            </p>
          ) : (
            renderGrid(pinned)
          )}
        </SectionCollapse>

        <SectionCollapse
          title="Master Duel"
          open={mdOpen}
          onToggle={() => setMdOpen((value) => !value)}
        >
          {masterDuel.length === 0 ? (
            <p className="px-6 pb-4 font-mda text-sm text-mda-ink-muted">
              No Master Duel decks
            </p>
          ) : (
            renderGrid(masterDuel)
          )}
        </SectionCollapse>

        <SectionCollapse
          title="TCG"
          open={tcgOpen}
          onToggle={() => setTcgOpen((value) => !value)}
        >
          {tcg.length === 0 ? (
            <p className="px-6 pb-4 font-mda text-sm text-mda-ink-muted">
              No TCG decks
            </p>
          ) : (
            renderGrid(tcg)
          )}
        </SectionCollapse>
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
