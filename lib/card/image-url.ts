const YGOPRODECK_HOST = "images.ygoprodeck.com";
export const CARD_IMAGE_PLACEHOLDER = "/placeholder.svg";

export type CardImageSize = "small" | "full";

export interface CardImageEntry {
  id?: number;
  image_url?: string;
  image_url_small?: string;
}

/**
 * YGOPRODeck assigns temporary spoiler IDs in the 10xxxxxxx block (100M–200M)
 * before Konami publishes an official passcode. Those rows often lack S3 art and
 * are later replaced by renamed official cards.
 *
 * Skill/token/etc. cards use other high ID ranges and are NOT treated as provisional.
 */
export function isProvisionalCardId(cardId: number): boolean {
  return (
    Number.isFinite(cardId) && cardId >= 100_000_000 && cardId < 200_000_000
  );
}

export function isYgoprodeckImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === YGOPRODECK_HOST;
  } catch {
    return url.includes(YGOPRODECK_HOST);
  }
}

/**
 * True when the URL points at Supabase Object Storage (legacy card-images bucket).
 * These paths must not be used once art lives on AWS S3 — they drive Storage + Egress quota.
 */
export function isSupabaseStorageImageUrl(
  url: string | undefined | null,
): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith(".supabase.co") &&
      parsed.pathname.includes("/storage/v1/object/")
    );
  } catch {
    return (
      url.includes(".supabase.co/") && url.includes("/storage/v1/object/")
    );
  }
}

export function isExternalCardImageFallbackDisabled(): boolean {
  return process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_CARD_IMAGE_FALLBACK === "true";
}

export function getCardImageBaseUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL?.trim();
  return base ? base.replace(/\/$/, "") : undefined;
}

function shouldRejectStoredCardImageUrl(url: string): boolean {
  if (url === CARD_IMAGE_PLACEHOLDER) return true;
  if (isSupabaseStorageImageUrl(url)) return true;
  if (isExternalCardImageFallbackDisabled() && isYgoprodeckImageUrl(url)) {
    return true;
  }
  return false;
}

function firstUsableStoredUrl(
  cardImages: CardImageEntry[] | null | undefined,
  preferSmall: boolean,
): string | undefined {
  if (!cardImages || cardImages.length === 0) return undefined;

  const first = cardImages[0];
  const candidates = preferSmall
    ? [first.image_url_small, first.image_url]
    : [first.image_url, first.image_url_small];

  for (const url of candidates) {
    if (!url) continue;
    if (shouldRejectStoredCardImageUrl(url)) continue;
    return url;
  }

  return undefined;
}

/**
 * Build a hosted (or YGOPRODeck fallback) image URL for a card id.
 * Provisional YGOPRODeck IDs never get invented S3 paths — those objects 403.
 */
export function buildCardImageUrl(
  cardId: number,
  size: CardImageSize = "small",
): string {
  if (!cardId || isProvisionalCardId(cardId)) {
    return CARD_IMAGE_PLACEHOLDER;
  }

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

  // Prefer stored URLs when present (already pointed at S3 after migration/sync).
  const stored = firstUsableStoredUrl(cardImages, preferSmall);
  if (stored) return stored;

  // Never invent S3 keys for provisional IDs or when we have no card id.
  if (!cardId || isProvisionalCardId(cardId)) {
    return CARD_IMAGE_PLACEHOLDER;
  }

  const hasImageMetadata = Boolean(cardImages && cardImages.length > 0);

  // Hosted base URL is source of truth (AWS S3) for official passcodes —
  // but only rewrite when the row had art metadata (rejected hosts → S3).
  // Inventing keys for null card_images causes next/image upstream 403s.
  if (getCardImageBaseUrl()) {
    if (!hasImageMetadata) {
      return CARD_IMAGE_PLACEHOLDER;
    }
    return buildCardImageUrl(cardId, preferSmall ? "small" : "full");
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
  const placeholderEntry = (): CardImageEntry[] => [
    {
      id: cardId || undefined,
      image_url: CARD_IMAGE_PLACEHOLDER,
      image_url_small: CARD_IMAGE_PLACEHOLDER,
    },
  ];

  // Prefer any already-valid stored URL (including rare high-id skill/art rows).
  const storedSmall = firstUsableStoredUrl(existing, true);
  const storedFull = firstUsableStoredUrl(existing, false);
  if (storedSmall || storedFull) {
    // Official passcodes on a hosted base → canonicalize to S3 passcode keys.
    if (getCardImageBaseUrl() && cardId && !isProvisionalCardId(cardId)) {
      return [
        {
          id: cardId,
          image_url: buildCardImageUrl(cardId, "full"),
          image_url_small: buildCardImageUrl(cardId, "small"),
        },
      ];
    }
    return [
      {
        id: existing?.[0]?.id ?? (cardId || undefined),
        image_url: storedFull ?? storedSmall!,
        image_url_small: storedSmall ?? storedFull!,
      },
    ];
  }

  // No usable stored art.
  // Provisional IDs / missing metadata must not invent S3 keys (upstream 403).
  if (!cardId || isProvisionalCardId(cardId) || !existing?.length) {
    if (getCardImageBaseUrl() || isProvisionalCardId(cardId) || !cardId) {
      return placeholderEntry();
    }
  }

  // Hosted base + rejected hosts (Supabase / YGO) → rewrite to passcode S3 URL.
  if (getCardImageBaseUrl() && cardId && !isProvisionalCardId(cardId)) {
    return [
      {
        id: cardId,
        image_url: buildCardImageUrl(cardId, "full"),
        image_url_small: buildCardImageUrl(cardId, "small"),
      },
    ];
  }

  const disableExternal = isExternalCardImageFallbackDisabled();

  if (existing && existing.length > 0) {
    const first = existing[0];
    const small = first.image_url_small;
    const full = first.image_url;

    if (disableExternal) {
      const validSmall =
        small && !shouldRejectStoredCardImageUrl(small) ? small : undefined;
      const validFull =
        full && !shouldRejectStoredCardImageUrl(full) ? full : undefined;

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
      const validSmall =
        small && !isSupabaseStorageImageUrl(small) ? small : undefined;
      const validFull =
        full && !isSupabaseStorageImageUrl(full) ? full : undefined;
      if (validSmall || validFull) {
        return [
          {
            id: first.id ?? cardId,
            image_url: validFull ?? validSmall!,
            image_url_small: validSmall ?? validFull!,
          },
        ];
      }
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
