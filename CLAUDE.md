# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read the indexed docs first (context injection)

This repo ships a **navigable, indexed documentation suite** designed so you load
only the few files a task needs — keep your context small and on-target:

1. **[AGENTS.md](AGENTS.md)** — start here. Its **Context Map** is a task → file
   routing table ("If you are working on X, read first Y"). Match your task, then
   open the **one** "Read first" file. AGENTS.md also holds the canonical
   conventions, guardrails, and command list — **don't duplicate those here; defer
   to it.**
2. **[docs/INDEX.md](docs/INDEX.md)** — full catalog: every doc with a one-line
   summary and a "read when" cue. Browse here when the Context Map doesn't cover it.
3. **Focused docs** under `docs/architecture/`, `docs/guides/`, `docs/reference/`,
   and ADRs in `docs/architecture/decisions/` — leaf nodes, one concern each.
   Architecture decisions are recorded as ADRs; read them before reworking a
   subsystem they cover.

Frontend work has its own routing file: **`apps/web/AGENTS.md`**.

When you change architecture, update the matching doc and its summary in
`docs/INDEX.md` (the `/doc-architect` skill maintains this suite).

## Commands

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Dev (api + web via Turbo) | `pnpm dev` · single app: `pnpm --filter api dev` / `pnpm --filter web dev` |
| Build all | `pnpm build` · contracts only: `pnpm --filter @sql-edu/contracts build` |
| Typecheck / lint | `pnpm typecheck` · `pnpm lint` |
| All unit tests | `pnpm test` · one package: `pnpm --filter api test` |
| **Single test file / name** | `pnpm --filter api exec jest src/sandbox/sqlite-executor.spec.ts` · by name: `... exec jest -t "happy path"` |
| E2E (needs full stack up) | `pnpm e2e` · first run: `pnpm --filter @sql-edu/e2e install:browsers` |
| Infra (no sandbox DB needed) | `docker compose up -d postgres redis rabbitmq mailhog` |
| DB: client / migrate / new migration | `pnpm prisma:generate` · `pnpm db:migrate` · `pnpm --filter api db:migrate:dev` |
| **Curriculum: validate+bake, then seed** | `pnpm db:validate` → `pnpm db:seed` (see workflow below) |

> Turbo wires `^build` so `pnpm build`/`typecheck` build `@sql-edu/contracts`
> first. But running `pnpm --filter api typecheck` **directly** fails unless
> contracts is built (`pnpm --filter @sql-edu/contracts build`) and the Prisma
> client is generated (`pnpm prisma:generate`) first.

## Architecture (the big picture)

pnpm + Turborepo monorepo. Three runtime pieces agree on types through one shared
package:

- **`packages/contracts/` (`@sql-edu/contracts`)** — Zod schemas + inferred TS
  types. **Single source of truth** for every API request/response shape; both
  api and web import from it (never across package boundaries by relative path).
- **`apps/api/` (NestJS, :3001)** — REST API, one feature module per domain
  (`auth`, `users`, `content`, `study`, `grading`, `sandbox`, `ai`, `mail`).
  Prisma → PostgreSQL main DB; Redis for tokens/quota/activation codes; RabbitMQ
  for async mail.
- **`apps/web/` (Next.js App Router, :3000)** — UI; talks only to the API.

**The grading hot path spans four areas — understand it as one flow:** a submit
goes `study/` (orchestrates, writes `UserTaskProgress`, awards XP via the pure
functions in `study/progression.ts`) → `grading/` (3 stages: forbidden-statement
guard → execute → result compare; the compare/guard logic is pure and unit-tested)
→ `sandbox/` (runs the untrusted SQL). The "expected result" it compares against
is **not** computed at request time — it's baked offline into the seed (below).

**Sandbox = embedded SQLite (ADR-0003).** Untrusted student SQL runs only via the
abstract `SandboxRunner` seam, bound to `SqliteSandboxRunner`: a fresh in-memory
DB per request (holding only the task fixture) executed inside a **worker thread**
that's terminated at a 2s timeout. Never run student SQL on the main DB. The
curriculum therefore targets **SQLite dialect**.

## Critical workflows & gotchas

- **Curriculum content is a two-step pipeline.** `Task.expectedResultJson` is
  never hand-written. Edit seed files in `apps/api/prisma/seed/` (blocks/tasks/
  datasets, registered in `registry.ts`), then **`pnpm db:validate`** runs each
  `referenceQuery` against SQLite and writes `<level>/baked.json`, then
  **`pnpm db:seed`** upserts from those baked files. Any change to a `setupSql` or
  `referenceQuery` requires re-running validate → seed, or grading breaks.
- **Enums live in two places that must stay in sync:** `apps/api/prisma/schema.prisma`
  and `packages/contracts/src/`. Don't define an enum a third time.
- **One `.env` file** at the repo root — single source of truth. NestJS reads it
  via `envFilePath: '../../.env'`; Prisma scripts are prefixed with
  `dotenv -e ../../.env --`. No `apps/api/.env` needed. See `docs/reference/configuration.md`.
- **AI safety:** `SAFE_BLOCK_SELECT` in `apps/api/src/ai/ai.service.ts` deliberately
  omits `referenceQuery`/`expectedResultJson` from LLM context — never add them.
- **New feature module:** register it at the `=== FEATURE MODULES ===` seam in
  `apps/api/src/app.module.ts`.
