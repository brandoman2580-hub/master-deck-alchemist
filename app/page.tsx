"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  MessageSquare,
  Target,
  Sparkles,
} from "lucide-react";
import MDAIcon from "@/public/images/MDA_Logo_One.svg";
import { Button } from "../components/ui/button";
import Link from "next/link";
import {
  fadeInUpVariants,
  staggerContainer,
  staggerItem,
  useInViewAnimation,
  useHoverAnimation,
} from "@/lib/animations";

export default function Home() {
  // Ensure page starts at top on initial load
  useEffect(() => {
    // Disable scroll restoration to prevent browser from restoring scroll position
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    // Scroll to top immediately on mount (synchronous)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    
    // Also set scroll position directly for cross-browser compatibility
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main
        id="main-content"
        tabIndex={-1}
        aria-label="Main content"
        role="main"
      >
        <Hero />
        <Features />
        <StatsStrip />
        <Footer />
      </main>
    </div>
  );
}

function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInViewAnimation(containerRef, { once: true, amount: 0.3 });
  const hoverAnimation = useHoverAnimation();

  return (
    <section className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-[url('/images/mda_hero_bg.svg')] bg-cover bg-right lg:bg-center"
        aria-hidden
      />

      <div
        ref={containerRef}
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28"
      >
        <motion.div
          className="flex flex-col lg:flex-row items-start lg:items-center gap-12 lg:gap-16"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={staggerContainer(0.1)}
        >
          <div className="max-w-xl space-y-8">
            <motion.div className="space-y-4" variants={staggerItem}>
              <motion.h1
                className="text-5xl md:text-6xl lg:text-7xl leading-tight tracking-[0.08em]"
                style={{ fontFamily: "var(--font-heading)" }}
                variants={fadeInUpVariants}
              >
                Master Deck Alchemist
              </motion.h1>
              <motion.p
                className="max-w-cxl text-lg md:text-xl text-slate-200 leading-relaxed"
                variants={fadeInUpVariants}
              >
                Analyze consistency, synergies, and weaknesses with AI that explains its reasoning — so every change makes sense.
              </motion.p>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row items-center gap-4"
              variants={staggerItem}
            >
              <motion.div {...hoverAnimation}>
                <Button
                  asChild
                  size="lg"
                  className="h-14 px-8"
                >
                  <Link href="/deck-builder" className="flex items-center gap-3">
                    Launch Deck Builder
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </Link>
                </Button>
              </motion.div>

              <motion.div {...hoverAnimation}>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-14 px-8"
                >
                  <Link href="/saved-decks">View Saved Decks</Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInViewAnimation(containerRef, { once: true, amount: 0.2 });
  const hoverAnimation = useHoverAnimation(1.02, -2);

  const features = [
    {
      icon: Sparkles,
      title: "AI Recommender",
      description:
        "Hybrid RAG pulls archetype staples, tech calls, and flex slots tuned to your list.",
    },
    {
      icon: Brain,
      title: "Deck Analysis",
      description:
        "Power, consistency, resilience, and matchup grades with actionable fixes.",
    },
    {
      icon: Target,
      title: "Deck Tester",
      description:
        "Simulate lines, analyze brick rates, and surface mulligan guidance instantly.",
    },
    {
      icon: MessageSquare,
      title: "AI Chatbot",
      description:
        "Context-aware assistant that answers rulings, combos, and sideboarding plans.",
    },
  ];

  return (
    <section className="relative bg-slate-950 py-20">
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
      >
        <motion.div
          className="text-center mb-14"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={fadeInUpVariants}
        >
          <span
            className="text-white/60 tracking-[0.1em] uppercase text-sm mb-3 block"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Core Systems
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-3 text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Deck Forging Arsenal
          </h2>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Precision tools for competitive deck building.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={staggerContainer(0.1)}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-xl p-6 transition-all duration-300 shadow-lg hover:shadow-xl"
              variants={staggerItem}
              {...hoverAnimation}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3
                      className="text-lg font-semibold text-white"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {feature.title}
                    </h3>
                  </div>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function StatsStrip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInViewAnimation(containerRef, { once: true, amount: 0.2 });
  const hoverAnimation = useHoverAnimation(1.02, -2);

  const steps = [
    {
      label: "Explore uncharted decks",
      detail: "Start with AI baselines tuned for your archetype.",
    },
    {
      label: "Feel the pace",
      detail: "Stress-test ratios with realistic draw + combo physics.",
    },
    {
      label: "Compete globally",
      detail: "Compare against live meta lists and side plans.",
    },
    {
      label: "Rewrite the story",
      detail: "Lock your tournament-ready version and export fast.",
    },
  ];

  return (
    <section className="relative bg-slate-950 py-12">
      <div ref={containerRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={staggerContainer(0.1)}
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.label}
              className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-md px-5 py-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              variants={staggerItem}
              {...hoverAnimation}
            >
              <div className="flex items-start gap-4">
                <div
                  className="text-3xl font-semibold text-white/80"
                  style={{ fontFamily: "var(--font-heading)" }}
                  aria-hidden
                >
                  {index + 1}
                </div>
                <div className="space-y-1">
                  <div
                    className="text-sm font-semibold text-white"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {step.label}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInViewAnimation(containerRef, { once: true, amount: 0.2 });

  return (
    <footer
      ref={containerRef}
      className="relative bg-slate-950 border-t border-white/10 py-12"
      aria-label="Footer"
      role="contentinfo"
    >
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={fadeInUpVariants}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <MDAIcon
              className="w-24 h-24"
              aria-label="Master Deck Alchemist logo"
            />
            <div>
              <div
                className="tracking-wider uppercase text-sm text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Master Deck Alchemist
              </div>
              <div className="text-xs text-slate-400">
                © 2025 All rights reserved
              </div>
            </div>
          </div>

          <div className="max-w-3xl text-sm text-slate-300 leading-relaxed">
            <p>
              The literal and graphical information presented on this site about Yu-Gi-Oh!, including card images, the attribute, level/rank and type symbols, and card text, is copyright 4K Media Inc, a subsidiary of Konami Digital Entertainment, Inc. This website is not produced by, endorsed by, supported by, or affiliated with 4k Media or Konami Digital Entertainment.
            </p>
          </div>
        </div>

        <div className="mt-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </motion.div>
    </footer>
  );
}
