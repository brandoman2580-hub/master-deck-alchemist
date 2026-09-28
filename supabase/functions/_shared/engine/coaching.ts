/**
 * Deno mirror of formatFactsForPrompt + coaching hard rule.
 * Lean metrics-only Facts block for Groq (no raw deck dumps).
 */

import type { FactsEnvelope } from "./types.ts";
import {
  prioritySlice,
  resolveFactsPromptCaps,
  type FormatFactsOptions,
} from "./prompt-packing.ts";

export type { FormatFactsOptions } from "./prompt-packing.ts";
export {
  packDeckCardsForPrompt,
  resolveFactsPromptCaps,
  prioritySlice,
} from "./prompt-packing.ts";

export const VALIDATED_FACTS_HARD_RULE = `VALIDATED FACTS HARD RULE:
- Treat any VALIDATED FACTS / FactsEnvelope block as ground truth for legality, role coverage, consistency rates, matchup readiness, grade axes, and combo lines.
- If a metric, win rate, brick rate, combo step, or endboard is NOT present in that block (or in attached retrieved card rows / SERVER_VARIANTS), do NOT claim it as fact.
- You may still give qualitative strategy advice, but label speculation clearly and never fabricate numbers.
- Trace every quantitative claim to an evidence ID from the envelope or attachments.
- Prefer recommendations that address collisions and low role coverage called out in facts.`;

/**
 * Compress FactsEnvelope into a metrics-focused prompt block.
 * Caps are raised and intent-selected (not blind top-N).
 */
