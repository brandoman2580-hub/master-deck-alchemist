/**
 * Helper function to determine deck building context based on deck state
 */
export function getDeckContext(
  getDeckStats: () => {
    mainCount: number;
    extraCount: number;
    sideCount: number;
  },
): "initial_build" | "refining" | "completing" {
  const stats = getDeckStats();
  if (stats.mainCount === 0) return "initial_build";
  if (stats.mainCount >= 50) return "completing";
  return "refining";
}
