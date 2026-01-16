# Deck Improvement Explorer - Quick Reference Guide

## One-Page Overview

### Feature Purpose
Transform the chatbot into a **premium interface** for exploring 5 deck improvement areas: **Consistency**, **ATK Power**, **Defense**, **Meta**, and **Synergies**.

---

## The 5 Improvement Areas

| Area | Focus | Example Questions | Key Cards |
|------|-------|-------------------|-----------|
| 🎯 **Consistency** | Reduce bricking, deck flow | "How do I reduce bricking?" | Pot of Desires, Small World |
| ⚡ **ATK Power** | Offensive power, OTK | "Increase my monster ATK?" | Blue-Eyes Chaos MAX, Boss Monsters |
| 🛡️ **Defense** | Interruptions, protection | "Hand traps to add?" | Ash Blossom, Infinite Impermanence |
| 🎲 **Meta** | Counter current threats | "Counter Kashtira?" | Format-specific techs |
| ✨ **Synergies** | Hidden support, budget | "Hidden synergies?" | Generic support, cheaper alternatives |

---

## Design System At a Glance

### Colors
```
Primary Action:  #00d9ff (Cyan)
Success:         #10b981 (Green)
Warning:         #ff9500 (Orange)
Error:           #ef4444 (Red)
Background:      #0f1419 (Dark)
Text Primary:    #f8f9fa (White)
Text Secondary:  #b0b8c0 (Gray)
Glass:           rgba(255,255,255,0.05-0.08)
```

### Spacing (Tailwind)
- xs: 0.25rem | sm: 0.5rem | md: 1rem | lg: 1.5rem | xl: 2rem

### Radius
- sm: 0.5rem | md: 0.75rem | lg: 1rem | xl: 1.5rem | full: 9999px

### Animations
- Fast: 150ms | Base: 300ms | Slow: 500ms
- Easing: `easeOut` for entrance, `easeInOut` for hover

---

## Layout Structure

```
┌─────────────────────────────────────────────────┐
│ Header (Compact)                                │  40px
├─────────────────────────────────────────────────┤
│ [📊] [⚡] [🛡️] [🎯] [✨]  Quick Actions Bar  │  48px (sticky)
├─────────────────────────────────────────────────┤
│                                                 │
│                 MESSAGE AREA                    │  flex-1 (scrollable)
│          (user right, bot left)                 │
│                                                 │
│ ┌─ RECOMMENDATION CAROUSEL ─────────────────┐  │
│ │ [Card] [Card] [Card]  (drag, momentum)    │  │
│ └─────────────────────────────────────────────┘  │
│                                                 │
├─────────────────────────────────────────────────┤
│ [Suggestion Pill] [Suggestion Pill]            │  48px
│ Input: "Ask about your deck..." [Send]         │  56px
└─────────────────────────────────────────────────┘
```

---

## Component Quick Reference

### Message Bubbles
```tsx
// User Message (Right)
<UserMessage 
  content="How do I improve consistency?"
  timestamp={new Date()}
/>

// Bot Message (Left, with icon)
<BotMessage 
  content="Here are consistency improvements..."
  type="suggestion"  // standard | suggestion | success | error
/>
```

### Recommendation Card
```tsx
<RecommendationCard
  card={card}
  synergy={0.85}          // 0-1 scale
  reason="Improves draw"
  impact={0.7}            // Expected improvement
  onAdd={() => {}}
  onPreview={() => {}}
/>
```

### Quick Actions Bar
```tsx
<QuickActionsBar
  activeAction="consistency"
  onActionClick={(action) => {}}
/>
```

### Input Area
```tsx
<ChatInput
  onSend={(message) => {}}
  activeArea="consistency"
  disabled={false}
/>
```

---

## Animation Timing Cheat Sheet

