/**
 * Shared Workshop card tile metrics — library and deck builder must match.
 * Aspect ≈ 59×86mm (Yu-Gi-Oh); width mirrors masterduelmeta.com tiles.
 */
export const WORKSHOP_CARD_SIZES = "(min-width: 576px) 104px, 20vw";

export const WORKSHOP_CARD_TILE =
  "relative aspect-[59/86] w-[20vw] max-w-[104px] min-w-[72px] overflow-hidden bg-mda-deep sm:w-[104px]";

export const WORKSHOP_CARD_SHELL =
  "relative inline-block shadow-[0_6px_16px_rgba(58,79,92,0.28)]";

export const WORKSHOP_CARD_WIDTH_PX = 104;
export const WORKSHOP_CARD_MIN_WIDTH_PX = 72;
export const WORKSHOP_CARD_GAP_PX = 8;

/** Pixel width for layout math (virtualizer / column count). */
export function workshopCardTileWidthPx(viewportWidth: number): number {
  if (viewportWidth >= 576) return WORKSHOP_CARD_WIDTH_PX;
  return Math.min(
    WORKSHOP_CARD_WIDTH_PX,
    Math.max(WORKSHOP_CARD_MIN_WIDTH_PX, Math.floor(viewportWidth * 0.2)),
  );
}

export function workshopCardTileHeightPx(tileWidthPx: number): number {
  return Math.round(tileWidthPx * (86 / 59));
}
