# MDA v2 Phase 1a — Orphan / legacy inventory

## Architecture

Full-tree dead-code inventory + **cleanup executed** on branch `MDA-v2-sanitation-thermo`.  
Approved dispositions applied 2026-09-28. Edge **undeploy** of retired remotes remains **Phase 5**.

Allowed dispositions: `KEEP` | `_deprecated/` | `DELETE` | `DOCS-ARCHIVE` | `UNDEPLOY-LATER (Phase 5)`

Scan date: 2026-09-28 · Base: `develop` @ `8a35272`

### Cleanup status

| Action | Result |
|--------|--------|
| NOT_LIVE edges + `create-deck` + `recommendation-agent` | Moved → `_deprecated/supabase-functions/` |
| Strategist `prompts.ts` / `response-generator.ts` | Moved → `_deprecated/supabase-functions/strategist-not-live/` |
| `config.toml` | Rewritten to LIVE product + LIVE/UNKNOWN ops only |
| `/deck-builder`, `/saved-decks` + components | → `_deprecated/` (shared utils → `lib/deck/utils.ts`; cost UI → `components/mda/deck-cost-display.tsx`) |
| Share CTAs | Now route to `/workshop` |
| Orphan UI / hooks / API / stores / types | → `_deprecated/` |
| Cypress + listed Jest files | **DELETED**; `cypress-axe` uninstalled |
| `scripts/generate-favicons.js` | → `_deprecated/scripts/` |
| DOCS-ARCHIVE set | → `docs/_archive/` |
| `/private` | **DELETED** |
| `deck-tester` | Already absent (no-op) |

### Your QA (required before lint/build/commit/PR)

Phase 1a cleanup + Phase 1a.5 restructure:

- [x] Workshop loads; Strategist panel mounts
- [x] Archives + Share (cost display + open/import into Workshop)
- [x] Auth signup + `/error` redirect path
- [x] Cold load card library
- [x] `/deck-builder` → `/workshop`, `/saved-decks` → `/deck-archives`
- [x] Nothing you meant to keep disappeared

---

## Approval record (your decisions)

Blanket approvals from chat (summarized):

1. `recommendation-agent` → `_deprecated/` + **UNDEPLOY-LATER (Phase 5)**
2. `cypress-axe` → **DELETE**
3. All NOT_LIVE edges → `_deprecated/`; `create-deck` → same + **UNDEPLOY-LATER**
4. UNKNOWN meta/rarity ops (`update-meta`, `sync-master-duel-rarity`, + related LIVE ops) → **KEEP**
5. `config.toml` → live/unknown only (**done**)
6. `deck-builder`, `saved-decks`, `deck-tester` routes/components → `_deprecated/`
7â€“9. Marked orphan UI / hooks / API / stores → `_deprecated/`
10. Marked tests → **DELETE**; `generate-favicons.js` → `_deprecated/`
11. DOCS-ARCHIVE marks → `docs/_archive/`

### Tooling hygiene

| Path | Your decision | Done |
|------|---------------|------|
| `cypress-axe` | DELETE | Yes |
| `a11y_manifest.json` | KEEP (stale Cypress text — optional follow-up) | Left |
| `.lintstagedrc.json` | KEEP | Left |
| README vs husky `docs:check` | KEEP | Left |

---

## Relocated live shared code (not deprecated)

| New path | Former | Why kept live |
|----------|--------|---------------|
| `lib/deck/utils.ts` | `app/deck-builder/utils.ts` | Workshop + StrategistThread imports |
| `components/mda/deck-cost-display.tsx` | `components/deck-builder/deck-cost-display.tsx` | Share page |

Parking lot: [`_deprecated/README.md`](../_deprecated/README.md).

---

## Phase 1a.5 — Folder restructure (`app` / `lib` / `scripts` / `types`)

Scan date: 2026-09-29 · Branch: `MDA-v2-sanitation-thermo`  
Goal: naming collisions, leftover one-offs, clearer folder boundaries. **Not** Phase 1b SSoT / edge undeploy / auth UX merge.

