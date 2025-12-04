# WCAG 2.1 AA Accessibility Audit & Remediation Plan
## Master Deck Alchemist Frontend (Solo Developer Workflow)

---

## Executive Summary

This plan provides a systematic approach to audit and remediate the Master Deck Alchemist Next.js + Tailwind CSS + Supabase frontend to achieve **WCAG 2.1 AA compliance**. Optimized for a **solo developer workflow with Cursor assistance**. The scope includes all public-facing UI components, authentication flows, deck builder interface, and admin dashboard features. Deliverables include an automated component inventory, baseline-based CI gating, prioritized remediation backlog, and verification reports. Timeline: 6–8 weeks with critical items (authentication, forms, navigation) completed in the first 2 weeks.

---

## 1. Component Inventory & Prioritization

### Automated Inventory Generation

**Script:** `scripts/generate-a11y-inventory.ts` (uses `fast-glob`)

**Run:**
```bash
npm run a11y:inventory
```

**Output:** `a11y-inventory.json` (JSON array, not CSV)

**Schema:**
```typescript
interface ComponentRecord {
  component_name: string;        // PascalCase component name
  path: string;                  // Relative path from repo root
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  state: 'untested' | 'in-progress' | 'fixed' | 'verified';
  notes: string;                 // Remediation notes
  wcag_criteria_violations: string[];  // Array of WCAG criteria (e.g., ["3.3.1", "4.1.3"])
  baseline_violations: string[];      // Violations present in baseline
  last_scan_sha: string | null;        // Git SHA of last scan
}
```

**Workflow:**
1. Run `npm run a11y:inventory` to generate/update inventory
2. Review `a11y-inventory.json`
3. Update `state`, `notes`, `wcag_criteria_violations` as you work
4. Commit inventory updates with code changes

**Priority Classification:**
- **Critical:** Authentication, forms, navigation, modals
- **High:** Interactive components, search, filters, chatbot
- **Medium:** Display components, cards, lists, tabs
- **Low:** Decorative elements, animations, loading states

**Note:** Radix UI components (Dialog, Select, DropdownMenu, Tabs) are marked as "Low effort" - verify with jest-axe, minimal manual testing needed.

---

## 2. Automated Scanning Strategy

### Tool Setup

**Install dependencies:**
```bash
npm install --save-dev jest-axe @axe-core/react cypress-axe axe-playwright @lhci/cli pa11y-ci eslint-plugin-jsx-a11y wait-on start-server-and-test fast-glob
```

### Tool Configurations

**1. jest-axe** (Component unit tests)

**Jest Setup** (`jest.setup.js`):
```javascript
import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);
```

**Example:** See `__tests__/a11y/login-form.test.tsx`

**2. pa11y-ci** (Full page scans)

**Configuration** (`.pa11yci.json`):
```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 10000,
    "wait": 1000
  },
  "urls": [
    "http://localhost:3000",
    "http://localhost:3000/deck-builder",
    "http://localhost:3000/saved-decks"
  ]
}
```

**3. Lighthouse CI**

**Configuration** (`.lighthouserc.js`):
```javascript
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000', 'http://localhost:3000/deck-builder'],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
```

**4. eslint-plugin-jsx-a11y**

**ESLint Config** (`.eslintrc.json`):
```json
{
  "extends": ["next/core-web-vitals", "plugin:jsx-a11y/recommended"],
  "plugins": ["jsx-a11y"],
  "rules": {
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/anchor-is-valid": "error",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-proptypes": "error",
    "jsx-a11y/aria-unsupported-elements": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    "jsx-a11y/role-supports-aria-props": "error"
  }
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "a11y:inventory": "tsx scripts/generate-a11y-inventory.ts",
    "a11y:lint": "eslint . --ext .ts,.tsx --format json --output-file reports/eslint-a11y-report.json",
    "a11y:scan": "npm run a11y:axe && npm run a11y:pa11y && npm run a11y:lighthouse",
    "a11y:axe": "jest --testPathPattern=a11y --json --outputFile=reports/jest-a11y-results.json",
    "a11y:pa11y": "pa11y-ci --json > reports/pa11y-report.json",
    "a11y:lighthouse": "lhci autorun",
    "a11y:scan-full": "npm run build && npx start-server-and-test start http://localhost:3000 30000 'npm run a11y:scan'",
    "a11y:baseline": "mkdir -p baseline && cp reports/pa11y-report.json baseline/pa11y-baseline.json 2>/dev/null || true && cp reports/jest-a11y-results.json baseline/jest-a11y-baseline.json 2>/dev/null || true",
    "test:a11y": "jest --testPathPattern=a11y"
  }
}
```

