# PRD — Master Deck Alchemist (v2 Product Constitution)

**Status:** Approved design (brainstorming §§1–6)  
**Date:** 2026-11-19  
**Audience:** Solo engineer + any IDE/AI builder implementing MDA v2  
**Principle:** Optimize for competitive player value. Existing plans and docs are evidence, not gospel.

## Architecture

MDA v2 is a Next.js App Router product: light tactical Workshop (Build / Matchups / Combos), Facts Brain as numeric SSoT, Strategist as Facts-backed coach (hybrid RAG still live until V2-E0 decides otherwise), TanStack Query + IndexedDB for catalog, Zustand for live deck, soft auth, desktop-primary viewport. OCG is a post-v2 format horizon only.

## Instructions

1. Treat this file as **product law** for v2. Prefer it over stale `WORKSHOP_SPEC` theme/format claims and over hard “complete deck only” Strategist gates.
2. Execute stages in order **V2-A → V2-G** (§6). Do not skip **V2-B0** (external comps) before mass restyle, or **V2-E0** before any de-RAG / major Strategist rebuild.
3. No schema, dependency, or config changes without explicit user OK in-session.
4. Start a workstream with the copy-pasteable **V2-A Execution Prompt** at the end of this document unless a later stage plan supersedes it.

## Dev Notes

- Tokens: `docs/mda-design-tokens.md` / `app/globals.css`. Visual SSoT for surfaces: approved Figma (preferred) / Lovable / Stitch comps.
- Cache matrix: `docs/v2-client-cache-matrix.md`.
- Track this file via `docs/.tracked` + `npm run docs:git-sync`.

---

## 1. Product Narrative, Viewport Strategy & Core JTBD

### 1.1 Product vision & aesthetic anchor

Master Deck Alchemist is a **desktop-primary competitive deck instrument** for Yu-Gi-Oh!. Players build and tune **TCG** or **Master Duel** lists in one Workshop shell, then receive **Facts-backed** coaching: deterministic engine numbers (Monte Carlo, legality, matchups, combo graphs) with capped Groq narration via Strategist.

Visually, MDA is a **light tactical HUD** — off-white canvas, cyan interactive accents, hazard amber for warnings — with hierarchical crop frames, L-brackets, and tech-cut CTAs. It is not a generic SaaS dashboard, not a purple-gradient AI template, and not the legacy dark/gold workshop.

### 1.2 Provenance & superseded decisions

This PRD formalizes Scope-C intent from the MDA v2 production plan and related chats, but **overrides** them where player value wins.

| Source | Role |
|--------|------|
| `mda_v2_production_plan_84c1f2ce.plan.md` + transcript `ab0aabf7-913b-49a4-9976-977a8db5e521` | Phase evidence; not immutable law |
| `docs/mda-design-tokens.md`, `app/globals.css` | Token vocabulary for implementation |
| `docs/v2-client-cache-matrix.md`, `types/deck.ts`, `lib/engine/types.ts` | Cache & domain contract baselines |
| Strategist Quality Overhaul (`strategist_quality_overhaul_4376ae62`, transcript `4d1d78ad-6bbe-4157-9f16-c26c0b429280`) | Shipped Facts Brain + packing baseline; **kept hybrid RAG** for synergy |

**Explicitly supersedes:**

- Dark/gold palette and OCG / Edison / HAT as live formats in `docs/WORKSHOP_SPEC.md`
- Hard “saved + legal + complete only” as the **sole** Strategist unlock
- Treating the Scope-C production plan as permanent product law where it conflicts with player value
- ADR-001 framing `deck-assistant` as the live Workshop coach (live coach = **Strategist** + Facts Brain)
- Any claim that a **de-RAG Strategist rebuild plan** already exists and is ready to implement (it does not; see §6 V2-E0)

### 1.3 Viewport & scaling contract

| Breakpoint | Behavior |
|------------|----------|
| ≥ 1280px | **Primary.** Full Workshop chrome and three-tab body |
| 1024–1279px | Coach/analytics panes → drawers/sheets |
| 768–1023px | Card Library → slide-in sheet; center deck fills width |
| &lt; 768px | Must not break; **non-primary** — no mobile-first redesign tax in v2 |

