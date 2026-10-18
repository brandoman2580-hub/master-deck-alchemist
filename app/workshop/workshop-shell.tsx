"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { CardImage } from "@/components/ui/card-image";
import { normalizeDeckName } from "@/lib/deck/normalize-deck-name";
import type { Card } from "@/types/card";
import type { DeckFormat } from "@/types/deck";
import "./space-grotesk.css";

export type WorkshopShellTab = "build" | "matchups" | "combos";

export type WorkshopShellPillar = {
  label: string;
  value: number | null;
};

export type WorkshopShellProps = {
  deckName: string;
  deckFormat: DeckFormat;
  mainCount: number;
  extraCount: number;
  sideCount: number;
  coverCard: Card | null;
  gradeLetter: string | null;
  pillars: WorkshopShellPillar[];
  gradeLoading: boolean;
  banlistFault: boolean;
  tab: WorkshopShellTab;
  onTabChange: (tab: WorkshopShellTab) => void;
  onBackToArchives: () => void;
  onRename: (name: string) => void;
  children: ReactNode;
};

const TABS: { id: WorkshopShellTab; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "matchups", label: "Matchups" },
  { id: "combos", label: "Combos" },
];

/**
 * Two-plate workshop sleeve: deck identity on the left, grade on the right,
 * with Build / Matchups / Combos opening the work sheet underneath.
 */
