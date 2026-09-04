export const MAGNET_RADIUS = 10;

export type MagTarget = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Pixel border-radius for the morph ring (0 = square). */
  radius: number;
};

/** Distance from point to rectangle (0 when inside). */
export function distanceToRect(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number {
  const nearestX = Math.max(rect.left, Math.min(clientX, rect.right));
  const nearestY = Math.max(rect.top, Math.min(clientY, rect.bottom));
  return Math.hypot(clientX - nearestX, clientY - nearestY);
}

/**
 * When a modal dialog is open, magnetic targeting is scoped to it so
 * background `[data-magnetic]` nodes (cards, nav, etc.) cannot capture the ring.
 */
export function getMagneticSearchRoot(): ParentNode {
  const modals = document.querySelectorAll("[aria-modal='true']");
  if (modals.length > 0) {
    return modals[modals.length - 1] ?? document;
  }

  const openActionPopovers = document.querySelectorAll(
    '[data-mda-action-popover][data-state="open"]',
  );
  if (openActionPopovers.length > 0) {
    return openActionPopovers[openActionPopovers.length - 1] ?? document;
  }

  return document;
}

function readBorderRadius(node: HTMLElement, rect: DOMRect): number {
  const computed = window.getComputedStyle(node).borderRadius;
  const parsed = Number.parseFloat(computed);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed + 7, Math.max(rect.height, rect.width) / 2 + 7);
}

export function nearestMagneticTarget(
  clientX: number,
  clientY: number,
): MagTarget | null {
  const root = getMagneticSearchRoot();
  const nodes = root.querySelectorAll<HTMLElement>("[data-magnetic]");
  let bestDist = Number.POSITIVE_INFINITY;
  let best: MagTarget | null = null;

  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    const dist = distanceToRect(clientX, clientY, rect);
    if (dist > MAGNET_RADIUS) return;
    if (dist < bestDist) {
      bestDist = dist;
      best = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
        radius: readBorderRadius(node, rect),
      };
    }
  });

  return best;
}
