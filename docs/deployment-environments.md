# Deployment Environments

Three-tier release flow for **Master Deck Alchemist** on Vercel Hobby + Supabase.

| Tier | Git branch | Vercel target | URL |
|------|------------|---------------|-----|
| **Development** | `feature/*`, `fix/*` | Preview | Unique per branch |
| **Staging** | `develop` | Preview (stable branch alias) | Stable staging URL |
| **Production** | `master` | Production | `https://master-deck-alchemist.vercel.app` |

---

## Git workflow

```text
feature/my-change  →  PR → develop  →  QA on staging URL  →  PR → master  →  production
```

1. Branch from `develop`: `git checkout develop && git pull && git checkout -b feature/my-change`
2. Push and open a PR **into `develop`** (GitHub Actions runs unit, edge, lint).
3. After merge, Vercel deploys `develop` to the **stable staging alias**.
4. QA on staging; when ready, open a PR **`develop` → `master`**.
5. After merge, Vercel deploys production.

**Never push directly to `master`.** Use GitHub branch protection (see below).

---

## GitHub setup

### Create the repository

1. GitHub → **New repository** → `master-deck-alchemist` (private recommended)
2. Do **not** initialize with README, `.gitignore`, or license (history is pushed from Bitbucket)
3. Follow [docs/github-migration.md](./github-migration.md) to mirror branches and reconnect Vercel

### Branch protection (manual — dashboard)

1. GitHub → **Settings** → **Branches** → **Add branch protection rule**
2. Branch name pattern: **`master`**
   - Require a pull request before merging
   - Require status checks to pass: **Unit tests**, **Edge function tests**, **Lint** (and **Build** / **E2E** when enabled)
   - Do not allow bypassing the above settings
   - Restrict force pushes
3. Optional: add a lighter rule for **`develop`** (require PR, no direct pushes)

### CI workflows

The repo root `.github/workflows/` defines:

| Workflow | Triggers | Jobs |
|----------|----------|------|
| `ci.yml` | All PRs; pushes to `develop`, `master`, `feature/**`, `fix/**` | Unit, edge, lint; build + e2e on `develop`/`master` pushes |
| `a11y-ci.yml` | PRs and pushes to `develop` / `master` | Accessibility scans |

E2E runs only when `playwright.config.ts` exists on the branch.

### Default branch for new work

Set **`develop`** as the default branch for day-to-day PRs, or keep `master` as default but always target `develop` in feature PRs.

### Agent PR automation (`gh` CLI)

