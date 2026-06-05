# SQL Education

A full-stack platform for learning SQL by solving real tasks against sandboxed
datasets, with an AI tutor.

This repository is a **pnpm + Turborepo monorepo**. This commit is the
**foundation scaffold**: infrastructure, the canonical database schema, shared
contracts, and buildable app skeletons. Feature logic is added by later waves.

## Layout

```
SQL-Education/
├─ apps/
│  ├─ api/          # Nest.js + Prisma (REST API, Swagger at /docs, health at /health)
│  └─ web/          # Next.js (App Router) + MUI v6 + Tailwind + React Query
├─ packages/
│  └─ contracts/    # @sql-edu/contracts — shared Zod schemas + inferred TS types
├─ e2e/             # Playwright end-to-end tests
├─ docker-compose.yml
├─ .env.example
├─ turbo.json
└─ pnpm-workspace.yaml
```

## Prerequisites

- Node.js >= 20 (developed on v24)
- pnpm (via Corepack)
- Docker (for Postgres/Redis/RabbitMQ/Mail)

Enable pnpm:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

> On Windows, if Corepack cannot write to the global Node install directory, it
> was enabled into a user shim directory (`%LOCALAPPDATA%\pnpm-shim`) which is on
> the user PATH. Open a fresh terminal so `pnpm` resolves.

## Setup

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Copy environment files
#    - root .env is read by the API at runtime (@nestjs/config) and by Turbo
#    - apps/api/.env is read by the Prisma CLI
cp .env.example .env
cp apps/api/.env.example apps/api/.env       # Windows: copy apps\api\.env.example apps\api\.env

# 3. Start infrastructure (Postgres, sandbox Postgres, Redis, RabbitMQ, MailHog)
docker compose up -d postgres sandbox-postgres redis rabbitmq mailhog

# 4. Generate the Prisma client and apply migrations
pnpm prisma:generate
pnpm db:migrate            # applies committed migrations (prisma migrate deploy)
# For local schema changes during dev use:
pnpm --filter api db:migrate:dev
```

## Run

```bash
# Everything (Turbo runs api + web dev servers)
pnpm dev

# Or individually
pnpm --filter api dev      # http://localhost:3001  (docs: http://localhost:3001/docs)
pnpm --filter web dev      # http://localhost:3000
```

## Build

```bash
pnpm build                                   # turbo: contracts -> api + web
pnpm --filter @sql-edu/contracts build
pnpm --filter api build
pnpm --filter web build
```

## Test

```bash
pnpm test                  # turbo: all unit tests
pnpm --filter api test     # Nest/Jest
pnpm --filter web test     # RTL/Jest (jsdom)
pnpm e2e                   # Playwright (needs browsers: pnpm --filter @sql-edu/e2e install:browsers)
```

## Docker (full stack)

```bash
docker compose up -d --build   # builds api + web images and starts the whole stack
```

| Service           | Host port(s)     | Notes                                   |
| ----------------- | ---------------- | --------------------------------------- |
| postgres          | 5432             | db/user/pass: `sql_edu`                 |
| sandbox-postgres  | 5433             | db `sandbox`, user `sandbox_admin`      |
| redis             | 6379             |                                         |
| rabbitmq          | 5672 / 15672     | guest/guest; mgmt UI on 15672           |
| mailhog (mail)    | 1025 / 8025      | SMTP 1025, web UI 8025                   |
| api               | 3001             | health `/health`, Swagger `/docs`       |
| web               | 3000             |                                         |

## Environment

All keys live in `.env.example`. Inside `docker-compose.yml`, hostnames are
overridden to the service names (`postgres`, `sandbox-postgres`, `redis`,
`rabbitmq`, `mailhog`).

## Notes for contributors

- **Contracts first.** Shared request/response types live in
  `@sql-edu/contracts`. Build it before consumers: `pnpm --filter @sql-edu/contracts build`
  (Turbo does this automatically via `^build`).
- **Database schema** is canonical in `apps/api/prisma/schema.prisma`; the enums
  there are mirrored in `@sql-edu/contracts` (Level/TaskStatus/BlockStatus in
  `study.ts`, UserStatus in `auth.ts`, ComparisonMode in `common.ts`).
- The Nest app exposes a feature-module **seam** in
  `apps/api/src/app.module.ts` (marked `=== FEATURE MODULES ... ===`) where later
  modules (Auth/Users/Mail/Content/Study/Grading/Ai) are imported.
- Import shared types via the workspace dependency
  `"@sql-edu/contracts": "workspace:*"` (e.g. `import { LoginSchema } from "@sql-edu/contracts"`).