### Baseline & Diff Gating

**Script:** `scripts/a11y-diff-check.js`

**How it works:**
1. Compares current `reports/` to `baseline/` directory
2. Fails only on **NEW Critical violations** (not in baseline)
3. Allows existing violations (tracked in baseline)
4. Produces concise summary

**Update baseline:**
```bash
# After fixing violations or accepting known issues
npm run a11y:scan-full
npm run a11y:baseline
git add baseline/
git commit -m "chore: update a11y baseline"
```

**See:** `docs/a11y-solo-workflow.md` for detailed workflow.

---

## 3. Manual Testing Strategy

### Keyboard-Only Walkthrough

**Checklist:**
- [ ] Tab order follows visual/logical flow
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible (2px solid, 3:1 contrast)
- [ ] Skip link present and functional
- [ ] No keyboard traps (Esc closes modals/dropdowns)
- [ ] Arrow keys work in menus/selects
- [ ] Enter/Space activate buttons/links

### Screen Reader Testing

**NVDA (Windows):**
1. Download from nvaccess.org
2. Test with Chrome/Firefox
3. Navigate: Login → Deck Builder → Add Card → Save Deck

**VoiceOver (macOS/iOS):**
1. Enable: System Preferences → Accessibility → VoiceOver
2. Test with Safari
3. Verify landmark regions, button purposes, form labels, error announcements

**TalkBack (Android):**
1. Enable: Settings → Accessibility → TalkBack
2. Test on real device or Android emulator (API 30+)
3. Swipe right to navigate, double-tap to activate
4. Verify: All interactive elements announced, button purposes clear, form labels announced
5. **Time:** ~15 minutes per page

### Contrast Testing

**Tools:** WebAIM Contrast Checker, axe DevTools, Chrome DevTools

**Process:**
1. Extract color pairs from Tailwind config
2. Check: Normal text ≥4.5:1, Large text ≥3:1, UI components ≥3:1
3. Test in light and dark modes

### Mobile/Zoom Testing

**Requirements:**
- Content reflows at 200% zoom (no horizontal scrolling)
- Touch targets ≥44×44px
- Text readable without zooming
- No content loss at 320px viewport width

**Test:** Chrome DevTools → Device toolbar → 200% zoom, viewport widths: 320px, 375px, 768px, 1024px

---

## 4. Remediation Guidelines & Patterns

### Prioritized Backlog

**Week 1–2 (Critical):**
1. Add skip link (WCAG 2.4.1) - **Automatable**
2. Fix form labels and error associations (WCAG 3.3.1, 4.1.3) - **Automatable**
3. Implement focus management (WCAG 2.1.2, 2.4.3) - **Hybrid**
4. Add ARIA labels to icon-only buttons (WCAG 4.1.2) - **Automatable**
5. Ensure keyboard navigation (WCAG 2.1.1) - **Hybrid**

**Week 3–4 (High):**
6. Add live regions for async updates (WCAG 4.1.3) - **Hybrid**
7. Fix contrast ratios (WCAG 1.4.3) - **Automatable**
8. Add heading hierarchy (WCAG 2.4.6) - **Automatable**
9. Implement focus visible indicators (WCAG 2.4.7) - **Automatable**
10. Add alt text to images (WCAG 1.1.1) - **Automatable**

**See:** `docs/a11y-remediation-mapping.md` for full WCAG criteria → Automatable/Manual/Hybrid mapping.

### Code Examples

**Accessible Form:**
```tsx
<div>
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    aria-required="true"
    aria-invalid={!!error}
    aria-describedby={error ? "email-error" : undefined}
  />
  {error && (
    <div id="email-error" role="alert" aria-live="polite">
      {error}
    </div>
  )}
</div>
```

