# MDA Design Tokens (Phase 2a)

## Architecture

Source of truth: `app/globals.css` (`:root`). Tailwind bridges: `tailwind.config.ts` → `mda.*`.
Storybook preview imports the same globals (`.storybook/preview.ts`).

## Dev Notes

- Light off-white / gray / cyan family only. **Purple is demoted** — keep `--mda-purple` for rare legacy accents; do not expand purple UI.
- Production loader default: **`quad`** (`MdaLoadingScreen` / `MdaLoaderMark`). `legacy` and `waveform` remain explicit variants.

## Roles → CSS → hex

| Role | CSS variable | Hex / value | Where used |
|------|--------------|-------------|------------|
| Page canvas | `--mda-bg` | `#e6e9ea` | `body`, shells |
| Deep canvas | `--mda-bg-deep` | `#d5dade` | Loading overlays, recessed zones |
| Surface | `--mda-surface` | `#eef1f3` | Panels (`.mda-panel`) |
| Raised surface | `--mda-surface-raised` | `#f5f7f8` | Modals, floating pods |
| Panel fill | `--mda-panel` | `#dde2e5` | Secondary fills |
| **Body text** | `--mda-ink` | `#3a4f5c` | Default copy (~7:1 on bg) |
| Strong text | `--mda-ink-strong` | `#2f414c` | Headings / emphasis |
| Soft text | `--mda-ink-soft` | `#4d6676` | Legacy mid ink; still AA on bg |
| Muted text | `--mda-ink-muted` | `#4a5f6e` | Secondary labels (solid, AA) |
| Chrome | `--mda-chrome` | `#425969` | Borders, L-brackets, bezels |
| Chrome muted | `--mda-chrome-muted` | `#5a6f7e` | Secondary chrome |
| Chrome deep | `--mda-chrome-deep` | `#374a56` | Inverse fills, heavy bezels |
| **CTA label ink** | `--mda-cta-ink` | `#2a3d48` | Text on sky/cyan CTA fills |
| Cyan accent | `--mda-cyan` | `#38d6ff` | Focus ring, interactive accents **not body text** |
| Cyan soft | `--mda-cyan-soft` | `#7ee8ff` | Soft hover washes |
| Cyan muted | `--mda-cyan-muted` | `rgba(56,214,255,0.22)` | Washed fills |
| Sky CTA fill | `--mda-sky` | `#7ec8e8` | Primary ClipButton fills |
| Sky strong | `--mda-sky-strong` | `#63b3ed` | CTA hover |
| Danger fill | `--mda-danger` | `#e95e70` | Destructive fill indicators |
| Danger text | `--mda-danger-text` | `#b42338` | Error copy on light canvas |
| Success fill | `--mda-success` | `#3edb8c` | Success indicators |
| Success text | `--mda-success-text` | `#1a6b42` | Success copy on light canvas |
| Hazard fill | `--mda-hazard` | `#d97706` | Warning / banned / quota-critical fill |
| Hazard text | `--mda-hazard-text` | `#8a5a00` | Warning copy on light canvas |
| Hazard stripe A/B | `--mda-hazard-stripe-a/b` | `#d97706` / `#f5e6c8` | `.mda-hazard-stripe` only |
| Grid mark | `--mda-grid-mark` | `rgba(58,79,92,0.12)` | `.mda-grid-surface` watermark |
| Bezel | `--mda-bezel` | `#425969` | Frame / crop edges |
| Focus | `--mda-focus` | `#38d6ff` | `:focus-visible` outline |
| Inverse pod | `--mda-inverse*` | chrome / `#f3f6f8` | Strategist input / dark readout islands |
| Header bar | `--mda-header-bar` | `#6b8ead` | App header strip |
| Purple (demoted) | `--mda-purple` | `#8565e4` | Do not expand |
| Motion | `--mda-duration-*` | 150 / 200 / 280ms | Hover / enter; zero under `prefers-reduced-motion` |

## WCAG 2.2 AA audit (Phase 2a)

Measured against `--mda-bg` `#e6e9ea` unless noted. Target: **4.5:1** normal text, **3:1** UI/icons.

| Pair | Ratio | Verdict |
|------|-------|---------|
| `--mda-ink` on bg | ~7.0:1 | Pass (body default) |
| `--mda-ink-soft` on bg | ~5.0:1 | Pass |
| `--mda-ink-muted` on bg | ~5.5:1 | Pass (was failing as 55% alpha) |
| `--mda-cta-ink` on `--mda-sky` | ~6.1:1 | Pass |
| `--mda-cta-ink` on `--mda-sky-strong` | ~5.0:1 | Pass |
| White on `--mda-sky` | ~1.9:1 | **Fail** — fixed on ClipButton / archive sky CTAs |
| `--mda-cyan` as text on bg | ~1.4:1 | **Fail as text** — accent/border/focus only |
| `--mda-danger` as text on bg | ~2.7:1 | **Fail as text** — use `--mda-danger-text` |
| `--mda-success` as text on bg | ~1.5:1 | **Fail as text** — use `--mda-success-text` |
| `--mda-hazard` as text on bg | ~2.6:1 | **Fail as text** — use `--mda-hazard-text` |
| Inverse text on inverse | ~6.8:1 | Pass |

### Rules of thumb

1. **Never** use cyan/sky/hazard/danger/success *fills* as body text on the light canvas.
2. Sky/cyan CTAs use `--mda-cta-ink` (not white).
3. Status copy uses `*-text` tokens; fills stay saturated for chips/bars.
4. Inverse pods are opt-in islands — do not flip the whole app to dark mode.
5. Hazard stripes = headers/status only (`.mda-hazard-stripe`), never wallpaper or virtualized card cells.

## Opt-in utility classes (2a)

| Class | Purpose |
|-------|---------|
| `.mda-grid-surface` | Low-opacity technical grid on command shells |
| `.mda-hazard-stripe` | Diagonal hazard band for status headers |
| `.mda-panel` / `.mda-panel-strong` | Existing light panels |

## Inverse pods

Use `--mda-inverse` / `--mda-inverse-deep` + `--mda-inverse-text` for Strategist input, critical status readouts, and other dark islands. Keep surrounding shell light.

## Changelog

- **Phase 2a:** Body ink darkened; solid muted; CTA ink; hazard/grid/bezel/focus/motion; danger/success/hazard text tokens; ClipButton + archive sky CTAs switched off white-on-sky.
- **Phase 2a Batch A:** Foundation atoms (`MdaHazardStripe`, `MdaSegmentedBar`, `MdaCropFrame`, `MdaStatusChip`, `MdaCallout`); bezel variants on `MdaFrameCorners`; ClipButton `techCut` + `hazard`; loaders `legacy` \| `quad` \| `waveform`; Storybook 10 seed; `/dev/loaders` gallery (prod 404).
- **Loader pick (locked):** Production default = **`quad`**. `legacy` and `waveform` remain as explicit `variant` options for Storybook / gallery.
