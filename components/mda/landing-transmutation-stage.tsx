"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

const SPRITE_COUNT = 180;

type SpriteSeed = {
  id: number;
  /** Horizontal position as % of stage width. */
  x: number;
  /** 0–1 scroll progress when this sprite begins to appear. */
  appearAt: number;
  /** Vertical travel multiplier (higher = rises farther). */
  rise: number;
  /** Sprite pixel size. */
  size: number;
  /** Horizontal drift in % while rising (fans the cone). */
  drift: number;
};

/**
 * Deterministic cone: dense at the platform center, fanning as sprites rise.
 * Mix of short-travel (stay near platform) and long-travel (pillar) particles.
 */
function createSpriteSeeds(count: number): SpriteSeed[] {
  const seeds: SpriteSeed[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(count - 1, 1);
    const u = Math.max(((i * 47) % 100) / 100, 0.001);
    const v = ((i * 91) % 100) / 100;
    const gauss =
      Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const lane = i % 10;
    // 0–2: hug the platform; 3–6: mid column; 7–9: full rise
    const rise =
      lane < 3
        ? 0.08 + ((i * 13) % 18) / 100
        : lane < 7
          ? 0.28 + ((i * 13) % 28) / 100
          : 0.55 + ((i * 13) % 40) / 100;
    const spread = 5.5 + rise * 10;
    seeds.push({
      id: i,
      x: 50 + gauss * spread,
      appearAt: t * 0.72,
      rise,
      size: lane < 6 ? 6 + ((i * 17) % 14) : 12 + ((i * 17) % 22),
      drift: gauss * (2.2 + rise * 4),
    });
  }
  return seeds;
}

type RisingSpriteProps = {
  seed: SpriteSeed;
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
};

function RisingSprite({
  seed,
  progress,
  reduceMotion,
}: RisingSpriteProps): ReactNode {
  const opacity = useTransform(progress, (value) => {
    if (reduceMotion) {
      return value > seed.appearAt ? 0.95 : 0;
    }
    const local = (value - seed.appearAt) / Math.max(1 - seed.appearAt, 0.08);
    if (local <= 0) return 0;
    if (local < 0.12) return local / 0.12;
    return 1;
  });

  const filter = useTransform(progress, (value) => {
    const local = Math.max(
      0,
      (value - seed.appearAt) / Math.max(1 - seed.appearAt, 0.08),
    );
    const saturate = reduceMotion
      ? 1.4
      : 0.7 + Math.min(local, 1) * 1.6 + value * 0.55;
    const brightness = reduceMotion ? 1.1 : 0.95 + Math.min(local, 1) * 0.55;
    return `saturate(${saturate}) brightness(${brightness})`;
  });

  const top = useTransform(progress, (value) => {
    if (reduceMotion) return `${72 - seed.rise * 28}%`;
    const local = Math.max(
      0,
      (value - seed.appearAt) / Math.max(1 - seed.appearAt, 0.08),
    );
    // Originate just above the platform disc, rise in a vertical pillar
    const start = 74;
    const end = 74 - 66 * seed.rise;
    return `${start + (end - start) * Math.min(local, 1)}%`;
  });

  const left = useTransform(progress, (value) => {
    if (reduceMotion) return `${seed.x}%`;
    const local = Math.max(
      0,
      (value - seed.appearAt) / Math.max(1 - seed.appearAt, 0.08),
    );
    return `${seed.x + seed.drift * Math.min(local, 1)}%`;
  });

  return (
    <motion.img
      src="/images/Blue_Sprite.png"
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className="pointer-events-none absolute origin-center mix-blend-screen"
      style={{
        width: seed.size,
        height: seed.size,
        left,
        top,
        opacity,
        filter,
        marginLeft: -seed.size / 2,
        marginTop: -seed.size / 2,
      }}
    />
  );
}

export type LandingTransmutationStageProps = {
  /** `#main-content` — page scroll root. */
  container: HTMLElement;
  className?: string;
};

/**
 * Layered transmutation stage:
 * - Card + platform stay fixed (platform at default scale, optically centered)
 * - Light burst locked to the card center; opacity 0 → 1 with page scroll
 * - Sprites flow up from the platform, densify/saturate, stay visible
 */
export function LandingTransmutationStage({
  container,
  className,
}: LandingTransmutationStageProps): ReactNode {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLElement>(container);
  const seeds = useMemo(() => createSpriteSeeds(SPRITE_COUNT), []);

  useEffect(() => {
    containerRef.current = container;
  }, [container]);

  const { scrollYProgress } = useScroll({
    container: containerRef,
  });

  const burstOpacity = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 1] : [0, 1],
  );
  const burstScale = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [1, 1] : [0.92, 1.22],
  );
  const burstFilter = useTransform(scrollYProgress, (value) => {
    const brightness = reduceMotion ? 1 : 0.95 + value * 0.55;
    const saturate = reduceMotion ? 1 : 1 + value * 0.7;
    return `brightness(${brightness}) saturate(${saturate})`;
  });

  return (
    <div
      className={cn("relative h-full w-full select-none", className)}
      aria-hidden
    >
      {/*
        Light burst — centered on the card core. Fully hidden at top of page,
        full opacity at the bottom.
      */}
      <motion.img
        src="/images/Blue_Light_Burst.png"
        alt=""
        draggable={false}
        decoding="async"
        className="pointer-events-none absolute left-1/2 top-[36%] z-[1] w-[90%] max-w-none origin-center mix-blend-screen"
        style={{
          x: "-50%",
          y: "-50%",
          opacity: burstOpacity,
          scale: burstScale,
          filter: burstFilter,
        }}
      />

      {/*
        Platform at default width (88% of the 821px-class stage). Lifted off
        the viewport floor so the disc sits under the card, not as a footer.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/Holographic_Platform.png"
        alt=""
        draggable={false}
        decoding="async"
        className="pointer-events-none absolute bottom-[10%] left-1/2 z-0 w-[88%] max-w-none -translate-x-1/2"
      />

      <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
        {seeds.map((seed) => (
          <RisingSprite
            key={seed.id}
            seed={seed}
            progress={scrollYProgress}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/Card.png"
        alt=""
        draggable={false}
        decoding="async"
        className="pointer-events-none absolute left-1/2 top-[6%] z-[3] w-[62%] max-w-none -translate-x-1/2"
      />
    </div>
  );
}

function subscribeMainContent(onStoreChange: () => void): () => void {
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
}

function getMainContentSnapshot(): HTMLElement | null {
  return document.getElementById("main-content");
}

function getMainContentServerSnapshot(): HTMLElement | null {
  return null;
}

/**
 * Helper that waits for `#main-content` (used by section indicator / scroll).
 */
export function useLandingScrollContainer(): HTMLElement | null {
  return useSyncExternalStore(
    subscribeMainContent,
    getMainContentSnapshot,
    getMainContentServerSnapshot,
  );
}
