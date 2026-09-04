"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Brain,
  ChevronDown,
  Gauge,
  ScatterChart,
  List,
  Route,
  Search,
} from "lucide-react";
import MDAIcon from "@/public/images/MDA_Logo_One.svg";
import {
  LandingAuthModal,
  type AuthMode,
} from "@/components/mda/landing-auth-modal";
import { LandingFeatureRow } from "@/components/mda/landing-feature-row";
import { LandingLoginButton } from "@/components/mda/landing-login-button";
import { LandingSideNav } from "@/components/mda/landing-side-nav";
import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";
import { signup } from "@/app/login/actions";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "section-1", label: "01" },
  { id: "section-2", label: "02" },
  { id: "section-3", label: "03" },
  { id: "section-4", label: "04" },
] as const;

const HERO_COPY =
  "Master Deck Alchemist is the AI-powered deck engineering platform for competitive Yu-Gi-Oh! players—combining intelligent deck optimization, guided combo learning, matchup preparation, and versioned deck management in one precision-built workspace.";

const FOOTER_LEGAL =
  "The literal and graphical information presented on this site about Yu-Gi-Oh!, including card images, the attribute, level/rank and type symbols, and card text, is copyright 4K Media Inc, a subsidiary of Konami Digital Entertainment, Inc. This website is not produced by, endorsed by, supported by, or affiliated with 4k Media or Konami Digital Entertainment.";

const MOCKUPS = {
  build: encodeURI("/images/MDA - Workshop v2 (Alternative), Build View, Cards Tab (1).png"),
  matchups: encodeURI("/images/MDA - Workshop v2 (Alternative), Matchups View.png"),
  combos: encodeURI("/images/MDA - Workshop v2 (Alternative), Combos View.png"),
} as const;

const HERO_ART = "/images/hero_deck_exploded_view.svg";

/**
 * Landing — Figma MDA Login Page (Alternative 4) v2 (light token system).
 */