Container rules: prose/FAQ capped near `72ch`; deck grids and binder virtualization expand fluidly on ultrawide. Workshop must not introduce a full-page vertical scroll; each pane scrolls internally. Landing **does** use full-page scroll for narrative chapters (§2.2).

### 1.4 30-second core JTBD

Open Workshop → build or edit a legal TCG or Master Duel list → open **Strategist** or **Matchups / Combos** for Facts-backed insight (**≤ 2 clicks** from Build once the shell is loaded).

### 1.5 Formats

- **v2 ship:** `TCG` \| `Master Duel` only.
- **Post-v2 horizon:** **OCG** is the first format expansion. Reserve extension points (`DeckFormat`, banlist epoch, eval matrix, format policy) without shipping OCG UI or rules in v2.

### 1.6 Role-based access matrix (soft gate)

| Capability | Guest | Authenticated |
|------------|-------|---------------|
| Landing (narrative + auth CTAs) | Yes | Yes |
| Workshop Build | Yes (local draft) | Yes |
| Matchups / Combos Facts (progressive) | Yes, with incomplete/illegal banners | Same |
| Save / Archives mutations / create share | Login CTA | Yes (deck caps apply) |
| Strategist | Login CTA | Yes + soft completeness **warn** (not hard-block mid-tune) |
| Help feedback + screenshot | No | Yes (rate-limited) |
| Quota-backed AI | N/A | Server-authoritative remaining; soft-block at zero |
| Share link view / import | Yes | Yes |

### 1.7 Coaching unlock (progressive)

- **Facts** run on any non-empty list with honest incomplete/illegal status banners and degraded-confidence copy where needed.
- **Strategist** requires authentication; warn when the list is incomplete or illegal — **do not** hard-block mid-tune.
- Never invent card names; refuse poison/illegal asks with a clear reason.
- Monte Carlo / Facts numbers remain source of truth; LLM narration is optional, capped, and must not replace numbers.

---

## 2. Information Architecture & Navigation Flow

Grounded in NNG heuristics and Hick’s Law: few persistent choices, progressive disclosure, clear system status.

### 2.1 Persistent navigation chrome

- **App header:** 64px (`h-16`). Left: brand → `/` (decorative/non-link on Landing). Right: Login CTA (guest) or UserMenu (auth: Help, Logout, account affordances).
- **No command palette (`⌘K`) in v2** — search lives in Workshop Library.
- Header does **not** duplicate Workshop tabs. Archives is a peer route.

### 2.2 Route map

| Route | Purpose | Layout notes (≥1280) |
|-------|---------|----------------------|
| `/` | Awwwards-caliber narrative landing | Hero: brand + one headline + short support + Login/Sign up. Below fold: scroll chapters for Workshop, Facts, Strategist, Matchups/Combos, Archives/Share. Motion purposeful; reduced-motion path required |
| `/workshop` | Core JTBD shell | Header + deck chrome + tab body. Build = center deck + right rail (Library \| Strategist) |
| `/deck-archives` | Saved lists | Header + grid/list; cap banners; mutations auth-gated |
| `/share/[token]` | Public preview → Import | MDA crop-frame command shell; Import → `/workshop` with deck loaded |
| `/auth/confirm`, `/auth/reset-password` | Auth flows | Minimal shells |
| System (`error`, `not-found`, loading) | Recovery | MDA tokens; `error.tsx` exposes `reset` |

### 2.3 Workshop IA (in-shell — not separate URLs)

**Top tabs (exactly three):** Build \| Matchups \| Combos.

**Inside Build only:** segmented right rail **Library \| Strategist** (Strategist soft-gated). Soft CTAs inside Strategist replies may switch Matchups/Combos tabs.

```
/  →  /workshop  →  Build | Matchups | Combos
                      └─ Build rail: Library | Strategist
/share/[token]  → Import → /workshop
/deck-archives  (peer)
```

### 2.4 Progressive disclosure

