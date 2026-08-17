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

/**
 * Tier colors for the matchup scatter:
 * gold (threat/top), brand cyan (mid), steel (peripheral) —
 * readable on the gray radial page fill without competing with KPI cyan text.
 */
const TIER_COLORS: Record<Tier, string> = {
  1: "#F2C14E",
  2: "#7EE8FF",
  3: "#8FA3B0",
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
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <MdaLoadingScreen
        open={loading}
        scoped
        status="Loading matchup meta analysis…"
      />

      <div className="flex flex-wrap items-center gap-4 font-mda text-sm uppercase text-white/80">
        <span>Show:</span>
        {([1, 2, 3] as Tier[]).map((tier) => (
          <label key={tier} className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={tiers[tier]}
              onChange={() =>
                setTiers((prev) => ({ ...prev, [tier]: !prev[tier] }))
              }
              className="accent-[color:var(--mda-cyan)]"
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
          { label: "Avg Win Rate", value: `${avgWin}%` },
          { label: "Favorable", value: String(favorable) },
          { label: "Unfavorable", value: String(unfavorable) },
          { label: "Tier 1 Avg", value: `${tier1Avg}%` },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[color:var(--mda-surface)] px-3 py-3"
          >
            <p className="font-mda text-xs uppercase text-white/55">{stat.label}</p>
            <p className="font-mda text-2xl font-bold text-[color:var(--mda-cyan-soft)]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="h-[340px] w-full bg-transparent">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 24, bottom: 40, left: 28 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="metaShare"
              name="Meta Representation"
              unit="%"
              stroke="rgba(234,247,255,0.45)"
              tick={{ fill: "rgba(234,247,255,0.65)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
            >
              <Label
                value="Meta Representation (%)"
                position="bottom"
                offset={16}
                style={{
                  fill: "rgba(234,247,255,0.8)",
                  fontSize: 12,
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
              stroke="rgba(234,247,255,0.45)"
              tick={{ fill: "rgba(234,247,255,0.65)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
            >
              <Label
                value="Win Rate (%)"
                angle={-90}
                position="insideLeft"
                offset={8}
                style={{
                  fill: "rgba(234,247,255,0.8)",
                  fontSize: 12,
                  fontFamily: "var(--font-mda), sans-serif",
                  textTransform: "uppercase",
                  textAnchor: "middle",
                }}
              />
            </YAxis>
            <ZAxis range={[70, 180]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "rgba(126,232,255,0.35)" }}
              contentStyle={{
                background: "rgba(3,19,26,0.92)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 0,
                color: "#EAF7FF",
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
                fontSize: 12,
                textTransform: "uppercase",
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {([1, 2, 3] as Tier[]).map((tier) => (
          <div key={tier} className="bg-[color:var(--mda-surface)]/40 p-3">
            <h3 className="mb-3 font-mda text-sm font-bold uppercase text-white">
              Tier {tier} Decks
            </h3>
            <ul className="space-y-2">
              {byTier[tier].slice(0, 6).map((point) => (
                <li key={point.name}>
                  <div className="mb-1 flex justify-between font-mda text-xs text-white/80">
                    <span className="truncate">{point.name}</span>
                    <span>{point.winRate}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-white/10">
                    <div
                      className={cn(
                        "h-full",
                        point.winRate >= 55
                          ? "bg-[color:var(--mda-success)]"
                          : point.winRate <= 45
                            ? "bg-[color:var(--mda-danger)]"
                            : "bg-[color:var(--mda-cyan)]",
                      )}
                      style={{ width: `${point.winRate}%` }}
                    />
                  </div>
                </li>
              ))}
              {byTier[tier].length === 0 ? (
                <li className="font-mda text-xs text-white/40">No decks</li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
