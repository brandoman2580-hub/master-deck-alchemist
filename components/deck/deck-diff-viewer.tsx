"use client";

import { useMemo } from "react";
import type { Card } from "@/types/card";
import { Button } from "@/components/ui/button";

type Metric = {
  label: string;
  before: number;
  after: number;
  format?: (value: number) => string;
};

export interface DeckDiffViewerProps {
  before: Card[];
  after: Card[];
  beforeLabel?: string;
  afterLabel?: string;
  metrics?: Metric[];
  onApplyAll?: () => void;
}

export function DeckDiffViewer({
  before,
  after,
  beforeLabel = "Current Deck",
  afterLabel = "With AI Suggestions",
  metrics = [],
  onApplyAll,
}: DeckDiffViewerProps) {
  const { addedIds, removedIds } = useMemo(() => {
    const beforeIds = new Set(before.map((c) => c.id));
    const afterIds = new Set(after.map((c) => c.id));

    return {
      addedIds: new Set(after.filter((c) => !beforeIds.has(c.id)).map((c) => c.id)),
      removedIds: new Set(
        before.filter((c) => !afterIds.has(c.id)).map((c) => c.id),
      ),
    };
  }, [after, before]);

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-slate-900/30 backdrop-blur-sm">
      <header className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Deck Diff</h3>
          <p className="text-xs text-slate-400">
            Compare your current list vs a suggested build.
          </p>
        </div>
        {onApplyAll ? (
          <Button
            type="button"
            onClick={onApplyAll}
            className="bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-100"
          >
            Apply All
          </Button>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-950/40">
          <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold text-slate-200">
            {beforeLabel}
          </div>
          <div className="max-h-80 overflow-auto p-2">
            <ul className="space-y-1">
              {before.map((card) => (
                <li
                  key={`before-${card.deckInstanceId || card.id}`}
                  className={`rounded-lg px-3 py-2 text-sm text-slate-200 border ${
                    removedIds.has(card.id)
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-white/5 bg-white/5"
                  }`}
                >
                  {card.name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/40">
          <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold text-slate-200">
            {afterLabel}
          </div>
          <div className="max-h-80 overflow-auto p-2">
            <ul className="space-y-1">
              {after.map((card) => (
                <li
                  key={`after-${card.deckInstanceId || card.id}`}
                  className={`rounded-lg px-3 py-2 text-sm text-slate-200 border ${
                    addedIds.has(card.id)
                      ? "border-green-500/30 bg-green-500/10"
                      : "border-white/5 bg-white/5"
                  }`}
                >
                  {card.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {metrics.length > 0 ? (
        <div className="border-t border-white/10 px-4 py-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Metrics
          </h4>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {metrics.map((m) => {
              const format = m.format ?? ((v: number) => String(v));
              const delta = m.after - m.before;
              const deltaSign = delta > 0 ? "+" : "";

              return (
                <div
                  key={m.label}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-slate-200">
                      {m.label}
                    </div>
                    <div
                      className={`text-xs font-semibold ${
                        delta > 0
                          ? "text-green-400"
                          : delta < 0
                            ? "text-red-400"
                            : "text-slate-400"
                      }`}
                    >
                      {deltaSign}
                      {format(delta)}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {format(m.before)} {"->"} {format(m.after)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
