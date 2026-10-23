"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { EditorialUserMenu } from "@/components/mda/editorial-user-menu";
import { FadeSwap } from "@/components/mda/fade-swap";
import { RollingNumber } from "@/components/mda/rolling-number";
import { SlidingTabMark } from "@/components/mda/sliding-tab-mark";
import { CardImage } from "@/components/ui/card-image";
import { useRouteHeadingFocus } from "@/hooks/useRouteHeadingFocus";
import { normalizeDeckName } from "@/lib/deck/normalize-deck-name";
import { GRADE_MS, VIEW_PANEL_S } from "@/lib/motion/tokens";
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
 * Workshop sleeve: wordmark bar, then one deck plate.
 * Identity sits on the left, the grade on the upper right,
 * and Build / Matchups / Combos form the plate's bottom edge.
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
  useRouteHeadingFocus();
  const showSide = deckFormat === "TCG";
  const formatLabel = deckFormat === "TCG" ? "TCG" : "MASTER DUEL";
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
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#28303b] bg-[#0c0e12] px-8">
        <p className="select-none text-lg font-medium uppercase tracking-widest text-[#f7fcff]">
          Master Deck Alchemist
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToArchives}
            className="flex h-10 items-center gap-3 border border-[#28303b] bg-[#14181f] px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e2e2e8] transition-colors hover:border-[#14181f] hover:bg-[#e2e8f0] hover:text-[#14181f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3]"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M19 12H5" />
              <path d="M11 6L5 12l6 6" />
            </svg>
            Archives
          </button>
          <EditorialUserMenu />
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col gap-4 p-6">
        <section aria-label="Deck session" className="flex shrink-0 flex-col border border-[#28303b] bg-[#14181f]">
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:gap-16">
            <div className="flex w-full min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center lg:w-auto lg:max-w-[42%] lg:shrink-0">
            {coverCard ? (
              <div className="relative h-20 w-14 shrink-0 overflow-hidden border border-[#28303b] bg-[#0c0e12]">
                <CardImage card={coverCard} preferSmall fill sizes="56px" alt="" />
              </div>
            ) : (
              <div aria-hidden="true" className="h-20 w-14 shrink-0 border border-[#28303b] bg-[#0c0e12]" />
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
                  <h1 data-page-heading tabIndex={-1} className="truncate text-2xl font-semibold uppercase tracking-tight text-[#f7fcff] outline-none">{deckName}</h1>
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
                    className="flex h-11 w-11 shrink-0 items-center justify-center border border-transparent text-[#8a96a6] transition-colors hover:border-[#14181f] hover:bg-[#e2e8f0] hover:text-[#14181f] focus-visible:border-[#bfe5f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3]"
                  >
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M16.5 3.5l4 4L7 21H3v-4L16.5 3.5z" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium uppercase tracking-[0.12em]">
                <p className="flex items-center gap-2 text-[#e2e8f0]">
                  <span className="border border-[#28303b] px-1.5 py-0.5 font-normal text-[#8a96a6]">Format</span>
                  {formatLabel}
                </p>
                <p className="flex items-center gap-4 text-[#e2e2e8]">
                  <span className="flex items-center gap-2">
                    <span className="border border-[#28303b] px-1.5 py-0.5 font-normal text-[#8a96a6]">Main</span>
                    <RollingNumber value={mainCount} className="tabular-nums text-[#f7fcff]" />
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="border border-[#28303b] px-1.5 py-0.5 font-normal text-[#8a96a6]">Extra</span>
                    <RollingNumber value={extraCount} className="tabular-nums text-[#f7fcff]" />
                  </span>
                  {showSide ? (
                    <span className="flex items-center gap-2">
                      <span className="border border-[#28303b] px-1.5 py-0.5 font-normal text-[#8a96a6]">Side</span>
                      <RollingNumber value={sideCount} className="tabular-nums text-[#f7fcff]" />
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

            <div className="flex w-full min-w-0 flex-1 items-center gap-5">
              <div className="flex shrink-0 flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a96a6]">Grade</span>
                <span className="mt-1 text-[40px] font-semibold leading-none text-[#f7fcff]">{letter}</span>
              </div>
              <span aria-hidden="true" className="h-10 w-px shrink-0 bg-[#28303b]" />
              <dl className="flex min-w-0 flex-1 items-end gap-4">
                {pillars.map((pillar) => {
                  const mark = gradeLoading || pillar.value == null
                    ? null
                    : Math.min(100, Math.max(0, pillar.value));
                  return (
                    <div key={pillar.label} className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
                      <dt className="col-start-1 row-start-1 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a96a6]">{pillar.label}</dt>
                      <dd className="col-start-2 row-start-1 text-[13px] font-bold tabular-nums text-[#f7fcff]">
                        {mark == null ? "—" : <RollingNumber value={mark} durationMs={GRADE_MS} />}
                      </dd>
                      <div aria-hidden="true" className="col-span-2 row-start-2 mt-1.5 h-2 w-full overflow-hidden bg-[#5b6369]">
                        {mark == null ? null : (
                          <span
                            data-grade-mark
                            className="block h-full w-full origin-left bg-[#bfe5f3] transition-transform duration-200 ease-out motion-reduce:transition-none"
                            style={{ transform: `scaleX(${mark / 100})` }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>

          <div role="tablist" aria-label="Workshop mode" id={tablistId} className="flex w-full border-t border-[#28303b]">
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
                      ? "group relative flex h-10 min-h-10 flex-1 items-center justify-center border-r border-[#28303b] bg-[#14181f] px-5 text-xs font-semibold uppercase tracking-widest text-[#e2e8f0] transition-colors last:border-r-0 hover:border-[#14181f] hover:bg-[#e2e8f0] hover:text-[#14181f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#bfe5f3]"
                      : "group relative flex h-10 min-h-10 flex-1 items-center justify-center border-r border-[#28303b] bg-[#14181f] px-5 text-xs font-semibold uppercase tracking-widest text-[#8a96a6] transition-colors last:border-r-0 hover:border-[#14181f] hover:bg-[#e2e8f0] hover:text-[#14181f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#bfe5f3]"
                  }
                >
                  {item.label}
                  {selected ? (
                    <SlidingTabMark
                      layoutId="workshop-view-tab"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-[#bfe5f3] group-hover:bg-[#14181f]"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <div
          role="tabpanel"
          id={panelId}
          aria-labelledby={`${tablistId}-${tab}`}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <FadeSwap
            panelKey={tab}
            duration={VIEW_PANEL_S}
            panelClassName={
              tab === "build"
                ? undefined
                : "border border-[#28303b] bg-[#eef3f6] text-[#0c0e12]"
            }
          >
            {children}
          </FadeSwap>
        </div>
      </div>
    </div>
  );
}
