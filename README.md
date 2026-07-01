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
npm run test:unit    # Jest
npm run test:edge    # Deno edge function unit tests
npm run lint         # TypeScript check (tsc --noEmit; Next.js 16 removed next lint)
npm run build
npm run test:e2e     # Playwright (after build)
```

**GitHub Actions** (`.github/workflows/ci.yml`) runs on pull requests and on pushes to `develop` / `master`. Enable Actions in the GitHub repo settings.

**Deployments**: feature branches → Preview; `develop` → staging; `master` → production. See [docs/deployment-environments.md](docs/deployment-environments.md).

## Linters & formatting

- **ESLint**: Configured with Next.js and accessibility plugins
- **TypeScript**: Strict mode enabled
- **Prettier**: Integrated via ESLint config

Run `npm run lint` before committing.

## Contributing

1. Branch from `develop`: `git checkout develop && git pull && git checkout -b feature/your-feature`
2. Make changes following the project structure guidelines
3. Run `npm run lint`, `npm run test:unit`, and `npm run build` locally
4. Open a PR **into `develop`** (not `master`)
5. After staging QA, merge `develop` → `master` for production

See [docs/deployment-environments.md](docs/deployment-environments.md) for Vercel and Supabase setup.

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
