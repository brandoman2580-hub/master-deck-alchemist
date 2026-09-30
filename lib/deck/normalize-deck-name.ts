/**
 * Normalize a user-entered deck name for rename.
 * @returns trimmed name, or null if empty / whitespace-only.
 */
export function normalizeDeckName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Keep length sane for Archives cards / chrome.
  return trimmed.slice(0, 80);
}
