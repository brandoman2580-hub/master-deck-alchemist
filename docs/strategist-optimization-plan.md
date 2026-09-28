# Strategist direction (canonical)

## Architecture

> **This document replaces the rejected greenfield rewrite** that previously lived here (new `card_roles` table, `validate_and_ground_deck` RPC, monthly `pg_cron` + `pg_net` sync with embedded service-role keys, and a free-form ADD/CUT JSON schema).
>
> **Do not reimplement those snippets.**

## Live path

The Workshop Strategist is the **Facts Brain** coach:

1. Client sends a **live Workshop deck snapshot** (`{ id, count }` rows) via `lib/api/strategist.ts`.
2. Edge `supabase/functions/strategist/index.ts` **sanitizes** IDs against `cards`, loads Facts, and routes modes:
   - `qa` · `tune_copies` · `discover_synergy` · `optimize` · `auto`
3. Groq (`openai/gpt-oss-120b`) narrates a clamped **`DeckCoachResponse`** from validated attachments only (`coach-response.ts`).
4. Server owns actionables: Monte Carlo **SERVER_VARIANTS**, engine-condition synergy retrieval, ban/lock evidence, combo templates.

Persona: professional + competitive Yu-Gi-Oh terms (`hand trap`, `brick`, `board breaker`). No casual peer filler.

Roles stay on **`card_strategy_weights`** (+ shared heuristic fallback). There is **no** `card_roles` table.

## Source of truth for the overhaul

| Doc / plan | Role |
|---|---|
| Cursor plan **Strategist Quality Overhaul** | Phased execution (live snapshot, persona, packing, roles, modes, eval) |
| [`docs/strategist-overhaul-amendment.md`](./strategist-overhaul-amendment.md) | Historical pushbacks (reject `card_roles`, sanitize snapshot, etc.) — implement via Facts Brain contracts, not the amendment’s illustrative code blocks verbatim when they conflict |
| This file | Guardrail: rejected SQL/RPC/cron rewrite must not return |

## Dead / NOT LIVE paths

Do **not** extend these for production coaching:

- `supabase/functions/strategist/prompts.ts`
- `supabase/functions/strategist/response-generator.ts`
- Entire `supabase/functions/deck-assistant/` twin → see `supabase/functions/deck-assistant/NOT_LIVE.md`

## Eval

Golden Jest fixtures: `__tests__/engine/strategist-golden-modes.test.ts` (mode routing, invented-name rejection, ban/lock, evidence allowlist, professional tone smoke, NOT LIVE banners).

Live chat-in matrix + runner: [`docs/strategist-eval-matrix.md`](./strategist-eval-matrix.md) (`npm run strategist:eval`).

## Out of scope (still)

- Native Groq tool-calling loop / streaming UX
- Replacing Facts Monte Carlo with LLM-scored consistency
- Ops-owned monthly banlist/card sync (separate track; never embed service-role keys in SQL docs as copy-paste deployables)
