# Accessibility Quick Reference
## Master Deck Alchemist - Developer Checklist

### Before Committing Code

- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible (2px solid, 3:1 contrast)
- [ ] Images have alt text or `aria-hidden="true"`
- [ ] Forms have labels and error associations
- [ ] No new accessibility violations in automated scans
- [ ] ESLint a11y rules pass

---

## Common Patterns

### Buttons

```tsx
// Icon-only button
<button aria-label="Close dialog">
  <X className="h-4 w-4" aria-hidden="true" />
</button>

// Button with text
<Button onClick={handleClick}>
  Save Deck
</Button>
```

### Forms

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

### Modals

```tsx
// Use Radix UI Dialog (already accessible)
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogTitle>Title</DialogTitle>
    <DialogDescription>Description</DialogDescription>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Images

```tsx
// Decorative
<img src="/bg.png" alt="" aria-hidden="true" />

// Meaningful
<img src="/logo.svg" alt="Master Deck Alchemist logo" />

// Next.js Image
<Image src="/card.jpg" alt="Blue-Eyes White Dragon card" />
```

### Live Regions

```tsx
// For dynamic content (chat, notifications)
<div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
  {announcement}
</div>

// For errors
<div role="alert" aria-live="assertive">
  {errorMessage}
</div>
```

### Skip Link

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
>
  Skip to main content
</a>
```

---

## WCAG Quick Checks

| Criterion | Check | Tool |
|-----------|-------|------|
| 1.1.1 (Alt Text) | All images have alt | axe, ESLint |
| 1.4.3 (Contrast) | Text ≥4.5:1, UI ≥3:1 | WebAIM, Lighthouse |
| 2.1.1 (Keyboard) | All functions keyboard accessible | Manual |
| 2.1.2 (No Trap) | Can escape modals | jest-axe |
| 2.4.1 (Skip Links) | Skip link present | axe |
| 2.4.3 (Focus Order) | Tab order logical | Manual |
| 2.4.7 (Focus Visible) | Focus indicators visible | axe |
| 3.3.1 (Error ID) | Errors announced | jest-axe |
| 3.3.2 (Labels) | All inputs have labels | axe, ESLint |
| 4.1.2 (Name/Role) | ARIA attributes correct | axe |

---

## Testing Commands

```bash
# Run all accessibility scans
npm run a11y:scan

# Run jest-axe tests
npm run test:a11y

# Run ESLint a11y checks
npm run a11y:lint

# Run pa11y-ci
npm run a11y:pa11y
```

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)


