/**
 * Stable identity of a banlist. Unlimited cards are ignored.
 * The same function runs in the scraper and in the Workshop so a banlist
 * change stops an older snapshot from counting as current.
 */
export function banlistFingerprint(
  banlist: Record<string, string | undefined>,
): string {
  const rows: string[] = [];
  for (const [name, status] of Object.entries(banlist)) {
    if (
      status !== "Forbidden" &&
      status !== "Limited" &&
      status !== "Semi-Limited"
    ) {
      continue;
    }
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) continue;
    rows.push(`${trimmed}|${status}`);
  }
  rows.sort();
  return rows.join("\n");
}