- **Glance:** deck counts, `deckFormat`, ban/illegal chips, quota remaining (auth).
- **Delayed (~180ms):** card hover inspectors / preview.
- **Overlay (focus-trapped):** Login modal, Help hub, share/create dialogs.
- **Matchups/Combos:** incomplete/illegal banners before deep tables/graphs; never invent lines when empty (`combos.source: "empty"`).

### 2.5 OCG horizon (IA only)

`deckFormat` remains a single selector with an extensible enum. v2 shows TCG \| Master Duel. OCG appears later as a third value — no extra nav item — and only when banlist, Facts policy, and eval are ready together.

---

## 3. Visual Design System & Token Constitution

### 3.1 Design-ops gate (production refinement)

Editorial tokens and atoms are the **implementation vocabulary**, not the final visual authority.

- **Visual SSoT for v2 surfaces:** external production comps in **Figma** (preferred) and/or **Lovable / Stitch** for exploration, then locked frames before mass surface coding.
- App work **implements approved comps** mapped onto MDA tokens (`--mda-*`). No vibe-coding new shells from memory.
- Visual fine-tune (V2-D) runs only after comps exist for touched routes (Landing, Workshop, Archives, Share, Help).

### 3.2 Aesthetic anchor

Light tactical instrument: technical grid / crop marks on **command shells only**; hierarchical L-brackets; sparingly used hazard stripes; tech-cut CTAs. Cyan = interactive accent (**not** body text). Inverse pods only for Strategist input / critical readouts — **not** full-app dark mode.

### 3.3 Color tokens (light v2)

Source of truth: `app/globals.css` / `docs/mda-design-tokens.md`.

| Role | Token | Value |
|------|-------|-------|
| Canvas | `--mda-bg` | `#e6e9ea` |
| Deep canvas | `--mda-bg-deep` | `#d5dade` |
| Surface / raised | `--mda-surface` / `--mda-surface-raised` | `#eef1f3` / `#f5f7f8` |
| Body / strong ink | `--mda-ink` / `--mda-ink-strong` | `#3a4f5c` / `#2f414c` |
| Muted ink | `--mda-ink-muted` | `#4a5f6e` |
| Chrome / bezel | `--mda-chrome` / `--mda-bezel` | `#425969` |
| Accent / focus | `--mda-cyan` / `--mda-focus` | `#38d6ff` |
| CTA fill + label | `--mda-sky` + `--mda-cta-ink` | `#7ec8e8` + `#2a3d48` |
| Hazard / danger / success | fill + `*-text` pairs | Use text tokens for copy on light canvas |
| Purple | `--mda-purple` | Demoted — rare legacy only |

**WCAG 2.2 AA:** body text ≥ 4.5:1; UI/graphics ≥ 3:1. Never use cyan/sky/hazard/danger/success **fills** as body text on the light canvas.

### 3.4 Typography

- Display / HUD labels: **Orbitron** (`--font-heading` / `--font-mda`) — uppercase tracking on chrome labels.
- Dense body (card rules, FAQ): readable system/semantic stack where Orbitron harms legibility.
- Minimum functional type: **12px (`text-xs`)**. Tabular nums on counts, ATK/DEF, quota.
- Brand wordmark: hero-level on Landing; header-scale elsewhere.

### 3.5 Shape, motion, elevation, loaders

- Corners: tech-cut / clip on primary CTAs; restrained radius on panels (no pill-cluster UI).
- Motion: `--mda-duration-fast|base|enter` = 150 / 200 / 280ms; CSS hover (`ease-out`); JS motion (e.g. Motion/Framer) for enter/exit and landing scroll chapters only; **all travel → 0 under `prefers-reduced-motion`**.
- Loader default: **`quad`**. `waveform` / `legacy` = Storybook / gallery only.
- Magnetic cursor: branded shells only — never on virtualized binder cells.

### 3.6 Z-index stack

| Layer | Z | Use |
|-------|---|-----|
| Content | `z-0` | Panes, grids |
| Sticky chrome | `z-10` | Header, deck chrome |
| Drawers / sheets | `z-20` | Tablet Library / analytics |
| Popovers / tooltips | `z-30` | Card preview, menus |
| Modals | `z-40` | Login, Help |
| Toasts | `z-50` | Save / cap / quota notices |
| Critical / live region | `z-60` | Blocking overlays, aria-live host |

