# Master Deck Alchemist

A modern Yu-Gi-Oh! deck building and analysis application powered by AI.

> Build, test, and optimize your Yu-Gi-Oh! decks with intelligent recommendations and comprehensive analysis tools.

---

## Table of Contents

- [Quick start](#quick-start)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Development](#development)
- [Testing & CI](#testing--ci)
- [Linters & formatting](#linters--formatting)
- [Contributing](#contributing)
- [License](#license)

---

## Quick start

```bash
# install deps
npm i # or pnpm i / yarn

# dev server
npm run dev

# build & run production locally
npm run build
npm start
```

## Tech stack

- **Next.js 16** (App Router) + TypeScript
- **React 18** + Tailwind CSS
- **Supabase** (Auth, Database, Edge Functions)
- **Zustand** (State Management)
- **Groq API** (AI via Supabase Edge Functions)
- **@dnd-kit** (Drag & Drop)
- **@tanstack/react-virtual** (Virtualization)
- **Radix UI** (via Shadcn UI components)

## Project structure

```
app/              # Next.js App Router pages
components/       # React components (UI & feature components)
  ui/            # Reusable UI components (Shadcn pattern)
hooks/           # Custom React hooks
lib/             # Shared utilities and helpers
  api/           # API client functions
context/         # React Context providers
store/           # Zustand stores
types/           # TypeScript type definitions
public/          # Static assets
supabase/        # Supabase Edge Functions (Deno)
```

## Development

### File size guidelines

Keep source files under **~500 lines** for readability. Large files should be split into:
- **Components**: Extract UI subcomponents into `components/<ComponentName>/`
- **Helpers**: Move pure functions to `lib/helpers.ts` or page-specific `utils.ts`
- **Hooks**: Move custom hooks to `hooks/use*.ts`

### Code organization

- **Shared helpers** → `lib/helpers.ts`
- **Page-local helpers** → `app/<page>/utils.ts`
- **Custom hooks** → `hooks/use*.ts`
- **UI components** → `components/ui/` (Shadcn pattern)
- **Feature components** → `components/`

### Import paths

Use the `@/` alias configured in `tsconfig.json`:

```typescript
import { formatMoney } from '@/lib/helpers';
import { useDeck } from '@/context/deck-context';
```

### State management

- **Zustand**: Global state (e.g., `useCardStore`, `useModeStore`, `useUserStore`)
- **React Context**: Complex hierarchical state (e.g., `DeckContext`)
- **Local state**: Component-specific state with `useState`

## Testing & CI

```bash
# Run accessibility tests
npm run test:a11y

# Run linting
npm run lint

# Build validation
npm run build
```

CI must run `npm run build` to validate TypeScript and Next.js build.

## Linters & formatting

- **ESLint**: Configured with Next.js and accessibility plugins
- **TypeScript**: Strict mode enabled
- **Prettier**: Integrated via ESLint config

Run `npm run lint` before committing.

## Contributing

1. Fork the repository
2. Create a feature branch: `feature/your-feature`
3. Make your changes following the project structure guidelines
4. Run `npm run lint` and `npm run build` to ensure everything works
5. Submit a PR with a clear description and screenshots if UI changed

### Commit message format

```
type(scope): brief description

Examples:
- refactor(lib): move formatMoney helper
- feat(deck-builder): add card search filter
- fix(auth): resolve login modal state issue
```

## License

MIT
