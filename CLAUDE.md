# CLAUDE.md — Munchboxd

> AI assistant guide for the Munchboxd codebase. Keep this file updated as the project evolves.

## What is Munchboxd?

Munchboxd is "Letterboxd for munchies" — a web app where users log their cannabis sessions (strain, product type, brand, high rating) paired with the food they ate ("munchies"). Users create accounts, log sessions tied to their profile, and can browse a public feed of everyone's posts — like Letterboxd's activity feed.

---

## Project Structure

```
munchboxd/
├── app/
│   ├── page.tsx                  # Main page — auth gate + entire application UI
│   ├── layout.tsx                # Root layout (fonts, metadata, global wrapper)
│   ├── globals.css               # Tailwind import + CSS variables
│   └── components/
│       └── AuthForm.tsx          # Login / register form (shown when logged out)
├── lib/
│   └── supabaseClient.ts         # Supabase client singleton (exported as `supabase`)
├── supabase/
│   └── setup.sql                 # One-time SQL to run in Supabase SQL Editor
├── public/                       # Static assets (SVGs)
├── next.config.ts                # Next.js config — React Compiler enabled
├── tsconfig.json                 # TypeScript config (strict mode, path alias @/*)
├── eslint.config.mjs             # ESLint flat config (Next.js + TypeScript rules)
└── postcss.config.mjs            # PostCSS with @tailwindcss/postcss
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 |
| Auth + Database | Supabase (built-in email/password auth + PostgreSQL) |
| Supabase SDK | `@supabase/supabase-js` v2 |
| Compiler | React Compiler (babel-plugin-react-compiler) |
| Linting | ESLint 9 (flat config) |

There is no custom backend. All auth and data operations go through the Supabase client directly from the browser.

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

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_project_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
```

Both are `NEXT_PUBLIC_` so they are bundled into the browser. The Supabase anon key is safe for client-side use; access control is enforced by Row Level Security (RLS) policies in the database.

---

## Database Setup (one-time)

Run `supabase/setup.sql` in the **Supabase SQL Editor** (Dashboard → SQL Editor → New query → paste → Run). This script is idempotent and safe to run multiple times.

What it does:
1. Creates the `profiles` table (one row per user, `id` mirrors `auth.users.id`)
2. Adds a `user_id` FK column to `sessions` (references `profiles.id`)
3. Enables Row Level Security on all three tables
4. Creates RLS policies (read-all public, write-own for sessions/munchies/profiles)
5. Creates a trigger that auto-creates a `profiles` row when a new auth user signs up

---

## Database Schema

### `profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Mirrors `auth.users.id` |
| `username` | text (UNIQUE) | Lowercase, chosen at registration |
| `created_at` | timestamptz | Auto-generated |

### `sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | integer (PK) | Auto-generated |
| `user_id` | uuid (FK) | References `profiles.id`; used for ownership + joins |
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
| `created_at` | timestamptz | Auto-generated |

**Join chain for the public feed:** `munchies → sessions → profiles`

Supabase's relational select syntax handles this in one query:
```ts
supabase.from('munchies').select(`
  ...,
  sessions (
    strain_name, product_type, user_id,
    profiles ( username )
  )
`)
```

---

## Authentication

Uses **Supabase Auth** (built-in email + password). No third-party auth library needed.

### Flow
1. App loads → `supabase.auth.getSession()` checks for existing session
2. `supabase.auth.onAuthStateChange` keeps `user` state in sync
3. If `user` is null → render `<AuthForm />` (login/register)
4. If `user` is set → render the main app
5. On sign-out → clear `allMunchies`, reset `activeTab`, return to auth gate

### Registration
- User provides: email, password, username
- `supabase.auth.signUp({ options: { data: { username } } })` stores username in `raw_user_meta_data`
- A database trigger (`on_auth_user_created`) auto-creates the `profiles` row using `raw_user_meta_data->>'username'`
- The `AuthForm` checks username uniqueness before calling signUp to prevent trigger failures

### Reading the current user
```ts
// From auth state
const username = user?.user_metadata?.username as string | undefined;

// From a munchie's session join (for the public feed)
username: row.sessions?.profiles?.username ?? null
```

### Key Supabase auth methods used
| Method | Where used |
|---|---|
| `supabase.auth.getSession()` | `page.tsx` on mount |
| `supabase.auth.onAuthStateChange()` | `page.tsx` on mount |
| `supabase.auth.signUp()` | `AuthForm.tsx` |
| `supabase.auth.signInWithPassword()` | `AuthForm.tsx` |
| `supabase.auth.signOut()` | `page.tsx` `handleSignOut` |

---

## Application Architecture

### Component Structure

```
page.tsx (Home)          ← auth gate + main layout + all state
  └── AuthForm.tsx       ← shown when !user; handles login + register
```

`page.tsx` uses internal render helper functions rather than separate components:

- `renderForm()` — the logging form (reused in Dashboard and Log New Session tabs)
- `renderMunchieCard(m, showUser?)` — single munchie card; `showUser=true` shows the @username badge (used in public feed)
- `renderRecent()` — last 5 of the current user's munchies
- `renderMyMunchies()` — all of the current user's munchies
- `renderFeed()` — all munchies from all users with usernames

### Tabs

Four tabs controlled by `activeTab: Tab` state (`'dashboard' | 'new' | 'munchies' | 'feed'`):

| Tab | Content |
|---|---|
| Dashboard | Side-by-side grid: form + user's 5 most recent munchies |
| Log new session | Form only, max-width constrained |
| My munchies | Full list filtered to `user_id === user.id` |
| Public feed | All munchies from all users, with @username badges |

### State Management

All state is local `useState` in `Home`. No global state library.

| State | Type | Purpose |
|---|---|---|
| `user` | `User \| null` | Current authenticated user |
| `authLoading` | `boolean` | True while checking initial session (prevents auth form flash) |
| `activeTab` | `Tab` | Which sidebar tab is active |
| `allMunchies` | `Munchie[]` | Full list from DB; filtered client-side for My Munchies tab |
| `isSaving` | `boolean` | Disables submit button during insert |
| `message` | `string \| null` | User-facing feedback after save |
| Form fields | `string \| number` | Controlled inputs for the session/munchie form |

### Data Flow

1. `user` state is set by auth listener (mount effect)
2. Second `useEffect` (depends on `[user]`) fetches all munchies joined with sessions + profiles
3. `myMunchies` is derived from `allMunchies.filter(m => m.user_id === user?.id)` — no separate query
4. On form submit: insert session (with `user_id`) → insert munchie → optimistically prepend to `allMunchies`
5. On sign-out: clear `allMunchies`

### Supabase Client

`lib/supabaseClient.ts` exports a single `supabase` instance. Always import via the `@/*` path alias:

```ts
import { supabase } from '@/lib/supabaseClient';
```

---

## Code Conventions

### TypeScript
- Strict mode enabled — avoid adding `any` except in Supabase mapped responses (the relational select result is untyped)
- Custom types defined at the top of the file where they are used (`Munchie`, `Tab`)
- Use `import type { User } from '@supabase/supabase-js'` for Supabase-provided types

### Components
- All components use `'use client'` — no server components or server actions
- Functional components only
- React Compiler is enabled — do not add `useMemo`/`useCallback` unless profiling shows a need

### Styling
- **Tailwind CSS only** — no CSS Modules, no styled-components, no `style={{}}` objects
- **Dark theme** throughout: `bg-slate-950` page background, `bg-slate-900` cards, `bg-slate-800` active states
- **Accent colors**: emerald/green for interactive elements, active nav, and the avatar initial; amber for star ratings
- Form labels: `text-[11px] uppercase tracking-[0.16em] text-slate-400` — keep consistent
- Inputs/selects/textareas: `rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm`
- Cards: `border border-slate-800 rounded-xl px-4 py-3 text-sm bg-slate-900/60`
- User avatar: `h-8 w-8 rounded-full bg-emerald-500 text-slate-950 font-bold` (shows first letter of username)

### Form Handling
- Forms use `onSubmit={handleSubmit}` with `e.preventDefault()`
- Use `|| null` for optional fields so empty strings aren't stored
- Always `setIsSaving(true)` at start, `false` in `finally`
- User feedback via `message` state

### Error Handling
- Log details with `console.log()`
- Show user-facing messages via `message` state
- Return early on Supabase errors

---

## Valid Enum Values

### `product_type` (sessions)
Pre-roll · Flower · Cart · Edible · Dab

### `source_type` (munchies)
Homemade · Fast food · Restaurant · Gas station · Other

---

## Things to Know Before Modifying

1. **No tests** — verify changes manually in the browser.
2. **Client-only** — no API routes, no server actions, no server components.
3. **Auth gate in page.tsx** — `if (!user) return <AuthForm />` is the entire auth boundary. If adding protected pages, replicate this pattern.
4. **Supabase trigger creates profiles** — if the trigger fails (e.g., duplicate username in a race condition), the auth user exists but has no profile. Their sessions inserts will fail due to the FK constraint. The `AuthForm` does a pre-check for username uniqueness to prevent this.
5. **React Compiler** — enabled in `next.config.ts`. Do not add manual memoization.
6. **Supabase relational query flattening** — the nested `row.sessions.profiles.username` is flattened into the `Munchie` type in the `mapped` array.
7. **`allMunchies` is shared** — both the public feed and "My munchies" derive from the same array. Filtering is done client-side, not with separate queries.

---

## Deployment

Ready for Vercel deployment. Set environment variables in Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Also ensure `supabase/setup.sql` has been run against your Supabase project and that **Email Confirmations** in Supabase Auth settings are configured as desired (disable for development to allow instant login after signup).