### 3.7 Signature micro-interactions

- ClipButton: hover `scale-[1.01]` / active `scale-[0.99]` @ ~200ms.
- Card add/remove with aria-live count updates.
- Strategist soft CTA keycaps open Matchups/Combos.
- Landing: intentional scroll-linked chapter transitions (2–3+ crafted motions), never motion noise.

### 3.8 Strict negative constraints

- No purple-on-white / indigo gradient SaaS look; no cream + terracotta broadsheet; no gold-on-near-black revival.
- No neon lime as primary interactive color; no hazard stripes as wallpaper or on virtualized card cells.
- No raster hazard PNGs — CSS / SVG first.
- No Inter / Roboto / Arial as brand display; no emoji-led UI.
- No full-bleed dark charcoal shell as the default app chrome.

---

## 4. Platform-Agnostic Data Contracts

UI and fixtures bind to these contracts. Backend wiring must not force UI refactors. DB may keep legacy column names (e.g. `mode`) behind a mapping layer.

### 4.1 Core TypeScript contracts

```ts
/** v2 live values; OCG reserved for post-v2 — do not ship UI until rules/banlist/eval exist */
type DeckFormat = "TCG" | "Master Duel"; // future: | "OCG"

type DeckSection = "mainDeck" | "extraDeck" | "sideDeck";
type WorkshopTab = "build" | "matchups" | "combos";
type BuildRail = "library" | "strategist";

type Card = {
  id: number;
  name: string;
  type: string;
  desc: string;
  atk?: number | string;
  def?: number | string;
  level?: number;
  race: string;
  attribute?: string;
  archetype?: string | null;
  card_images: { id: number; image_url: string; image_url_small: string }[];
};

type DeckCard = Card & { deckInstanceId: string };

type ClientDeck = {
  id: string;
  name: string;
  mainDeck: DeckCard[];
  extraDeck: DeckCard[];
  sideDeck: DeckCard[];
  deckFormat: DeckFormat; // SSoT for rules; persist as DB `mode`
  updated_at?: string;
  isPinned?: boolean;
};

type PersistedDeck = {
  id: string;
  name: string;
  mainDeck: Card[];
  extraDeck: Card[];
  sideDeck: Card[];
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
  deckFormat?: DeckFormat;
};

type DeckCompleteness = {
  isEmpty: boolean;
  isNamed: boolean; // not untitled "New Deck"
  isLegal: boolean;
  isComplete: boolean;
  warnings: string[];
};

type ComboNode = {
  id: string;
  label: string;
  cardIds: number[];
  cardName?: string;
  kind: "hand" | "step" | "endboard" | "choke" | "killer" | "interruption";
  order?: number;
};

type ComboLine = {
  id: string;
  name: string;
  nodes: ComboNode[];
  edges: { from: string; to: string; label?: string; isDisruption?: boolean }[];
  killers: string[];
  endboardSummary: string;
};

type FactsEnvelope = {
  schemaVersion: string;
  deckId: string;
  deckHash: string;
  format: DeckFormat | string;
  legality: object;
  diagnostics: object;
  consistency: object; // Monte Carlo brick/HT stats — numeric SSoT
  matchups: object[];
  combos: { lines: ComboLine[]; source: "template" | "compiled" | "empty" };
  grade: {
    consistency: number;
    power: number;
    resilience: number;
    disruption: number;
    letter: "S" | "A" | "B" | "C" | "D" | "F";
  };
};

type StrategistMode = "qa" | "tune_copies" | "discover_synergy" | "optimize" | "auto";

type StrategistRequest = {
  deckSnapshot: ClientDeck;
  factsSnippet: Partial<FactsEnvelope>;
  mode: StrategistMode;
  message: string;
};

type AiQuota = {
  used: number;
  limit: number;
  remaining: number; // server-authoritative
};

type StrategistResponse = {
  prose: string;
  structured?: object;
  softCta?: "matchups" | "combos";
  refusal?: { reason: string };
  quota?: AiQuota;
};

type DeckCaps = {
  softLimit: 60;
  hardLimit: 75;
  persistedCount: number; // untitled drafts excluded until first real save
};

type SharePayload = {
  token: string;
  deck: PersistedDeck | ClientDeck;
  deckFormat: DeckFormat;
};

type FeedbackTicket = {
  category: "bug" | "feedback" | "other";
  message: string;
  diagnostics?: {
    route: string;
    buildId: string;
    deckFormat: DeckFormat | null;
    deckIdHash?: string; // anonymized; user may toggle off
  };
  screenshotPath?: string; // private storage key — never public URL
};
```

