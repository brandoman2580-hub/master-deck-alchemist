/**
 * Compatibility re-exports — prefer get-facts-edge.ts for full FactsEnvelope.
 * @deprecated Use getOrComputeFactsEnvelope from get-facts-edge.ts
 */

export {
  computeDeckHashFromSections,
  evaluateStructuralLegality,
  getOrComputeFactsEnvelope,
} from "./get-facts-edge.ts";

import type { FactsEnvelope } from "../_shared/engine/types.ts";
import { formatFactsForPrompt } from "../_shared/engine/coaching.ts";

/** @deprecated Thin prompt block — use formatFactsForPrompt(FactsEnvelope) */
export interface FactsPromptBlock {
  format: "TCG" | "MASTER_DUEL";
  deckHash: string;
  legalityOk: boolean;
  legalityErrors: string[];
  roleCoverage: {
    starters: number;
    extenders: number;
    handTraps: number;
    boardBreakers: number;
    endboardPieces: number;
  };
  collisions: Array<{ code: string; severity: string; message: string }>;
  primaryArchetype: string | null;
  primaryStrategy: string | null;
  fitScore: number;
  bosses: string[];
  notes: string[];
}

export function formatFactsPromptBlockFromEnvelope(
  facts: FactsEnvelope,
): string {
  return formatFactsForPrompt(facts);
}

/** @deprecated */
export function formatFactsPromptBlock(block: FactsPromptBlock): string {
  const collisions =
    block.collisions.length > 0
      ? block.collisions
        .map((c) => `- [${c.severity}] ${c.code}: ${c.message}`)
        .join("\n")
      : "- None";

  return `# VALIDATED FACTS (Facts Brain — do not invent alternate metrics)

**Format:** ${block.format}
**Deck hash:** ${block.deckHash}
**Legality:** ${block.legalityOk ? "OK" : "FAILED"}
${block.legalityErrors.length ? block.legalityErrors.map((e) => `- ${e}`).join("\n") : "- No legality errors"}

**Role coverage:** starters=${block.roleCoverage.starters}, extenders=${block.roleCoverage.extenders}, handTraps=${block.roleCoverage.handTraps}, boardBreakers=${block.roleCoverage.boardBreakers}, endboard=${block.roleCoverage.endboardPieces}

**Strategy fit:** archetype=${block.primaryArchetype ?? "unknown"}, primary=${block.primaryStrategy ?? "n/a"}, fitScore=${block.fitScore}
${block.notes.map((n) => `- ${n}`).join("\n") || "-"}

**Bosses:** ${block.bosses.length ? block.bosses.join(", ") : "None detected"}

**Structural collisions:**
${collisions}`;
}
