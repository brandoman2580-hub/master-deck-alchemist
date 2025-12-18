"use client";

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

export default function Home() {
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
  return (
    <section className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-[url('/images/mda_hero_bg.svg')] bg-cover bg-right lg:bg-center"
        aria-hidden
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-12 lg:gap-16">
          <div className="max-w-xl space-y-8">
            <div className="space-y-4">
              <h1
                className="text-5xl md:text-6xl lg:text-7xl leading-tight tracking-[0.08em]"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Master Deck Alchemist
              </h1>
              <p className="max-w-cxl text-lg md:text-xl text-slate-200 leading-relaxed">
              Analyze consistency, synergies, and weaknesses with AI that explains its reasoning — so every change makes sense.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
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

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 px-8"
              >
                <Link href="/saved-decks">View Saved Decks</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-14">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-xl p-6 transition-all duration-300 shadow-lg hover:shadow-xl"
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-md px-5 py-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="relative bg-slate-950 border-t border-white/10 py-12"
      aria-label="Footer"
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

          <div className="flex items-center gap-8">
            <a
              href="#terms"
              className="text-sm text-slate-300 hover:text-white transition-colors duration-200"
            >
              Terms of Service
            </a>
            <a
              href="#privacy"
              className="text-sm text-slate-300 hover:text-white transition-colors duration-200"
            >
              Privacy Policy
            </a>
            <a
              href="#contact"
              className="text-sm text-slate-300 hover:text-white transition-colors duration-200"
            >
              Contact
            </a>
          </div>
        </div>

        <div className="mt-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </footer>
  );
}
