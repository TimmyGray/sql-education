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

**Registration flow:**
1. `POST /auth/register` — creates `PENDING` user, sends activation email via RabbitMQ
2. `POST /auth/activate` — verifies 6-char code from email, sets `UserStatus.ACTIVE`
3. `POST /auth/login` — returns access token + sets httpOnly refresh cookie

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

| Method | Path | Auth | Request schema | Response schema |
|--------|------|------|----------------|-----------------|
| `POST` | `/ai/ask` | 🔒 Bearer | `AskTutorSchema` | `TutorResponse` |

**`AskTutorSchema`:** `{ blockId: string, question: string }`

**`TutorResponse`:** `{ answer: string, questionsRemaining: number }`

Quota: 10 questions per (user, block) pair. Returns `429 Too Many Requests` when exhausted.
The LLM context never includes `referenceQuery` or expected results.

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | none | Returns `{ status: 'ok' }` when the API is running |

---

*Back to the [index](../INDEX.md).*
