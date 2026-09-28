# NOT LIVE — `deck-assistant` edge twin

## Architecture

**Status:** Not the production coaching gateway.

## Live path (edit these)

| Concern | Path |
|---|---|
| Edge entry | `supabase/functions/strategist/index.ts` |
| Coach + persona | `supabase/functions/strategist/coach-response.ts` |
| Client API | `lib/api/strategist.ts` |
| Shared Facts / packing | `supabase/functions/_shared/engine/` + `lib/engine/` |

Workshop chat calls **`/functions/v1/strategist`**. The thin re-export at `lib/api/deckAssistant.ts` is deprecated cutover glue only.

## Dev Notes

`deck-assistant` is a historical twin used by older Deno tests and local experiments. It still contains a Facts-Brain-shaped `index.ts`, but it is **not** the deployed Workshop Strategist surface.

## Do not

- Add new coaching modes, persona rules, or snapshot sanitization here first
- Treat `prompts.ts` / `response-generator.ts` as live (also marked **NOT LIVE**)
- Reintroduce free-form recommendation schemas from the rejected `docs/strategist-optimization-plan.md` rewrite

## Prefer

Copy or port changes into `supabase/functions/strategist/` (and mirrored `lib/engine/` helpers for Jest), then leave this twin alone unless you are deliberately retiring it.
