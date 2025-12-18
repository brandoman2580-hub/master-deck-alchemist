"use client";

import { useState } from "react";
import { getRecommendations } from "@/lib/api/recommend";

export function RecommenderPanel({ mainDeckIds }: { mainDeckIds: number[] }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getRecommendations>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRecommend = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRecommendations({
        mainDeck: mainDeckIds,
        format: "Master Duel",
        playstyle: "control",
        maxResults: 8,
      });
      setData(res);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const sortedRecs = (() => {
    if (!data) return [];
    const { recommendations, llm } = data;
    if (!llm?.ranked_ids) return recommendations;
    const order = new Map(llm.ranked_ids.map((id, idx) => [id, idx]));
    return [...recommendations].sort((a, b) => {
      const aiA = order.get(a.id) ?? 999;
      const aiB = order.get(b.id) ?? 999;
      return aiA - aiB;
    });
  })();

  return (
    <div className="border rounded-lg p-4 bg-slate-900 text-slate-100 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI Recommendations</h2>
        <button
          onClick={handleRecommend}
          disabled={loading || mainDeckIds.length === 0}
          className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-sm font-medium"
        >
          {loading ? "Thinking..." : "Suggest cards"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {data?.llm?.summary && (
        <p className="text-sm text-slate-200">
          {data.llm.summary}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
        {sortedRecs.map((card) => (
          <div
            key={card.id}
            className="border border-slate-700 rounded-md p-3 bg-slate-800"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold">{card.name}</p>
              {card.archetype && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 uppercase tracking-wide">
                  {card.archetype}
                </span>
              )}
            </div>
            {card.stats && (
              <p className="text-[11px] text-slate-300 mb-1">
                {card.type} — {card.stats}
              </p>
            )}
            <p className="text-[11px] text-slate-300 line-clamp-3 mb-1">
              {card.desc}
            </p>
            {data?.llm?.per_card_notes?.[card.id] && (
              <p className="text-[11px] text-emerald-300">
                Role: {data.llm.per_card_notes[card.id]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