**Icon-Only Button:**
```tsx
<button aria-label="Send message">
  <Send className="h-5 w-5" aria-hidden="true" />
</button>
```

**Skip Link:**
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4">
  Skip to main content
</a>
<main id="main-content" tabIndex={-1}>...</main>
```

**See:** Test files for complete examples.

---

## 5. Next.js + Tailwind + Supabase Specifics

### Focus Management

**Component:** `app/(lib)/FocusManager.tsx`

**Usage:** Add to `app/layout.tsx`:
```tsx
import { FocusManager } from './(lib)/FocusManager';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <FocusManager />
        {children}
      </body>
    </html>
  );
}
```

**Behavior:**
- Focuses `<main>` only after client navigation (not initial load)
- Only focuses if `document.activeElement === document.body` (avoids stealing focus from modals)
- Skips when modals/overlays are open (detects `data-state="open"`)

### Supabase Realtime & Live Regions

**Note:** Verify `@supabase/supabase-js` version supports `.channel(...).on('postgres_changes', ...)`. If not, use fallback API.

**Debounced Live Region (prevents AT flooding):**
```tsx
function AIChatbot() {
  const [announcement, setAnnouncement] = useState('');
  const debounceRef = useRef<NodeJS.Timeout>();

  const announce = (message: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAnnouncement(message);
    debounceRef.current = setTimeout(() => setAnnouncement(''), 5000);
  };

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
        {announcement}
      </div>
      {/* Chat UI */}
    </>
  );
}
```

**Fallback API (if realtime not available):**
```tsx
// Polling fallback
useEffect(() => {
  const interval = setInterval(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(1);
    if (data && data[0]) {
      announce(`New message: ${data[0].content.substring(0, 50)}...`);
    }
  }, 5000);
  return () => clearInterval(interval);
}, []);
```

### Form Validation with Supabase

**Server errors → Accessible client errors:**
```tsx
const { error } = await supabase.auth.signUp({ email, password });
if (error) {
  if (error.message.includes('email')) {
    setErrors(prev => ({ ...prev, email: error.message }));
  } else {
    setSubmitError(error.message);
  }
}
```

---

## 6. Testing & Verification

### Automated Test Examples

**See:**
- `__tests__/a11y/login-form.test.tsx` (jest-axe)
- `cypress/e2e/a11y.spec.ts` (Cypress + axe)
- `e2e/a11y.spec.ts` (Playwright + axe-playwright)

**Recommendation:** Use Playwright for keyboard flow + headless checks (better for solo dev workflow).

### Manual Verification Checklist

**Per Component:**
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Focus indicators visible
- [ ] Error messages announced immediately
- [ ] No keyboard traps
- [ ] Color contrast meets 4.5:1 (text) or 3:1 (UI)
- [ ] Text alternatives for images/icons
- [ ] Heading hierarchy logical
- [ ] Landmark regions present

**Sign-off:**
- **Critical:** All automated tests pass, manual keyboard/screen reader complete, zero Critical violations
- **High:** Automated pass, manual complete, ≤2 High violations
- **Medium:** Automated pass, basic manual, ≤5 Medium violations
- **Low:** Automated pass, visual inspection

---

## 7. CI/CD and Quality Gates

### GitHub Actions Workflow

**File:** `.github/workflows/a11y-ci.yml`

**Features:**
- Uses `start-server-and-test` (no sleep-based waits)
- Downloads baseline artifacts
- Runs `scripts/a11y-diff-check.js` for diff gating
- Fails only on NEW Critical violations
- Uploads reports as artifacts

**See:** `.github/workflows/a11y-ci.yml` for full implementation.

### False Positive Handling

**File:** `.a11y-ignore.json`

**Format:**
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

**Process:**
1. Document in `.a11y-ignore.json`
2. Update baseline: `npm run a11y:baseline`
3. Commit both files

---

## 8. Developer Ergonomics & Prevention

### Pre-commit Hooks

**Husky + lint-staged:**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "bash -c 'npm run test:a11y -- --findRelatedTests --bail'"
    ]
  }
}
```

