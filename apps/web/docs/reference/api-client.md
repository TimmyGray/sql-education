# API Client Reference

> **Summary:** `request<T>()` generic helper, `ApiError`, `tokenStore`, `AuthContext` interface, and `useAuth()` hook.
> **Read this when:** You are calling the backend, handling errors, or reading/mutating auth state in the frontend.
> **Audience:** both
> **Related:** [Architecture overview](../architecture/overview.md#auth-flow) · [Development guide](../guides/development.md#api-calls)

[← Back to web docs index](../INDEX.md)

---

## `request<T>()` {#request}

`src/lib/api-client.ts`

Generic typed fetch wrapper. All API calls go through this (directly or via wrappers in `src/lib/api/`).

```ts
import { request, RequestOptions } from "@/lib/api-client";

const result = await request<T>(path, options?);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Path relative to `API_BASE_URL`, e.g. `"/health"` |
| `options.json` | `unknown` | JSON body — serialized automatically; sets `Content-Type: application/json` |
| `options.accessToken` | `string \| null` | Override the Bearer token. Pass `null` to omit `Authorization` entirely (used for `/auth/refresh`) |
| `options.method` | `string` | HTTP method (default `"GET"`) |
| `options._retried` | `boolean` | Internal: set on the retry after a 401 refresh; never pass from callers |

**Returns:** Parsed JSON typed as `T`. A 204 response returns `undefined as T`.

**Throws:** `ApiError` on any non-2xx response (see below). Network errors propagate as-is.

**Behaviour:**
- Always sends `credentials: "include"` so the httpOnly refresh cookie travels with requests.
- Attaches `Authorization: Bearer <token>` from `tokenStore` unless overridden.
- On a `401` (and the request is not already a retry and did not opt out of auth), performs a **single-flight** refresh via `refreshAccessToken()`, then retries the original request once with the new token. If the refresh fails, calls `onAuthFailure` and lets the `401` propagate as `ApiError`.

---

## `ApiError` {#api-error}

```ts
class ApiError extends Error {
  status: number;    // HTTP status code
  message: string;  // server message or statusText
  body?: unknown;   // full parsed response body
}
```

Use `instanceof ApiError` to check whether an error came from the API vs a network failure:

```ts
try {
  const data = await someApiCall();
} catch (err) {
  if (err instanceof ApiError) {
    if (err.status === 403) { /* handle locked resource */ }
    if (err.status === 409) { /* handle conflict */ }
  }
}
```

`toFriendlyMessage(err)` in `src/components/auth/errors.ts` maps common status codes to user-readable strings for auth forms.

---

## `tokenStore` {#token-store}

Module-scoped in-memory store for the JWT access token. **Never import this in components** — use `useAuth()` instead.

```ts
tokenStore.get()          // string | null
tokenStore.set(token)     // stores the token
tokenStore.clear()        // removes the token
```

`AuthProvider` keeps `tokenStore` in sync via `setAuth()` and `clearAuth()`. The `request<T>()` helper reads from `tokenStore` automatically.

---

## `AuthContext` interface {#auth-context}

`src/lib/auth-context.tsx`

The shape of the value exposed by `useAuth()`:

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `user` | `User \| null` | Current user (null if not authenticated or still bootstrapping) |
| `accessToken` | `string \| null` | Current in-memory access token |
| `isBootstrapping` | `boolean` | `true` while the initial silent-refresh is in flight |
| `setAuth(user, token)` | `void` | Update user + token in context and tokenStore |
| `clearAuth()` | `void` | Clear user + token from context and tokenStore |
| `login(email, pw)` | `Promise<User>` | POST /auth/login → hydrate user. Throws `ApiError` on failure |
| `register(email, pw, confirm)` | `Promise<void>` | POST /auth/register. Does not authenticate (account is PENDING) |
| `activate(email, code)` | `Promise<User>` | POST /auth/activate → hydrate user. Throws `ApiError` on failure |
| `resendCode(email)` | `Promise<void>` | POST /auth/resend-code. Throws `ApiError` on 429 (cooldown) |
| `logout()` | `Promise<void>` | POST /auth/logout (best-effort) then `clearAuth()` |
| `updateProfile(displayName)` | `Promise<User>` | PATCH /users/me → update cached user |
| `refreshUser()` | `Promise<User>` | GET /auth/me → refresh cached user |

---

## `useAuth()` hook {#use-auth}

```ts
import { useAuth } from "@/lib/auth-context";

const { user, login, logout, isBootstrapping } = useAuth();
```

Must be called inside a component that is a descendant of `<AuthProvider>` (i.e. anywhere inside the app). Throws if called outside the provider tree.

**Common patterns:**

```tsx
// Show a loader during bootstrap
if (isBootstrapping) return <FullScreenLoader />;

// Guard that the user is loaded before rendering
if (!user) return null;

// Kick off login
const handleLogin = async () => {
  try {
    await login(email, password);
    router.push("/dashboard");
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      // PENDING account — send to /activate
    }
  }
};
```

---

## API wrapper modules (`src/lib/api/`) {#api-wrappers}

| File | Functions | Endpoints |
|------|-----------|-----------|
| `auth.ts` | `register`, `activate`, `login`, `resendCode`, `refresh`, `logout`, `getMe`, `updateProfile` | `/auth/*` · `/users/me` |
| `study.ts` | `getDashboard`, `getBlock`, `submitAnswer`, `reveal` | `/content/dashboard` · `/content/blocks/:id` · `/study/tasks/:id/submit` · `/study/tasks/:id/reveal` |
| `ai.ts` | `askAiStream` | `/ai/blocks/:blockId/ask/stream` (SSE — does not use `request<T>()`, uses raw `fetch` + `ReadableStream`) |

Each wrapper:
1. Calls `request<T>()` with the correct path and options.
2. Parses the response with the matching Zod schema from `@sql-edu/contracts`.
3. Returns the typed, validated value.

---

## `API_BASE_URL` {#base-url}

```ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` or the deployment environment to point at a different API host. All `request<T>()` calls prepend this automatically.

---

*Back to [web docs index](../INDEX.md)*