### 4.2 Cache & ownership rules (product law)

| Data | Owner | Persist |
|------|-------|---------|
| Card catalog (~13k) | TanStack Query + IndexedDB (7d TTL) | Disk + memory |
| Live workshop deck | Zustand only (Context = compatibility shim) | sessionStorage restore for non-empty drafts |
| Archives list | Auth-scoped Query | Memory only (no IDB PII by default) |
| Facts | One Query keyed by `deckHash` + `deckFormat` + banlist epoch | Engine cache + Query; Matchups & Combos **share** it |
| Strategist thread | Existing client persistence | Unchanged unless E0 redesign says otherwise |
| Banlist tables | Load on `deckFormat` change | — |

**Rules:**

1. Do not dual-write live deck arrays in Context and Zustand.
2. Monte Carlo numbers are SSoT; LLM narration is capped and optional.
3. Deck caps: soft **60** / hard **75** account total; server enforces; untitled `"New Deck"` excluded until first real save.
4. OCG: extend `DeckFormat` + banlist epoch + eval decks together — never half-ship.
5. Presentation components must not import `@supabase/supabase-js` directly — use Query hooks / data services.

### 4.3 Strategist baseline vs next-gen

- **Shipped baseline:** Facts Brain coach — sanitized snapshot, priority prompt packing, modes above, hybrid RAG still used for synergy retrieval on the live edge.
- **Not approved for coding yet:** full “move away from RAG” rebuild. Requires V2-E0 design gate (§6) before implementation.

---

## 5. Interaction Matrix, Accessibility & Edge-State Resilience

### 5.1 Keyboard & pointer

- **Global:** `Tab` / `Shift+Tab` through header → Workshop chrome → active pane; `Esc` closes modal/drawer/popover and returns focus to opener.
- **Workshop tabs:** arrow keys within tablist; `Enter` / `Space` activates.
- **Build DnD:** pointer + KeyboardSensor (Space grab, arrows move, Esc cancel) with **aria-live** announcements.
- **Library:** type-to-search; `Enter` adds one copy when legal; disabled + explanation at copy/ban limit.
- **Strategist:** `Enter` sends (Shift+Enter newline); soft CTA controls are real buttons that switch Matchups/Combos.
- **No `⌘K` in v2.** Right-click card context is **out of v2** (post-v2 candidate only).

### 5.2 Touch targets

Minimum **24×24 CSS px** controls. Desktop-primary; drawer/sheet triggers must remain usable on tablet.

### 5.3 Asset & media resilience

- Card art: fixed aspect lock; on error → MDA placeholder (name + type visible).
- CDN/S3 failure: binder stays usable; no layout collapse.
- Feedback screenshots: type/size validation client + server; EXIF stripped; private bucket only; never public URL-guessable; never log screenshot bytes to client analytics.

### 5.4 System status & edge states

| State | Behavior |
|-------|----------|
| Empty Build | CTAs: search Library, import share, open Archives (auth) |
| Incomplete / illegal | Banner + counters; Facts still run with honest copy; Strategist warns, does not hard-block mid-tune |
| Empty Matchups | Actionable empty (e.g. build toward legal main size) + jump to Build — no fake tiers |
| Empty Combos | Honest empty; no invented hands/lines |
| Guest hits Strategist / save / Help submit | Login modal; preserve intent after auth when practical |
| Soft deck cap (60) | Archives + save toast warning |
| Hard deck cap (75) | Block create/copy/first-persist; server rejects |
| Quota low / zero | Hazard chip → “COMM CHANNEL DEPLETED” empty + recovery copy |
| Strategist refuse | Clear reason; no invented card names |
| Loading | Quad loader sparingly; pane skeletons for Facts/Archives; honor reduced motion |
| Network / unexpected | Route `error.tsx` with `reset`; expected auth/validation as return values, not throws |

