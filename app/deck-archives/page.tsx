"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import {
  deleteDeck,
  getUserDecks,
  saveDeck,
  toggleDeckPin,
} from "@/lib/supabaseDecks";
import { createDeckShare } from "@/lib/api/deckShare";
import type { DeckMode, DeckType } from "@/types/types";
import { v4 as uuidv4 } from "uuid";

function mapRows(rows: unknown[]): DeckType[] {
  return rows.map((row) => {
    const deck = row as {
      id: string;
      name: string;
      cards?: {
        main?: DeckType["mainDeck"];
        extra?: DeckType["extraDeck"];
        side?: DeckType["sideDeck"];
      };
      updated_at?: string;
      mode?: DeckMode;
      is_pinned?: boolean;
    };
    return {
      id: deck.id,
      name: deck.name,
      mainDeck: deck.cards?.main ?? [],
      extraDeck: deck.cards?.extra ?? [],
      sideDeck: deck.cards?.side ?? [],
      updated_at: deck.updated_at,
      mode: deck.mode ?? "Master Duel",
      isPinned: deck.is_pinned ?? false,
    };
  });
}

export default function DeckArchivesPage(): ReactNode {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const { loadDeck, clearDeck } = useDeck();

  const [decks, setDecks] = useState<DeckType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [tcgOpen, setTcgOpen] = useState(true);
  const [mdOpen, setMdOpen] = useState(true);

  const [detailsDeck, setDetailsDeck] = useState<DeckType | null>(null);
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [newDeckMode, setNewDeckMode] = useState<DeckMode>("Master Duel");
  const [alertsOpen, setAlertsOpen] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (!user) {
      setDecks([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await getUserDecks(user.id);
      setDecks(mapRows(rows as unknown[]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decks");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    await saveDeck(duplicate, user.id);
    await refresh();
  };

  const handleDeleteConfirm = async (deck: DeckType): Promise<void> => {
    if (!user) return;
    await deleteDeck(deck.id, user.id);
    await refresh();
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
    return result.shareUrl;
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
            void toggleDeckPin(deck.id, user.id, !deck.isPinned).then(refresh);
          }}
          actionControls={
            <DeckArchiveActionPopovers
              deckName={deck.name}
              mode={deck.mode}
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

  return (
    <div className="relative flex min-h-full flex-col bg-[radial-gradient(circle_at_center,#A4A8B1_0%,#45474B_100%)] text-white">
      <MdaLoadingScreen
        open={loading}
        status="Syncing deck archives from your library…"
      />

      <MdaAppHeader onLoginClick={() => router.push("/")} />

      <div className="flex flex-col gap-2 pb-10">
        <div className="flex flex-nowrap items-center justify-between gap-4 px-6 py-4">
          <h1 className="inline-flex shrink-0 bg-[color:var(--mda-cyan-muted)] px-16 py-1 font-mda text-3xl font-bold uppercase tracking-wide text-white">
            Deck Archives
          </h1>
          <div className="flex min-w-0 flex-nowrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAlertsOpen((value) => !value)}
              aria-label="Deck archives alerts"
              data-magnetic
              className="shrink-0 rounded p-2 text-white/80 transition-colors duration-200 ease-in-out hover:bg-white hover:text-[color:var(--mda-bg-deep)]"
            >
              <Bell className="h-6 w-6" aria-hidden />
            </button>
            <MdaSearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search decks"
              containerClassName="min-w-0 w-[min(100%,400px)] flex-1"
            />
            <ClipButton
              size="sm"
              variant="surface"
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
          <div className="mx-6 rounded-md border border-white/10 bg-white/5 px-4 py-6 font-mda text-white/80">
            Preview mode — sign in to sync and manage your decks.{" "}
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-[color:var(--mda-cyan-soft)] underline"
            >
              Log in
            </button>
          </div>
        ) : null}

        {error ? (
          <p
            className="px-6 font-mda text-sm text-[color:var(--mda-danger)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {alertsOpen ? (
          <div className="mx-6 mb-2 max-w-xl border border-white/10 bg-[color:var(--mda-surface)] p-4">
            <div className="mb-3 bg-[color:var(--mda-header-bar)] px-3 py-2 font-mda text-lg font-bold uppercase">
              Deck Archives Alerts
            </div>
            <div className="space-y-2 font-mda text-sm text-white/80">
              <p>
                Database and banlist sync status will appear here when
                available.
              </p>
              <p className="text-white/50">
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
            <p className="px-6 pb-4 font-mda text-sm text-white/40">
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
            <p className="px-6 pb-4 font-mda text-sm text-white/40">
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
            <p className="px-6 pb-4 font-mda text-sm text-white/40">
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