### A. Missed one-offs → `_deprecated/`

| Path | Disposition |
|------|-------------|
| `lib/recommender-helpers.ts` | → `_deprecated/lib/` |
| `lib/hooks/useAnalytics.ts` | → `_deprecated/lib/hooks/` |
| `lib/utils/deckSort.ts` | → `_deprecated/lib/utils/` |
| `lib/utils/prompt-utils.ts` | → `_deprecated/lib/utils/` |
| `lib/seo/metadata.ts` | → `_deprecated/lib/seo/` (keep `structured-data.ts`) |
| Unused `app/fonts/` (Anton, RobotoCondensed, ShareTechMono) | → `_deprecated/app-fonts/` |

**KEEP:** `lib/ai/groq-model.ts` (Jest mirror of edge `_shared/groq-model.ts`).

### B. `lib/` renames

| From | To |
|------|-----|
| `lib/api.ts` | `lib/data/cards.ts` |
| `lib/supabaseDecks.ts` | `lib/data/decks.ts` |
| `lib/utils/cardPricing.ts` | `lib/card/pricing.ts` |
| `lib/utils/rarityBadges.ts` | `lib/card/rarity.ts` |
| `lib/card-image-url.ts` | `lib/card/image-url.ts` |
| `lib/card-library-cache.ts` | `lib/card/library-cache.ts` |
| `lib/constants.ts` | `lib/deck/constants.ts` |
| `lib/helpers.ts` (import/normalize) | `lib/deck/import.ts` |
| `openLoginModal` (from helpers) | UI → `useLoginModalStore` / thin hook |
| `toAbsoluteShareUrl` | `lib/share/urls.ts` (`lib/utils.ts` = `cn` only) |
| `lib/magnetic-targets.ts` | `components/mda/magnetic-cursor/magnetic-targets.ts` |
| `lib/workshop-grade*.ts` | `lib/workshop/grade.ts` (merged) |
| `lib/query-client.tsx` | `lib/query/client.tsx` |
| `getRemainingCopies` / `isExtraDeckCard` | `lib/deck/copy-limits.ts` |
| `lib/analysis/cardRoleDetector.ts` | `lib/deck/card-roles.ts` |
| `lib/analysis/archetypeKnowledge.ts` | `lib/engine/archetype-knowledge.ts` |

**CONSOLIDATED onto `utils/supabase/*`** (Phase B): `lib/supabaseClient.ts` deleted. The legacy
client persisted sessions to `localStorage`, which desynced from the cookie-based server client
and broke authenticated server actions. All importers now use `createBrowserClient` from
`@supabase/ssr` via `utils/supabase/client.ts`.

### C. `app/`

| Path | Disposition |
|------|-------------|
| `app/(lib)/FocusManager.tsx` | → `components/mda/focus-manager.tsx` |
| `app/login/actions.tsx` | → `app/auth/actions.ts` (`signup` only; drop dead OAuth/`login`) |
| `app/error/page.tsx` | **KEEP** (`/error` redirect target) |
| `app/workshop/layout.tsx` | **DELETE** (pass-through) |
| `app/share/[token]/page.tsx` | Thin route; UI → `components/mda/share/` |

### D. `types/`

| New file | Contents |
|----------|----------|
| `types/deck.ts` | `PersistedDeck` (was `Deck`), `ClientDeck` (was `DeckType`), deck card/mode/section/ban |
| `types/deck-import.ts` | Import formats |
| `types/auth.ts` | `SignupFormState` only (drop unused `AuthProvider`) |
| `types/search.ts` | UI `SearchParams` |
| `types/card.ts` | **KEEP** |

### E. `scripts/ops/`

Move: `image-migration/`, `storage-quota-recovery/`, `scrapers/`, `prune-card-image-storage.ts`, `fix-git-lock.ps1`.

### QA gate (before lint/build/commit/PR)

- [ ] Workshop + Strategist
- [x] Archives + Share
- [x] Auth signup + `/error` path
- [ ] Cold card library
- [x] `/deck-builder` → `/workshop`, `/saved-decks` → `/deck-archives`
