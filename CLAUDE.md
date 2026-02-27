# CLAUDE.md — Munchboxd

> AI assistant guide for the Munchboxd codebase. Keep this file updated as the project evolves.

## What is Munchboxd?

Munchboxd is "Letterboxd for munchies" — a web app where users log their cannabis sessions (strain, product type, brand, high rating) paired with the food they ate ("munchies"). Users can save sessions, view recent logs, and browse their full history.

---

## Project Structure

```
munchboxd/
├── app/
│   ├── page.tsx          # Main page — the entire application UI lives here
│   ├── layout.tsx        # Root layout (fonts, metadata, global wrapper)
│   └── globals.css       # Tailwind import + CSS variables (light/dark theme)
├── lib/
│   └── supabaseClient.ts # Supabase client singleton (exported as `supabase`)
├── public/               # Static assets (SVGs)
├── next.config.ts        # Next.js config — React Compiler enabled
├── tsconfig.json         # TypeScript config (strict mode, path alias @/*)
├── eslint.config.mjs     # ESLint flat config (Next.js + TypeScript rules)
└── postcss.config.mjs    # PostCSS with @tailwindcss/postcss
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 |
| Database/Backend | Supabase (PostgreSQL via `@supabase/supabase-js`) |
| Compiler | React Compiler (babel-plugin-react-compiler) |
| Linting | ESLint 9 (flat config) |

There is no custom backend. All data operations go through the Supabase client directly from the browser.

---

## Development Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

No test framework is configured. There are no test files.

---

## Environment Variables

Create a `.env.local` file in the project root. These are required for the app to function:

```
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_project_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
```

Both are prefixed with `NEXT_PUBLIC_` so they are bundled into the browser build. Do not put sensitive server-only secrets in this project — the Supabase anon key is designed for client-side use (access is controlled by Supabase RLS policies).

---

## Database Schema

Managed entirely in Supabase (PostgreSQL). Two tables:

### `sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | integer (PK) | Auto-generated |
| `strain_name` | text | nullable |
| `product_type` | text | Pre-roll, Flower, Cart, Edible, Dab |
| `brand` | text | nullable |
| `high_rating` | integer | 1–5 |

### `munchies`
| Column | Type | Notes |
|---|---|---|
| `id` | integer (PK) | Auto-generated |
| `session_id` | integer (FK) | References `sessions.id` |
| `food_name` | text | nullable |
| `source_type` | text | Homemade, Fast food, Restaurant, Gas station, Other |
| `rating` | integer | 1–5 star rating |
| `description` | text | nullable |
| `created_at` | timestamp | Auto-generated |

Each form submission creates one `sessions` row first, then one `munchies` row linked to it via `session_id`. Reads join munchies with their session via Supabase's relational select syntax.

---

## Application Architecture

### Component Structure

The entire application lives in a single client component: `app/page.tsx`. It uses three internal render helper functions to organize the UI:

- `renderForm()` — the logging form (used in both Dashboard and Log New Session tabs)
- `renderRecent()` — shows the 5 most recent munchies
- `renderAllMunchies()` — shows the full munchie history

### Tabs

Three tabs controlled by `activeTab: Tab` state (`'dashboard' | 'new' | 'munchies'`):

- **Dashboard** — side-by-side grid: form on left, recent munchies on right
- **Log new session** — form only, max-width constrained
- **My munchies** — full history list

### State Management

All state is local `useState` in the `Home` component. No global state library. State includes:

- Form fields: `strain`, `productType`, `brand`, `highRating`, `foodName`, `sourceType`, `munchieRating`, `description`
- UI: `activeTab`, `isSaving`, `message`
- Data: `recentMunchies` — the full list fetched from Supabase on mount, used for both recent (sliced to 5) and all views

### Data Flow

1. On mount (`useEffect`), fetch all munchies joined with their sessions, ordered by `created_at DESC`
2. On submit, insert session → get returned `id` → insert munchie with that `session_id`
3. Optimistically prepend the new entry to `recentMunchies` so the UI updates immediately without a refetch

### Supabase Client

`lib/supabaseClient.ts` exports a single `supabase` instance created with `createClient`. Import it as:

```ts
import { supabase } from '../lib/supabaseClient';
// or with path alias:
import { supabase } from '@/lib/supabaseClient';
```

---

## Code Conventions

### TypeScript
- Strict mode is enabled — no implicit `any` (except in mapped Supabase responses where `row: any` is used as a pragmatic workaround for the untyped Supabase relational query result)
- Custom types are defined at the top of the file where they are used
- Use the `@/*` path alias (maps to project root) for imports from `lib/`

### Components
- All components use the `'use client'` directive since the app relies on browser-side interactivity
- Functional components only, no class components
- React Compiler is enabled — avoid manual `useMemo`/`useCallback` unless there is a specific reason

### Styling
- **Tailwind CSS only** — no CSS Modules, no styled-components, no inline `style={{}}` objects
- **Dark theme** throughout: `bg-slate-950` page, `bg-slate-900` cards, `bg-slate-800` active states
- **Accent colors**: emerald/green for interactive elements and active states, amber for star ratings
- Labels use `text-[11px] uppercase tracking-[0.16em] text-slate-400` — keep this consistent for new form fields
- Borders use `border-slate-700` (inputs) / `border-slate-800` (cards)
- Input/select/textarea: `rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm`

### Form Handling
- Forms use `onSubmit={handleSubmit}` with `e.preventDefault()`
- Use `|| null` when inserting optional fields so empty strings don't get stored
- Always set `isSaving` to `true` at the start and `false` in `finally`
- Show user feedback via the `message` state string

### Error Handling
- Log errors to console with `console.log()`
- Show user-facing messages via the `message` state (e.g., `'Error saving session.'`, `'Session saved ✅'`)
- Return early on Supabase errors rather than proceeding with null data

---

## Product Type Options

These are the valid values for the `product_type` field (hardcoded in the select dropdown):
- Pre-roll
- Flower
- Cart
- Edible
- Dab

## Source Type Options

These are the valid values for the `source_type` field (hardcoded in the select dropdown):
- Homemade
- Fast food
- Restaurant
- Gas station
- Other

---

## Things to Know Before Modifying

1. **No tests** — there is no test suite. Manually verify changes in the browser.
2. **Monolithic page component** — `app/page.tsx` is intentionally a single large component. If adding significant new features, consider extracting into separate component files under `app/components/`.
3. **Client-only** — this app has no server components, no API routes, no server actions. Everything is client-side React talking directly to Supabase.
4. **No auth** — there is currently no user authentication. All users share the same Supabase table data (relies on Supabase RLS if access control is needed).
5. **React Compiler** — enabled in `next.config.ts`. Avoid adding unnecessary `useMemo`/`useCallback` wrappers; the compiler handles memoization automatically.
6. **Supabase relational queries** — when joining tables, Supabase returns nested objects (e.g., `row.sessions.strain_name`). The `mapped` array in `loadMunchies` flattens this structure into the `Munchie` type.

---

## Deployment

The project is ready for Vercel deployment. Set the required environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings. No special build configuration is needed beyond what's already in `next.config.ts`.
