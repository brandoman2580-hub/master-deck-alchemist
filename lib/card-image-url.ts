const YGOPRODECK_HOST = "images.ygoprodeck.com";
export const CARD_IMAGE_PLACEHOLDER = "/placeholder.svg";

export type CardImageSize = "small" | "full";

export interface CardImageEntry {
  id?: number;
  image_url?: string;
  image_url_small?: string;
}

export function isYgoprodeckImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === YGOPRODECK_HOST;
  } catch {
    return url.includes(YGOPRODECK_HOST);
  }
}

export function isExternalCardImageFallbackDisabled(): boolean {
  return process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_CARD_IMAGE_FALLBACK === "true";
}

export function getCardImageBaseUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL?.trim();
  return base ? base.replace(/\/$/, "") : undefined;
}

export function buildCardImageUrl(
  cardId: number,
  size: CardImageSize = "small",
): string {
  const base = getCardImageBaseUrl();
  if (base) {
    return `${base}/${cardId}.jpg`;
  }

  if (isExternalCardImageFallbackDisabled()) {
    return CARD_IMAGE_PLACEHOLDER;
  }

  const folder = size === "small" ? "cards_small" : "cards";
  return `https://images.ygoprodeck.com/images/${folder}/${cardId}.jpg`;
}

export function resolveCardImageUrl(
  cardId: number,
  cardImages?: CardImageEntry[] | null,
  options?: { preferSmall?: boolean },
): string {
  const preferSmall = options?.preferSmall ?? true;
  const disableExternal = isExternalCardImageFallbackDisabled();

  if (cardImages && cardImages.length > 0) {
    const first = cardImages[0];
    const candidates = preferSmall
      ? [first.image_url_small, first.image_url]
      : [first.image_url, first.image_url_small];

    for (const url of candidates) {
      if (!url) continue;
      if (disableExternal && isYgoprodeckImageUrl(url)) continue;
      return url;
    }
  }

  if (cardId) {
    return buildCardImageUrl(cardId, preferSmall ? "small" : "full");
  }

  return CARD_IMAGE_PLACEHOLDER;
}

export function normalizeCardImages(
  cardId: number,
  existing?: CardImageEntry[] | null,
): CardImageEntry[] {
  const disableExternal = isExternalCardImageFallbackDisabled();

  if (existing && existing.length > 0) {
    const first = existing[0];
    const small = first.image_url_small;
    const full = first.image_url;

    if (disableExternal) {
      const validSmall = small && !isYgoprodeckImageUrl(small) ? small : undefined;
      const validFull = full && !isYgoprodeckImageUrl(full) ? full : undefined;

      if (validSmall || validFull) {
        return [
          {
            id: first.id ?? cardId,
            image_url: validFull ?? validSmall ?? buildCardImageUrl(cardId, "full"),
            image_url_small:
              validSmall ?? validFull ?? buildCardImageUrl(cardId, "small"),
          },
        ];
      }
    } else if (small || full) {
      return existing;
    }
  }

  return [
    {
      id: cardId,
      image_url: buildCardImageUrl(cardId, "full"),
      image_url_small: buildCardImageUrl(cardId, "small"),
    },
  ];
}