| Interaction | Duration | Easing | Details |
|-------------|----------|--------|---------|
| Message enter | 300-400ms | easeOut | Fade + slide up |
| Card enter | 400ms | cubic-bezier(0.34, 1.56, 0.64, 1) | Spring-like |
| Card stagger | +50ms per card | - | Creates cascade |
| Hover effect | 150ms | easeOut | Subtle lift |
| Button press | 100ms | easeOut | Quick feedback |
| Input focus | 200ms | easeOut | Ring highlight |
| Carousel drag | Momentum | - | Inertial scrolling |

---

## Color Usage Guide

### For Different States

**Active/Selected**
- Use primary cyan with border: `border-cyan-500/50`
- Increase background opacity: `bg-white/[0.12]`

**Hover**
- Subtle scale: `scale-1.05`
- Slight elevation: `y: -2px`
- Glow effect (optional): `shadow-lg`

**Disabled**
- Reduce opacity: `opacity-50`
- Cursor: `cursor-not-allowed`
- Gray text: `text-white/40`

**Loading**
- Use pulse animation
- Skeleton background: `glass animate-pulse`
- Avoid hiding content

**Success**
- Green accent: `text-green-400`
- Checkmark icon
- Brief confirmation message

**Error**
- Red accent: `text-red-400`
- Alert icon
- Clear error message with solution

---

## Responsive Breakpoints

| Screen | Width | Layout | Focus |
|--------|-------|--------|-------|
| Mobile | < 640px | Full-width cards, vertical | Touch-friendly (44px targets) |
| Tablet | 640-1024px | 2-column, balanced | Flexible layout |
| Desktop | > 1024px | Optimal, multi-column | Keyboard shortcuts |

---

## Key Framer Motion Patterns

### Entrance (Messages)
```tsx
initial={{ opacity: 0, y: 10, scale: 0.95 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
transition={{ duration: 0.3, ease: 'easeOut' }}
```

### Card Stagger
```tsx
variants={{
  visible: (custom) => ({
    opacity: 1,
    y: 0,
    transition: { delay: custom * 0.08 },
  })
}}
```

### Hover Lift
```tsx
whileHover={{ y: -4, scale: 1.05 }}
whileTap={{ scale: 0.95 }}
```

### Carousel
```tsx
drag="x"
dragElastic={0.2}
dragMomentum={{
  power: 0.8,
  timeConstant: 200,
  restDelta: 10,
}}
```

---

## Glassmorphism Quick Setup

```css
/* Base Glass */
.glass {
  @apply backdrop-blur-md bg-white/[0.04] border border-white/10 rounded-xl;
}

/* Elevated Glass */
.glass-elevated {
  @apply backdrop-blur-xl bg-white/[0.08] border border-white/15;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05),
              0 8px 32px rgba(0, 0, 0, 0.1);
}

/* Dark Glass (for cards) */
.glass-dark {
  @apply backdrop-blur-md bg-slate-950/40 border border-white/5;
}

/* Input Glass */
.glass-input {
  @apply glass-elevated px-4 py-3 text-white placeholder:text-white/40;
  @apply focus:outline-none focus:ring-2 focus:ring-cyan-500/50;
}
```

---

## Icon Reference (lucide-react)

| Use Case | Icon |
|----------|------|
| Bot message | `<Bot className="h-5 w-5" />` |
| Suggestions | `<Sparkles />` |
| Add action | `<Plus />` |
| Preview | `<Eye />` |
| Send | `<Send />` |
| Success | `<Check />` |
| Error | `<AlertCircle />` |
| Loading | `<Loader2 className="animate-spin" />` |
| Consistency | `<TrendingUp />` |
| Power | `<Zap />` |
| Defense | `<Shield />` |
| Target | `<Target />` |
| Info | `<Info />` |

---

## File Structure

