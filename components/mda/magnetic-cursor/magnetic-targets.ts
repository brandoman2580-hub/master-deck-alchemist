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

function isVisibleOverlay(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number.parseFloat(style.opacity || "1") === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}

function pointInRect(clientX: number, clientY: number, rect: DOMRect): boolean {
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

/**
 * Active overlay root for magnetic targeting (user menu / action popover / modal).
 * Background `[data-magnetic]` nodes must not capture the ring while open.
 */
export function getMagneticSearchRoot(): ParentNode {
  const userMenus = document.querySelectorAll("[data-mda-user-menu]");
  for (let i = userMenus.length - 1; i >= 0; i -= 1) {
    const el = userMenus[i];
    if (el && isVisibleOverlay(el)) return el;
  }

  const openActionPopovers = document.querySelectorAll(
    '[data-mda-action-popover][data-state="open"]',
  );
  for (let i = openActionPopovers.length - 1; i >= 0; i -= 1) {
    const el = openActionPopovers[i];
    if (el && isVisibleOverlay(el)) return el;
  }

  const modals = document.querySelectorAll("[aria-modal='true']");
  for (let i = modals.length - 1; i >= 0; i -= 1) {
    const el = modals[i];
    if (el && isVisibleOverlay(el)) return el;
  }

  return document;
}

function readBorderRadius(node: HTMLElement, rect: DOMRect): number {
  const computed = window.getComputedStyle(node).borderRadius;
  const parsed = Number.parseFloat(computed);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed + 7, Math.max(rect.height, rect.width) / 2 + 7);
}

function toMagTarget(node: HTMLElement, rect: DOMRect): MagTarget {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
    radius: readBorderRadius(node, rect),
  };
}

function geometricNearestInRoot(
  root: ParentNode,
  clientX: number,
  clientY: number,
): MagTarget | null {
  const nodes = root.querySelectorAll<HTMLElement>("[data-magnetic]");
  let bestDist = Number.POSITIVE_INFINITY;
  let bestArea = Number.POSITIVE_INFINITY;
  let best: MagTarget | null = null;

  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    const dist = distanceToRect(clientX, clientY, rect);
    if (dist > MAGNET_RADIUS) return;
    const area = rect.width * rect.height;
    if (dist < bestDist || (dist === bestDist && area < bestArea)) {
      bestDist = dist;
      bestArea = area;
      best = toMagTarget(node, rect);
    }
  });

  return best;
}

/**
 * Topmost magnetic control under the pointer that belongs to `root`.
 * Walks the hit stack so punch-through to page chrome is ignored.
 */
function hitMagneticInRoot(
  root: ParentNode,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const stack =
    typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : (() => {
          const single = document.elementFromPoint?.(clientX, clientY);
          return single ? [single] : [];
        })();

  for (const el of stack) {
    if (!(el instanceof Element)) continue;
    if (root !== document && !root.contains(el)) continue;
    const hit = el.closest<HTMLElement>("[data-magnetic]");
    if (hit && (root === document || root.contains(hit))) {
      return hit;
    }
  }
  return null;
}

/**
 * Prefer the magnetic node under the pointer (innermost control).
 * When an overlay root is open, page magnets underneath never win.
 */
export function nearestMagneticTarget(
  clientX: number,
  clientY: number,
): MagTarget | null {
  const root = getMagneticSearchRoot();
  const scoped = root !== document && root instanceof Element;

  if (scoped) {
    const rootRect = root.getBoundingClientRect();
    if (!pointInRect(clientX, clientY, rootRect)) {
      // Overlay open, pointer outside — suppress background magnets entirely.
      return null;
    }

    const hit = hitMagneticInRoot(root, clientX, clientY);
    if (hit) {
      const rect = hit.getBoundingClientRect();
      if (rect.width >= 4 && rect.height >= 4) {
        return toMagTarget(hit, rect);
      }
    }

    return geometricNearestInRoot(root, clientX, clientY);
  }

  const hit = hitMagneticInRoot(document, clientX, clientY);
  if (hit) {
    const rect = hit.getBoundingClientRect();
    if (rect.width >= 4 && rect.height >= 4) {
      return toMagTarget(hit, rect);
    }
  }

  return geometricNearestInRoot(document, clientX, clientY);
}
