# Web App — Agent Guide

> **Summary:** Conventions, guardrails, and a context map for working inside `apps/web` (Next.js 15 + MUI frontend).
> **Read this first**, then jump to the specific docs the Context Map points to.

[📑 Web docs index](docs/INDEX.md) · [Project-wide AGENTS](../../AGENTS.md)

---

## Context Map — what to read for the task at hand

| If you are working on…                  | Read first                                        | Then maybe                                     |
|-----------------------------------------|---------------------------------------------------|------------------------------------------------|
| Understanding the web app structure     | `docs/architecture/overview.md`                   | `docs/architecture/components.md`              |
| Routing, layouts, or provider stack     | `docs/architecture/overview.md#routing`           | `src/app/layout.tsx` · `src/app/providers.tsx` |
| Auth pages (login / register / activate)| `docs/architecture/overview.md#auth-flow`         | `src/components/auth/` · `src/lib/api/auth.ts` |
| Dashboard (level tabs + block grid)     | `docs/architecture/components.md#dashboardview`   | `src/components/study/DashboardView.tsx`       |
| Study page (SQL editor + tasks)         | `docs/architecture/components.md#studyview`       | `src/components/study/StudyView.tsx`           |
| AI tutor drawer                         | `docs/architecture/components.md#ai-tutor-drawer` | `src/components/study/AiTutorDrawer.tsx`       |
| Making API calls / fetching             | `docs/reference/api-client.md`                    | `src/lib/api/`                                 |
| Auth state / session / tokens           | `docs/reference/api-client.md#auth-context`       | `src/lib/auth-context.tsx`                     |
| Adding a new page                       | `docs/guides/development.md#adding-pages`         | `src/app/`                                     |
| Adding a new component                  | `docs/guides/development.md#adding-components`    | `src/components/`                              |
| Styling, theme tokens, MUI              | `docs/guides/development.md#theming`              | `src/theme/`                                   |
| Environment variables                   | `docs/guides/development.md#environment-variables`| `.env.local`                                   |
| Running or writing tests                | `docs/guides/development.md#testing`              | `src/**/*.test.tsx`                            |

---

## Snapshot

- **Framework:** Next.js 15, App Router, React 19, TypeScript strict
- **UI:** MUI v6 + Tailwind (utility-only, no Tailwind components competing with MUI)
- **Data fetching:** TanStack React Query v5 (`staleTime: 30 s`, no window-focus refetch)
- **Forms:** react-hook-form + Zod resolvers
- **SQL editor:** CodeMirror 6 via `@uiw/react-codemirror`
- **Port:** 3000 in dev, standalone Docker image in prod
- **Entry point:** `src/app/layout.tsx`

## Conventions

- **Access tokens are in-memory only.** The JWT access token lives in the `tokenStore` module variable in `src/lib/api-client.ts` — never in `localStorage` or cookies. The httpOnly `refreshToken` cookie is the durable credential.
- **`useAuth()` is the single source of truth for user state.** Import from `@/lib/auth-context`. Never read `tokenStore` directly in components.
- **All API calls go through `request<T>()`** in `@/lib/api-client`. The wrappers in `src/lib/api/` call it and parse responses with Zod schemas.
- **Types from contracts.** Import shared types and schemas from `@sql-edu/contracts`. Parse API responses with the matching Zod schema (e.g. `DashboardSchema.parse(data)`) so contract drift fails loudly at the boundary.
- **React Query for server state.** Use `useQuery` / `useMutation` for all data that comes from the API. Adjust `staleTime` per-query only when necessary.
- **Path alias `@/`.** Use `@/` for any import from within `src/`. Never use relative `../..` paths across feature boundaries.
- **No `any`.** TypeScript strict mode is on everywhere.

## Guardrails

- ✅ Protected routes must be rendered inside `<RequireAuth>` or a layout that uses `<AppShell>` (which wraps `<RequireAuth>` internally).
- ✅ Auth-only pages (login / register / activate) must use `<RedirectIfAuthed>` so an active session bounces to `/dashboard` instead of flashing the form.
- ✅ Run `pnpm --filter web typecheck && pnpm --filter web test` before declaring work done.
- ❌ Do not store tokens in `localStorage` or `sessionStorage`.
- ❌ Do not import from `apps/api/` — use `@sql-edu/contracts` for shared types.
- ❌ Do not call `/auth/refresh` or `/auth/me` from components; `AuthProvider` owns the session lifecycle.
- ❌ Do not use `axios` or bare `fetch()` in components or lib files — use `request<T>()`.

## Commands (web-only)

| Command | Purpose |
|---------|---------|
| `pnpm --filter web dev` | Start the Next.js dev server on port 3000 |
| `pnpm --filter web build` | Production build (standalone) |
| `pnpm --filter web typecheck` | TypeScript type check |
| `pnpm --filter web test` | Jest unit tests |
| `pnpm --filter web lint` | ESLint + Prettier |
| `pnpm --filter web clean` | Remove `.next/` |

---

*Keep this file small. Detailed content lives in `docs/` and is reachable via the Context Map.*
