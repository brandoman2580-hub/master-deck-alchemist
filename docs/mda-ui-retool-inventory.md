# MDA UI Retool Inventory (Phase 2a gate)

## Architecture

Approval gate for Phase 2 surface retool on branch `MDA-v2-ui-2a-foundation`.  
**2a** ships foundation atoms only after Batch A approval. **2b** applies surface rows; **2c** Help backend.

## Dev Notes

**Rule:** Approve (or amend) rows before mass surface restyle.  
**Approval values:** `APPROVE` | `AMEND` (note change) | `DEFER` | `SKIP`  
**Status:** Batch A **APPROVED** (2026-09-30) and implemented. **Loader pick locked: `quad`.** Batches B–F still pending.  
**Thermo-nuclear constraint:** Do **not** put bezels / hazard stripes / crop marks on every virtualized card cell.

---

## A. New foundation atoms (Phase 2a)

| Path | Current role | Qualify? | Target pattern(s) | Implementation | Effort | WCAG notes | Your approval |
|------|--------------|----------|-------------------|----------------|--------|------------|---------------|
| `components/mda/hazard-stripe.tsx` (new) | — | Y | Hazard stripe header | CSS `repeating-linear-gradient` + `.mda-hazard-stripe` | S | Decorative; pair with text label using `--mda-hazard-text` | **APPROVE** |
| `components/mda/segmented-bar.tsx` (new) | — | Y | Segmented gauges | Flex of CSS rects; plug for Grade / quota (P3) | S | Segment fills need 3:1 vs track | **APPROVE** |
| `components/mda/crop-frame.tsx` (new) | — | Y | Crop-mark command shell | CSS pseudo / SVG-in-JS; page/chrome only | M | Non-interactive `aria-hidden` | **APPROVE** |
| `components/mda/status-chip.tsx` (new) | — | Y | MODEL-tag status | Solid ink/hazard chip | S | Text uses ink/hazard-text | **APPROVE** |
| `components/mda/callout.tsx` (new) | — | Y | Callout leaders | Landing/Share only | M | Don’t use on Workshop binder | **APPROVE** |
| Loader: quad-pulse (new variant) | — | Y | Quad loader | CSS/SVG in loading screen | M | `role=status`; reduced-motion | **APPROVE** |
| Loader: waveform (new variant) | — | Y | Waveform loader | CSS/SVG in loading screen | M | Same as above | **APPROVE** |
| Temporary loader gallery route/panel | — | Y | A/B pick | Dev-only or gated `/dev/loaders` / Workshop flag | S | Remove or gate before prod | **APPROVE** |

---

## B. Existing foundation / chrome (Phase 2a evolve; 2b consume)

| Path | Current role | Qualify? | Target pattern(s) | Implementation | Effort | WCAG notes | Your approval |
|------|--------------|----------|-------------------|----------------|--------|------------|---------------|
| `components/mda/frame-corners.tsx` | L-bracket overlay | Y | HUD bezel variants `command` \| `selected` \| `quiet` | Extend props; CSS | M | `aria-hidden` | **APPROVE** |
| `components/mda/clip-button.tsx` | Square MDA CTAs | Y | Tech-cut + sky CTA | Tokens done (cta-ink); optional clip-path notch | S | Sky CTAs use `--mda-cta-ink` | **APPROVE** |
| `components/mda/landing-login-button.tsx` | Bracketed login CTA | Y | Tech-cut; hardcode stroke → token | CSS tokens | S | Bracket stroke was `#4D6676` | **APPROVE** |
| `components/mda/mda-loading-screen.tsx` | Full/scoped spinner overlay | Y | Quad + waveform variants; keep rings as `legacy` fallback | Variants prop | M | Live region OK; honor reduced-motion | **APPROVE** |
| `components/mda/app-header.tsx` | App chrome header | Y | Micro-tech metadata; crop optional | Bezel + tokens | M | Focus order with UserMenu | |
| `components/mda/brand-lockup.tsx` | Brand title/mark | Y (light) | Keep brand hero rules on landing | Tokens only | S | Contrast on header bar | |
| `components/mda/search-field.tsx` | Workshop search | Y | Technical hairline + cyan focus | CSS | S | Focus ring AA | |
| `components/mda/deck-cap-badge.tsx` | Cap status chip | Y | Status chip / hazard when near hard-cap | Use `MdaStatusChip` | S | Label contrast | |
| `components/mda/section-collapse.tsx` | Accordion section | Y | `+` affordance rows | CSS | S | `aria-expanded` | |
| `components/mda/collapse.tsx` | Generic collapse | Y (light) | Align with section-collapse | CSS | S | Keyboard | |
| `components/mda/focus-manager.tsx` | Focus utility | N | — | Leave alone | — | Keep | |
| `components/mda/magnetic-cursor.tsx` | Branded pointer | N (shells only) | Already gated | Leave; don’t expand | — | Reduced-motion / fine pointer | |
| `components/mda/magnetic-cursor/magnetic-targets.ts` | Target helpers | N | — | Leave alone | — | — | |
| `components/mda/workshop-card-dims.ts` | Card size constants | N | — | Leave alone | — | — | |
| `components/mda/archives-popover-styles.ts` | Shared popover class strings | Y | Align to MDA bezel tokens | Token strings | S | Inverse text AA | |

