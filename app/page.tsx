import { Brain, TrendingUp, Target, Cpu } from "lucide-react";
import MDAIcon from "@/public/images/MDA_Logo_One.svg";
import { Button } from "../components/ui/button.tsx";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero Section */}
      <Hero />

      {/* Key Features */}
      <Features />

      {/* Live Stats Strip */}
      <StatsStrip />

      {/* Footer */}
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat flex items-center"
      style={{ backgroundImage: `url(/images/mda_landing_bg.svg)` }}
    >
      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/70 to-slate-950/95"></div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 pt-40">
        <div className="max-w-3xl">
          {/* HUD Label with Parallelogram */}
          <div className="relative inline-flex items-center gap-2 mb-6">
            <div className="absolute -left-4 -top-2 w-32 h-8 bg-cyan-500/10 transform -skew-x-12 border-l-2 border-cyan-500/50"></div>
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse relative z-10"></div>
            <span
              className="text-cyan-400 tracking-[0.2em] uppercase text-xs relative z-10"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Arcane Deck Engine
            </span>
            <div className="w-12 h-px bg-gradient-to-r from-cyan-400/50 to-transparent"></div>
          </div>

          {/* App Title */}
          {/* <div className="mb-4 flex items-center gap-3">
            <PotionIcon className="w-32 h-32" />
            <h2
              className="text-2xl md:text-3xl tracking-wider uppercase bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-yellow-300"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Master Deck Alchemist
            </h2>
          </div> */}

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
          <p className="text-slate-300 text-lg md:text-xl mb-10 max-w-2xl leading-relaxed">
            Harness AI-powered synergy analysis and real-time meta insights to
            craft tournament-grade decks. Optimize ratios, discover combos, and
            dominate the competitive landscape.
          </p>

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

          {/* HUD Flourishes */}
          <div className="mt-16 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500/40 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-cyan-400/60"></div>
              </div>
              <span
                className="text-xs text-slate-400 uppercase tracking-wider"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                System Online
              </span>
            </div>
            <div className="h-px flex-1 max-w-xs bg-gradient-to-r from-cyan-500/40 to-transparent"></div>

            {/* Angled line accent */}
            <div className="hidden md:flex items-center gap-2">
              <div className="w-16 h-px bg-cyan-500/40 transform rotate-45 origin-left"></div>
              <div className="w-1 h-1 bg-cyan-400"></div>
            </div>
          </div>

          {/* Bottom parallelogram accent */}
          <div className="mt-8 relative">
            <div className="w-64 h-1 bg-gradient-to-r from-cyan-500/60 via-cyan-400/40 to-transparent transform -skew-x-12"></div>
            <div className="absolute top-0 left-0 w-48 h-12 border border-cyan-500/20 transform -skew-x-12 -translate-y-6"></div>
          </div>
        </div>
      </div>

      {/* Corner HUD Elements */}
      <div className="absolute top-24 right-8 hidden lg:block">
        <div className="w-24 h-24 rounded-full border border-cyan-500/20 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border border-cyan-500/30 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Left angled HUD lines */}
      <div className="absolute top-1/3 left-8 hidden xl:block">
        <div className="space-y-2">
          <div className="w-24 h-px bg-cyan-500/30 transform -rotate-45"></div>
          <div className="w-16 h-px bg-cyan-500/20 transform -rotate-45 ml-4"></div>
          <div className="w-20 h-px bg-cyan-500/25 transform -rotate-45 ml-2"></div>
        </div>
      </div>

      {/* Bottom right parallelogram */}
      <div className="absolute bottom-32 right-12 hidden lg:block">
        <div className="w-32 h-24 border-2 border-cyan-500/20 transform -skew-x-12"></div>
        <div className="absolute top-2 left-2 w-28 h-20 border border-cyan-500/30 transform -skew-x-12"></div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Brain,
      title: "AI Synergy Scan",
      description:
        "Advanced algorithms analyze card interactions and suggest optimal combinations for maximum consistency.",
    },
    {
      icon: TrendingUp,
      title: "Matchup Insights",
      description:
        "Real-time meta analysis reveals strengths and weaknesses against top-tier competitive strategies.",
    },
    {
      icon: Target,
      title: "Optimized Ratios",
      description:
        "Statistical modeling determines ideal deck ratios for starters, extenders, and disruption pieces.",
    },
    {
      icon: Cpu,
      title: "Combo Matrix",
      description:
        "Visual combo trees and probability calculations ensure you always have lines of play available.",
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
            <div
              key={index}
              className="group relative bg-slate-900/60 backdrop-blur-sm border border-cyan-500/15 rounded-2xl p-6 hover:border-cyan-400/40 transition-all duration-300 hover:bg-slate-900/80"
            >
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

              {/* Bottom accent with angled element */}
              <div className="mt-6 relative">
                <div className="h-px bg-gradient-to-r from-cyan-500/0 via-cyan-500/30 to-cyan-500/0"></div>
                <div className="absolute -bottom-1 right-0 w-8 h-2 bg-cyan-500/20 transform -skew-x-12"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional HUD decorations */}
        <div className="absolute top-16 right-16 hidden xl:block">
          <div className="w-16 h-16 border border-cyan-500/15 transform rotate-45"></div>
        </div>
        <div className="absolute bottom-16 left-16 hidden xl:block">
          <div className="space-y-1">
            <div className="w-20 h-px bg-cyan-500/20"></div>
            <div className="w-16 h-px bg-cyan-500/15 ml-2"></div>
            <div className="w-12 h-px bg-cyan-500/10 ml-4"></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
  const stats = [
    { label: "Decks Built", value: "847,293" },
    { label: "Combos Simulated", value: "12.4M" },
    { label: "Engines Supported", value: "340+" },
    { label: "Active Duelists", value: "156K" },
  ];

  return (
    <section className="relative bg-slate-950 border-y border-cyan-500/20 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index}>
              <div className="text-center relative">
                {/* Parallelogram background */}
                <div className="absolute inset-0 bg-cyan-500/5 transform -skew-x-6 -z-10"></div>
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
              {index < stats.length - 1 && (
                <div
                  className="hidden lg:block absolute top-1/2 -translate-y-1/2 w-px h-12 bg-cyan-500/30"
                  style={{ left: `${(index + 1) * 25}%` }}
                ></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative bg-slate-950 border-t border-cyan-500/20 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <MDAIcon className="w-24 h-24" />
            <div>
              <div
                className="tracking-wider uppercase text-sm"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Master Deck Alchemist
              </div>
              <div className="text-xs text-slate-500">
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
