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
| `auth.controller.ts` | `POST /auth/register` · `/activate` · `/login` · `/refresh` · `/logout` |
| `auth.service.ts` | Business logic: hash password, generate codes/tokens, validate |
| `auth.service.spec.ts` | Unit tests |

**Key rules:**
- Registration always creates a `PENDING` user and publishes an activation code to the mail queue.
- Activation codes are 6 characters, stored in Redis with a 15-min TTL; attempts are limited.
- Access tokens expire in 15 minutes (`JWT_ACCESS_TTL`). Refresh tokens expire in 7 days (`JWT_REFRESH_TTL`) and are delivered as httpOnly cookies.
- Cookie-bearing routes use `@Res({ passthrough: true })` — don't remove it.

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

AI tutor: quota management, prompt construction, LLM call (via OpenRouter), response sanitization.

| File | Purpose |
|------|---------|
| `ai.controller.ts` | `POST /ai/ask` |
| `ai.service.ts` | Quota check, prompt build, LLM call, sanitize response |

**Security-critical rules:**
- `SAFE_BLOCK_SELECT` deliberately omits `referenceQuery` and `expectedResultJson` from any DB query that feeds the AI context. **Do not add these fields.**
- The AI is instructed to refuse to give direct SQL solutions; the response is post-filtered to strip code blocks that look like full answers.
- Quota: `UserBlockAiUsage.questionsAsked` ≤ 10 per (user, block). Increment happens in the same DB transaction as the AI call.

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
| `RedisModule` | `redis/redis.service.ts` | ioredis client for quota, tokens, activation codes |
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

### Dashboard — `app/dashboard/`

Renders the level selector tabs and a block grid with unlock state and XP. Fetches from `GET /content/dashboard` via React Query.

### Study — `app/study/[level]/[block]/`

The main learning page: SQL editor (CodeMirror), task list (`TaskCard`), dataset schema panel, results table, and the `AiTutorDrawer` (slide-out chat). Fetches from `GET /content/blocks/:level/:blockOrder`.

### Contracts {#contracts}

The frontend imports **only** from `@sql-edu/contracts` — never directly from `apps/api/`. This ensures both sides use the same Zod schemas for validation and the same TypeScript types.

| File | Exports |
|------|---------|
| `packages/contracts/src/auth.ts` | `LoginSchema`, `RegisterSchema`, `ActivateSchema`, `User` type, `UserStatus` |
| `packages/contracts/src/study.ts` | `Level`, `TaskStatus`, `BlockStatus`, `SubmitAnswerSchema`, `SubmitResult` |
| `packages/contracts/src/ai.ts` | `AskTutorSchema`, `TutorResponse` |
| `packages/contracts/src/common.ts` | `ComparisonMode`, `ApiError` |

---

*Next: [Data model](data-model.md) for entity details, or back to the [index](../INDEX.md).*