**Workflow:**
- Pre-commit: ESLint + lightweight jest-axe on changed files
- CI: Full scans with baseline comparison

### Radix UI Components

**Low Effort:** Components using Radix UI primitives are mostly accessible by default:
- `Dialog` - Focus trap, aria-modal handled
- `Select` - Keyboard navigation, ARIA roles handled
- `DropdownMenu` - Keyboard support handled
- `Tabs` - ARIA roles, keyboard navigation handled

**Action:** Verify with jest-axe, minimal manual testing needed.

### PR Template

**`.github/pull_request_template.md`:**
```markdown
## Accessibility Checklist
- [ ] All new components tested with `jest-axe`
- [ ] Keyboard navigation verified
- [ ] Screen reader tested (NVDA/VoiceOver/TalkBack)
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Images have alt text or `aria-hidden="true"`
- [ ] Forms have labels and error associations
- [ ] No new accessibility violations in pa11y report
- [ ] ESLint a11y rules pass
```

---

## 9. Deliverables & Timeline

### Deliverable List

| Deliverable | Effort | Due Date |
|-------------|--------|----------|
| Component inventory JSON | 0.5 day | Week 1, Day 1 |
| Automated scanning setup | 1 day | Week 1, Day 2 |
| Baseline creation | 0.5 day | Week 1, Day 2 |
| Critical fixes (Week 1–2) | 10 days | Week 2, Day 5 |
| High priority fixes (Week 3–4) | 10 days | Week 4, Day 5 |
| Medium priority fixes (Week 5–6) | 10 days | Week 6, Day 5 |
| Low priority fixes (Week 7–8) | 5 days | Week 8, Day 3 |
| Verification report | 2 days | Week 8, Day 5 |
| Documentation | 1 day | Week 8, Day 5 |

### Ticket Template

**`.github/ISSUE_TEMPLATE/a11y-fix.md`:**
```markdown
## Component
<!-- e.g., components/ui/login-form.tsx -->

## Priority
<!-- Critical / High / Medium / Low -->

## WCAG Violations
<!-- e.g., 3.3.1, 4.1.3 -->

## Acceptance Criteria
- [ ] Component passes `jest-axe` tests
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] No violations in pa11y report
- [ ] Manual testing complete

## Labels
`a11y` `wcag-2.1-aa` `priority:high`
```

---

## 10. Top 10 Quick Fixes

1. **Add skip link** (WCAG 2.4.1) - Add `<SkipLink />` to `app/layout.tsx`
2. **Fix icon-only buttons** (WCAG 4.1.2) - Add `aria-label`
3. **Associate form labels** (WCAG 3.3.2) - Use `<label htmlFor>`
4. **Add error associations** (WCAG 3.3.1) - Use `aria-describedby`
5. **Fix focus indicators** (WCAG 2.4.7) - Ensure `focus-visible:ring-2`
6. **Add alt text** (WCAG 1.1.1) - All images need alt or `aria-hidden="true"`
7. **Fix heading hierarchy** (WCAG 2.4.6) - Ensure h1 → h2 → h3
8. **Add aria-live** (WCAG 4.1.3) - For dynamic content
9. **Ensure keyboard escape** (WCAG 2.1.2) - Esc closes modals
10. **Check contrast** (WCAG 1.4.3) - Text ≥4.5:1, UI ≥3:1

---

## 11. Resources & References

- **WCAG 2.1 Quick Reference:** https://www.w3.org/WAI/WCAG21/quickref/
- **WebAIM Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **axe DevTools:** https://www.deque.com/axe/devtools/
- **ARIA Authoring Practices:** https://www.w3.org/WAI/ARIA/apg/
- **Solo Workflow Guide:** `docs/a11y-solo-workflow.md`
- **Remediation Mapping:** `docs/a11y-remediation-mapping.md`
- **Quick Reference:** `docs/a11y-quick-reference.md`

---

**Document Version:** 2.0 (Solo Developer Optimized)  
**Last Updated:** 2024-01-XX  
**Next Review:** After Week 4 milestone