```
📁 components/ui/
  ├── chat-message-user.tsx
  ├── chat-message-bot.tsx
  ├── quick-action-button.tsx
  ├── recommendation-card.tsx
  ├── recommendation-carousel.tsx
  ├── chat-input.tsx
  ├── synergy-badge.tsx
  └── chat-skeleton.tsx

📁 lib/
  ├── animations/
  │   └── chatbot.ts (Framer Motion variants)
  └── api/
      └── improvementSuggestions.ts

📁 supabase/functions/
  ├── improvement-suggestions/
  └── recommendation-agent/ (enhanced)

📁 docs/
  ├── deck-improvement-exploration-plan.md
  ├── chatbot-ui-design-upgrade.md
  ├── chatbot-component-patterns.md
  ├── chatbot-design-references.md
  ├── DECK-IMPROVEMENT-EXPLORER-SUMMARY.md
  └── QUICK-REFERENCE.md (this file)
```

---

## Accessibility Checklist

- [ ] Color contrast > 4.5:1 (WCAG AA)
- [ ] Touch targets > 44px
- [ ] Keyboard navigation working
- [ ] Focus indicators visible
- [ ] `prefers-reduced-motion` respected
- [ ] ARIA labels on interactive elements
- [ ] Form labels associated with inputs
- [ ] Error messages linked to fields
- [ ] Screen reader tested

---

## Performance Checklist

- [ ] All animations use `transform` + `opacity` only
- [ ] Images lazy loaded
- [ ] Components code-split where applicable
- [ ] Memoization applied to expensive renders
- [ ] 60fps animation target
- [ ] Lighthouse score > 80
- [ ] Mobile load time < 3s
- [ ] No layout shifts during animations

---

## Testing Scenarios

### Scenario 1: First Time User
1. Opens chatbot → sees quick action buttons
2. Clicks "Consistency" → suggestions appear
3. Asks question → gets card recommendations
4. Clicks "Add to Deck" → confirmation

### Scenario 2: Experienced User
1. Opens chatbot → clicks "Meta"
2. Asks for meta counters
3. Receives counter recommendations
4. Drags cards to compare in carousel
5. Adds multiple cards efficiently

### Scenario 3: Mobile User
1. Opens on 375px width → layout adjusts
2. Taps quick action button → large target works
3. Scrolls carousel → smooth momentum scroll
4. Types in input → keyboard friendly
5. Taps send → receives response

---

## Common Patterns

### Staggered Entrance
```tsx
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: index * 0.08 }}
```

### Conditional Glass Effect
```tsx
className={`${isActive ? 'glass-elevated' : 'glass'}`}
```

### Button Feedback
```tsx
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
```

### Smooth Scroll Container
```tsx
<motion.div
  className="overflow-x-auto scrollbar-hide"
  drag="x"
  dragElastic={0.2}
>
  {/* Cards */}
</motion.div>
```

---

## Quick Win Ideas

1. **Skeleton Loading** - Show card placeholders while loading
2. **Success Animation** - Bounce when card added successfully
3. **Error Shake** - Shake input on validation error
4. **Typing Indicator** - Dots animation while bot responds
5. **Gesture Feedback** - Haptic feedback on mobile actions
6. **Message Reactions** - 👍 👎 buttons on recommendations
7. **Card Flip Sound** - Subtle audio on card reveal
8. **Confetti on Deck Saved** - Celebration animation

---

## Design Token Exports

Create `lib/design-tokens.ts`:

```typescript
export const tokens = {
  colors: {
    cyan: '#00d9ff',
    success: '#10b981',
    warning: '#ff9500',
    error: '#ef4444',
  },
  spacing: [0.25, 0.5, 1, 1.5, 2],
  radius: [0.5, 0.75, 1, 1.5],
  transitions: { fast: 150, base: 300, slow: 500 },
};
```

---

## Support & References

- **Design**: `chatbot-ui-design-upgrade.md`
- **Components**: `chatbot-component-patterns.md`
- **Backend**: `deck-improvement-exploration-plan.md`
- **Inspiration**: `chatbot-design-references.md`
- **Full Overview**: `DECK-IMPROVEMENT-EXPLORER-SUMMARY.md`

---

**Status**: Ready to Implement  
**Priority**: HIGH - Flagship Feature  
**Estimated Timeline**: 4 Weeks  
**Team Size**: 3-4 developers
