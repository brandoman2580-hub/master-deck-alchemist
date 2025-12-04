# WCAG 2.1 AA Remediation Mapping
## Automation vs Manual Testing Classification

This table maps WCAG 2.1 AA success criteria to testing methods and remediation effort for solo developer workflow.

| WCAG Criterion | Description | Automatable | Manual | Hybrid | Notes |
|----------------|-------------|-------------|--------|--------|-------|
| **1.1.1** | Non-text Content (Alt text) | ✅ Yes | ⚠️ Partial | - | axe, ESLint detect missing alt. Manual: verify alt text quality. |
| **1.3.1** | Info and Relationships | ✅ Yes | ⚠️ Partial | - | axe detects semantic issues. Manual: verify heading hierarchy, lists. |
| **1.3.2** | Meaningful Sequence | ⚠️ Partial | ✅ Yes | - | Manual: verify reading order with screen reader. |
| **1.3.3** | Sensory Characteristics | ⚠️ Partial | ✅ Yes | - | Manual: verify no color-only or shape-only instructions. |
| **1.4.1** | Use of Color | ✅ Yes | ⚠️ Partial | - | axe detects color-only indicators. Manual: verify context. |
| **1.4.2** | Audio Control | ✅ Yes | - | - | axe detects autoplay audio. |
| **1.4.3** | Contrast (Minimum) | ✅ Yes | ⚠️ Partial | - | axe, Lighthouse detect low contrast. Manual: verify gradients, images. |
| **1.4.4** | Resize Text | ⚠️ Partial | ✅ Yes | - | Manual: test 200% zoom, viewport reflow. |
| **1.4.5** | Images of Text | ✅ Yes | - | - | axe detects images of text. |
| **2.1.1** | Keyboard | ⚠️ Partial | ✅ Yes | ✅ Yes | axe detects keyboard traps. Manual: full keyboard walkthrough. Playwright: keyboard flows. |
| **2.1.2** | No Keyboard Trap | ✅ Yes | ⚠️ Partial | - | jest-axe, Playwright detect traps. Manual: verify Esc works. |
| **2.1.4** | Character Key Shortcuts | ⚠️ Partial | ✅ Yes | - | Manual: verify no single-key shortcuts. |
| **2.4.1** | Bypass Blocks | ✅ Yes | ⚠️ Partial | - | axe detects skip links. Manual: verify functionality. |
| **2.4.2** | Page Titled | ✅ Yes | - | - | axe detects missing titles. |
| **2.4.3** | Focus Order | ⚠️ Partial | ✅ Yes | ✅ Yes | Manual: tab order walkthrough. Playwright: programmatic tab order. |
| **2.4.4** | Link Purpose | ✅ Yes | ⚠️ Partial | - | axe detects generic links. Manual: verify context. |
| **2.4.6** | Headings and Labels | ✅ Yes | ⚠️ Partial | - | axe detects missing headings. Manual: verify hierarchy. |
| **2.4.7** | Focus Visible | ✅ Yes | ⚠️ Partial | - | axe detects missing focus styles. Manual: verify 3:1 contrast. |
| **2.5.1** | Pointer Gestures | ⚠️ Partial | ✅ Yes | - | Manual: verify keyboard alternatives for drag/drop. |
| **2.5.2** | Pointer Cancellation | ⚠️ Partial | ✅ Yes | - | Manual: verify no accidental activation. |
| **2.5.3** | Label in Name | ✅ Yes | ⚠️ Partial | - | axe detects mismatched labels. Manual: verify screen reader. |
| **2.5.4** | Motion Actuation | ⚠️ Partial | ✅ Yes | - | Manual: verify no motion-only controls. |
| **3.2.1** | On Focus | ⚠️ Partial | ✅ Yes | - | Manual: verify no context change on focus. |
| **3.2.2** | On Input | ⚠️ Partial | ✅ Yes | - | Manual: verify no unexpected context changes. |
| **3.2.3** | Consistent Navigation | ⚠️ Partial | ✅ Yes | - | Manual: verify navigation consistency. |
| **3.2.4** | Consistent Identification | ⚠️ Partial | ✅ Yes | - | Manual: verify consistent component labels. |
| **3.3.1** | Error Identification | ✅ Yes | ⚠️ Partial | - | jest-axe detects missing aria-describedby. Manual: verify announcements. |
| **3.3.2** | Labels or Instructions | ✅ Yes | ⚠️ Partial | - | axe detects missing labels. Manual: verify instruction clarity. |
| **3.3.3** | Error Suggestion | ⚠️ Partial | ✅ Yes | - | Manual: verify helpful error messages. |
| **3.3.4** | Error Prevention | ⚠️ Partial | ✅ Yes | - | Manual: verify confirmation for destructive actions. |
| **4.1.1** | Parsing | ✅ Yes | - | - | HTML validator, axe detect parsing errors. |
| **4.1.2** | Name, Role, Value | ✅ Yes | ⚠️ Partial | - | axe detects ARIA issues. Manual: verify screen reader announcements. |
| **4.1.3** | Status Messages | ⚠️ Partial | ✅ Yes | ✅ Yes | jest-axe detects missing aria-live. Manual: verify announcements. Playwright: test live regions. |

