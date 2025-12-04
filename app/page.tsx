"use client";

import { Brain, MessageSquare, Target, Sparkles } from "lucide-react";
import MDAIcon from "@/public/images/MDA_Logo_One.svg";
import { ParallaxHero } from "../components/parallax-hero";
import { Button } from "../components/ui/button";
import Link from "next/link";
import CutCornerWrapper from "../components/cut-corner-wrapper";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main id="main-content" tabIndex={-1} aria-label="Main content" role="main">
      {/* Hero Section with Parallax Background */}
      <ParallaxHero>
        {/* Dark gradient overlay - minimal to show all parallax layers */}
        {/* <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/10 to-slate-950/30 z-[3] pointer-events-none"></div> */}

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 pt-40 w-full">
          <div className="max-w-3xl">
            {/* Label */}
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-cyan-400 animate-pulse"></div>
              <span
                className="text-cyan-400 tracking-[0.2em] uppercase text-xs"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Arcane Deck Engine
              </span>
            </div>

            {/* Main Heading */}
            <h1
              className="mb-6 tracking-[0.08em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span className="block text-5xl md:text-6xl lg:text-7xl mb-2">
                Forge Meta-Ready
              </span>
              <span className="block text-5xl md:text-6xl lg:text-7xl bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
                Decks with Arcane
              </span>
              <span className="block text-5xl md:text-6xl lg:text-7xl">
                Precision.
              </span>
            </h1>

            {/* Subtext */}
            <div className="mb-10 max-w-2xl">
              <p className="text-slate-100 text-lg md:text-xl leading-relaxed relative z-10 bg-slate-950/40 backdrop-blur-sm px-4 py-3 border border-cyan-500/10">
                Harness AI-powered synergy analysis and real-time meta insights to
                craft tournament-grade decks. Optimize ratios, discover combos, and
                dominate the competitive landscape.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="h-15 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 uppercase tracking-wider transition-all duration-200 shadow-[0_0_40px_rgba(56,189,248,0.25)] hover:shadow-[0_0_60px_rgba(56,189,248,0.4)]">
                <Link href="/deck-builder">
                  Launch Deck Builder
                </Link>
              </Button>
              <Button asChild size="lg" className="h-15 px-8 py-4 bg-transparent border border-cyan-500/50 hover:border-cyan-400 text-cyan-400 uppercase tracking-wider transition-all duration-200 backdrop-blur-sm">
                <Link href="/saved-decks">View Saved Decks</Link>
              </Button>
            </div>

          </div>
        </div>

      </ParallaxHero>

      {/* Key Features */}
      <Features />

      {/* Live Stats Strip */}
      <StatsStrip />

      {/* Footer */}
      <Footer />
      </main>
    </div>
  );
}

function Features() {
  const features = [
    {
      icon: Sparkles,
      title: "AI Recommendations",
      description:
        "Get personalized card recommendations powered by hybrid RAG search. Find archetype-specific cards, tech options, and engine suggestions tailored to your deck.",
    },
    {
      icon: Brain,
      title: "Deck Analysis",
      description:
        "Comprehensive AI-powered analysis covering power level, consistency, resilience, matchups, and complexity. Get detailed insights with actionable suggestions.",
    },
    {
      icon: Target,
      title: "Deck Tester",
      description:
        "Simulate matchups, analyze win rates, and get strategic insights. Test your deck against meta strategies with detailed matchup analysis and duel simulations.",
    },
    {
      icon: MessageSquare,
      title: "AI Chatbot",
      description:
        "Interactive AI assistant that understands your deck context. Ask questions, get recommendations, and receive expert-level strategic guidance in real-time.",
    },
  ];

  return (
    <section className="relative bg-slate-950 py-24 border-t border-cyan-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-px bg-cyan-500/50"></div>
            <span
              className="text-cyan-400 tracking-[0.2em] uppercase text-sm"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Core Systems
            </span>
            <div className="w-8 h-px bg-cyan-500/50"></div>
          </div>
          <h2
            className="text-4xl md:text-5xl tracking-wide uppercase mb-4"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Deck Forging Arsenal
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Advanced technology engineered for competitive dominance
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <CutCornerWrapper
              key={index}
              size="md"
              hoverHighlight
              padding="1.5rem"
              style={{
                ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
                ["--cut-corner-stroke-hover" as any]: "rgba(20,239,255,0.52)",
                ["--cut-corner-fill" as any]: "transparent",
                backdropFilter: "blur(6px) saturate(120%)",
                WebkitBackdropFilter: "blur(6px) saturate(120%)",
              }}
            >
              <div className="group relative">
              {/* Icon Container */}
              <div className="mb-6 relative">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-700/20 flex items-center justify-center ring-1 ring-cyan-500/30 group-hover:ring-cyan-400/50 transition-all duration-300">
                  <feature.icon className="w-8 h-8 text-cyan-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400/60 animate-pulse"></div>
              </div>

              {/* Content */}
              <h3
                className="mb-3 tracking-wide uppercase"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {feature.title}
              </h3>
              <p className="text-slate-400 leading-relaxed">
                {feature.description}
              </p>

              </div>
            </CutCornerWrapper>
          ))}
        </div>

      </div>
    </section>
  );
}

function StatsStrip() {
  const stats = [
    { label: "Cards in Database", value: "10,000+" },
    { label: "Archetypes Supported", value: "500+" },
    { label: "Formats Supported", value: "2" },
    { label: "AI Analyses Run", value: "50K+" },
  ];

  return (
    <section className="relative bg-slate-950 border-y border-cyan-500/20 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index}>
              <div className="text-center">
                <div
                  className="text-3xl md:text-4xl mb-2 bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-xs uppercase tracking-[0.15em] text-slate-400"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative bg-slate-950 border-t border-cyan-500/20 py-12" aria-label="Footer" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <MDAIcon className="w-24 h-24" aria-label="Master Deck Alchemist logo" />
            <div>
              <div
                className="tracking-wider uppercase text-sm"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Master Deck Alchemist
              </div>
              <div className="text-xs text-slate-400">
                © 2025 All rights reserved
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-8">
            <a
              href="#terms"
              className="text-sm text-slate-400 hover:text-cyan-400 transition-colors duration-200"
            >
              Terms of Service
            </a>
            <a
              href="#privacy"
              className="text-sm text-slate-400 hover:text-cyan-400 transition-colors duration-200"
            >
              Privacy Policy
            </a>
            <a
              href="#contact"
              className="text-sm text-slate-400 hover:text-cyan-400 transition-colors duration-200"
            >
              Contact
            </a>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="mt-8 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
      </div>
    </footer>
  );
}