---

## C. Workshop surfaces (Phase 2b)

| Path | Current role | Qualify? | Target pattern(s) | Implementation | Effort | WCAG notes | Your approval |
|------|--------------|----------|-------------------|----------------|--------|------------|---------------|
| `components/mda/workshop-deck-chrome.tsx` | Workshop tabs / chrome | Y | Command crop frame; tab = bracketed not pill | Crop frame + bezel | L | Tab `aria-selected` | |
| `components/mda/workshop-build-pane.tsx` | Build layout | Y | Content restraint; selected bezel only | Quiet bezel on selection | L | 60fps binder | |
| `components/mda/workshop-card-library.tsx` | Virtualized binder | Y (restrained) | Selected cell quiet bezel only | **No** per-cell ornament | L | Focus visible on cards | |
| `components/mda/workshop-card-filters.tsx` | Filter rows | Y | Tactical list rows | CSS | M | Toggle a11y | |
| `components/mda/mda-card-preview.tsx` | Card hover/preview | Y | Bezel + ease-in-out; hazard micro if banned | Bezel + motion | M | Popover focus | |
| `components/mda/workshop-matchups-pane.tsx` | Matchups charts | Y | Thin bezels; segmented bars | SegmentedBar | L | Chart text AA | |
| `components/mda/workshop-combos-pane.tsx` | Combo lines | Y | List widget + selected cyan edge | CSS | L | Row keyboard | |
| `components/mda/workshop-grade-disclaimer.tsx` | Grade caveat | Y | Status chip energy | Tokens | S | Readable disclaimer | |
| `components/mda/deck-cost-display.tsx` | Price strip | Y | Adapt for light MDA + inverse contexts | Tokens (2b with Share) | M | Currently white/80 for dark shells | |

---

## D. Strategist (Phase 2b)

| Path | Current role | Qualify? | Target pattern(s) | Implementation | Effort | WCAG notes | Your approval |
|------|--------------|----------|-------------------|----------------|--------|------------|---------------|
| `workshop-strategist/WorkshopStrategistPanel.tsx` | Panel shell | Y | Inverse/raised pod | Inverse tokens | L | Focus trap not required (pane) | |
| `workshop-strategist/StrategistInputBar.tsx` | Message input | Y | Inverse pod | Inverse + focus | M | Label / send keyboard | |
| `workshop-strategist/StrategistModeControl.tsx` | Mode toggles | Y | Tactical toggles | Segmented control look | M | `aria-pressed` | |
| `workshop-strategist/StrategistThread.tsx` | Message list | Y | Technical list | CSS | M | Live region for new msgs | |
| `workshop-strategist/StrategistEmptyState.tsx` | Empty coach | Y | HUD empty | CSS | S | — | |
| `workshop-strategist/CoachAnswerBlock.tsx` | Answer body | Y (light) | Typography tokens | CSS | S | Markdown contrast | |
| `workshop-strategist/RecommendationCard.tsx` | Rec card | Y | Modular panel + bezel | Bezel | M | Action buttons AA | |
| `workshop-strategist/EvidenceDisclosure.tsx` | Evidence accordion | Y | `+` collapse | section-collapse pattern | S | `aria-expanded` | |
| `workshop-strategist/SynergyActionRow.tsx` | Synergy actions | Y | Tech-cut buttons | ClipButton | S | — | |
| `workshop-strategist/TuningActionRow.tsx` | Tune actions | Y | Tech-cut buttons | ClipButton | S | — | |
| `workshop-strategist/WorkshopTabCta.tsx` | Soft tab CTAs | Y | Bracketed CTA | CSS | S | — | |
| `workshop-strategist/apply-tuning.ts` / `types.ts` / `index.ts` | Logic / types | N | — | Leave alone | — | — | |

