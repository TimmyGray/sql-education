# Module Map

> **Summary:** Responsibilities, key files, and rules for every NestJS API module and frontend section.
> **Read this when:** You're changing a specific domain area and need to know where things live and what the constraints are.
> **Audience:** both
> **Related:** [Architecture overview](overview.md) · [Data model](data-model.md)

[← Back to docs index](../INDEX.md)

---

## API modules (`apps/api/src/`)

### Auth

Handles registration, email activation, login, JWT token issuance, refresh, and logout.

| File | Purpose |
|------|---------|
| `auth.controller.ts` | `POST /auth/register` · `/activate` · `/login` · `/refresh` · `/logout` · `/test-account` |
| `auth.service.ts` | Business logic: hash password, generate codes/tokens, validate |
| `auth.service.spec.ts` | Unit tests |
| `client-ip.ts` | `getClientIp()` — extracts the caller's IP (`req.ip`, falling back to `X-Forwarded-For`) for the test-account rate limit |
| `test-account-cleanup.service.ts` | `@Cron` job (every minute) that deletes expired test accounts |

**Key rules:**
- Registration always creates a `PENDING` user and publishes an activation code to the mail queue.
- Activation codes are 6 characters, stored in Redis with a 15-min TTL; attempts are limited.
- Access tokens expire in 15 minutes (`JWT_ACCESS_TTL`). Refresh tokens expire in 7 days (`JWT_REFRESH_TTL`) and are delivered as httpOnly cookies.
- Cookie-bearing routes use `@Res({ passthrough: true })` — don't remove it.

**Test accounts (`POST /auth/test-account`):**
- Creates a pre-activated, throwaway `User` (`isTestAccount: true`, random
  `test-<uuid>@test-account.sql-edu.local` email, no email sent) with full
  `ACTIVE`-equivalent access, and immediately logs the caller in like
  `/auth/login`.
- `testAccountExpiresAt` is set 30 minutes (`TEST_ACCOUNT_TTL_SECONDS`) out and
  returned to the client so the frontend can show a countdown
  (`TestAccountBanner`) and redirect to `/login?testAccountExpired=1` on expiry.
- Rate-limited to one creation per client IP per hour
  (`TEST_ACCOUNT_IP_COOLDOWN_SECONDS`, tracked in Redis via `testAccountIpKey`);
  a repeat call returns `429 { error: "TEST_ACCOUNT_RATE_LIMITED" }`.
- `TestAccountCleanupService` (`@Cron(CronExpression.EVERY_MINUTE)`, registered
  via `ScheduleModule.forRoot()` in `app.module.ts`) deletes any user where
  `isTestAccount` is true and `testAccountExpiresAt` has passed.
- `app.set("trust proxy", 1)` (in `main.ts`) is required so `req.ip` reflects
  the real client IP behind a reverse proxy (Vercel) — without it, the rate
  limit would key off the proxy's IP for every request.

---

### Users

Exposes profile read/update for the authenticated user.

| File | Purpose |
|------|---------|
| `users.controller.ts` | `GET /users/me` · `PATCH /users/me` |
| `users.service.ts` | Prisma reads/writes for `User.displayName` |

---

### Content

Read-only domain: serves dashboard data (blocks + progress per user) and full block content for the study page.

| File | Purpose |
|------|---------|
| `content.controller.ts` | `GET /content/dashboard` · `GET /content/blocks/:level/:blockOrder` |
| `content.service.ts` | Assembles per-user block/task state from Prisma |

**Key rule:** `ContentService.getCompletedBlockIds` is also consumed by `StudyService` to gate submissions to unlocked blocks — don't break its return contract.

---

### Study {#study}

Write side of the study domain: process submissions, handle reveals, advance progression.

| File | Purpose |
|------|---------|
| `study.controller.ts` | `POST /study/tasks/:taskId/submit` · `POST /study/tasks/:taskId/reveal` |
| `study.service.ts` | Orchestrates grading, persists `UserTaskProgress`, awards XP |
| `progression.ts` | **Pure functions** — block unlock, completion check, XP calculation |
| `study.service.spec.ts` | Unit tests |

**Key rules:**
- `progression.ts` contains no I/O — all DB state is loaded before calling these functions. Keep it pure.
- XP is awarded only on the **first** block completion (guarded by checking current `UserLevelXp`).
- Submissions to locked blocks return `403 Forbidden`.

