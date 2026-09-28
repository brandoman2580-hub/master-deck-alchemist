# Strategist eval matrix (chat-in → response-out)

## Architecture

Living checklist for quality, grounding, and routing of the **Facts Brain** Strategist (`/functions/v1/strategist`).  
Contract: [`DeckCoachResponse`](../lib/engine/assistant-contract.ts) — `answer`, `mode`, `evidence`, optional `tuning` / `synergies` / `recommendations` / `redirectHint`.

**Not in scope:** Gemini’s `validate_and_ground_deck`, ADD/CUT schemas, or `navigation_intent` payloads. Soft CTAs use `redirectHint: workshop_matchups | workshop_combos`.

Related: [strategist-optimization-plan.md](./strategist-optimization-plan.md).

---

## Commands

```bash
npm run strategist:eval -- promote --from reports/strategist-eval/<run>.jsonl --id A3_MD
# edit scripts/strategist-eval/goldens/regression.jsonl constraints
# re-run → new case stays in future suites
```

## Golden constraints (repo store, not a live DB table)

Eval goldens are **version-controlled** so every fail can become a permanent regression case without coupling CI to Supabase schema churn.

| Artifact | Role |
|---|---|
| [`scripts/strategist-eval/golden-constraints.schema.json`](../scripts/strategist-eval/golden-constraints.schema.json) | JSON Schema for a golden case |
| [`scripts/strategist-eval/scenarios.json`](../scripts/strategist-eval/scenarios.json) | Seed matrix (prompts + `constraints`) |
| [`scripts/strategist-eval/goldens/*.jsonl`](../scripts/strategist-eval/goldens/) | Additive regressions (same id overrides seed) |
| [`lib/eval/strategist-golden-score.ts`](../lib/eval/strategist-golden-score.ts) | Deterministic scorers (Jest + CLI) |

**Workflow when a run fails for a real quality bug:**

```bash
npm run strategist:eval -- promote --from reports/strategist-eval/<run>.jsonl --id A3_MD
# edit scripts/strategist-eval/goldens/regression.jsonl constraints
# re-run → new case stays in future suites
```

Constraint highlights:

- `forbidRecommendNames` — add/run framing fails; **refuse/ban mentions pass**
- `requireRefuseNames` — name must appear near refuse/forbidden language
- `formatPolicy: match_session` (default when `format` set) — **skip** TCG cases on an MD session (no false HTTP 400)
- `httpError` — poison-snapshot / unknown-id cases

Runtime Facts (banlists, card library, role weights) stay in Supabase. Eval expectations stay in git.

---

## How to run

Env vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, optional `STRATEGIST_EVAL_TOKEN`) are loaded automatically from `.env.development.local`.

### Session workflow (per deck / format)

```bash
# 1) Start a session (positional UUID — required for npm 11+)
npm run strategist:eval -- start f6c72984-1be4-4f5c-a040-173b394233df

#    Or from an exported DeckType JSON file:
# npm run strategist:eval -- start ./tmp/my-deck.json

# 2) Run the matrix against that session
npm run strategist:eval -- run
# npm run strategist:eval -- run A1,B2,E3

# 3) End before loading a different deck
npm run strategist:eval -- end

# 4) Aggregate pass / fail / warn / skip
npm run strategist:eval -- report
```

**npm 11 caveat:** `npm run … -- --deck-id <uuid>` does **not** work. npm treats `--deck-id` as its own CLI config and never forwards it to the script (you’ll see `Unknown cli config "--deck-id"` and Usage). Prefer positional args above, or:

```bash
node scripts/strategist-eval.mjs start --deck-id <uuid>
```

Helpers: `npm run strategist:eval:status`, `strategist:eval:report`, `strategist:eval:promote`, etc.

Writes JSONL + per-run summaries under `reports/strategist-eval/`.  
`report` writes `reports/strategist-eval/aggregate-report_<timestamp>.md`.

Auth: prefers `STRATEGIST_EVAL_TOKEN` in `.env.development.local` if present; otherwise mints a short-lived JWT with `SUPABASE_JWT_SECRET` for the deck owner (local eval). If minting fails against Auth, paste your browser `access_token` as `STRATEGIST_EVAL_TOKEN` once.

### Manual UI checks

Paste the same prompts into Workshop → Build → Strategist. Use for **G1/G2** (CTA click) and **H1** (eligibility gate).

---

## Pass criteria (every scenario)

