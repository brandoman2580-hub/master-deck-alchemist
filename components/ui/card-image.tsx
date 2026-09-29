"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image, { type ImageProps } from "next/image";
import {
  CARD_IMAGE_PLACEHOLDER,
  resolveCardImageUrl,
  type CardImageEntry,
} from "@/lib/card/image-url";
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

/**
 * Visual stand-in when card art is unavailable.
 * Prefer this over fetching /placeholder.svg through next/image so missing-art
 * cards never generate network 404 noise in the workshop.
 */
function CardArtPlaceholder({
  alt,
  className,
  fill,
  width,
  height,
}: {
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number | `${number}`;
  height?: number | `${number}`;
}): ReactNode {
  return (
    <span
      role="img"
      aria-label={alt}
      className={cn(
        "relative block overflow-hidden bg-mda-chrome-deep",
        fill ? "absolute inset-0 h-full w-full" : undefined,
        className,
      )}
      style={
        fill
          ? undefined
          : {
              width: width ? Number(width) : undefined,
              height: height ? Number(height) : undefined,
            }
      }
    >
      <span
        aria-hidden
        className="absolute inset-[6%] rounded-[2px] border border-mda-cyan/25 bg-mda-chrome"
      />
      <span
        aria-hidden
        className="absolute left-1/2 top-[36%] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-mda-cyan/40"
      />
    </span>
  );
}

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
  const resolved = resolveCardImageUrl(card.id, card.card_images, {
    preferSmall,
  });
  const [src, setSrc] = useState(resolved);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(resolved);
    setLoaded(false);
    setFailed(false);
  }, [resolved, card.id]);

  const resolvedAlt = alt ?? card.name ?? "Card image";
  const isPlaceholder = src === CARD_IMAGE_PLACEHOLDER || failed;
  const showSkeleton = !skipSkeleton && !loaded && !isPlaceholder;

  if (isPlaceholder) {
    return (
      <CardArtPlaceholder
        alt={resolvedAlt}
        className={className}
        fill={fill}
        width={width}
        height={height}
      />
    );
  }

  const image = (
    <Image
      {...props}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      src={src}
      alt={resolvedAlt}
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
        // Swap to inline placeholder — avoids next/image retrying a dead S3 key
        // and avoids depending on /placeholder.svg network fetch for recovery.
        setSrc(CARD_IMAGE_PLACEHOLDER);
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