export function WorkshopShell({
  deckName,
  deckFormat,
  mainCount,
  extraCount,
  sideCount,
  coverCard,
  gradeLetter,
  pillars,
  gradeLoading,
  banlistFault,
  tab,
  onTabChange,
  onBackToArchives,
  onRename,
  children,
}: WorkshopShellProps): ReactNode {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(deckName);
  const [syncedName, setSyncedName] = useState(deckName);
  const editingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Partial<Record<WorkshopShellTab, HTMLButtonElement>>>({});
  const moveFromKeyboard = useRef(false);
  const tablistId = useId();
  const panelId = useId();
  const showSide = deckFormat === "TCG";
  const formatLabel = deckFormat === "TCG" ? "TCG" : "MD";
  const letter = gradeLoading || !gradeLetter ? "—" : gradeLetter;

  if (!editing && syncedName !== deckName) {
    setSyncedName(deckName);
    setDraft(deckName);
  }

  useEffect(() => {
    if (!editing) return;
    const field = inputRef.current;
    if (!field) return;
    field.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
  }, [editing]);

  useEffect(() => {
    if (!moveFromKeyboard.current) return;
    moveFromKeyboard.current = false;
    tabRefs.current[tab]?.focus();
  }, [tab]);

  const closeEditor = (commitName: boolean) => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    if (!commitName) {
      setDraft(deckName);
      return;
    }
    const next = normalizeDeckName(draft);
    if (!next || next === deckName) {
      setDraft(deckName);
      return;
    }
    onRename(next);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((item) => item.id === tab);
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    else return;
    event.preventDefault();
    const next = TABS[nextIndex];
    if (!next || next.id === tab) return;
    moveFromKeyboard.current = true;
    onTabChange(next.id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0e12] font-spaceGrotesk text-[#e2e8f0]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#28303b] bg-[#111317] px-6 md:px-8">
        <p className="font-orbitron select-none text-[14px] font-semibold uppercase tracking-[0.25em] text-[#f1f5f9]">
          Master Deck Alchemist
        </p>
        <button
          type="button"
          onClick={onBackToArchives}
          className="flex h-11 min-h-11 items-center gap-3 border border-[#28303b] bg-[#14181f] px-5 text-xs font-semibold uppercase tracking-wider text-[#e2e8f0] transition-colors hover:border-[#bfe5f3] focus-visible:border-[#bfe5f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3]"
        >
          Archives
          <span aria-hidden="true" className="inline-block h-[10px] w-[2px] bg-[#bfe5f3]" />
        </button>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-6 p-6 md:p-8">
        <section aria-label="Deck session" className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          <div className="flex flex-col items-start gap-6 border border-[#28303b] bg-[#14181f] p-4 sm:flex-row sm:items-center lg:col-span-7">
            {coverCard ? (
              <div className="relative h-[104px] w-[72px] shrink-0 overflow-hidden border border-[#28303b] bg-[#1b2028]">
                <CardImage card={coverCard} preferSmall fill sizes="72px" alt={coverCard.name} />
              </div>
            ) : (
              <div aria-hidden="true" className="h-[104px] w-[72px] shrink-0 border border-[#28303b] bg-[#1b2028]" />
            )}

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {editing ? (
                  <input
                    ref={inputRef}
                    aria-label="Deck name"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={80}
                    autoComplete="off"
                    onBlur={() => closeEditor(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        closeEditor(true);
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        closeEditor(false);
                      }
                    }}
                    className="h-11 min-w-0 flex-1 border border-[#bfe5f3] bg-[#1b2028] px-3 text-2xl font-bold tracking-tight text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3]"
                  />
                ) : (
                  <h1 className="truncate text-2xl font-bold tracking-tight text-white">{deckName}</h1>
                )}
                {editing ? null : (
                  <button
                    type="button"
                    aria-label="Edit deck name"
                    onClick={() => {
                      editingRef.current = true;
                      setDraft(deckName);
                      setEditing(true);
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center border border-transparent text-[#8a96a6] transition-colors hover:border-[#28303b] hover:text-[#e2e8f0] focus-visible:border-[#bfe5f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3]"
                  >
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M16.5 3.5l4 4L7 21H3v-4L16.5 3.5z" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#28303b] pt-2 text-sm">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#8a96a6]">
                  Format:
                  <span className="text-xs font-semibold text-[#e2e8f0]">{formatLabel}</span>
                </p>
                <span aria-hidden="true" className="h-3 w-px bg-[#28303b]" />
                <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-[#8a96a6]">
                  <span className="flex items-center gap-1">
                    Main <span className="text-xs font-semibold tabular-nums text-[#e2e8f0]">{mainCount}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    Extra <span className="text-xs font-semibold tabular-nums text-[#e2e8f0]">{extraCount}</span>
                  </span>
                  {showSide ? (
                    <span className="flex items-center gap-1">
                      Side <span className="text-xs font-semibold tabular-nums text-[#e2e8f0]">{sideCount}</span>
                    </span>
                  ) : null}
                </p>
                {banlistFault ? (
                  <svg aria-label="Banlist fault" role="img" className="h-4 w-4 fill-[#bfe5f3] text-[#bfe5f3]" viewBox="0 0 24 24">
                    <title>Banlist fault</title>
                    <polygon points="12,3 22,21 2,21" />
                  </svg>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between border border-[#28303b] bg-[#14181f] p-4 lg:col-span-5">
            <div className="mb-3 flex items-baseline justify-between border-b border-[#28303b] pb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#8a96a6]">Grade</span>
              <span className="text-3xl font-bold leading-none text-[#e2e8f0]">{letter}</span>
            </div>
            <dl className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
              {pillars.map((pillar) => (
                <div key={pillar.label} className="flex flex-col">
                  <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#8a96a6]">{pillar.label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-[#e2e8f0]">
                    {gradeLoading || pillar.value == null ? "—" : pillar.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div role="tablist" aria-label="Workshop mode" id={tablistId} className="flex items-center gap-1 border-b border-[#28303b]">
          {TABS.map((item) => {
            const selected = item.id === tab;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[item.id] = node ?? undefined;
                }}
                type="button"
                role="tab"
                id={`${tablistId}-${item.id}`}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTabChange(item.id)}
                onKeyDown={onTabKeyDown}
                className={
                  selected
                    ? "flex h-11 min-h-11 items-center gap-2 border-t-2 border-[#bfe5f3] bg-[#e2e8f0] px-6 text-xs font-bold uppercase tracking-widest text-[#0c0e12] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0c0e12]"
                    : "flex h-11 min-h-11 items-center border border-transparent bg-transparent px-6 text-xs font-medium uppercase tracking-widest text-[#8a96a6] transition-colors hover:text-white focus-visible:border-[#bfe5f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3]"
                }
              >
                {item.label}
                {selected ? <span aria-hidden="true" className="h-[10px] w-[2px] bg-[#bfe5f3]" /> : null}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={panelId}
          aria-labelledby={`${tablistId}-${tab}`}
          className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[#28303b] bg-[#eef3f6] text-[#0c0e12]"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