---

## E. Archives (Phase 2b)

| Path | Current role | Qualify? | Target pattern(s) | Implementation | Effort | WCAG notes | Your approval |
|------|--------------|----------|-------------------|----------------|--------|------------|---------------|
| `components/mda/deck-archive-card.tsx` | Archive deck tile | Y | Modular panel; sky CTA ink done | Bezel + tokens | M | Inverse overlay text | |
| `components/mda/archives-dialogs.tsx` | Confirm/edit dialogs | Y | Command bezel dialog | Crop/bezel | M | Focus trap (Radix) | |
| `components/mda/archives-popovers.tsx` | Rename/share popovers | Y | Bezel popovers | Tokens | M | Focus return | |

---

## F. Landing (Phase 2b)

| Path | Current role | Qualify? | Target pattern(s) | Implementation | Effort | WCAG notes | Your approval |
|------|--------------|----------|-------------------|----------------|--------|------------|---------------|
| `components/mda/landing-side-nav.tsx` | Landing nav | Y | Product-sheet ticks | CSS / hazard light | M | Landmark nav | |
| `components/mda/landing-feature-row.tsx` | Feature band | Y | Callout / scale ticks | Optional callout | M | — | |
| `components/mda/landing-auth-modal.tsx` | Auth modal | Y | Command bezel | Bezel + inverse fields | M | Focus trap | |

---

## G. Mandatory UX-debt rows (amendment)

| Path | Current role | Qualify? | Target pattern(s) | Implementation | Effort | WCAG notes | Sub-phase | Your approval |
|------|--------------|----------|-------------------|----------------|--------|------------|-----------|---------------|
| `components/mda/share/share-deck-client.tsx` | Share preview/import — **legacy slate/shadcn** | Y | MDA crop frame + header + ClipButton | Full restyle; keep cost + Import → `/workshop` | L | Replace white-on-slate; AA focus | **2b** | |
| `app/share/[token]/page.tsx` + `layout.tsx` | Share route shell | Y | Light MDA shell | Wire MDA chrome | M | Same as client | **2b** | |
| `components/ui/user-menu.tsx` | Avatar menu — custom portal, not Radix | Y | Radix DropdownMenu + MDA bezel; email + Logout + Help | Restyle; Help → stub dialog | M | `aria-expanded`, focus return | **2b** | |
| `components/mda/help/` (new) | Help hub + feedback | Y | FAQ + diagnostics + categorized form | Stub shell in 2b; full pipeline 2c | L | jest-axe; auth/rate-limit | **2b stub / 2c full** | |

---

## H. MDA-touched `components/ui/*` (audit for 2b)

