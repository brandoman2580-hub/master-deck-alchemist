/**
 * Phase 4: Client-side helper functions for recommendation telemetry
 */

/**
 * Generate deck fingerprint (SHA256 hash) for telemetry
 * Matches server-side fingerprintDeck function
 */
export async function fingerprintDeck(
  deck: unknown,
  explainTo: string,
  prefs: unknown,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = JSON.stringify({ deck, explainTo, prefs });
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = new Uint8Array(hash);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

