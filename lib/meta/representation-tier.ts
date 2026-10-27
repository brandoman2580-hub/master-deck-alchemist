export type MetaTier = 1 | 2 | 3;

/**
 * Representation cutoffs shared with the Yu-Gi-Oh Meta tier scraper.
 * Shares at or above 2% are tier 3. Below that is omitted.
 * Tier 2 is the 5–10% band and must be kept with tiers 1 and 3.
 */
export function tierFromRepresentation(
  share: number | null | undefined,
): MetaTier | null {
  if (share == null || !Number.isFinite(share)) return null;
  if (share > 10) return 1;
  if (share >= 5) return 2;
  if (share >= 2) return 3;
  return null;
}
