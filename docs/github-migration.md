# Bitbucket → GitHub migration

One-time cutover guide for **master-deck-alchemist**. Complete these steps in order.

Replace `<GITHUB_OWNER>` with your GitHub user or org (this project uses **`brandoman2580-hub`**).

---

## 1. Create the GitHub repository

1. Open [github.com/new](https://github.com/new)
2. **Repository name:** `master-deck-alchemist`
3. **Visibility:** Private (recommended)
4. Leave **README**, **.gitignore**, and **license** unchecked
5. Click **Create repository**

---

## 2. Install GitHub CLI (optional but recommended)

Enables agent-driven PR creation from Cursor.

```powershell
winget install GitHub.cli
gh auth login
```

Choose: GitHub.com → HTTPS → Login with browser.

---

## 3. Push all branches and tags

From your local clone (after merging the migration PR or on `chore/migrate-bitbucket-to-github`):

```powershell
cd c:\Projects\master-deck-alchemist

# Add GitHub as a new remote (keep Bitbucket until cutover is verified)
git remote add github https://github.com/brandoman2580-hub/master-deck-alchemist.git

# Mirror all branches and tags
git push github --all
git push github --tags
```

Verify on GitHub that these branches exist:

- `master`
- `develop`
- `cursor/v2-workshop-alchemy-foundation`
- `fix/groq-gpt-oss-120b-migration`
- Any other active feature branches

---

## 4. Set default branch and protection

1. **Settings** → **General** → **Default branch** → set to `develop` (optional; matches day-to-day PR flow)
2. **Settings** → **Branches** → add protection for `master` (see [deployment-environments.md](./deployment-environments.md#github-setup))

---

## 5. Reconnect Vercel to GitHub

1. [Vercel project settings → Git](https://vercel.com/brandondieselyakima-4396s-projects/master-deck-alchemist/settings/git)
2. **Disconnect** Bitbucket (or delete and re-import the project)
3. **Import** `https://github.com/brandoman2580-hub/master-deck-alchemist`
4. Confirm **Production Branch** = `master`
5. Trigger a deploy from `develop` to confirm preview/staging still works

Environment variables are stored on Vercel and survive the Git provider switch.

---

## 6. Verify CI on GitHub

1. Open a test PR into `develop`
2. Confirm these checks run and pass:
   - **Unit tests**
   - **Edge function tests**
   - **Lint**
3. After merging to `develop`, confirm **Build** (and **E2E** if `playwright.config.ts` is on the branch)

---

## 7. Switch your local `origin` remote

Once GitHub is verified:

```powershell
git remote rename origin bitbucket
git remote rename github origin
git fetch origin
git branch -u origin/develop develop
```

Update any CI deploy keys or webhooks that pointed at Bitbucket.

---

## 8. Archive Bitbucket

1. Bitbucket → **Repository settings** → **Archive repository**
2. Add a note in the archived repo description:  
   `Moved to https://github.com/brandoman2580-hub/master-deck-alchemist`

---

## Troubleshooting

### `gh` not found after install

Restart the terminal or Cursor. On Windows, `winget` installs `gh` to PATH after a new shell session.

### E2E job skipped

Expected on branches without `playwright.config.ts` (e.g. `develop` before the workshop UI branch merges). The job runs automatically once Playwright is on `develop` or `master`.

### Vercel preview URLs changed

Preview URLs may change when reconnecting Git. Update Supabase Auth redirect URLs if you hard-coded old preview domains.

### Deno edge tests fail in CI

Ensure `denoland/setup-deno` runs before `npm run test:edge`. The workflow installs Deno automatically; no local Deno required for contributors.

---

## Related docs

- [deployment-environments.md](./deployment-environments.md) — branch flow, Vercel, Supabase
- [environment-variables.md](./environment-variables.md) — env var reference
