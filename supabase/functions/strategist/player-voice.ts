/**
 * Deterministic player-facing voice for consistency deltas.
 * Numbers stay server SoT; UI gets plain competitive language — never four-decimal dumps.
 */

import { stripEngineerMetrics } from "./yugioh-slang.ts";

export interface VoiceDelta {
  starterAccess: number;
  brickRate: number;
  oneInterruptionSurvival: number;
}

export interface VoiceVariantInput {
  cardName?: string;
  fromCopies: number;
  toCopies: number;
  factsDelta: VoiceDelta;
  /** Hint package name for trim copy (e.g. Resonator, Lair). */
  packageHint?: string;
}

const NEGLIGIBLE = 0.005;
const SMALL = 0.02;

function band(abs: number): "negligible" | "small" | "meaningful" {
  if (abs < NEGLIGIBLE) return "negligible";
  if (abs < SMALL) return "small";
  return "meaningful";
}

/**
 * Map a single copy-variant delta into a short professional reason.
 */
export function formatPlayerChangeReason(v: VoiceVariantInput): string {
  const d = v.factsDelta;
  const cutting = v.toCopies < v.fromCopies;
  const starterBand = band(Math.abs(d.starterAccess));
  const brickBand = band(Math.abs(d.brickRate));
  const surviveBand = band(Math.abs(d.oneInterruptionSurvival));
  const packageHint = v.packageHint?.trim();

  const parts: string[] = [];

  if (cutting && starterBand === "negligible" && brickBand !== "meaningful") {
    parts.push("Cleanest trim — minimal impact on openers");
  } else if (cutting && starterBand === "small") {
    parts.push("Slight consistency cost on openers");
  } else if (cutting && starterBand === "meaningful" && d.starterAccess < 0) {
    parts.push("Reduces starter density — only if you need the room");
  } else if (!cutting && d.starterAccess > 0) {
    parts.push("Improves opener access");
  } else if (cutting) {
    parts.push("Safe cut — consistency barely moves");
  } else {
    parts.push("Copy increase supported by opening simulations");
  }

  if (d.brickRate < -NEGLIGIBLE) {
    parts.push("slightly less brick");
  } else if (d.brickRate > SMALL) {
    parts.push("can brick a bit more");
  }

  if (surviveBand !== "negligible" && d.oneInterruptionSurvival < 0) {
    parts.push("slightly softer under disruption");
  }

  if (packageHint && cutting) {
    parts.push(`trims the ${packageHint} package`);
  }

  return `${parts[0]}.${parts.length > 1 ? ` ${parts.slice(1).join("; ")}.` : ""}`
    .replace(/\.\./g, ".")
    .trim();
}

/**
 * Default tradeoffs in competitive language (no brickRate jargon).
 */
export function defaultPlayerTradeoffs(mainOverForty = false): string[] {
  const lines = [
    "Cutting extenders can lower ceiling while opening cleaner.",
    "Adding copies may push Main over 40 and dilute every draw.",
  ];
  if (mainOverForty) {
    lines.unshift("You're over 40 — trim to 40 before stacking more gas.");
  }
  return lines;
}

/**
 * Lead sentence for a tune_copies fallback when Groq fails.
 */
export function formatTuneFallbackAnswer(
  variants: Array<VoiceVariantInput & { cardName: string }>,
  mainDeckSize?: number,
): string {
  if (variants.length === 0) {
    return "I could not find a clean copy change that improves your opens for that ask. Check starter density and Main size, then ask again about a specific package.";
  }
  const top = variants.slice(0, 3);
  const over =
    typeof mainDeckSize === "number" && mainDeckSize > 40
      ? `You're at ${mainDeckSize} — `
      : "";
  const ranked = top
    .map((v, i) => {
      const why = formatPlayerChangeReason(v);
      if (i === 0) {
        return `first cut is **${v.cardName}** (${v.fromCopies}→${v.toCopies}) — ${why}`;
      }
      return `next: **${v.cardName}** (${v.fromCopies}→${v.toCopies}) — ${why}`;
    })
    .join(" ");
  return stripEngineerMetrics(`${over}${ranked}`);
}

/**
 * Player-facing consistency snapshot (no raw rates as primary prose).
 */
export function formatConsistencyPlayerBlurb(stats: {
  starterAccess: number;
  brickRate: number;
  oneInterruptionSurvival: number;
  n: number;
}): string {
  if (stats.n <= 0) {
    return "Opening consistency was not computed for this list yet.";
  }
  const opener =
    stats.starterAccess >= 0.85
      ? "Your openers are already strong."
      : stats.starterAccess >= 0.7
        ? "Opener access is decent but not locked in."
        : "Opener access looks thin — you may be missing starters or search.";
  const brick =
    stats.brickRate <= 0.08
      ? "Brick rate is tight."
      : stats.brickRate <= 0.15
        ? "You still brick more than ideal."
        : "Brick rate is high — expect dead opens.";
  return `${opener} ${brick}`;
}

/**
 * Denylist check used by tests and post-parse sanitize.
 */
export function playerTextPassesMetricDenylist(text: string): boolean {
  return !/(Δstarter|Δbrick|Δsurvive|starterAccess\s*[≈=~]|brickRate\s*[≈=~]|FactsEnvelope|Validated Δ)/i
    .test(text);
}
