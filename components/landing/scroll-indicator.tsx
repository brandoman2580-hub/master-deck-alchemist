"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown } from "lucide-react";

const HERO_FADE_THRESHOLD = 80; // Pixels scrolled before indicator starts fading

/**
 * Scroll indicator for the landing page Hero.
 * Shows a subtle bounce animation to indicate more content below.
 * Fades out as user scrolls and is clickable to scroll to the next section.
 */
export function ScrollIndicator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const opacity = useTransform(
    scrollY,
    [0, HERO_FADE_THRESHOLD, HERO_FADE_THRESHOLD + 60],
    [1, 0.5, 0]
  );

  const y = useTransform(
    scrollY,
    [0, HERO_FADE_THRESHOLD],
    [0, 10]
  );

  const handleClick = () => {
    document.getElementById("features")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <motion.div
      ref={containerRef}
      className="absolute bottom-8 left-0 right-0 mx-auto w-fit flex flex-col items-center gap-2 z-20 cursor-pointer group"
      style={{ opacity, y }}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Scroll to explore more content"
    >
      <motion.div
        className="flex flex-col items-center"
        animate={prefersReducedMotion ? {} : { y: [0, 6, 0] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <ChevronDown
          className="h-6 w-6 text-white/60 group-hover:text-accent-cyan/80 transition-colors duration-200"
          strokeWidth={2.5}
          aria-hidden
        />
      </motion.div>
    </motion.div>
  );
}