export function formatFactsForPrompt(
  facts: FactsEnvelope,
  options: FormatFactsOptions = {},
): string {
  const { diagnostics, legality, format, consistency, matchups, grade } = facts;
  const caps = resolveFactsPromptCaps(options);
  const q = (options.question ?? "").toLowerCase();

  const collisionItems = prioritySlice(
    diagnostics.collisions,
    caps.collisions,
    (c) => {
      let s = c.severity === "error" ? 30 : c.severity === "warning" ? 20 : 5;
      if (c.code.includes("LOCK") || /lock|conflict/i.test(c.message)) s += 15;
      if (q && c.message.toLowerCase().split(/\s+/).some((w) => w.length > 4 && q.includes(w))) {
        s += 10;
      }
      return s;
    },
  );
  const collisions =
    collisionItems.length > 0
      ? collisionItems
        .map((c) => `- [${c.severity}] ${c.code}: ${c.message}`)
        .join("\n")
      : "- None";

  const bossItems = prioritySlice(
    diagnostics.bosses,
    caps.bosses,
    (b) => (b.zone === "extra" ? 10 : 5),
  );
  const bosses =
    bossItems.length > 0
      ? bossItems.map((b) => `${b.name} (id:${b.cardId})`).join(", ")
      : "None detected";

  const consistencyLine =
    consistency.n > 0
      ? `n=${consistency.n}, starterAccess=${consistency.starterAccess.toFixed(3)}, brickRate=${consistency.brickRate.toFixed(3)}, oneInterruptionSurvival=${consistency.oneInterruptionSurvival.toFixed(3)}`
      : "not computed";

  const matchupItems = prioritySlice(
    matchups,
    caps.matchups,
    (m) => {
      let s = Math.abs(m.tagAdvantage) * 10;
      if (m.tier === "1" || m.tier === "T1") s += 8;
      if (q && q.includes(m.opponentArchetype.toLowerCase())) s += 25;
      return s;
    },
  );
  const matchupLines =
    matchupItems.length > 0
      ? matchupItems
        .map(
          (m) =>
            `- ${m.opponentArchetype} (T${m.tier ?? "?"}): tagAdvantage=${m.tagAdvantage.toFixed(2)}`,
        )
        .join("\n")
      : "- none";

  const comboItems = prioritySlice(
    facts.combos.lines,
    caps.combos,
    (l) => {
      let s = (l.endboardSummary?.length ?? 0) > 0 ? 8 : 2;
      if (q && q.includes(l.name.toLowerCase())) s += 20;
      return s;
    },
  );
  const comboLines =
    comboItems.length > 0
      ? comboItems
        .map((l) => {
          const killers = l.killers.slice(0, 3).join(", ") || "n/a";
          const summary = (l.endboardSummary || "").slice(0, 120);
          const fallback = l.fallbackSummary
            ? ` | if choke: ${l.fallbackSummary.slice(0, 80)}`
            : "";
          return `- ${l.name}: ${summary} (killers: ${killers})${fallback}`;
        })
        .join("\n")
      : "- none";

  const restrictionItems = prioritySlice(
    diagnostics.restrictions ?? [],
    caps.restrictions,
    (r) => {
      let s = 10;
      if (q && q.includes(r.name.toLowerCase())) s += 20;
      if (/only|cannot|lock/i.test(r.lockSummary)) s += 8;
      return s;
    },
  );
  const restrictionLines =
    restrictionItems.length > 0
      ? restrictionItems
        .map((r) => `- ${r.name}: ${r.lockSummary}`)
        .join("\n")
      : "- none";

  const noteItems = prioritySlice(
    diagnostics.strategyFit.notes,
    caps.strategyNotes,
    (_n, i) => 10 - i,
  );
  const strategyNotes =
    noteItems.length > 0
      ? noteItems.map((n) => `- ${n}`).join("\n")
      : "-";

  return `# VALIDATED FACTS (Facts Brain — do not invent alternate metrics)

**Format:** ${format}
**Deck hash:** ${facts.deckHash}
**Legality:** ${legality.ok ? "OK" : "FAILED"} (${legality.errors.length} errors)
**Role coverage:** starters=${diagnostics.roleCoverage.starters}, extenders=${diagnostics.roleCoverage.extenders}, handTraps=${diagnostics.roleCoverage.handTraps}, boardBreakers=${diagnostics.roleCoverage.boardBreakers}, endboard=${diagnostics.roleCoverage.endboardPieces}, locks=${diagnostics.roleCoverage.locks}
**Strategy fit:** archetype=${diagnostics.strategyFit.primaryArchetype ?? "unknown"}, primary=${diagnostics.strategyFit.primaryStrategy ?? "n/a"}, fitScore=${diagnostics.strategyFit.fitScore}
${strategyNotes}
**Bosses:** ${bosses}
**Structural collisions:**
${collisions}
**Summon / Extra Deck locks:**
${restrictionLines}
**Consistency:** ${consistencyLine}
**Matchups (tag readiness, priority ≤${caps.matchups}):**
${matchupLines}
**Grade:** ${grade.letter} (C=${grade.consistency} P=${grade.power} R=${grade.resilience} D=${grade.disruption})
**Grade synergy factor (internal):** ${typeof (grade as { synergyFactor?: number }).synergyFactor === "number" ? (grade as { synergyFactor: number }).synergyFactor.toFixed(2) : "n/a"}
**Format rule pack:** ${(grade as { formatRulePack?: string }).formatRulePack ?? "n/a"}
**Combos:** ${facts.combos.source} (${facts.combos.lines.length} lines; showing ≤${caps.combos})
${comboLines}

Only discuss combo steps present above; do not invent lines. Cite evidence IDs such as facts.consistency, facts.combos, facts.grade, facts.grade.breakdown, facts.formatRulePack, facts.diagnostics.*. Prefer professional competitive language in the answer (brick, choke, hand trap, board breaker) — never dump raw Δstarter/brickRate decimals or "FactsEnvelope" jargon to the user.`;
}

export function buildCoachSystemPrompt(
  basePrompt: string,
  factsPromptBlock?: string,
): string {
  const factsSection = factsPromptBlock?.trim()
    ? `\n\n${factsPromptBlock.trim()}\n`
    : "\n\n(No VALIDATED FACTS block attached — do not invent quantitative deck metrics.)\n";
  return `${VALIDATED_FACTS_HARD_RULE}\n\n${basePrompt}${factsSection}`;
}
