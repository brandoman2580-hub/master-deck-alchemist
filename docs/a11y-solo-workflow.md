# Accessibility Workflow for Solo Developer
## Master Deck Alchemist

This guide explains how to run accessibility scans, update baselines, and work with CI gating as a solo developer with Cursor assistance.

---

## How to Run Local Scans

### Quick Pre-commit Scan (Fast)

Run lightweight checks on changed files before committing:

```bash
# ESLint a11y checks only
npm run a11y:lint

# Jest-axe on changed components (if tests exist)
npm run test:a11y -- --findRelatedTests
```

**Time:** ~10-30 seconds

### Full Local Scan (Comprehensive)

Run complete accessibility audit locally:

```bash
# 1. Build the app
npm run build

# 2. Start server in background
npm run start &

# 3. Wait for server, then run scans
npm run a11y:scan

# Or use the convenience script (handles server lifecycle)
npm run a11y:scan-full
```

**Time:** ~2-5 minutes

**Output:** Reports saved to `reports/` directory:
- `pa11y-report.json` - Full page scans
- `jest-a11y-results.json` - Component unit tests
- `eslint-a11y-report.json` - Static analysis
- `.lighthouseci/` - Lighthouse reports

### Partial Scans (Component-specific)

Test a single component:

```bash
# Jest-axe for specific component
npm run test:a11y -- components/ui/login-form.test.tsx

# ESLint for specific file
npx eslint components/ui/login-form.tsx
```

---

## How CI Gating Works

### Baseline Comparison

CI compares current scan results against a **baseline** stored in the `baseline/` directory:

1. **Baseline Creation:** Run `npm run a11y:baseline` to capture current state
2. **CI Check:** On PR, CI runs `scripts/a11y-diff-check.js` which:
   - Loads baseline from `baseline/` directory
   - Compares current `reports/` to baseline
   - **Fails only on NEW Critical violations**
   - Allows existing violations (tracked in baseline)

### What Gets Blocked

- ❌ **NEW Critical violations** (impact: critical, type: error)
- ❌ **Regressions** (violations that were fixed but reappeared)
- ✅ Existing violations (in baseline) are allowed
- ✅ Warnings and Medium/Low violations are logged but don't block

### Updating the Baseline

When you fix violations or accept known issues:

```bash
# 1. Run full scan
npm run a11y:scan-full

# 2. Review reports in reports/ directory
cat reports/pa11y-report.json | jq '.[] | .issues[] | select(.type == "error")'

# 3. If acceptable, update baseline
npm run a11y:baseline

# 4. Commit baseline files
git add baseline/
git commit -m "chore: update a11y baseline"
```

**Important:** Only update baseline after:
- Fixing violations, OR
- Documenting suppressions in `.a11y-ignore.json`

---

## How to Update Baselines

### Initial Baseline Setup

First time setup:

```bash
# 1. Generate component inventory
npm run a11y:inventory

# 2. Run full scan
npm run a11y:scan-full

# 3. Create baseline directory
mkdir -p baseline

# 4. Copy current reports as baseline
cp reports/pa11y-report.json baseline/pa11y-baseline.json
cp reports/jest-a11y-results.json baseline/jest-a11y-baseline.json
cp reports/lighthouse-a11y.json baseline/lighthouse-a11y-baseline.json 2>/dev/null || true

# 5. Commit baseline
git add baseline/
git commit -m "chore: initial a11y baseline"
```

### Updating After Fixes

After fixing accessibility issues:

```bash
# 1. Fix violations in code
# ... make changes ...

# 2. Verify fixes locally
npm run a11y:scan-full

# 3. Update baseline
npm run a11y:baseline

# 4. Commit both fixes and baseline
git add .
git commit -m "fix(a11y): resolve login form errors + update baseline"
```

### Handling False Positives

For violations that are false positives or acceptable:

1. **Document in `.a11y-ignore.json`:**
```json
{
  "suppressions": [
    {
      "component": "components/ui/card-preview.tsx",
      "rule": "color-contrast",
      "tool": "axe",
      "reason": "Manually verified: 4.6:1 contrast meets WCAG AA",
      "owner": "developer",
      "expiry": "2024-12-31",
      "wcag_criteria": ["1.4.3"]
    }
  ]
}
```

2. **Update baseline to include the violation:**
```bash
npm run a11y:baseline
```

3. **Commit both:**
```bash
git add .a11y-ignore.json baseline/
git commit -m "chore(a11y): document color-contrast suppression"
```

---

## Workflow Summary

### Daily Development

1. **Before committing:**
   ```bash
   npm run a11y:lint  # Quick check
   ```

2. **After making a11y changes:**
   ```bash
   npm run a11y:scan-full  # Verify fixes
   npm run a11y:baseline   # Update if needed
   ```

### Weekly Review

1. **Review baseline violations:**
   ```bash
   cat baseline/pa11y-baseline.json | jq '.[] | .issues[] | select(.type == "error")'
   ```

2. **Plan fixes for high-priority items**

3. **Update inventory:**
   ```bash
   npm run a11y:inventory
   ```

### CI Integration

- **PRs:** Automatically run diff check
- **Nightly:** Full scan, update baseline if needed
- **Manual:** Trigger via `workflow_dispatch` in GitHub Actions

---

## Troubleshooting

### CI Fails on "New Critical Violations"

1. Check what's new:
   ```bash
   node scripts/a11y-diff-check.js
   ```

2. Fix violations or update baseline:
   ```bash
   npm run a11y:baseline
   ```

### Baseline Out of Sync

If baseline doesn't match current state:

```bash
# Regenerate baseline from current reports
npm run a11y:baseline -- --force
```

### Server Won't Start in CI

Check that `wait-on` is installed:
```bash
npm install --save-dev wait-on start-server-and-test
```

---

## Quick Reference

| Command | Purpose | Time |
|---------|---------|------|
| `npm run a11y:lint` | Quick ESLint check | ~10s |
| `npm run a11y:scan` | Full scan (server must be running) | ~2-5m |
| `npm run a11y:scan-full` | Build + start + scan | ~3-6m |
| `npm run a11y:baseline` | Update baseline from reports | ~1s |
| `npm run a11y:inventory` | Regenerate component inventory | ~5s |
| `node scripts/a11y-diff-check.js` | Compare to baseline | ~1s |

---

**See full plan:** `docs/a11y-audit-remediation-plan.md`

