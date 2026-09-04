"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, Pin, Plus } from "lucide-react";
import { MdaAppHeader } from "@/components/mda/app-header";
import { ClipButton } from "@/components/mda/clip-button";
import { MdaSearchField } from "@/components/mda/search-field";
import { SectionCollapse } from "@/components/mda/section-collapse";
import { DeckArchiveCard } from "@/components/mda/deck-archive-card";
import {
  DeckDetailsModal,
  FormatPickerDialog,
} from "@/components/mda/archives-dialogs";
import { DeckArchiveActionPopovers } from "@/components/mda/archives-popovers";
import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";
import { useUserStore } from "@/store/useUserStore";
import { useDeck } from "@/context/deck-context";
import { createDeckShare } from "@/lib/api/deckShare";
import { toAbsoluteShareUrl } from "@/lib/utils";
import { isDeckLegalForShare } from "@/lib/validation/deck-validator";
import type { DeckMode, DeckType } from "@/types/types";
import { v4 as uuidv4 } from "uuid";
import {
  useDeleteDeckMutation,
  useSaveDeckMutation,
  useToggleDeckPinMutation,
  useUserDecksQuery,
} from "@/hooks/use-user-decks";

export default function DeckArchivesPage(): ReactNode {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const { loadDeck, clearDeck } = useDeck();

  const {
    data: decks = [],
    isLoading,
    isError,
    error: queryError,
  } = useUserDecksQuery(user?.id);

  const togglePin = useToggleDeckPinMutation(user?.id);
  const saveDeckMutation = useSaveDeckMutation(user?.id);
  const deleteDeckMutation = useDeleteDeckMutation(user?.id);

  const [query, setQuery] = useState("");
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [tcgOpen, setTcgOpen] = useState(true);
  const [mdOpen, setMdOpen] = useState(true);

  const [detailsDeck, setDetailsDeck] = useState<DeckType | null>(null);
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [newDeckMode, setNewDeckMode] = useState<DeckMode>("Master Duel");
  const [alertsOpen, setAlertsOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter((deck) => deck.name.toLowerCase().includes(q));
  }, [decks, query]);

  const pinned = filtered.filter((deck) => deck.isPinned);
  const tcg = filtered.filter((deck) => deck.mode === "TCG" && !deck.isPinned);
  const masterDuel = filtered.filter(
    (deck) => deck.mode !== "TCG" && !deck.isPinned,
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
    clearDeck();
    setNewDeckOpen(false);
    router.push(`/workshop?mode=${encodeURIComponent(newDeckMode)}`);
  };

  const handleCopyConfirm = async (
    source: DeckType,
    mode: DeckMode,
  ): Promise<void> => {
    if (!user) return;
    const duplicate: DeckType = {
      ...source,
      id: uuidv4(),
      name: `${source.name} (Copy)`,
      mode,
      isPinned: false,
    };
    await saveDeckMutation.mutateAsync(duplicate);
  };

  const handleDeleteConfirm = async (deck: DeckType): Promise<void> => {
    if (!user) return;
    await deleteDeckMutation.mutateAsync(deck.id);
  };

  const createShareUrl = async (deck: DeckType): Promise<string> => {
    if (!user) throw new Error("Auth required");
    const result = await createDeckShare({
      deck: {
        name: deck.name,
        mainDeck: deck.mainDeck,
        extraDeck: deck.extraDeck,
        sideDeck: deck.sideDeck,
        mode: deck.mode,
      },
    });
    return toAbsoluteShareUrl(result.shareUrl);
  };

  const renderGrid = (list: DeckType[]): ReactNode => (
    <div className="grid grid-cols-1 justify-items-center gap-6 px-6 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {list.map((deck) => (
        <DeckArchiveCard
          key={deck.id}
          name={deck.name}
          mode={deck.mode}
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
            togglePin.mutate({
              deckId: deck.id,
              pinned: !deck.isPinned,
            });
          }}
          actionControls={
            <DeckArchiveActionPopovers
              deckName={deck.name}
              mode={deck.mode}
              canShare={isDeckLegalForShare(deck)}
              onCopyConfirm={(mode) => {
                if (!requireAuth()) return;
                void handleCopyConfirm(deck, mode);
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

  const errorMessage =
    isError && queryError instanceof Error
      ? queryError.message
      : isError
        ? "Failed to load decks"
        : null;

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
              data-magnetic
              containerClassName="min-w-[200px] w-[min(100%,400px)] flex-1"
            />
            <ClipButton
              size="sm"
              variant="filled"
              onClick={() => {
                if (!requireAuth()) return;
                setNewDeckOpen(true);
              }}
              className="shrink-0 gap-2 pl-4 pr-7"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New Deck
            </ClipButton>
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

        {errorMessage ? (
          <p className="px-6 font-mda text-sm text-mda-danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {alertsOpen ? (
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
        ) : null}

        <SectionCollapse
          title="Pinned"
          icon={Pin}
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
      />
      <FormatPickerDialog
        title="New deck format"
        open={newDeckOpen}
        mode={newDeckMode}
        onModeChange={setNewDeckMode}
        onCancel={() => setNewDeckOpen(false)}
        onConfirm={handleNewDeckConfirm}
      />
    </div>
  );
}
