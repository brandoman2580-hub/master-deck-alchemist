# Animation Quick Reference Guide

## Animation Utilities Location
All animation utilities are located in `lib/animations/`

## Common Animation Patterns

### Fade In
```tsx
import { motion } from 'framer-motion';
import { fadeInVariants } from '@/lib/animations/variants';

<motion.div
  initial="hidden"
  animate="visible"
  variants={fadeInVariants}
>
  Content
</motion.div>
```

### Slide In
```tsx
import { slideInVariants } from '@/lib/animations/variants';

<motion.div
  initial="hidden"
  animate="visible"
  variants={slideInVariants('left')}
>
  Content
</motion.div>
```

### Stagger Children
```tsx
import { staggerContainer, fadeInUp } from '@/lib/animations/variants';

<motion.div
  variants={staggerContainer}
  initial="hidden"
  animate="visible"
>
  {items.map((item) => (
    <motion.div key={item.id} variants={fadeInUp}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

### Page Transition
```tsx
import { pageTransition } from '@/lib/animations/transitions';

<motion.div
  initial="initial"
  animate="animate"
  exit="exit"
  variants={pageTransition}
>
  Page Content
</motion.div>
```

### Hover Effect
```tsx
<motion.div
  whileHover={{ scale: 1.02, y: -2 }}
  whileTap={{ scale: 0.98 }}
  className="transition-shadow duration-200 hover:shadow-lg"
>
  Interactive Element
</motion.div>
```

## Animation Durations

- **Instant**: 100ms - Immediate feedback (button clicks)
- **Fast**: 200ms - Quick transitions (tab switches)
- **Normal**: 300ms - Standard transitions (modals)
- **Slow**: 500ms - Deliberate transitions (page changes)
- **Slower**: 800ms - Dramatic transitions (rare)

## Easing Functions

- **smooth**: `[0.4, 0, 0.2, 1]` - Standard smooth easing
- **elegant**: `[0.25, 0.1, 0.25, 1]` - Elegant, refined easing
- **gentle**: `[0.2, 0, 0, 1]` - Gentle, subtle easing
- **bounce**: `[0.68, -0.55, 0.265, 1.55]` - Playful bounce (use sparingly)

## Common Variants

### Fade Variants
- `fadeInVariants` - Simple fade in
- `fadeInUpVariants` - Fade in from bottom
- `fadeInDownVariants` - Fade in from top
- `fadeInLeftVariants` - Fade in from left
- `fadeInRightVariants` - Fade in from right

### Scale Variants
- `scaleInVariants` - Scale from center
- `scaleUpVariants` - Scale from bottom
- `scaleDownVariants` - Scale from top

### Slide Variants
- `slideInLeftVariants` - Slide from left
- `slideInRightVariants` - Slide from right
- `slideInUpVariants` - Slide from bottom
- `slideInDownVariants` - Slide from top

### Stagger Variants
- `staggerContainer` - Container for staggered children
- `staggerItem` - Individual staggered item

## Performance Tips

1. **Always use `transform` and `opacity`** - GPU accelerated
2. **Avoid animating layout properties** - width, height, top, left
3. **Use `will-change` sparingly** - Only when animation is about to start
4. **Remove `will-change` after animation** - Prevents memory issues
5. **Debounce rapid state changes** - Prevents animation conflicts

## Accessibility

### Reduced Motion
```tsx
import { useReducedMotion } from '@/hooks/useReducedMotion';

const shouldReduceMotion = useReducedMotion();

<motion.div
  animate={shouldReduceMotion ? {} : { scale: 1.1 }}
>
  Content
</motion.div>
```

### Focus States
Always maintain visible focus indicators during animations.

## Common Issues & Solutions

### Issue: Animation conflicts with drag-and-drop
**Solution**: Use `AnimatePresence` with proper `key` props, coordinate with @dnd-kit

### Issue: Layout shift during animation
**Solution**: Reserve space with fixed dimensions or use `layout` prop

### Issue: Animation lags on scroll
**Solution**: Use `IntersectionObserver` to trigger animations only when visible

### Issue: Multiple animations conflict
**Solution**: Use animation coordinator or queue system

## Testing Checklist

Before deploying animations:
- [ ] Test on Chrome, Firefox, Safari, Edge
- [ ] Test on mobile devices (iOS, Android)
- [ ] Test with `prefers-reduced-motion: reduce`
- [ ] Test with slow 3G connection
- [ ] Test with keyboard navigation
- [ ] Test with screen reader
- [ ] Verify no layout shift (CLS)
- [ ] Check FPS during animations (target: 60 FPS)
- [ ] Test rapid interactions (no conflicts)
- [ ] Verify animations complete properly

