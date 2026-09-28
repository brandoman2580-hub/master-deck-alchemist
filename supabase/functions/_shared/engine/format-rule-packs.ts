/**
 * Deno mirror of lib/engine/format-rule-packs.ts
 */

import type { EngineFormat, FormatRulePackId, RoleCoverage } from "./types.ts";

export const MAXX_C_HARD_OUT_NAMES = [
  'Ash Blossom & Joyous Spring',
  "Called by the Grave",
  "Crossout Designator",
] as const;

export const MAXX_C_CARD_NAME = 'Maxx "C"' as const;

export interface FormatRulePackResult {
  packId: FormatRulePackId;
  resilienceDelta: number;
  disruptionDelta: number;
  notes: string[];
  maxxOutCount: number;
  maxxPressureActive: boolean;
}

export interface FormatRulePackInput {
  format: EngineFormat;
  banlist?: Record<string, string>;
  mainDeckCardNames: string[];
  roleCoverage: RoleCoverage;
}

function normalizeBan(status: string | undefined): string {
  return String(status ?? "Unlimited").trim().toLowerCase();
}

function isForbidden(status: string | undefined): boolean {
  const s = normalizeBan(status);
  return s === "forbidden" || s === "banned";
}

export function maxxOutResilienceDelta(outCount: number): number {
  if (outCount <= 0) return -12;
  if (outCount === 1) return -8;
  if (outCount === 2) return -4;
  if (outCount === 3) return 0;
  if (outCount === 4) return 3;
  if (outCount === 5) return 6;
  return 8;
}

function countNamedCopies(
  mainNames: string[],
  allowlist: readonly string[],
): number {
  const set = new Set(allowlist.map((n) => n.toLowerCase()));
  let count = 0;
  for (const name of mainNames) {
    if (set.has(name.trim().toLowerCase())) count += 1;
  }
  return count;
}

function applyTcgTournamentPack(
  roleCoverage: RoleCoverage,
): FormatRulePackResult {
  const interaction = roleCoverage.handTraps + roleCoverage.boardBreakers;
  let resilienceDelta = 0;
  let disruptionDelta = 0;
  const notes: string[] = [
    "TCG tournament banlist applies (US/world tournament standard). Master Duel list is not used.",
  ];

  if (interaction <= 1) {
    resilienceDelta = -6;
    disruptionDelta = -4;
    notes.push(
      `Low interaction density (${interaction} HT+breaker roles) — soft to TCG hand traps / breakers.`,
    );
  } else if (interaction <= 3) {
    resilienceDelta = -2;
    notes.push(
      `Light interaction package (${interaction} HT+breaker roles).`,
    );
  } else if (interaction >= 8 && interaction <= 14) {
    resilienceDelta = 4;
    disruptionDelta = 3;
    notes.push(
      `Healthy TCG interaction density (${interaction} HT+breaker roles).`,
    );
  } else if (interaction > 14) {
    disruptionDelta = 2;
    notes.push(
      `Heavy interaction density (${interaction} HT+breaker roles) — Disruption nudged; watch brick risk separately.`,
    );
  } else {
    notes.push(
      `Standard TCG interaction density (${interaction} HT+breaker roles).`,
    );
  }

  return {
    packId: "tcgTournament",
    resilienceDelta,
    disruptionDelta,
    notes,
    maxxOutCount: 0,
    maxxPressureActive: false,
  };
}

function applyMasterDuelMaxxCPack(
  banlist: Record<string, string> | undefined,
  mainDeckCardNames: string[],
): FormatRulePackResult {
  const notes: string[] = [
    "Master Duel banlist applies. TCG tournament list is not used.",
  ];

  const maxxStatus = banlist?.[MAXX_C_CARD_NAME] ?? banlist?.["Maxx C"];
  if (isForbidden(maxxStatus)) {
    notes.push(
      'Maxx "C" is Forbidden on the active Master Duel list — Maxx pressure pack is inert.',
    );
    return {
      packId: "masterDuelMaxxC",
      resilienceDelta: 0,
      disruptionDelta: 0,
      notes,
      maxxOutCount: 0,
      maxxPressureActive: false,
    };
  }

  const outCount = countNamedCopies(mainDeckCardNames, MAXX_C_HARD_OUT_NAMES);
  const resilienceDelta = maxxOutResilienceDelta(outCount);
  notes.push(
    `Maxx "C" is legal on Master Duel — hard outs in Main: ${outCount} (Ash / Called by / Crossout). Resilience delta ${resilienceDelta >= 0 ? "+" : ""}${resilienceDelta}.`,
  );
  if (outCount < 5) {
    notes.push(
      "Competitive MD lists often main ~5–6 hard Maxx answers; this is a heuristic, not a win-rate claim.",
    );
  }

  return {
    packId: "masterDuelMaxxC",
    resilienceDelta,
    disruptionDelta: 0,
    notes,
    maxxOutCount: outCount,
    maxxPressureActive: true,
  };
}

export function applyFormatRulePack(
  input: FormatRulePackInput,
): FormatRulePackResult {
  if (input.format === "TCG") {
    return applyTcgTournamentPack(input.roleCoverage);
  }
  if (input.format === "MASTER_DUEL") {
    return applyMasterDuelMaxxCPack(input.banlist, input.mainDeckCardNames);
  }
  return {
    packId: "none",
    resilienceDelta: 0,
    disruptionDelta: 0,
    notes: ["No format rule pack applied."],
    maxxOutCount: 0,
    maxxPressureActive: false,
  };
}
