/**
 * Text-pattern check for Ash Blossom & Joyous Spring.
 * This is not a rules engine: it flags effect text that adds from Deck to hand,
 * Special Summons from the Deck, or sends from the Deck to the GY.
 */

export const ASH_TRAP_NAME = "Ash Blossom & Joyous Spring";

export type AshClause = "add" | "special" | "send";

export interface AshWarning {
  trapName: typeof ASH_TRAP_NAME;
  clause: AshClause;
  stepNodeId: string;
}

/** "Deck" in Yu-Gi-Oh means the Main Deck. "Extra Deck" is a different place Ash cannot negate. */
const MAIN_DECK = String.raw`(?<!extra\s)\bdeck\b`;
const ADD_FROM_DECK = new RegExp(String.raw`\badd\b[^.]{0,160}\bfrom\b[^.]{0,80}${MAIN_DECK}[^.]{0,80}\bhand\b`, "i");
const SPECIAL_FROM_DECK = new RegExp(String.raw`\bspecial summon\b[^.]{0,160}\bfrom\b[^.]{0,80}${MAIN_DECK}`, "i");
const SEND_FROM_DECK = new RegExp(
  String.raw`\bsend\b[^.]{0,120}\bfrom\b[^.]{0,80}${MAIN_DECK}[^.]{0,80}\b(?:gy|graveyard)\b`,
  "i",
);

export function ashClausePhrase(clause: AshClause): string {
  if (clause === "add") return "adds a card from the Deck to the hand";
  if (clause === "special") return "Special Summons from the Deck";
  return "sends a card from the Deck to the GY";
}

/**
 * First matching Ash clause in effect text, or null.
 * "Add" wins over "Special Summon" when one sentence does both.
 */
export function ashClauseForText(desc: string): AshClause | null {
  const text = desc.replace(/\s+/g, " ");
  // Ash's own text lists the actions it negates. Those lines are not something Ash can stop.
  if (/includes any of these effects/i.test(text) && /negate that effect/i.test(text)) return null;
  if (ADD_FROM_DECK.test(text)) return "add";
  if (SPECIAL_FROM_DECK.test(text)) return "special";
  if (SEND_FROM_DECK.test(text)) return "send";
  return null;
}

export interface AshStepCard {
  id: string;
  kind: string;
  lane?: string;
  cardIds: number[];
}

/**
 * Warnings for opening-hand and play cards. End-board cards are not steps.
 * Nothing here is written back onto the saved graph.
 */
export function ashWarningsForSteps(
  nodes: readonly AshStepCard[],
  cardsById: ReadonlyMap<number, { desc: string }>,
): AshWarning[] {
  const warnings: AshWarning[] = [];
  for (const node of nodes) {
    const lane = node.lane ?? (node.kind === "hand" ? "hand" : node.kind === "step" ? "play" : "");
    if (lane !== "hand" && lane !== "play") continue;
    const cardId = node.cardIds[0];
    if (cardId == null) continue;
    const card = cardsById.get(cardId);
    if (!card) continue;
    const clause = ashClauseForText(card.desc);
    if (!clause) continue;
    warnings.push({ trapName: ASH_TRAP_NAME, clause, stepNodeId: node.id });
  }
  return warnings;
}
