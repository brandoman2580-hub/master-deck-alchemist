const COPY_CAP: Record<string, number> = {
  Forbidden: 0,
  Limited: 1,
  "Semi-Limited": 2,
};

/**
 * A list is legal when every card respects the active banlist.
 * Names are matched without case or extra spaces.
 * Returns the first illegal card name, or null when the list is legal.
 */
export function firstBanlistViolation(
  copiesByName: Iterable<[string, number]>,
  banlist: Record<string, string | undefined>,
): string | null {
  const caps = new Map<string, { cap: number; label: string }>();
  for (const [name, status] of Object.entries(banlist)) {
    if (!status) continue;
    const cap = COPY_CAP[status];
    if (cap == null) continue;
    caps.set(normalizeCardName(name), { cap, label: name });
  }

  for (const [name, copies] of copiesByName) {
    const rule = caps.get(normalizeCardName(name));
    if (!rule) continue;
    if (copies > rule.cap) return name;
  }
  return null;
}

export function normalizeCardName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ");
}
