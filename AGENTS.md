# Agent Guide

> **Summary:** Conventions, guardrails, and a context map so an agent loads only the docs it needs.
> **Read this first**, then jump to the specific docs the Context Map points to.

[📑 Full docs index](docs/INDEX.md)

---

## Context Map — what to read for the task at hand

Load the **"Read first"** file only. Open "Then maybe" if that's not enough.

| If you are working on…                     | Read first                                   | Then maybe                                     |
|--------------------------------------------|----------------------------------------------|------------------------------------------------|
| Understanding the system overall           | `docs/architecture/overview.md`              | `docs/architecture/modules.md`                 |
| Adding or changing an API module           | `docs/architecture/modules.md`               | `apps/api/src/<module>/`                       |
| Changing the data model / Prisma schema    | `docs/architecture/data-model.md`            | `apps/api/prisma/schema.prisma`                |
| Auth, JWT, activation flow                 | `docs/architecture/modules.md#auth`          | `apps/api/src/auth/`                           |
| SQL grading pipeline                       | `docs/architecture/modules.md#grading`       | `apps/api/src/grading/`                        |
| Progression rules (XP, unlock, completion) | `docs/architecture/modules.md#study`         | `apps/api/src/study/progression.ts`            |
| AI tutor / quota / safety                  | `docs/architecture/modules.md#ai`            | `apps/api/src/ai/`                             |
| SQL sandbox execution                      | `docs/architecture/modules.md#sandbox`       | `apps/api/src/sandbox/`                        |
| Adding curriculum content (blocks/tasks)  | `docs/guides/development.md#adding-content`  | `apps/api/prisma/seed/`                        |
| Frontend pages or components               | `apps/web/AGENTS.md`                         | `apps/web/docs/architecture/overview.md`       |
| Shared types / contracts                   | `docs/architecture/modules.md#contracts`     | `packages/contracts/src/`                      |
| Local first-time setup                     | `docs/guides/getting-started.md`             | —                                              |
| Day-to-day dev commands                    | `docs/guides/development.md`                 | —                                              |
| Writing or running tests                   | `docs/guides/testing.md`                     | —                                              |
| Environment variables / configuration      | `docs/reference/configuration.md`            | —                                              |
| API endpoints                              | `docs/reference/api.md`                      | `apps/api/src/main.ts` (Swagger at `/docs`)   |

---

## Project snapshot

- **What it is:** Interactive SQL learning platform — students solve graded SQL tasks against sandboxed datasets, with an AI tutor and progressive curriculum.
- **Stack:** TypeScript · NestJS 11 (API, port 3001) · Next.js 15 + MUI v6 (Web, port 3000) · PostgreSQL 16 (main DB) · Prisma 6 · embedded SQLite (SQL sandbox) · Redis 7 · RabbitMQ 3 · OpenRouter (AI)
- **Entry points:** `apps/api/src/main.ts` (API bootstrap) · `apps/web/src/app/layout.tsx` (web root)
- **How it runs:** `pnpm dev` (Turbo orchestrates both apps); `docker compose up -d` for infrastructure

## Conventions (follow these)

- **Contracts first.** Every shared request/response type goes in `packages/contracts/src/` as a Zod schema. Build contracts before consumers (`pnpm --filter @sql-edu/contracts build`). Turbo does this automatically via `^build`.
- **Feature modules.** Each domain lives in its own NestJS module: `{feature}.module.ts` / `{feature}.controller.ts` / `{feature}.service.ts` / `{feature}.service.spec.ts`. New modules are registered in `apps/api/src/app.module.ts` at the `=== FEATURE MODULES ===` seam.
- **Enums.** Canonical enums live in `packages/contracts/src/` **and** `apps/api/prisma/schema.prisma` — keep both in sync. Do not define them a third time.
- **Naming:** Services → `{Feature}Service`, Controllers → `{Feature}Controller`, DTOs → `{Action}Dto`, Guards → `{Behavior}Guard`.
- **TypeScript:** Strict mode everywhere. No `any`. Use Zod schemas in contracts; `nestjs-zod` wrappers in the API.
- **Formatting/lint:** `pnpm lint` (ESLint + Prettier). Run before committing.
- **Tests:** Jest for unit (`*.spec.ts`), Playwright for e2e (`e2e/tests/`). New services need a matching `.spec.ts`.
- **Imports:** Use the workspace alias `@sql-edu/contracts` — never import by relative path across package boundaries.

## Guardrails (do / don't)

- ✅ Run `pnpm lint && pnpm typecheck && pnpm test` before declaring work done.
- ✅ Keep reference queries and `expectedResultJson` out of AI context — see `SAFE_BLOCK_SELECT` in `apps/api/src/ai/ai.service.ts`.
- ✅ User SQL must execute only in the embedded SQLite sandbox via `SqliteSandboxRunner` (fresh in-memory DB per request, in a worker thread) — never on the main DB.
- ✅ New or changed curriculum content must be re-validated/re-baked (`pnpm db:validate`) before seeding — it bakes `expectedResultJson` against SQLite.
- ❌ Don't add new npm packages without noting it — `pnpm install` in the correct workspace package only.
- ❌ Don't edit generated files: `apps/api/src/generated/`, `node_modules/`, `dist/`, `.next/`.
- ❌ Don't duplicate Zod schemas — one schema per concept in `@sql-edu/contracts`.
- ❌ Don't store tokens or credentials in code. All secrets go in `.env` (never committed).

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Run API + Web dev servers (Turbo) |
| `pnpm test` | Run all Jest unit tests |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm typecheck` | TypeScript type check (all packages) |
| `pnpm build` | Build all packages (contracts → api + web) |
| `pnpm e2e` | Run Playwright end-to-end tests |
| `pnpm db:migrate` | Apply committed Prisma migrations |
| `pnpm db:validate` | Run reference queries against SQLite and re-bake `expectedResultJson` |
| `pnpm db:seed` | Seed curriculum content (idempotent) |
| `pnpm prisma:generate` | Regenerate Prisma client after schema changes |

## Where things live

| Concern | Location |
|---------|----------|
| Shared types & schemas | `packages/contracts/src/` |
| API entry point | `apps/api/src/main.ts` |
| API root module | `apps/api/src/app.module.ts` |
| Feature modules (API) | `apps/api/src/<feature>/` |
| Database schema | `apps/api/prisma/schema.prisma` |
| Migrations | `apps/api/prisma/migrations/` |
| Curriculum seed | `apps/api/prisma/seed/` |
| Web pages (App Router) | `apps/web/src/app/` |
| Web components | `apps/web/src/components/` |
| Auth context (web) | `apps/web/src/lib/auth-context.tsx` |
| API client (web) | `apps/web/src/lib/api-client.ts` |
| End-to-end tests | `e2e/tests/` |
| Docker stack | `docker-compose.yml` |
| Env template | `.env.example` |

---

*Keep this file small and current. Detailed material belongs in `docs/` and is reached via the Context Map above.*
