"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import StreaksLayer from "./streaks-layer";

interface ParallaxHeroProps {
  children?: React.ReactNode;
}

export function ParallaxHero({ children }: ParallaxHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof globalThis !== "undefined" && globalThis.matchMedia) {
      const mediaQuery = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, []);

  // Scroll progress for this section
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Transform ranges for each layer
  // Background moves slowest, foreground moves fastest
  const yBg = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? ["0%", "0%"] : ["0%", "10%"]
  );
  const yGlyphs = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? ["0%", "0%"] : ["0%", "20%"]
  );
  const yFg = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? ["0%", "0%"] : ["0%", "30%"]
  );

  return (
    <section
      ref={ref}
      className="relative min-h-screen overflow-hidden"
      style={{ position: "relative" }}
      aria-label="Hero section with parallax background"
    >
      {/* Parallax layers container - matches working parallax-background structure */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Background Layer - moves slowest, behind everything */}
        <motion.div
          style={{
            y: yBg,
            backgroundImage: "url('/parallax/layer-bg.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            width: "100%",
            height: "120%",
            top: "-10%",
          }}
          className="absolute left-0 z-0 brightness-125 contrast-110"
          aria-label="Parallax background layer"
        />

        {/* StreaksLayer - static vertical cyan streaks */}
        <StreaksLayer y={yFg} />

        {/* Foreground Layer - moves fastest, on top */}
        <motion.div
          style={{
            y: yFg,
            backgroundImage: "url('/parallax/layer-foreground.png')",
            backgroundSize: "90%",
            backgroundPosition: "center right",
            backgroundRepeat: "no-repeat",
            width: "100%",
            height: "120%",
            top: "-10%",
            left: "10%",
          }}
          className="absolute left-0 z-[2]"
          aria-label="Parallax foreground layer"
        />

        {/* Glyphs Layer - behind foreground */}
        <motion.div
          style={{
            y: yGlyphs,
            backgroundImage: "url('/parallax/layer-glyphs.png')",
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            width: "100%",
            height: "120%",
            top: "-10%",
          }}
          className="absolute left-0 z-[1] mix-blend-screen opacity-60"
          aria-label="Parallax glyphs layer"
        />
      </div>

      {/* Content above parallax layers */}
      {children && (
        <div className="relative z-10 h-full flex items-center">
          {children}
        </div>
      )}
    </section>
  );
}