export default function HomePage(): ReactNode {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const setUser = useUserStore((state) => state.setUser);
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const openLogin = (): void => {
    setError(null);
    setMessage(null);
    setMode("login");
    setAuthOpen(true);
  };

  const closeAuth = (): void => {
    setAuthOpen(false);
    setError(null);
    setMessage(null);
  };

  const handleModeChange = (next: AuthMode): void => {
    setError(null);
    setMessage(null);
    if (next === "signup") {
      setEmail("");
      setPassword("");
      setConfirm("");
      setShowPassword(false);
    }
    setMode(next);
  };

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError(null);
    setAuthOpen(false);
    setAuthLoading(true);
    setSubmitting(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setSubmitting(false);
      setAuthLoading(false);
      setError(authError?.message ?? "Login failed");
      setAuthOpen(true);
      return;
    }

    setUser(data.user);
    setSubmitting(false);
    router.push("/deck-archives");
  };

  const handleSignup = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    if (password !== confirm) {
      setSubmitting(false);
      setError("Passwords do not match");
      return;
    }
    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    const result = await signup({ success: false }, formData);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Signup failed");
      return;
    }
    setMessage(
      `Confirmation email sent to ${result.email ?? email}. Check your inbox, then log in.`,
    );
    setPassword("");
    setConfirm("");
    setMode("login");
  };

  const handleForgotPassword = async (): Promise<void> => {
    if (!email) {
      setError("Enter your email above first");
      return;
    }
    setError(null);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${origin}/auth/reset-password` },
    );
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setMessage("Password reset email sent.");
  };

  const scrollToSection = (index: number): void => {
    const node = sectionRefs.current[index];
    if (!node) return;
    setActiveSection(index);
    const scrollRoot =
      scrollContainerRef.current ??
      document.getElementById("main-content");
    if (scrollRoot) {
      const rootRect = scrollRoot.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const nextTop =
        scrollRoot.scrollTop + (nodeRect.top - rootRect.top);
      scrollRoot.scrollTo({
        top: nextTop,
        behavior: reduceMotion ? "auto" : "smooth",
      });
      return;
    }
    node.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  useEffect(() => {
    const scrollRoot = document.getElementById("main-content");
    scrollContainerRef.current = scrollRoot;

    const nodes = sectionRefs.current.filter(Boolean) as HTMLElement[];
    if (!scrollRoot || nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (!hit?.target) return;
        const index = nodes.indexOf(hit.target as HTMLElement);
        if (index >= 0) {
          setActiveSection((prev) => (prev === index ? prev : index));
        }
      },
      {
        root: scrollRoot,
        rootMargin: "-42% 0px -42% 0px",
        threshold: 0,
      },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen bg-mda-bg text-mda-ink">
      <MdaLoadingScreen
        open={authLoading}
        status="Signing in and opening Deck Archives…"
      />

      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-2.5">
        <div
          className="pointer-events-auto flex items-center gap-4"
          aria-label="Master Deck Alchemist"
        >
          <MDAIcon className="h-[30px] w-[29px] shrink-0" aria-hidden />
          <span className="font-display text-[22px] font-black uppercase tracking-wide text-mda-ink sm:text-2xl">
            Master Deck Alchemist
          </span>
        </div>
        <div
          className={cn(
            "pointer-events-auto transition-opacity duration-300",
            activeSection === 0
              ? "pointer-events-none opacity-0"
              : "opacity-100",
          )}
        >
          <LandingLoginButton
            onClick={openLogin}
            size="header"
            hidden={authOpen}
          />
        </div>
      </header>

      <div className="pointer-events-none fixed bottom-[12%] right-4 top-[98px] z-30 hidden items-start justify-end lg:flex xl:right-10">
        <LandingSideNav
          activeIndex={activeSection}
          onSelect={scrollToSection}
          className="pointer-events-auto"
        />
      </div>

      <div className="relative">
        {/* Section 1 — Hero */}
        <section
          id={SECTIONS[0].id}
          ref={(node) => {
            sectionRefs.current[0] = node;
          }}
          className="relative z-10 flex min-h-[100dvh] flex-col overflow-hidden pt-[68px]"
        >
          <div className="relative flex flex-1 flex-col lg:flex-row lg:items-start lg:px-16 lg:pt-6">
            <motion.div
              className="relative z-10 flex max-w-[598px] flex-col gap-12 px-6 pt-6 lg:px-0 lg:pt-0"
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <h1 className="font-display text-[64px] font-semibold uppercase leading-none sm:text-[80px] lg:text-[96px]">
                <span className="block text-mda-ink">Build.</span>
                <span className="block text-mda-ink">Optimize.</span>
                <span className="block text-mda-cyan">Dominate.</span>
              </h1>

              <div className="relative max-w-[450px] bg-[rgba(185,190,190,0.26)] p-3">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -left-0.5 -top-0.5 size-[17px] border-l-2 border-t-2 border-mda-cyan"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-0.5 -top-0.5 size-[17px] border-r-2 border-t-2 border-mda-cyan"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-0.5 -left-0.5 size-[17px] border-b-2 border-l-2 border-mda-cyan"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-0.5 -right-0.5 size-[17px] border-b-2 border-r-2 border-mda-cyan"
                />
                <p
                  className="font-display text-base uppercase leading-6 text-mda-ink"
                  style={{ fontWeight: 600, fontVariationSettings: '"wght" 600' }}
                >
                  Master Deck Alchemist{" "}
                  {HERO_COPY.replace(/^Master Deck Alchemist\s*/i, "")}
                </p>
              </div>

              <LandingLoginButton
                onClick={openLogin}
                size="hero"
                hidden={authOpen}
              />
            </motion.div>

            <div className="pointer-events-none relative z-0 mx-auto mt-2 aspect-square w-full max-w-[640px] flex-1 lg:absolute lg:-right-4 lg:top-[-24px] lg:mt-0 lg:h-[min(955px,78vh)] lg:w-[min(955px,58vw)] lg:max-w-none xl:right-8">
              <Image
                src={HERO_ART}
                alt="Exploded deck technical view"
                fill
                priority
                className="object-contain object-right-top"
                sizes="(max-width: 1024px) 90vw, 58vw"
              />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-2.5 pb-8 pt-4">
            <p className="font-display text-base font-normal uppercase leading-6 tracking-wide text-mda-ink">
              Scroll down
            </p>
            <motion.div
              aria-hidden
              animate={reduceMotion ? undefined : { y: [0, 6, 0] }}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
              }
            >
              <ChevronDown className="size-6 text-mda-ink" />
            </motion.div>
          </div>
        </section>

        {/* Section 2 — AI deck building */}
        <section
          id={SECTIONS[1].id}
          ref={(node) => {
            sectionRefs.current[1] = node;
          }}
          className="relative z-10 flex min-h-[642px] w-full items-start px-6 py-12 lg:px-16 lg:py-8 lg:pr-32"
        >
          <div className="flex w-full flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
            <div className="relative aspect-[789/526] w-full overflow-hidden rounded-sm bg-mda-panel shadow-mda-soft lg:min-w-0 lg:flex-1 lg:basis-[55%]">
              <Image
                src={MOCKUPS.build}
                alt="Workshop build view with AI assistant"
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 55vw"
              />
            </div>
            <div className="flex w-full flex-col lg:w-[min(420px,38%)] lg:shrink-0 lg:pt-2">
              <h2 className="font-display text-5xl font-semibold uppercase leading-none text-mda-ink sm:text-6xl lg:text-[72px]">
                AI-Powered Deck Building
              </h2>
              <div className="mt-2 flex flex-col gap-2.5 py-2.5">
                <LandingFeatureRow
                  icon={Brain}
                  label="Intelligent Card Suggestions"
                />
                <LandingFeatureRow
                  icon={Gauge}
                  label="Practical Deck Optimizations"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — Matchups */}
        <section
          id={SECTIONS[2].id}
          ref={(node) => {
            sectionRefs.current[2] = node;
          }}
          className="relative z-10 flex min-h-[642px] w-full items-start px-6 py-12 lg:px-16 lg:py-8 lg:pr-32"
        >
          <div className="flex w-full flex-col-reverse gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
            <div className="flex w-full flex-col lg:w-[min(420px,38%)] lg:shrink-0 lg:pt-2">
              <h2 className="font-display text-5xl font-semibold uppercase leading-none text-mda-ink sm:text-6xl lg:text-[72px]">
                Meta Matchup Analysis
              </h2>
              <div className="mt-2 flex flex-col gap-2.5 py-2.5">
                <LandingFeatureRow
                  icon={ScatterChart}
                  label="Insightful Matchup Data"
                />
                <LandingFeatureRow
                  icon={Search}
                  label="Real Meta Comparisons"
                />
              </div>
            </div>
            <div className="relative aspect-[789/526] w-full overflow-hidden rounded-sm bg-mda-panel shadow-mda-soft lg:min-w-0 lg:flex-1 lg:basis-[55%]">
              <Image
                src={MOCKUPS.matchups}
                alt="Workshop matchups analytics view"
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 55vw"
              />
            </div>
          </div>
        </section>

        {/* Section 4 — Combos */}
        <section
          id={SECTIONS[3].id}
          ref={(node) => {
            sectionRefs.current[3] = node;
          }}
          className="relative z-10 flex min-h-[642px] w-full items-start px-6 py-12 lg:px-16 lg:py-8 lg:pr-32"
        >
          <div className="flex w-full flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
            <div className="relative aspect-[789/526] w-full overflow-hidden rounded-sm bg-mda-panel shadow-mda-soft lg:min-w-0 lg:flex-1 lg:basis-[55%]">
              <Image
                src={MOCKUPS.combos}
                alt="Workshop combos lines view"
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 55vw"
              />
            </div>
            <div className="flex w-full flex-col lg:w-[min(420px,38%)] lg:shrink-0 lg:pt-2">
              <h2 className="font-display text-5xl font-semibold uppercase leading-none text-mda-ink sm:text-6xl lg:text-[72px]">
                Real Time Combo Lines
              </h2>
              <div className="mt-2 flex flex-col gap-2.5 py-2.5">
                <LandingFeatureRow
                  icon={Route}
                  label="Effective Combo Strategies"
                />
                <LandingFeatureRow
                  icon={List}
                  label="Informative Weakness Data"
                />
              </div>
            </div>
          </div>
        </section>

        <footer
          className={cn(
            "relative z-10 flex flex-col gap-4 px-6 py-8 font-display text-mda-ink",
            "sm:flex-row sm:items-center sm:justify-between sm:px-6",
          )}
        >
          <p className="text-base uppercase text-mda-ink">
            ©2026 Master Deck Alchemist
          </p>
          <p className="max-w-[747px] text-sm leading-normal text-mda-ink-muted">
            {FOOTER_LEGAL}
          </p>
        </footer>
      </div>

      <LandingAuthModal
        open={authOpen}
        mode={mode}
        onModeChange={handleModeChange}
        onClose={closeAuth}
        email={email}
        password={password}
        confirm={confirm}
        showPassword={showPassword}
        remember={remember}
        error={error}
        message={message}
        submitting={submitting}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onConfirmChange={setConfirm}
        onShowPasswordToggle={() => setShowPassword((value) => !value)}
        onRememberChange={setRemember}
        onLogin={(event) => void handleLogin(event)}
        onSignup={(event) => void handleSignup(event)}
        onForgotPassword={() => void handleForgotPassword()}
      />
    </div>
  );
}
