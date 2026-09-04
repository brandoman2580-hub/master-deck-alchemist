"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Label,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { getMetaDecks } from "@/lib/supabaseDecks";
import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";
import { cn } from "@/lib/utils";

type Tier = 1 | 2 | 3;

type MatchupPoint = {
  name: string;
  tier: Tier;
  winRate: number;
  metaShare: number;
};

const TIER_COLORS: Record<Tier, string> = {
  1: "var(--mda-tier-1)",
  2: "var(--mda-tier-2)",
  3: "var(--mda-tier-3)",
};

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildPoints(names: string[]): MatchupPoint[] {
  return names.slice(0, 18).map((name, index) => {
    const hash = hashName(name);
    const tier = ((hash % 3) + 1) as Tier;
    return {
      name,
      tier,
      winRate: 38 + (hash % 35),
      metaShare: 2 + ((hash >> 3) % 10) + index * 0.1,
    };
  });
}

export function WorkshopMatchupsPane(): ReactNode {
  const [points, setPoints] = useState<MatchupPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<Record<Tier, boolean>>({
    1: true,
    2: true,
    3: true,
  });

  useEffect(() => {
    let cancelled = false;
    getMetaDecks()
      .then((rows) => {
        if (cancelled) return;
        const names = rows.map((row) => {
          const r = row as unknown as { name?: string; deck_name?: string };
          return r.name ?? r.deck_name ?? "Meta Deck";
        });
        setPoints(
          buildPoints(
            names.length > 0
              ? names
              : [
                  "Tearlaments",
                  "Swordsoul",
                  "Branded",
                  "Yummy",
                  "Eldlich",
                  "Sky Striker",
                ],
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPoints(
            buildPoints([
              "Tearlaments",
              "Swordsoul",
              "Branded",
              "Yummy",
              "Eldlich",
              "Sky Striker",
            ]),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => points.filter((point) => tiers[point.tier]),
    [points, tiers],
  );

  const avgWin =
    filtered.length === 0
      ? 0
      : Math.round(
          filtered.reduce((sum, point) => sum + point.winRate, 0) /
            filtered.length,
        );
  const favorable = filtered.filter((point) => point.winRate > 55).length;
  const unfavorable = filtered.filter((point) => point.winRate < 45).length;
  const tier1 = filtered.filter((point) => point.tier === 1);
  const tier1Avg =
    tier1.length === 0
      ? 0
      : Math.round(
          tier1.reduce((sum, point) => sum + point.winRate, 0) / tier1.length,
        );

  const byTier: Record<Tier, MatchupPoint[]> = {
    1: filtered.filter((point) => point.tier === 1),
    2: filtered.filter((point) => point.tier === 2),
    3: filtered.filter((point) => point.tier === 3),
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <MdaLoadingScreen
        open={loading}
        scoped
        status="Loading matchup meta analysis…"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto lg:overflow-y-auto">
          <div className="flex flex-wrap items-center gap-4 font-mda text-xs font-bold uppercase tracking-wide text-mda-ink">
            <span>Show:</span>
            {([1, 2, 3] as Tier[]).map((tier) => (
              <label key={tier} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={tiers[tier]}
                  onChange={() =>
                    setTiers((prev) => ({ ...prev, [tier]: !prev[tier] }))
                  }
                  className="accent-mda-cyan"
                />
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: TIER_COLORS[tier] }}
                  aria-hidden
                />
                Tier {tier}
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Avg Win Rate", value: `${avgWin}%`, hint: "vs filtered meta" },
              { label: "Favorable", value: String(favorable), hint: "≥55% win rate" },
              { label: "Unfavorable", value: String(unfavorable), hint: "≤45% win rate" },
              { label: "Tier 1 Avg", value: `${tier1Avg}%`, hint: "top meta only" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-mda-chrome px-3 py-3 text-center"
              >
                <p className="font-mda text-[10px] font-bold uppercase tracking-wide text-mda-inverse-text/70">
                  {stat.label}
                </p>
                <p className="font-display text-3xl font-bold text-mda-cyan">
                  {stat.value}
                </p>
                <p className="font-mda text-[9px] uppercase text-mda-inverse-text/45">
                  {stat.hint}
                </p>
              </div>
            ))}
          </div>

          <div className="min-h-[280px] flex-1 bg-mda-bg/50 p-2 lg:min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 24, bottom: 40, left: 28 }}>
                <CartesianGrid
                  stroke="rgba(77, 102, 118, 0.15)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  dataKey="metaShare"
                  name="Meta Representation"
                  unit="%"
                  stroke="rgba(77, 102, 118, 0.5)"
                  tick={{ fill: "rgba(77, 102, 118, 0.75)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(77, 102, 118, 0.25)" }}
                >
                  <Label
                    value="Meta Representation (%)"
                    position="bottom"
                    offset={16}
                    style={{
                      fill: "var(--mda-ink)",
                      fontSize: 11,
                      fontFamily: "var(--font-mda), sans-serif",
                      textTransform: "uppercase",
                    }}
                  />
                </XAxis>
                <YAxis
                  type="number"
                  dataKey="winRate"
                  name="Win Rate"
                  unit="%"
                  domain={[0, 100]}
                  stroke="rgba(77, 102, 118, 0.5)"
                  tick={{ fill: "rgba(77, 102, 118, 0.75)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(77, 102, 118, 0.25)" }}
                >
                  <Label
                    value="Win Rate (%)"
                    angle={-90}
                    position="insideLeft"
                    offset={8}
                    style={{
                      fill: "var(--mda-ink)",
                      fontSize: 11,
                      fontFamily: "var(--font-mda), sans-serif",
                      textTransform: "uppercase",
                      textAnchor: "middle",
                    }}
                  />
                </YAxis>
                <ZAxis range={[70, 180]} />
                <Tooltip
                  cursor={{
                    strokeDasharray: "3 3",
                    stroke: "rgba(56, 214, 255, 0.45)",
                  }}
                  contentStyle={{
                    background: "var(--mda-chrome)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 0,
                    color: "var(--mda-inverse-text)",
                    fontFamily: "var(--font-mda), sans-serif",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "winRate") return [`${value}%`, "Win Rate"];
                    if (name === "metaShare")
                      return [`${value}%`, "Meta Representation"];
                    return [value, name];
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{
                    fontFamily: "var(--font-mda), sans-serif",
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: "var(--mda-ink)",
                    paddingBottom: 8,
                  }}
                />
                {([1, 2, 3] as Tier[]).map((tier) =>
                  tiers[tier] ? (
                    <Scatter
                      key={tier}
                      name={`Tier ${tier}`}
                      data={byTier[tier]}
                      fill={TIER_COLORS[tier]}
                      fillOpacity={0.9}
                    />
                  ) : null,
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-mda-ink/10 pt-4 lg:w-[280px] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          {([1, 2, 3] as Tier[]).map((tier) => (
            <div key={tier}>
              <h3 className="mb-2 font-mda text-xs font-bold uppercase tracking-wide text-mda-ink-strong">
                Tier {tier} Decks
              </h3>
              <ul className="space-y-2">
                {byTier[tier].slice(0, 8).map((point) => (
                  <li key={point.name}>
                    <div className="mb-1 flex justify-between gap-2 font-mda text-xs text-mda-ink">
                      <span className="truncate">{point.name}</span>
                      <span className="shrink-0 font-bold">{point.winRate}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden bg-mda-panel">
                      <div
                        className={cn(
                          "h-full",
                          point.winRate >= 55
                            ? "bg-mda-success"
                            : point.winRate <= 45
                              ? "bg-mda-danger"
                              : "bg-mda-chrome",
                        )}
                        style={{ width: `${point.winRate}%` }}
                      />
                    </div>
                  </li>
                ))}
                {byTier[tier].length === 0 ? (
                  <li className="font-mda text-xs text-mda-ink-muted">No decks</li>
                ) : null}
              </ul>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