| Signal | Pass |
|---|---|
| Routing | `mode` matches expected family (`qa` / `tune_copies` / `discover_synergy` / `optimize`) or OOB refusal |
| Grounding | No invented card names as recommendations; Forbidden not suggested as adds |
| Tone | No casual peer filler (`Yo`, `bro`, `solid pick`, etc.) |
| Soft CTA | `workshop_matchups` / `workshop_combos` **only** when Facts have matchup rows / combo lines |
| Honesty | Thin Facts → explicit limitation, not a fabricated line/matchup script |
| Actionables | `tuning` / `synergies` IDs and deltas look server-clamped when present |
| Format | Format-specific cases **skip** when session format differs (`match_session`) |

**Triage tags on fail:** `routing` | `grounding` | `banlist` | `tone` | `CTA` | `honesty` | `actionable_clamp`

**Banlist oracle:** Assert against the **loaded format banlist** for the request — do not hardcode “Maxx C is always 3 in MD.”

---

## Fixture notes

Use a saved **legal** MD and/or TCG list with enough engine density that Facts can populate (e.g. Resonator / Lair hybrids). Empty combo/matchup Facts are valid for **E4** honesty checks.

Starter shells (cloneable structure-style lists) are a **separate product track** — reuse as fixtures when they exist.

**A2 / A3_TCG / F1** need a **TCG** session deck. On an MD-only session they **skip**, not fail.  
**A1 / A3_MD** need an **MD** session (skip on TCG).  
**B5** expects the session snapshot to include **Soul Resonator at count 3**; otherwise treat fails as fixture mismatch, not engine bugs.

---

## Scenario table

### A — Legality / format / banlist

| ID | Format | Prompt | Expected signals | Severity | Harness |
|---|---|---|---|---|---|
| A1 | MASTER_DUEL | Can I run 3 copies of Maxx "C" and use Hot Red Dragon Archfiend King Calamity as my primary Level 12 endboard boss? | Ban statuses match **MD** list; do not recommend Forbidden as add; professional tone; skip if session ≠ MD | high | API |
| A2 | TCG | Can I run 3 copies of Maxx "C" and use Hot Red Dragon Archfiend King Calamity as my primary Level 12 endboard boss? | Ban statuses match **TCG** list (may differ from MD); professional tone; skip if session ≠ TCG | high | API |
| A3_MD | MASTER_DUEL | Should I add Hot Red Dragon Archfiend King Calamity to my Extra Deck? | Assert against **MD** Forbidden; `requireRefuseNames` + no add recommendation (refuse mention OK); skip if session ≠ MD | high | API |
| A3_TCG | TCG | Should I add Hot Red Dragon Archfiend King Calamity to my Extra Deck? | Banlist-relative for **TCG**; no add recommendation; skip if session ≠ TCG (no hard refuse — status may differ from MD) | high | API |
| A4 | session | Should I play Ultra Neo Tomahawk Resonator Deluxe in this list? | Invented name rejected / not recommended as a real card | high | API |

### B — Consistency / tune_copies

| ID | Prompt | Expected signals | Severity | Harness |
|---|---|---|---|---|
| B1 | Why is my deck bricking on openers? | `mode=qa` (consistency); explain Facts; **not** forced copy Monte Carlo | high | API |
| B2 | Should I cut Ash Blossom to 2? | `mode=tune_copies`; tuning rows if variants exist; professional change reasons | high | API |
| B3 | Optimize my card copies for brick rate | `mode=tune_copies` (not optimize-deck bridge) | medium | API |
| B4 | Trim my Main Deck to 40 — what should I pitch? | Cut-oriented coaching / variants; toward-40 pressure when oversized | medium | API |
| B5 | I am currently running 3 copies of Soul Resonator. Is this ratio optimal for my starting consistency? | `mode=tune_copies`; answer cites Soul Resonator and acknowledges **3** copies from live `id+count` snapshot (soft — not Monte Carlo) | high | API |

### C — Synergy / locks / roles

| ID | Prompt | Expected signals | Severity | Harness |
|---|---|---|---|---|
| C1 | Show me DARK Fiend searchers for this list | `discover_synergy` (or discovery path); candidates grounded in library | high | API |
| C2 | I need more board breakers for going second | Breaker-oriented language/candidates; banlist-safe | high | API |
| C3 | Should I splash Hieratic Seal of the Heavenly Spheres or Baronne de Fleur to protect my endboard? | No invented ED bosses. **Conditional:** if `Facts.diagnostics.restrictions` non-empty, prefer lock/anti-synergy language and avoid unsummonable splash; if empty, do **not** fail for missing DARK/Fiend/Tyrant prose. Never fail solely for omitting Tyrant. | medium | API |
| C4 | What Extra Deck lock or anti-synergy problems does this list have? | `qa` anti_synergy behavior; restriction evidence when present | medium | API |