### 5.5 Accessibility gates

- WCAG 2.2 AA contrast per token constitution.
- jest-axe on Workshop Strategist, UserMenu, Help (and other high-interaction surfaces as touched).
- Focus trap on Login / Help / Share overlays.
- `prefers-reduced-motion` zeros travel, including landing scroll chapters.

---

## 6. Modular Component Architecture & Staged Execution Roadmap

### 6.1 Domain component tree

| Domain | Responsibility |
|--------|----------------|
| `layout/` | `MdaAppHeader`, frame/crop chrome, grid surface, loading shells |
| `atoms/` | ClipButton, FrameCorners, HazardStripe, SegmentedBar, StatusChip, LoaderMark |
| `workshop/` | DeckChrome (3 tabs), BuildPane, CardLibrary, Strategist suite, MatchupsPane, CombosPane/graph |
| `archives/` | List/grid, pin/rename/copy, cap banners |
| `share/` | Crop-frame preview + Import CTA |
| `help/` | FAQ, diagnostics toggle, feedback form |
| `auth/` | Login modal, confirm/reset shells |
| `landing/` | Hero auth composition + scroll narrative chapters (post-comps) |

Route files stay thin: compose organisms only. No monolithic page files. No direct Supabase in presentation.

### 6.2 v2 staged build (player-value order)

| Stage | Scope | Guardrail |
|-------|-------|-----------|
| **V2-A** As-built freeze | Document current tokens, Workshop IA, Query/Zustand/Facts cache as law | No drive-by refactors |
| **V2-B0** External UI design | Figma / Lovable / Stitch comps for Landing, Workshop, Archives, Share, Help | No mass restyle until comps approved |
| **V2-B1** Surface closeout | Share MDA restyle + progressive coaching banners mapped from comps | Match comps → tokens |
| **V2-B2** Awwwards landing | Scroll narrative + Login/Sign up per comps | Brand-first hero; reduced-motion path; replace thin Stitch dump as long-term SSoT when comps land |
| **V2-C** Help + feedback | FAQ + diagnostics + auth feedback + private Storage + notify email | Schema/env need explicit OK |
| **V2-D** Visual fine-tune | Spacing/type/hover/glass agreement vs comps | **Zero** new product behavior |
| **V2-E0** Strategist next-gen design | Inventory hybrid RAG vs Facts-only; define community-shaped UI actionables; choose keep / Facts-only / budgeted hybrid; write dedicated plan | **No rebuild code until that plan is approved** |
| **V2-E** Coaching quality | Harness completeness, 5-deck scripts, quota HUD; implement E0 outcome only if approved | No LLM-replaces-Monte-Carlo; no speculative de-RAG |
| **V2-F** Combo value | Hand → steps → endboard graph + killers/chokes + analytics sink | Honest empty; no invented lines |
| **V2-G** Release | Playwright smokes (keep Jest), Storybook CI optional→blocking, undeploy NOT_LIVE edges, prod smoke | Your QA sign-off each gate |

**V2-E0 checklist (blocking for any de-RAG or major coach UX rewrite):**

1. Inventory live synergy RAG vs Facts-only paths and failure modes players feel.
2. Define player jobs + seamless UI actionables (apply tune, open Matchups/Combos, copy package) guided by competitive-community norms.
3. Decide: **(a)** keep tightened hybrid RAG, **(b)** Facts + rules-only retrieval, or **(c)** hybrid with hard RAG budget — with eval criteria.
4. Write/iterate a dedicated plan; only then schedule implementation beside V2-E.

Until E0 is approved, v2 ships progressive unlock + quota + harness on the **current** Facts coach.

### 6.3 Post-v2 horizon — OCG platform

1. Banlist + size rules pack for OCG.
2. Extend `DeckFormat` + UI selector + Facts/Strategist `formatPolicy`.
3. Eval decks + goldens for OCG.
4. Archives / share / copy format semantics.

