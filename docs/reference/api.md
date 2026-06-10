# API Reference

> **Summary:** All REST endpoints, authentication requirements, and the request/response shapes defined in `@sql-edu/contracts`.
> **Read this when:** You're calling or extending the API.
> **Audience:** both
> **Related:** [Modules](../architecture/modules.md) · [Configuration](configuration.md)

[← Back to docs index](../INDEX.md)

---

**Base URL:** `http://localhost:3001` (dev)

**Interactive docs:** Swagger UI at `/docs` (auto-generated from NestJS decorators)

**Auth:** Most endpoints require `Authorization: Bearer <accessToken>`. Endpoints marked 🔒 also require `UserStatus.ACTIVE`. The access token (JWT, 15-min TTL) is returned in the login/refresh response body. The refresh token is a 7-day httpOnly cookie.

**Request/response types:** Defined in `packages/contracts/src/` as Zod schemas. The table below shows the schema name — import from `@sql-edu/contracts`.

---

## Auth

| Method | Path | Auth | Request schema | Response |
|--------|------|------|----------------|----------|
| `POST` | `/auth/register` | none | `RegisterSchema` | `{ message }` |
| `POST` | `/auth/activate` | none | `ActivateSchema` | `{ message }` |
| `POST` | `/auth/login` | none | `LoginSchema` | `{ accessToken, user: User }` + sets refresh cookie |
| `POST` | `/auth/refresh` | refresh cookie | — | `{ accessToken }` |
| `POST` | `/auth/logout` | refresh cookie | — | clears refresh cookie |
| `POST` | `/auth/test-account` | none | — | `TestAccountTokens` (`AuthTokens` + `testAccountExpiresAt`) + sets refresh cookie |

**Registration flow:**
1. `POST /auth/register` — creates `PENDING` user, sends activation email via RabbitMQ
2. `POST /auth/activate` — verifies 6-char code from email, sets `UserStatus.ACTIVE`
3. `POST /auth/login` — returns access token + sets httpOnly refresh cookie

**Test account flow:**
1. `POST /auth/test-account` — creates a pre-activated, throwaway `User`
   (`isTestAccount: true`, random `test-<uuid>@test-account.sql-edu.local`
   email, no email sent), sets `testAccountExpiresAt` 30 minutes out, and logs
   the caller in (returns access token + sets refresh cookie) just like
   `/auth/login`.
2. Limited to one creation per client IP per hour — a second call within that
   window returns `429 { error: "TEST_ACCOUNT_RATE_LIMITED" }`.
3. `TestAccountCleanupService` runs every minute and deletes any user where
   `isTestAccount` is true and `testAccountExpiresAt` has passed. The frontend
   logs the user out and redirects to `/login?testAccountExpired=1` once
   `testAccountExpiresAt` elapses client-side.

---

## Users

| Method | Path | Auth | Request schema | Response |
|--------|------|------|----------------|----------|
| `GET` | `/users/me` | 🔒 Bearer | — | `User` |
| `PATCH` | `/users/me` | 🔒 Bearer | `UpdateProfileSchema` | `User` |

`User` type: `{ id, email, displayName, status }` — passwordHash is never returned.

---

## Content (read-only)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/content/dashboard` | 🔒 Bearer | Per-user dashboard: all levels, block unlock states, XP totals |
| `GET` | `/content/blocks/:level/:blockOrder` | 🔒 Bearer | Full block content: theory, examples, tasks (without reference queries), user progress per task |

`:level` is one of `NOVICE` / `JUNIOR` / `MIDDLE` (uppercase).
`:blockOrder` is the 1-based block position within the level.

---

## Study (write)

| Method | Path | Auth | Request schema | Response schema |
|--------|------|------|----------------|-----------------|
| `POST` | `/study/tasks/:taskId/submit` | 🔒 Bearer | `SubmitAnswerSchema` | `SubmitResult` |
| `POST` | `/study/tasks/:taskId/reveal` | 🔒 Bearer | — | `{ referenceQuery: string }` |

**`SubmitAnswerSchema`:** `{ sql: string }`

**`SubmitResult`:**
```typescript
{
  correct: boolean;
  status: TaskStatus;           // COMPLETED | NOT_STARTED (wrong answer)
  message: string;              // human-readable feedback
  columns: string[];            // column names from the executed query
  rows: Record<string, unknown>[];
  errorType?: 'TIMEOUT' | 'SYNTAX' | 'RUNTIME' | 'FORBIDDEN';
}
```

Submit to a locked block returns `403 Forbidden`.
Reveal marks the task as `SKIPPED` and returns the reference SQL.

---

## AI Tutor

| Method | Path | Auth | Request schema | Response |
|--------|------|------|----------------|----------|
| `POST` | `/ai/blocks/:blockId/ask/stream` | 🔒 Bearer | `AskSchema` | `text/event-stream` (SSE) |

**`AskSchema`:** `{ message: string }` — block is identified by `:blockId` in the URL.

**Response:** Server-Sent Events stream. Each line is `data: <JSON>\n\n`. Three event shapes (see `AiStreamEventSchema` in `@sql-edu/contracts`):

```
{ "type": "token",  "text": "..." }
{ "type": "done",   "refused": boolean, "questionsRemaining": number, "reply": "..." }
{ "type": "error",  "message": "..." }
```

- `token` events arrive as the LLM generates text.
- `done` is always the last event. `reply` is the sanitised authoritative text — use it to replace any accumulated tokens (the sanitiser may have redacted a leaked answer).
- `error` replaces `done` when the LLM fails after all retries.
- **Quota:** 10 questions per (user, block) pair. When exhausted, the server returns a `done` event with `refused: true` and `questionsRemaining: 0` — no HTTP 429. Quota is only consumed when at least one token is received; retry-exhausted failures do not decrement the counter.
- **Block not found:** returns `404 JSON` before SSE headers are sent.
- The LLM context never includes `referenceQuery` or expected results.

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | none | Returns `{ status: 'ok' }` when the API is running |

---

*Back to the [index](../INDEX.md).*
