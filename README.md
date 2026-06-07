# SQL Education

A full-stack platform for learning SQL by solving real tasks against sandboxed datasets, with an AI tutor.

**pnpm + Turborepo monorepo** · TypeScript · NestJS · Next.js · PostgreSQL · Redis · RabbitMQ

## Documentation

| Doc | What's in it |
|-----|--------------|
| 📑 **[Docs Index](docs/INDEX.md)** | Map of all documentation |
| 🤖 **[AGENTS.md](AGENTS.md)** | Conventions + context map for AI agents and contributors |
| 🏛 **[Architecture](docs/architecture/overview.md)** | How the system is built |
| 🗄 **[Data Model](docs/architecture/data-model.md)** | Entities and relationships |
| 🚀 **[Getting Started](docs/guides/getting-started.md)** | Local setup walkthrough |
| 🛠 **[Development](docs/guides/development.md)** | Day-to-day workflow |
| 🧪 **[Testing](docs/guides/testing.md)** | Unit, integration and e2e tests |
| ⚙️ **[Configuration](docs/reference/configuration.md)** | All environment variables |
| 🔌 **[API Reference](docs/reference/api.md)** | Endpoints and contracts |

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

## Dev Container (recommended)

The easiest way to run the project — no local Node, pnpm, or Docker Compose setup required beyond Docker Desktop and VS Code.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) · [VS Code](https://code.visualstudio.com/) · [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

```
1. Open the repo in VS Code
2. Command Palette → "Dev Containers: Reopen in Container"
3. Wait for the container to build and postCreateCommand to finish
   (pnpm install runs automatically; watch the terminal)
4. Set real JWT secrets in .env (see note below)
5. pnpm prisma:generate && pnpm db:migrate && pnpm db:seed
6. pnpm dev
```

**Ports forwarded automatically:** web :3000 · API :3001 · MailHog :8025 · RabbitMQ UI :15672

> **JWT secrets:** `setup.sh` creates `.env` from `.env.example` on first container start, which leaves the placeholder secrets (`dev_access_secret_change_me`). Replace `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `.env` with real random values before running the app. Generate them with:
> ```powershell
> # PowerShell (run twice, use each output for one variable)
> [System.Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Max 256) }))
> ```
> If you place a `.env` with real secrets in the repo root **before** opening the container, `setup.sh` will use it as-is.

All infrastructure services (`postgres`, `sandbox-postgres`, `redis`, `rabbitmq`, `mailhog`) start automatically with the container. See [Getting Started](docs/guides/getting-started.md#dev-container) for full details.

---

## Prerequisites (local setup)

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

## Setup (local)

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