Do **not** show OCG in the selector until steps 1–3 are ready. RAG retirement ops run in a later train only when V2-E0 chose (b) or (c) and eval passed — never as a silent side effect of OCG work.

### 6.4 Standing non-goals (v2)

- Redis cache tier
- Knip as primary orphan tool
- Playwright replaces Jest
- Full Storybook coverage of every page
- Groq tool-calling / streaming chat as a required ship item
- Dual-write Context + Zustand live deck
- Unlimited decks per account
- Mobile-first redesign
- Dark/gold workshop revival
- Shipping a de-RAG Strategist rewrite without approved E0 plan
- Treating unfinished external comps as “done UI”
- Shipping a thin auth-only landing without scroll narrative

### 6.5 Definition of done (v2)

A competitive player on desktop can:

1. Build/tune a TCG or Master Duel list in Workshop.
2. See honest Facts on incomplete lists.
3. Use Strategist when authenticated (warn-not-block).
4. Experience progressive coaching UI and Share import on-brand with approved comps.
5. Use an Awwwards-caliber landing with Login/Sign up and scroll story.
6. Submit Help feedback (auth).
7. See AI quota status.
8. Read real combo hands → steps → endboards when lines exist.

Gates: lint + unit tests + build green; your phase QA checklists signed; Playwright smokes for critical journeys.

---

## Locked Architectural Decisions (summary)

1. **Player-first constitution** with dual horizon (v2 ship + OCG platform) — docs/plans are inputs, not locks when they reduce player value.
2. **Soft auth + progressive coaching** — Facts on incomplete lists; Strategist auth with warn-not-hard-block.
3. **Desktop-primary light tactical HUD** — tokens in `globals.css`; external Figma/Lovable/Stitch comps gate visual production work.
4. **Facts Query shared by Matchups/Combos**; Zustand live deck; Query + IDB catalog; soft 60 / hard 75 deck caps.
5. **Strategist Facts Brain is baseline**; hybrid RAG remains until an approved V2-E0 plan says otherwise — no phantom de-RAG rebuild in the ship train.

## Resolved Contradictions

| Conflict | Resolution |
|----------|------------|
| `WORKSHOP_SPEC` dark/gold + many formats | Superseded by light MDA tokens + TCG/MD only |
| Hard complete-deck Strategist gate | Progressive unlock (warn, don’t hard-block mid-tune) |
| Library/Strategist as top-level tabs | Build rail modes only; three top tabs |
| Production plan as immutable law | Evidence; player value overrides |
| “De-RAG plan ready” | Not found / not ready → V2-E0 design gate |
| Thin landing vs product story | Awwwards scroll narrative + auth CTAs required |
| Editorial atoms = finished UI | External comps are visual SSoT before surface coding |

---

## Copy-pasteable V2-A Execution Prompt

```text
You are implementing Master Deck Alchemist against docs/PRD-master-deck-alchemist.md.

Task: V2-A As-built freeze only.
- Do not restyle surfaces, change Strategist architecture, or add OCG.
- Verify alignment against docs/PRD-master-deck-alchemist.md and note any code drift in a short checklist reply (do not rewrite product law):
  - Workshop IA: tabs build|matchups|combos; Build rail library|strategist
  - Tokens: docs/mda-design-tokens.md / app/globals.css
  - Cache matrix: docs/v2-client-cache-matrix.md (Query catalog+IDB, Zustand liveDeck, shared Facts Query)
  - Soft auth + progressive coaching as product law (Strategist warns on incomplete — does not hard-block mid-tune as the only unlock model)
- No schema, dependency, or config changes without explicit user OK.
- Run lint + unit tests + build before claiming done.
- Next stages after V2-A: V2-B0 external comps (Figma/Lovable/Stitch), then B1 Share/progressive UI, B2 Awwwards landing — do not start those in this task.
```

---

## Document control

| Field | Value |
|-------|-------|
| Path | `docs/PRD-master-deck-alchemist.md` |
| Replaces as product law | Stale workshop theme claims; hard coaching gates; assumed de-RAG readiness |
| Next process step | User review of this file → `writing-plans` for implementation plan (not ad-hoc coding) |
