/**
 * Banlist + copy-cap eligibility (client mirror of edge synergy-eligibility).
 */

export function maxCopiesForBanStatus(
  status: string | undefined | null,
): number {
  if (!status) return 3;
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "forbidden" || normalized === "banned") return 0;
  if (normalized === "limited") return 1;
  if (normalized === "semi-limited" || normalized === "semi limited") {
    return 2;
  }
  return 3;
}

export function countCardCopiesInSections(
  sections: Array<{ id?: number; cardId?: number; count?: number }[]>,
  cardId: number,
): number {
  let total = 0;
  for (const section of sections) {
    for (const entry of section) {
      const id = entry.cardId ?? entry.id;
      if (id === cardId) total += entry.count ?? 1;
    }
  }
  return total;
}

export function canAddCardUnderBanlist(args: {
  cardId: number;
  cardName: string;
  copiesInDeck: number;
  banlist: Record<string, string>;
}): boolean {
  const max = maxCopiesForBanStatus(args.banlist[args.cardName]);
  if (max <= 0) return false;
  return args.copiesInDeck < max;
}