| Path | Current role | Qualify? | Target pattern(s) | Implementation | Effort | WCAG notes | Your approval |
|------|--------------|----------|-------------------|----------------|--------|------------|---------------|
| `components/ui/button.tsx` | shadcn button | Y (MDA routes) | Avoid rounded-full soft SaaS on MDA | MDA variant or wrap ClipButton | M | Contrast | |
| `components/ui/dropdown-menu.tsx` | Radix menu | Y | Bezel content styles for UserMenu | Token classes | S | Focus | |
| `components/ui/dialog.tsx` / `alert-dialog.tsx` / `sheet.tsx` | Overlays | Y | Command bezel content | Token chrome | M | Focus trap | |
| `components/ui/tabs.tsx` | Tabs | Y | Bracketed selected (Workshop) | Variant | M | `aria-selected` | |
| `components/ui/input.tsx` / `input-with-clear.tsx` | Inputs | Y | Technical hairline | Tokens | S | Focus | |
| `components/ui/badge.tsx` / `rarity-badge.tsx` | Badges | Y (light) | Status chip energy | Tokens | S | — | |
| `components/ui/card.tsx` / `card-preview.tsx` / `card-image.tsx` / `card-stack.tsx` | Card primitives | Y (restrained) | Preview bezel only | Don’t ornament every cell | M | — | |
| `components/ui/share-link-dialog.tsx` | Create share link | Y | Align with Share MDA | Tokens | M | — | |
| `components/ui/login-form.tsx` / `signup-form.tsx` / `login-modal.tsx` | Auth | Y | Match landing-auth-modal | Tokens | M | Autofill inverse | |
| `components/ui/filter-toggle.tsx` | Filter chips | Y | Tactical toggles | CSS | S | Pressed state | |
| `components/ui/popover.tsx` / `tooltip.tsx` / `select.tsx` / `scroll-area.tsx` / `progress.tsx` / `skeleton.tsx` / `avatar.tsx` / `label.tsx` / `alert.tsx` / `deck-drop-zone.tsx` / `animated-checkmark.tsx` / `archetype-autocomplete.tsx` | Supporting primitives | Audit | Soft-shadow / rounded-full leaks | Wrap or variant when used on MDA routes | S–M | Case-by-case | |
| `components/navbar.tsx` | Legacy/nav alternate | Y (if still mounted) | Align with `app-header` or deprecate path | Confirm callers | S | — | |

---

## I. Route shells (Phase 2b)

| Path | Current role | Qualify? | Target pattern(s) | Implementation | Effort | WCAG notes | Your approval |
|------|--------------|----------|-------------------|----------------|--------|------------|---------------|
| `app/workshop/page.tsx` + `workshop-client.tsx` | Workshop route | Y | Page crop frame + optional grid watermark | CropFrame | L | Skip link / main | |
| `app/deck-archives/page.tsx` + `layout.tsx` | Archives route | Y | Same command shell | CropFrame | M | — | |
| `app/page.tsx` | Landing | Y | Product-sheet; brand hero rules | Grid / callout sparingly | L | Brand test | |
| `app/layout.tsx` / `providers.tsx` | Root | N (light) | Token cascade only | Already via globals | S | — | |
| `app/loading.tsx` / `error.tsx` / `not-found.tsx` | System UI | Y | Use new loaders / MDA empty | Loader variants | S | Status roles | |
| Auth pages (`app/auth/*`) | Auth flows | Y (light) | Match MDA auth modal | Tokens | S | — | |

---

## J. Suggested approval batches

1. **Batch A — atoms (unblocks 2a code):** Section A + `frame-corners`, `clip-button`, `landing-login-button`, `mda-loading-screen`.
2. **Batch B — molecules/chrome:** `app-header`, `brand-lockup`, `search-field`, `deck-cap-badge`, collapses, status chip consumers.
3. **Batch C — Workshop + Strategist shells:** Section C–D.
4. **Batch D — Archives + Landing:** Section E–F.
5. **Batch E — Share + UserMenu + Help stub:** Section G (2b).
6. **Batch F — ui primitives + route shells:** Section H–I.

Reply with batch approvals (e.g. “Batch A APPROVE all”) or row-level amendments. **Until Batch A is approved, 2a will not implement atoms/loaders/Storybook.**

---

## Out of scope reminders

- Help Storage / Edge / email provider → **2c** only (schema/env OK required then).
- Quota HUD wiring → **Phase 3** (SegmentedBar is a plug only).
- Mass Share/UserMenu restyle → **2b**.
- Raster hazard PNGs → **forbidden**.
