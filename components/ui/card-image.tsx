"use client";

import Image, { type ImageProps } from "next/image";
import {
  CARD_IMAGE_PLACEHOLDER,
  resolveCardImageUrl,
  type CardImageEntry,
} from "@/lib/card-image-url";

export type CardImageSource = {
  id: number;
  name?: string;
  card_images?: CardImageEntry[] | null;
};

type CardImageProps = Omit<ImageProps, "src"> & {
  card: CardImageSource;
  preferSmall?: boolean;
};

/** next/image wrapper that never passes YGOPRODeck URLs when external fallback is disabled. */
export function CardImage({
  card,
  preferSmall = true,
  alt,
  ...props
}: CardImageProps) {
  const src = resolveCardImageUrl(card.id, card.card_images, { preferSmall });

  return (
    <Image {...props} src={src} alt={alt ?? card.name ?? "Card image"} />
  );
}

export function hasDisplayableCardImage(
  card: CardImageSource,
  preferSmall = true,
): boolean {
  const src = resolveCardImageUrl(card.id, card.card_images, { preferSmall });
  return src !== CARD_IMAGE_PLACEHOLDER;
}