### D — Optimize / bridges

| ID | Prompt | Expected signals | Severity | Harness |
|---|---|---|---|---|
| D1 | Convert Lair into RDA | `mode=optimize`; bridge / templates without free-form illegal scripts | high | API |
| D2 | Rework this deck toward Fiendsmith | `mode=optimize`; grounded bridge language | medium | API |

### E — Matchups / Combos soft CTA

| ID | Prompt | Expected signals | Severity | Harness |
|---|---|---|---|---|
| E1 | How does my current strategy match up against Snake-Eye? Do I have the right tools to beat them? | Concise Facts summary **or** thin-data honesty; `redirectHint=workshop_matchups` **only if** matchup rows exist | high | API (+ UI CTA) |
| E2 | What are my worst matchups going first? | meta_matchup behavior; CTA when rows exist | medium | API |
| E3 | What is the optimal opening hand for this build, and how do I reach my endboard boss? | Short curated line/endboard **or** no-template refusal; `workshop_combos` CTA only if combo lines exist — **not** a free sequencer | high | API (+ UI CTA) |
| E4 | (Same as E3 on a list with empty `facts.combos.lines`) | No `workshop_combos` CTA; explicit limitation | high | API |

### F — Side / meta / OOB

| ID | Format | Prompt | Expected signals | Severity | Harness |
|---|---|---|---|---|---|
| F1 | TCG | I'm taking this to a regional and struggle going second vs backrow. What should I side? | side_plan / matchup-aware; banlist-safe; CTA matchups if Facts rich; skip if session ≠ TCG | medium | API |
| F2 | auto | What's the best deck in the format right now? | OOB meta_tier; `redirectHint=meta_panel` (**not** workshop_matchups) | high | API or client OOB |
| F3 | auto | What's the weather today? | Off-domain refusal message | high | API or client OOB |
| F4 | auto | Build me a competitive Snake-Eye deck from scratch | OOB freeform_build; `redirectHint=save_deck` | high | API or client OOB |

### G — Soft CTA UX (manual)

| ID | Steps | Expected signals | Severity | Harness |
|---|---|---|---|---|
| G1 | Run E1 with CTA → click **View Matchups** | Tab → matchups; return to Build preserves chat | medium | Manual UI |
| G2 | Run E3 with CTA → click **View Combos** | Tab → combos; return to Build preserves chat | medium | Manual UI |

### H — Eligibility / snapshot (edge / client)

| ID | Steps | Expected signals | Severity | Harness |
|---|---|---|---|---|
| H1 | Unsaved or illegal deck → open Strategist | Client gate; no coach call | high | Manual UI |
| H2 | Chat with snapshot containing an unknown card id | Sanitize rejection / unknown-cards style error | high | API (custom snapshot) |

---

## Historical Gemini mapping (corrected)

Older Gemini product examples map onto this matrix as **behavior probes**, not fixed deck names.

| Gemini scenario | Matrix IDs | Notes |
|---|---|---|
| Format / Maxx C / Calamity | A1, A2, A3_MD, A3_TCG | Banlist-relative; format-split Calamity cases; no fixed “3× Maxx in MD” oracle |
| Fiend Resonator + Hieratic/Baronne | C3–C4 | Conditional lock text when Facts.restrictions present |
| TCG side vs backrow | F1 | No required JSON `role: board_breaker` |
| Named meta matchup + Matchups tab | E1–E2, G1 | E1 uses **Snake-Eye** (engine meta template). Soft CTA `workshop_matchups`, not `navigation_intent`. “Kewl Tunes” was an example label, not a required prompt. |
| Optimal opener + Combos tab | E3–E4, G2 | Soft CTA `workshop_combos`; not a visual sequencer product |
| Copy-count / ratio | B5 | Soft `id+count` acknowledgment; fixture must run Soul Resonator ×3 |

---

## After each run

1. Open the JSONL + summary under `reports/strategist-eval/`.
2. Tag fails with triage labels above.
3. For real quality regressions: `promote --from <jsonl> --id <ID>`, tighten constraints, commit the golden.
4. File engineering fixes against Facts Brain / soft CTA — **do not** reintroduce rejected SQL/RPC rewrite docs.