---

### Grading {#grading}

3-stage grading pipeline: `forbidden-statement guard → execution → result comparison`.

| File | Purpose |
|------|---------|
| `grading.service.ts` | Orchestrates the 3 stages |
| `forbidden-statement.guard.ts` | Rejects `DELETE`, `UPDATE`, `CREATE`, `DROP` etc. |
| `result-comparator.ts` | Compares actual vs expected rows (ORDERED / UNORDERED) |

**Key rule:** The grading service receives the `Task` entity including `referenceQuery` and `expectedResultJson` — these come from Prisma, not from client input. Never accept expected results from the request body.

---

### Sandbox {#sandbox}

Executes untrusted user SQL in an embedded SQLite database. See [ADR-0003](decisions/0003-sqlite-in-process-sandbox.md).

| File | Purpose |
|------|---------|
| `sandbox-runner.ts` | Abstraction (`SandboxRunner`) + `SandboxExecutionError` + DI token — the seam `GradingService` depends on |
| `sqlite-executor.ts` | **Pure, synchronous** core: opens a fresh `:memory:` DB, runs `setupSql` then the user query, maps errors, caps rows |
| `sqlite-sandbox.worker.ts` | Worker-thread host for the executor (so a runaway query can be terminated) |
| `sqlite-sandbox-runner.ts` | `SqliteSandboxRunner` — spawns the worker per request and enforces the timeout via `worker.terminate()` |

**Key rules:**
- Each grading run gets a **brand-new in-memory DB** containing only the task fixture — isolation is structural (no shared state, no app data to leak, nothing to tear down).
- The synchronous engine runs **inside a worker thread**; the 2-second timeout is enforced by terminating the worker (there is no server-side `statement_timeout`). A `MAX_RESULT_ROWS` cap bounds memory.
- `better-sqlite3` returns DATE columns as raw strings already, and the expected results are **baked against SQLite** (`validate.ts`), so values compare consistently.
- Error types are: `TIMEOUT` · `SYNTAX` · `RUNTIME` · `FORBIDDEN` — map these to user-facing messages, don't leak raw SQLite errors.

---

### AI {#ai}

AI tutor: quota management, prompt construction, SSE token streaming, exponential-backoff retry, response sanitization.

| File | Purpose |
|------|---------|
| `ai.controller.ts` | `POST /ai/blocks/:blockId/ask/stream` — SSE endpoint; returns 404 JSON if block not found before headers are sent |
| `ai.service.ts` | `askStream` async generator: quota gate → block load → stream tokens → strip `REFUSED:` prefix → sanitize → emit done event |
| `llm.service.ts` | `completeStream` async generator: calls OpenRouter with `stream: true`; retries up to 5× with exponential backoff (1 s → 16 s) before throwing |
| `prompt.ts` | `STREAMING_SYSTEM_PROMPT`, `buildUserPrompt`, `SafeBlock` / `SafeTask` types, `collectTaskTableNames` |
| `sanitize.ts` | Post-filter: redacts any reply that contains a query targeting the task's real tables |
| `refusals.ts` | Canned reply constants (`NOT_CONFIGURED_REPLY`, `QUOTA_EXCEEDED_REPLY`, `REDACTED_REPLY`, `AI_QUESTIONS_PER_BLOCK`) |

**SSE event protocol** (`POST /ai/blocks/:blockId/ask/stream`):
```
data: { "type": "token",  "text": "..." }        ← one or more, token by token
data: { "type": "done",   "refused": bool, "questionsRemaining": n, "reply": "..." }  ← always last
data: { "type": "error",  "message": "..." }      ← replaces done on unrecoverable LLM failure
```
`done.reply` is the sanitised authoritative text — the client should replace any accumulated tokens with it.

