# Web Development Guide

> **Summary:** Day-to-day patterns for the web app: adding pages and components, making API calls, theming, env vars, and running tests.
> **Read this when:** You are actively developing the frontend and need a recipe for a common task.
> **Audience:** both
> **Related:** [Architecture overview](../architecture/overview.md) · [API client reference](../reference/api-client.md)

[← Back to web docs index](../INDEX.md)

---

## Running the dev server {#running}

```bash
# From monorepo root (starts API + web together via Turbo):
pnpm dev

# Web only:
pnpm --filter web dev        # http://localhost:3000
```

Infrastructure must be running first (`docker compose up -d`). See the [project getting-started guide](../../../../docs/guides/getting-started.md) for first-time setup.

---

## Adding pages {#adding-pages}

Next.js App Router: every `page.tsx` under `src/app/` becomes a route.

**Protected page** (requires login):

1. Create `src/app/<route>/page.tsx`.
2. Place it under a layout that uses `<AppShell>`, or add `<RequireAuth>` directly inside the page component (see `src/app/account/page.tsx` as an example).

**Auth page** (redirect active users away):

1. Create `src/app/<route>/page.tsx`.
2. Wrap content with `<RedirectIfAuthed>` from `@/components/RequireAuth`.

**Shared layout** for a group of pages:

Create `src/app/<group>/layout.tsx` and render `<AppShell>{children}</AppShell>` (like `src/app/study/layout.tsx`).

---

## Adding components {#adding-components}

- Study-domain components → `src/components/study/`
- Auth-related components → `src/components/auth/`
- Shell/navigation components → `src/components/`

Use MUI components for all UI. Import from `@mui/material` and `@mui/icons-material`. Do not use HTML elements for layout or typography directly — MUI's `Box`, `Stack`, `Typography`, etc. handle responsive props natively.

Keep components **pure presentationally** where possible. Data fetching belongs in the top-level view component (`DashboardView`, `StudyView`), not in leaf components like `BlockCard` or `TaskCard`.

---

## Making API calls {#api-calls}

All API calls go through `request<T>()` from `@/lib/api-client`. The wrappers in `src/lib/api/` call it for you — add new wrappers there rather than calling `request<T>()` directly from components.

**Pattern for a new endpoint:**

```ts
// src/lib/api/study.ts (or a new domain file)
import { MyResponseSchema, type MyResponse } from "@sql-edu/contracts";
import { request } from "@/lib/api-client";

export async function doSomething(id: string): Promise<MyResponse> {
  const data = await request<MyResponse>(`/my-resource/${encodeURIComponent(id)}`);
  return MyResponseSchema.parse(data);   // validates at the boundary
}
```

**Pattern for a React Query hook in a component:**

```tsx
const { data, isLoading, isError, error, refetch } = useQuery<MyResponse>({
  queryKey: ["my-resource", id],
  queryFn: () => doSomething(id),
});
```

Use `encodeURIComponent()` for any URL segment that comes from user data or a database ID.

**Error handling:**

`request<T>()` throws `ApiError` on non-2xx responses. `ApiError` has:
- `.status` — HTTP status code
- `.message` — server message or status text
- `.body` — raw parsed body (useful for field-level errors)

Check `instanceof ApiError && error.status === 403` for "locked" resources (e.g. `StudyView`).

---

## Auth state in components {#auth-in-components}

```tsx
import { useAuth } from "@/lib/auth-context";

function MyComponent(): React.JSX.Element {
  const { user, logout, updateProfile } = useAuth();
  // ...
}
```

`user` is `null` while bootstrapping or logged out. Always check `user !== null` before reading user fields. `isBootstrapping` is available if you need to distinguish "not yet known" from "definitely logged out".

See [AuthContextValue in the API client reference](../reference/api-client.md#auth-context) for the full interface.

---

## Theming {#theming}

MUI theme is defined in `src/theme/theme.ts`:

| Token | Value |
|-------|-------|
| `palette.primary.main` | `#2563eb` (blue-600) |
| `palette.secondary.main` | `#7c3aed` (violet-600) |
| Font family | Inter → system-ui fallbacks |
| CSS variables | enabled (`cssVariables: true`) |

The `<ThemeRegistry>` in `src/theme/ThemeRegistry.tsx` wires Emotion's SSR cache for Next.js App Router. Do not move Emotion's `CacheProvider` or the `AppRouterCacheProvider` — they prevent style flicker on hydration.

To extend the theme, edit `src/theme/theme.ts`. Avoid one-off `sx` overrides for anything that should be consistent across the app.

Tailwind is available for utility classes, but MUI's `sx` prop and the `theme` object are the primary styling system. Do not use Tailwind classes on MUI components.

---

## Environment variables {#environment-variables}

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3001` | Backend base URL |

All `NEXT_PUBLIC_*` vars are baked in at build time (Next.js convention). Set them in `.env.local` for local overrides or in the Docker/CI environment for production.

The API base URL is read by `src/lib/api-client.ts:API_BASE_URL`. Do not hard-code `localhost:3001` anywhere else.

---

## Testing {#testing}

**Unit / component tests (Jest + Testing Library):**

```bash
pnpm --filter web test          # run all tests
pnpm --filter web test:watch    # watch mode
```

Test files: `*.test.tsx` co-located with the component (e.g. `StudyView.test.tsx` next to `StudyView.tsx`).

Pattern for components that use `useAuth()`:

```tsx
import { render } from "@/test-utils";  // wraps with Providers

render(<MyComponent />);
```

The `src/test-utils/` folder provides a custom `render()` that mounts the full provider stack (theme + query client + auth context mock) so hooks work without extra setup.

The `SqlEditor` (CodeMirror) is injected into `TaskCard` via the `editorSlot` render prop, making it easy to substitute a plain `<textarea>` in tests:

```tsx
<TaskCard
  editorSlot={({ value, onChange }) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} />
  )}
  ...
/>
```

**End-to-end tests (Playwright):**

```bash
pnpm e2e    # from monorepo root
```

E2e tests live in `e2e/tests/`. They exercise the full stack (API + web). See the [testing guide](../../../../docs/guides/testing.md) for e2e setup.

---

*Back to [web docs index](../INDEX.md) · Related: [API client reference](../reference/api-client.md)*
