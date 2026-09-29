# `_deprecated/` — Phase 1a sanitation parking lot

## Architecture

Confirmed-dead or retired product surfaces isolated here so live Workshop / Strategist / Archives / Share stay clean.

**Do not import from this tree in production code.** Prefer deleting after Phase 5 undeploy + zero-traffic confirmation for edge twins.

## Why (one-liners)

| Area | Why |
|------|-----|
| `supabase-functions/*` | NOT_LIVE / client-dead edges (`recommendation-agent`, `deck-assistant`, …) + `create-deck`; undeploy in Phase 5 |
| `supabase-functions/strategist-not-live/` | Legacy `prompts.ts` / `response-generator.ts` from live `strategist/` |
| `app/deck-builder`, `components/deck-builder` | Pre-Workshop builder route (utils live at `lib/deck/utils.ts`; cost UI at `components/mda/deck-cost-display.tsx`) |
| `app/saved-decks`, `components/saved-decks` | Superseded by `/deck-archives` |
| Orphan UI / recommender blocks | Zero production importers |
| Hooks / API / stores / types listed here | Orphan chains for deck-builder-agent / recommendation-agent |
| `scripts/generate-favicons.js` | One-off asset script |
| Phase 1a.5 orphans (`recommender-helpers`, `useAnalytics`, `deckSort`, `prompt-utils`, `seo/metadata`, unused fonts) | Zero live importers after Workshop cutover |

See `docs/v2-orphan-inventory.md` for the approval trail (includes Phase 1a.5 restructure map).
