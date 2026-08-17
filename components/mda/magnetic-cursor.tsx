"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";

const MAGNET_RADIUS = 10;
const IDLE_RING = 16;
/** Alchemy Sun cursor size (outer ring diameter). */
const SUN_SIZE = 22;

type MagTarget = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Pixel border-radius for the morph ring (0 = square). */
  radius: number;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isFinePointerDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: fine)").matches &&
    window.matchMedia("(min-width: 768px)").matches
  );
}

/** Distance from point to rectangle (0 when inside). */
function distanceToRect(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number {
  const nearestX = Math.max(rect.left, Math.min(clientX, rect.right));
  const nearestY = Math.max(rect.top, Math.min(clientY, rect.bottom));
  return Math.hypot(clientX - nearestX, clientY - nearestY);
}

function nearestMagneticTarget(
  clientX: number,
  clientY: number,
): MagTarget | null {
  const nodes = document.querySelectorAll<HTMLElement>("[data-magnetic]");
  let bestDist = Number.POSITIVE_INFINITY;
  let best: MagTarget | null = null;

  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    const dist = distanceToRect(clientX, clientY, rect);
    // Only snap when the pointer is on/nearly on the target — avoids
    // nearby links (e.g. "Create one") lighting up adjacent CTAs.
    if (dist > MAGNET_RADIUS) return;
    if (dist < bestDist) {
      bestDist = dist;
      const computed = window.getComputedStyle(node).borderRadius;
      const parsed = Number.parseFloat(computed);
      const radius =
        Number.isFinite(parsed) && parsed > 0
          ? Math.min(parsed + 7, Math.max(rect.height, rect.width) / 2 + 7)
          : 0;
      best = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
        radius,
      };
    }
  });

  return best;
}

/** True when hovering a clickable control that is not itself magnetic. */
function isNonMagneticInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const interactive = target.closest(
    "button, a, input, textarea, select, label, [role='button']",
  );
  if (!interactive) return false;
  return interactive.closest("[data-magnetic]") === null;
}

/**
 * Desktop magnetic cursor: alchemy Sun pointer + lagging outline ring
 * that morphs onto `[data-magnetic]` targets.
 */
export function MagneticCursor(): ReactNode {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const ringFaceRef = useRef<HTMLDivElement>(null);

  const rawDotX = useMotionValue(-100);
  const rawDotY = useMotionValue(-100);
  const rawRingX = useMotionValue(-100);
  const rawRingY = useMotionValue(-100);
  const rawW = useMotionValue(IDLE_RING);
  const rawH = useMotionValue(IDLE_RING);
  const rawR = useMotionValue(999);

  const spring = { stiffness: 1200, damping: 42, mass: 0.22 };
  const sunSpring = { stiffness: 2200, damping: 38, mass: 0.1 };
  const sunX = useSpring(rawDotX, sunSpring);
  const sunY = useSpring(rawDotY, sunSpring);
  const ringX = useSpring(rawRingX, spring);
  const ringY = useSpring(rawRingY, spring);
  const width = useSpring(rawW, spring);
  const height = useSpring(rawH, spring);
  const borderRadius = useSpring(rawR, spring);

  useEffect(() => {
    const sync = (): void => {
      setEnabled(isFinePointerDesktop() && !prefersReducedMotion());
    };
    sync();
    const mqFine = window.matchMedia("(pointer: fine)");
    const mqWidth = window.matchMedia("(min-width: 768px)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    mqFine.addEventListener("change", sync);
    mqWidth.addEventListener("change", sync);
    mqMotion.addEventListener("change", sync);
    return () => {
      mqFine.removeEventListener("change", sync);
      mqWidth.removeEventListener("change", sync);
      mqMotion.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    document.documentElement.classList.add("mda-magnetic-cursor");

    const paintActive = (isOn: boolean): void => {
      const face = ringFaceRef.current;
      if (!face) return;
      face.style.backgroundColor = isOn
        ? "rgba(126, 232, 255, 0.08)"
        : "transparent";
      face.style.opacity = isOn ? "1" : "0.35";
      face.style.boxShadow = isOn
        ? "inset 0 0 0 2px rgba(126,232,255,0.95), 0 0 16px rgba(56,214,255,0.35)"
        : "inset 0 0 0 1.5px rgba(26,29,34,0.55)";
    };

    const onMove = (event: MouseEvent): void => {
      rawDotX.set(event.clientX);
      rawDotY.set(event.clientY);

      // Prefer the control under the pointer when it isn't magnetic
      // (auth mode links sit just below the submit CTA).
      const target = isNonMagneticInteractive(event.target)
        ? null
        : nearestMagneticTarget(event.clientX, event.clientY);
      if (target) {
        setActive(true);
        rawRingX.set(target.x);
        rawRingY.set(target.y);
        rawW.set(Math.max(target.width + 14, 28));
        rawH.set(Math.max(target.height + 14, 28));
        rawR.set(target.radius);
        paintActive(true);
      } else {
        setActive(false);
        rawRingX.set(event.clientX);
        rawRingY.set(event.clientY);
        rawW.set(IDLE_RING);
        rawH.set(IDLE_RING);
        rawR.set(999);
        paintActive(false);
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      document.documentElement.classList.remove("mda-magnetic-cursor");
      window.removeEventListener("mousemove", onMove);
    };
  }, [
    enabled,
    rawDotX,
    rawDotY,
    rawRingX,
    rawRingY,
    rawW,
    rawH,
    rawR,
  ]);

  if (!enabled) return null;

  return (
    <>
      {/* Lagging magnetic morph ring */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9999]"
        style={{
          left: ringX,
          top: ringY,
          width,
          height,
          x: "-50%",
          y: "-50%",
          borderRadius: active ? borderRadius : 999,
        }}
      >
        <div
          ref={ringFaceRef}
          className="h-full w-full"
          style={{
            borderRadius: "inherit",
            backgroundColor: "transparent",
            opacity: 0.35,
            boxShadow: "inset 0 0 0 1.5px rgba(26,29,34,0.55)",
          }}
        />
      </motion.div>

      {/* Alchemy Sun cursor */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[10000]"
        style={{
          left: sunX,
          top: sunY,
          width: SUN_SIZE,
          height: SUN_SIZE,
          x: "-50%",
          y: "-50%",
          filter:
            "drop-shadow(0 0 4px rgba(126,232,255,0.85)) drop-shadow(0 0 10px rgba(56,214,255,0.45))",
        }}
      >
        <svg
          viewBox="0 0 22 22"
          width={SUN_SIZE}
          height={SUN_SIZE}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="11"
            cy="11"
            r="8.25"
            stroke="#A0FBFF"
            strokeWidth="1.75"
          />
          <circle cx="11" cy="11" r="2.75" fill="#A0FBFF" />
        </svg>
      </motion.div>
    </>
  );
}