**Security-critical rules:**
- `SAFE_BLOCK_SELECT` in `ai.service.ts` deliberately omits `referenceQuery` and `expectedResultJson`. **Do not add these fields.**
- `STREAMING_SYSTEM_PROMPT` tells the model to respond with plain text and prefix refusals with `"REFUSED: "`. The service strips this prefix before forwarding.
- Post-filter in `sanitize.ts` redacts any reply that contains a runnable query against the task's real tables.
- Quota: `UserBlockAiUsage.questionsUsed` ≤ 10 per (user, block). Incremented **only when at least one token is received** — a retry-exhausted failure does not consume a question.
- Retries apply only before the first token is yielded; a mid-stream error propagates immediately (can't replay partial output).

---

### Mail

Async transactional email via RabbitMQ + Nodemailer.

| File | Purpose |
|------|---------|
| `mail.service.ts` | RabbitMQ producer — publishes `{ to, subject, html }` to queue |
| `mail.consumer.ts` | RabbitMQ consumer — dequeues and sends via Nodemailer/SMTP |
| `mail.templates.ts` | HTML templates for activation code and welcome emails |

**Key rule:** Email is always async (fire-and-forget from the request path). `MailService.send()` publishes to the queue; the consumer runs in the same process but a different event loop.

---

### Common

Shared guards, decorators, and utilities used across all modules.

| File | Purpose |
|------|---------|
| `guards/jwt-auth.guard.ts` | Validates `Authorization: Bearer <accessToken>` |
| `guards/active-user.guard.ts` | Checks `user.status === ACTIVE` after JWT guard |
| `decorators/current-user.decorator.ts` | Extracts `{ userId, email, status }` from `req.user` |

---

### Config & Prisma

| Module | File | Purpose |
|--------|------|---------|
| `ConfigModule` | `config/env.validation.ts` | Validates all env vars at startup via Zod |
| `PrismaModule` | `prisma/prisma.service.ts` | Singleton Prisma client; exported for use by any module |
| `RedisModule` | `redis/redis.provider.ts` · `redis/redis.service.ts` | Auto-selects ioredis (local) or Upstash HTTP client (cloud) via `REDIS_CLOUD_URL`/`REDIS_CLOUD_TOKEN`; used for quota, tokens, activation codes |
| `HealthModule` | `health/health.controller.ts` | `GET /health` — liveness check |

---

## Frontend sections (`apps/web/src/`)

### Auth pages — `app/(auth)/`

| Page | Route |
|------|-------|
| `register/page.tsx` | `/register` |
| `login/page.tsx` | `/login` |
| `activate/page.tsx` | `/activate` |

Components live in `components/auth/`. `RequireAuth.tsx` is a HOC that redirects unauthenticated users to `/login`.

`components/auth/TestAccountButton.tsx` ("Try a test account") appears on both
`/login` and `/register`; it calls `authContext.startTestAccount()` (POST
`/auth/test-account`) and routes to `/dashboard` on success, or shows the
per-IP cooldown message on a `429 TEST_ACCOUNT_RATE_LIMITED`.
`components/TestAccountBanner.tsx` is mounted in `AppShell` for authenticated
pages; for `user.isTestAccount` it shows a live countdown to
`testAccountExpiresAt` and, on expiry, logs out and redirects to
`/login?testAccountExpired=1` (handled by the info `Alert` on the login page).

### Dashboard — `app/dashboard/`

Renders the level selector tabs and a block grid with unlock state and XP. Fetches from `GET /content/dashboard` via React Query.

### Study — `app/study/[level]/[block]/`

The main learning page: SQL editor (CodeMirror), task list (`TaskCard`), dataset schema panel, results table, and the `AiTutorDrawer` (slide-out chat). Fetches from `GET /content/blocks/:level/:blockOrder`.

### Contracts {#contracts}

The frontend imports **only** from `@sql-edu/contracts` — never directly from `apps/api/`. This ensures both sides use the same Zod schemas for validation and the same TypeScript types.

| File | Exports |
|------|---------|
| `packages/contracts/src/auth.ts` | `LoginSchema`, `RegisterSchema`, `ActivateSchema`, `User` type (incl. `isTestAccount`/`testAccountExpiresAt`), `UserStatus`, `TestAccountTokens` |
| `packages/contracts/src/study.ts` | `Level`, `TaskStatus`, `BlockStatus`, `SubmitAnswerSchema`, `SubmitResult` |
| `packages/contracts/src/ai.ts` | `AskSchema` · `AiStreamTokenSchema` · `AiStreamDoneSchema` · `AiStreamErrorSchema` · `AiStreamEventSchema` (discriminated union) · inferred TS types |
| `packages/contracts/src/common.ts` | `ComparisonMode`, `ApiError` |

---

*Next: [Data model](data-model.md) for entity details, or back to the [index](../INDEX.md).*