---

## Testing Tool Mapping

### Fully Automatable (axe, ESLint, Lighthouse)
- 1.1.1 (Alt text presence)
- 1.4.1 (Color-only indicators)
- 1.4.3 (Contrast ratios)
- 2.1.2 (Keyboard traps)
- 2.4.1 (Skip links)
- 2.4.2 (Page titles)
- 2.4.7 (Focus visible)
- 3.3.1 (Error identification - structure)
- 3.3.2 (Labels - presence)
- 4.1.1 (Parsing)
- 4.1.2 (ARIA attributes)

### Hybrid (Automated + Manual)
- 1.1.1 (Alt text quality)
- 1.4.3 (Gradient contrast)
- 2.1.1 (Keyboard navigation - full flows)
- 2.4.3 (Focus order)
- 4.1.3 (Status messages - functionality)

### Manual Only
- 1.3.2 (Reading order)
- 1.3.3 (Sensory characteristics)
- 1.4.4 (Text resize)
- 2.1.4 (Character shortcuts)
- 2.4.3 (Tab order - full walkthrough)
- 2.5.1 (Pointer gestures)
- 2.5.2 (Pointer cancellation)
- 2.5.4 (Motion actuation)
- 3.2.x (Consistent behavior)
- 3.3.3 (Error suggestions)
- 3.3.4 (Error prevention)

---

## Remediation Effort by Component Type

### Low Effort (Radix UI Components)
Components using Radix UI primitives are mostly accessible by default:
- `Dialog` - Focus trap, aria-modal handled
- `Select` - Keyboard navigation, ARIA roles handled
- `DropdownMenu` - Keyboard support, focus management handled
- `Tabs` - ARIA roles, keyboard navigation handled

**Action:** Verify with jest-axe, minimal manual testing needed.

### Medium Effort (Custom Components with Radix Base)
Components extending Radix UI:
- `Button` - Add aria-label for icon-only variants
- `Input` - Ensure label associations, error messages
- `Tooltip` - Verify keyboard trigger

**Action:** jest-axe + keyboard testing.

### High Effort (Fully Custom Components)
Components built from scratch:
- `CardGrid` - Keyboard navigation, focus management
- `AIChatbot` - Live regions, keyboard shortcuts
- `DeckBuilder` - Drag-and-drop keyboard alternative

**Action:** Full manual testing + Playwright E2E.

---

## Mobile Assistive Technology Testing

### TalkBack (Android)

**Setup:**
1. Enable TalkBack: Settings → Accessibility → TalkBack
2. Test on real device or Android emulator (API 30+)

**Quick Test Steps:**
1. Navigate to app
2. Swipe right to move through elements
3. Double-tap to activate
4. Verify:
   - All interactive elements announced
   - Button purposes clear
   - Form labels announced
   - Error messages announced

**Time:** ~15 minutes per page

### VoiceOver (iOS)

**Setup:**
1. Enable VoiceOver: Settings → Accessibility → VoiceOver
2. Test on real device or iOS Simulator

**Quick Test Steps:**
1. Navigate to app
2. Swipe right to move through elements
3. Double-tap to activate
4. Verify same as TalkBack

**Time:** ~15 minutes per page

---

## Priority Remediation Order

1. **Critical (Week 1-2):** Automatable violations first (faster feedback)
   - 1.1.1, 1.4.3, 2.1.2, 2.4.1, 3.3.1, 3.3.2, 4.1.2

2. **High (Week 3-4):** Hybrid items (automated + manual)
   - 2.1.1, 2.4.3, 2.4.7, 4.1.3

3. **Medium (Week 5-6):** Manual-only items
   - 1.3.2, 1.4.4, 2.5.1, 3.2.x

4. **Low (Week 7-8):** Polish and verification
   - Full manual walkthrough, mobile testing, documentation

---

**Last Updated:** 2024-01-XX