Install the [GitHub CLI](https://cli.github.com/) and authenticate once:

```bash
winget install GitHub.cli
gh auth login
```

Then PRs can be created from the terminal or Cursor agent:

```bash
gh pr create --base develop --head feature/my-change --title "feat: ..." --body "..."
```

---

## Vercel setup (Hobby)

Project: [master-deck-alchemist](https://vercel.com/brandondieselyakima-4396s-projects/master-deck-alchemist)

### 1. Confirm production branch

1. Vercel → Project → **Settings** → **Git**
2. **Production Branch**: `master`
3. Ensure GitHub repo `brandoman2580-hub/master-deck-alchemist` is connected

### 2. Staging via `develop` (no custom environment on Hobby)

On Hobby you only have **Production** and **Preview**. The `develop` branch acts as staging:

- Each push to `develop` triggers a Preview deployment
- Vercel assigns a **stable branch alias** (same URL across deploys), e.g.  
  `master-deck-alche-git-<hash>-brandondieselyakima-4396s-projects.vercel.app`
- Find it: **Deployments** → filter by branch `develop` → **Domains** on that deployment

Bookmark that URL as **staging**.

### 3. Environment variables

**Settings** → **Environment Variables**

| Variable | Preview (all) | Preview + branch `develop` | Production |
|----------|---------------|----------------------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dev project URL | Staging project URL (when ready) | Prod project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dev anon key | Staging anon key | Prod anon key |
| `NEXT_PUBLIC_CARD_IMAGE_BASE_URL` | Dev storage URL | Staging | Prod |
| `NEXT_PUBLIC_DISABLE_EXTERNAL_CARD_IMAGE_FALLBACK` | `true` | `true` | `true` |
| Server-only secrets | Preview scope | `develop` branch override | Production |

CLI examples (run from project root after `vercel link`):

```bash
# Production
vercel env add NEXT_PUBLIC_SUPABASE_URL production

# Staging-only override on develop branch
vercel env add NEXT_PUBLIC_SUPABASE_URL preview develop

# Pull staging vars locally
vercel pull --environment=preview --git-branch=develop
```

Until a dedicated Supabase staging project exists, staging can share the **dev** Supabase project with production using separate keys only when you split projects.

### 4. Safer production releases (recommended)

**Option A — Branch protection only (simplest on Hobby)**  
Merge to `master` only after staging QA. Each merge auto-deploys production.

**Option B — Promote instead of rebuild**  
1. Validate on staging deployment URL  
2. Promote that exact build to production (no rebuild):

```bash
vercel promote https://master-deck-alchemist-<deployment-id>.vercel.app
```

Use the deployment URL from the staging deployment you tested.

**Rollback:**

```bash
vercel rollback
# or rollback to a specific deployment:
vercel rollback <deployment-url-or-id>
```

### 5. When you upgrade to Vercel Pro

1. **Settings** → **Environments** → **Add Environment** → slug `staging`
2. Branch matcher: `equals` → `develop`
3. Copy env vars from Production, then override for staging
4. Optional: custom domain `staging.yourdomain.com`
5. Enable **Deployment Protection** on Production for approval gates

---

## Supabase setup

Today the app uses one dev project (`izshwywgfaozmisedwxm`). For proper isolation, use **three Supabase projects**:

| Tier | Supabase project | Used by |
|------|------------------|---------|
| Development | Existing dev project | Local `.env.local`, feature previews |
| Staging | New project (clone schema) | `develop` Vercel Preview |
| Production | New project | `master` Vercel Production |

### Create staging and production projects

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project**
2. Name e.g. `master-deck-alchemist-staging` and `master-deck-alchemist-prod`
3. Choose region close to users (same as dev if possible)
4. Save project refs and API keys

### Apply schema to each project

```bash
# Link CLI to target project (one at a time)
supabase link --project-ref <staging-or-prod-ref>

# Apply all migrations
supabase db push

# Verify
supabase migration list
```

Repeat for staging, then production. **Test on staging before production.**

### Edge Functions per environment

Deploy functions to each project:

```bash
supabase link --project-ref <project-ref>
supabase functions deploy deck-assistant
supabase functions deploy recommendation-agent
supabase functions deploy recommendation-feedback
# ... other functions in supabase/functions/
```

Set secrets per project in **Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**:

- `GROQ_API_KEY` (use separate keys per tier if Groq supports it)
- `MODEL_NAME` (optional)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### Auth and data

- **Staging**: seed test users and sample decks; safe for breaking changes
- **Production**: real user data; run migrations only after staging validation
- Configure **Auth redirect URLs** in each Supabase project for the matching Vercel URLs:
  - Staging: `https://<develop-branch-alias>.vercel.app/**`
  - Production: `https://master-deck-alchemist.vercel.app/**` (+ custom domain if added)

### Storage (card images)

If using `NEXT_PUBLIC_CARD_IMAGE_BASE_URL`, replicate or sync the `card-images` bucket to staging/prod, or run `npm run sync:card-images` against each project's credentials.

### Recommended rollout order

1. Keep local + feature previews on **dev** Supabase (current)
2. Create **staging** Supabase → link Vercel `develop` branch vars → QA
3. Create **production** Supabase → migrate prod data if needed → link Vercel Production vars
4. Cut over production only after staging passes full regression

---

## Local development

```bash
cp .env.example .env.local
# Fill with DEV Supabase keys — never production secrets on your machine unless debugging prod

npm run dev
```

Pull Vercel env for a specific tier:

```bash
vercel link   # once
vercel pull --environment=preview --git-branch=develop   # staging-like
vercel pull --environment=production                        # production (careful)
```

---

## Checklist: first staging deploy

- [ ] `develop` branch exists on GitHub
- [ ] GitHub Actions enabled; PR checks pass
- [ ] Branch protection on `master`
- [ ] Vercel production branch = `master`
- [ ] Staging branch alias bookmarked from first `develop` deploy
- [ ] Env vars set in Vercel (Preview + `develop` override when Supabase staging exists)
- [ ] Supabase Auth redirect URLs include staging + production URLs
- [ ] Edge functions deployed to target Supabase project(s)

---

## Related docs

- [github-migration.md](./github-migration.md) — Bitbucket → GitHub cutover steps
- [deployment-checklist.md](./deployment-checklist.md) — feature release verification
- [environment-variables.md](./environment-variables.md) — full env var reference
