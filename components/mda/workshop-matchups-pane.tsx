"use client";

import {
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";
import {
  readinessToDisplayWinRate,
  type FactsEnvelope,
} from "@/lib/engine";

type Tier = 1 | 2 | 3;

type MatchupPoint = {
  name: string;
  tier: Tier;
  winRate: number;
  metaShare: number;
  weight: number;
  tagAdvantage: number;
  notes: string[];
};

const TIER_COLORS: Record<Tier, string> = {
  1: "var(--mda-tier-1)",
  2: "var(--mda-tier-2)",
  3: "var(--mda-tier-3)",
};

const AXIS_LABEL_STYLE: CSSProperties = {
  fill: "var(--mda-ink)",
  fontSize: 20,
  fontFamily: "var(--font-mda), sans-serif",
  fontWeight: 400,
  textTransform: "uppercase",
};

function tierFromFacts(raw?: string): Tier {
  if (raw === "1") return 1;
  if (raw === "2") return 2;
  return 3;
}

function pointsFromFacts(facts: FactsEnvelope): MatchupPoint[] {
  return facts.matchups.map((m, index) => {
    const winRate = readinessToDisplayWinRate(m.tagAdvantage);
    const tier = tierFromFacts(m.tier);
    return {
      name: m.opponentArchetype,
      tier,
      winRate,
      metaShare:
        m.metaShare ??
        3 + ((index % 8) * 1.2) + (tier === 1 ? 6 : tier === 2 ? 3 : 0),
      weight: 40 + Math.round((m.tagAdvantage + 1) * 40) + (tier === 1 ? 60 : 0),
      tagAdvantage: m.tagAdvantage,
      notes: m.notes,
    };
  });
}

export type WorkshopMatchupsPaneProps = {
  facts: FactsEnvelope | null;
  loading: boolean;
  error?: string | null;
};

export function WorkshopMatchupsPane({
  facts,
  loading,
  error = null,
}: WorkshopMatchupsPaneProps): ReactNode {
  const [tiers, setTiers] = useState<Record<Tier, boolean>>({
    1: true,
    2: true,
    3: true,
  });

  const points = useMemo(
    () => (facts ? pointsFromFacts(facts) : []),
    [facts],
  );

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

  const consistency = facts?.consistency;
  const byTier: Record<Tier, MatchupPoint[]> = {
    1: filtered.filter((point) => point.tier === 1),
    2: filtered.filter((point) => point.tier === 2),
    3: filtered.filter((point) => point.tier === 3),
  };

  const needsDeck = !loading && !facts;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <MdaLoadingScreen
        open={loading}
        scoped
        status="Computing matchup readiness…"
      />

      {needsDeck ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center font-mda text-mda-ink">
          <p className="text-2xl font-semibold uppercase tracking-wide">
            Build a 40+ card main deck
          </p>
          <p className="max-w-md text-base text-mda-ink-muted">
            Matchups v1 scores opening-hand consistency and tag readiness against
            the current format tier list.
          </p>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto lg:overflow-y-auto">
            {consistency && consistency.n > 0 ? (
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  {
                    label: "Starter Access",
                    value: `${Math.round(consistency.starterAccess * 100)}%`,
                  },
                  {
                    label: "Brick Rate",
                    value: `${Math.round(consistency.brickRate * 100)}%`,
                  },
                  {
                    label: "1-HT Survive",
                    value: `${Math.round(consistency.oneInterruptionSurvival * 100)}%`,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-mda-chrome/90 px-2.5 py-2 text-center text-mda-inverse-text"
                  >
                    <p className="font-mda text-sm font-bold uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <p className="font-mda text-3xl font-semibold leading-none">
                      {stat.value}
                    </p>
                    <p className="mt-1 font-mda text-xs uppercase opacity-80">
                      n={consistency.n}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 font-mda uppercase text-mda-ink">
              <span className="text-2xl font-semibold tracking-wide">Show:</span>
              {([1, 2, 3] as Tier[]).map((tier) => (
                <label
                  key={tier}
                  data-magnetic
                  className="inline-flex cursor-pointer items-center gap-2.5 px-6 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={tiers[tier]}
                    onChange={() =>
                      setTiers((prev) => ({ ...prev, [tier]: !prev[tier] }))
                    }
                    className="size-5 shrink-0 accent-mda-ink"
                    aria-label={`Show Tier ${tier}`}
                  />
                  <span className="text-2xl font-normal tracking-wide">
                    Tier {tier}
                  </span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {[
                {
                  label: "Avg Readiness",
                  value: `${avgWin}%`,
                  hint: "tag score vs filtered meta",
                },
                {
                  label: "Favorable",
                  value: String(favorable),
                  hint: "decks (>55%)",
                },
                {
                  label: "Unfavorable",
                  value: String(unfavorable),
                  hint: "decks (<45%)",
                },
                {
                  label: "Tier 1 Avg",
                  value: `${tier1Avg}%`,
                  hint: `${tier1.length} major decks`,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#4D6676] px-2.5 py-2.5 text-center text-mda-inverse-text"
                >
                  <p className="font-mda text-base font-bold uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <p className="font-mda text-5xl font-semibold leading-none">
                    {stat.value}
                  </p>
                  <p className="mt-1 font-mda text-sm font-normal uppercase">
                    {stat.hint}
                  </p>
                </div>
              ))}
            </div>

            <div className="min-h-[280px] flex-1 p-2 lg:min-h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 16, right: 24, bottom: 44, left: 36 }}>
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
                    tick={{ fill: "rgba(77, 102, 118, 0.75)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(77, 102, 118, 0.25)" }}
                  >
                    <Label
                      value="Meta Representation (%)"
                      position="bottom"
                      offset={20}
                      style={AXIS_LABEL_STYLE}
                    />
                  </XAxis>
                  <YAxis
                    type="number"
                    dataKey="winRate"
                    name="Readiness"
                    unit="%"
                    domain={[0, 100]}
                    stroke="rgba(77, 102, 118, 0.5)"
                    tick={{ fill: "rgba(77, 102, 118, 0.75)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(77, 102, 118, 0.25)" }}
                  >
                    <Label
                      value="Readiness (%)"
                      angle={-90}
                      position="insideLeft"
                      offset={4}
                      style={{
                        ...AXIS_LABEL_STYLE,
                        textAnchor: "middle",
                      }}
                    />
                  </YAxis>
                  <ZAxis
                    type="number"
                    dataKey="weight"
                    range={[60, 420]}
                    name="weight"
                  />
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
                      if (name === "winRate") return [`${value}%`, "Readiness"];
                      if (name === "metaShare")
                        return [`${value}%`, "Meta Representation"];
                      if (name === "weight") return [value, "Weight"];
                      return [value, name];
                    }}
                    labelFormatter={(_, payload) => {
                      const point = payload?.[0]?.payload as
                        | MatchupPoint
                        | undefined;
                      return point?.name ?? "";
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="square"
                    wrapperStyle={{
                      fontFamily: "var(--font-mda), sans-serif",
                      fontSize: 14,
                      fontWeight: 400,
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

          <aside className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto border-t border-mda-ink/10 pt-4 lg:w-[340px] lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
            {([1, 2, 3] as Tier[]).map((tier) => (
              <div key={tier}>
                <h3 className="mb-3 font-mda text-xl font-semibold uppercase tracking-wide text-mda-ink">
                  Tier {tier} Decks
                </h3>
                <ul className="space-y-3">
                  {byTier[tier].slice(0, 8).map((point) => (
                    <li
                      key={point.name}
                      className="flex items-center gap-3 font-mda text-mda-ink"
                    >
                      <span className="w-[7.5rem] shrink-0 truncate text-base font-normal">
                        {point.name}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="h-[22px] min-w-0 flex-1 overflow-hidden bg-[#B9BEBE]">
                          <div
                            className="h-full bg-[#4D6676]"
                            style={{ width: `${point.winRate}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-xs font-normal">
                          {point.winRate}%
                        </span>
                      </div>
                    </li>
                  ))}
                  {byTier[tier].length === 0 ? (
                    <li className="font-mda text-base text-mda-ink-muted">
                      No decks
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}
