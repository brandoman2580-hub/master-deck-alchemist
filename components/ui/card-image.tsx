"use client";

import { useState, type ReactNode } from "react";
import Image, { type ImageProps } from "next/image";
import {
  CARD_IMAGE_PLACEHOLDER,
  resolveCardImageUrl,
  type CardImageEntry,
} from "@/lib/card-image-url";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type CardImageSource = {
  id: number;
  name?: string;
  card_images?: CardImageEntry[] | null;
};

type CardImageProps = Omit<ImageProps, "src"> & {
  card: CardImageSource;
  preferSmall?: boolean;
  /** When true, skip skeleton (e.g. known-cached decorative use). */
  skipSkeleton?: boolean;
};

/** next/image wrapper with shape-matched skeleton until load completes. */
export function CardImage({
  card,
  preferSmall = true,
  alt,
  skipSkeleton = false,
  className,
  onLoad,
  onError,
  fill,
  width,
  height,
  ...props
}: CardImageProps): ReactNode {
  const src = resolveCardImageUrl(card.id, card.card_images, { preferSmall });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showSkeleton = !skipSkeleton && !loaded && !failed;

  const image = (
    <Image
      {...props}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      src={src}
      alt={alt ?? card.name ?? "Card image"}
      className={cn(
        "transition-opacity duration-200",
        showSkeleton ? "opacity-0" : "opacity-100",
        className,
      )}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        setFailed(true);
        setLoaded(true);
        onError?.(event);
      }}
    />
  );

  if (skipSkeleton) {
    return image;
  }

  return (
    <>
      {showSkeleton ? (
        <Skeleton
          aria-hidden
          className="absolute inset-0 z-[1] h-full w-full rounded-none bg-white/10"
        />
      ) : null}
      {image}
    </>
  );
}

export function hasDisplayableCardImage(
  card: CardImageSource,
  preferSmall = true,
): boolean {
  const src = resolveCardImageUrl(card.id, card.card_images, { preferSmall });
  return src !== CARD_IMAGE_PLACEHOLDER;
}
