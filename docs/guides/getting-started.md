# Getting Started

> **Summary:** Complete first-time local setup: install prerequisites, start infrastructure, run migrations, seed curriculum, and verify everything works.
> **Read this when:** You're setting up the project for the first time.
> **Audience:** both
> **Related:** [Development](development.md) · [Configuration](../reference/configuration.md)

[← Back to docs index](../INDEX.md)

---

## Option A — Dev Container (recommended) {#dev-container}

The container pre-installs all tooling, starts all infrastructure services, and auto-creates `.env` with docker-internal hostnames. You only need Docker Desktop and VS Code.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) · [VS Code](https://code.visualstudio.com/) · [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### Steps

**1. Open in container**

Open the repo in VS Code, then run **Command Palette → "Dev Containers: Reopen in Container"**. The container builds, then `postCreateCommand` runs `setup.sh`, which:

- Creates `.env` from `.env.example` with service hostnames rewritten to docker-internal names (`localhost` → `postgres`, `redis`, `rabbitmq`, etc.) — **only if `.env` does not already exist**.
- Creates `apps/api/.env` from `apps/api/.env.example` with the Postgres hostname rewritten — only if it does not already exist.
- Runs `pnpm install`.

Wait for the terminal output to finish before continuing.

**2. Set JWT secrets**

The auto-created `.env` carries the placeholder secrets from `.env.example`. Replace them before starting the app:

```
JWT_ACCESS_SECRET=<random 32+ byte base64 string>
JWT_REFRESH_SECRET=<different random 32+ byte base64 string>
```

Generate values with PowerShell (run twice):

```powershell
[System.Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Max 256) }))
```

> **Tip:** If you put a `.env` with real secrets in the repo root **before** opening the container for the first time, `setup.sh` will detect it and skip the copy entirely — your secrets are preserved.

**3. Apply migrations and seed**

```bash
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
```

**4. Start the dev servers**

```bash
pnpm dev
```

VS Code will notify you when ports 3000 and 3001 are forwarded. Open http://localhost:3000 to verify.

**Ports forwarded automatically:**

| Port | Service |
|------|---------|
| 3000 | Next.js web |
| 3001 | NestJS API |
| 8025 | MailHog web UI |
| 15672 | RabbitMQ management UI |
| 5432 | PostgreSQL (primary) |
| 5433 | PostgreSQL (sandbox) |

---

## Option B — Local setup {#local-setup}

Use this if you prefer to run tooling directly on your machine.

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 (developed on v24) | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 11 | Enabled via Corepack (see step 1) |
| Docker Desktop | any recent | For Postgres, Redis, RabbitMQ, MailHog |

### Steps

### 1. Enable pnpm via Corepack

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

> **Windows note:** If Corepack can't write to the global Node directory, it installs a shim in `%LOCALAPPDATA%\pnpm-shim`. Open a **new terminal** so `pnpm` resolves from the PATH.

Verify: `pnpm --version` should print `11.x.x` or higher.

### 2. Clone and install dependencies

```bash
git clone <repo-url>
cd sql-education
pnpm install
```

### 3. Copy environment files

```bash
# Linux / macOS
cp .env.example .env
cp apps/api/.env.example apps/api/.env

# Windows (PowerShell)
copy .env.example .env
copy apps\api\.env.example apps\api\.env
```

The `.env` file at the repo root is read by the API at runtime and by Turbo for build-time env passthrough. `apps/api/.env` is read exclusively by the Prisma CLI. See [Configuration](../reference/configuration.md) for all variables.

### 4. Start infrastructure

```bash
docker compose up -d postgres sandbox-postgres redis rabbitmq mailhog
```

This starts five services. Wait ~10 seconds for Postgres to finish initializing before the next step.

| Service | Port | What it does |
|---------|------|-------------|
| `postgres` | 5432 | Main application database |
| `sandbox-postgres` | 5433 | Isolated SQL execution for student queries |
| `redis` | 6379 | Token cache, activation codes, AI quota |
| `rabbitmq` | 5672 / 15672 | Email queue (management UI at :15672) |
| `mailhog` | 1025 / 8025 | Dev SMTP capture (web UI at :8025) |

### 5. Generate Prisma client and apply migrations

```bash
pnpm prisma:generate   # generates the TypeScript Prisma client
pnpm db:migrate        # applies all committed migrations to postgres
```

### 6. Seed curriculum content

```bash
pnpm db:seed
```

This upserts all `SandboxDataset`, `Block`, and `Task` records from the baked JSON files in `apps/api/prisma/seed/`. It is idempotent — safe to run multiple times.

### 7. Start the dev servers

```bash
pnpm dev
```

Turbo starts both apps in watch mode:

| App | URL |
|-----|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger (API docs) | http://localhost:3001/docs |

## Verify it worked

1. Open http://localhost:3000 — you should see the login page.
2. Register a new account.
3. Open http://localhost:8025 (MailHog) — the activation email should appear. Copy the 6-character code.
4. Activate your account at http://localhost:3000/activate.
5. You should land on the dashboard showing curriculum levels.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `pnpm: command not found` | Corepack shim not on PATH | Open a new terminal; check `%LOCALAPPDATA%\pnpm-shim` is in `$PATH` |
| `Can't reach database server at localhost:5432` | Postgres container not ready | `docker compose ps` — wait for `healthy` status; or `docker compose up -d postgres` |
| `Environment validation failed` | Missing or wrong keys in `.env` | Compare `.env` with `.env.example`; check [Configuration](../reference/configuration.md) |
| `P3009` Prisma migration error | Migrations out of sync | Run `pnpm --filter api db:migrate:dev` to create a new migration |
| Seed fails with "reference query returned no rows" | Dataset setup SQL is wrong | Run `pnpm --filter api db:validate` to debug the failing task |
| Activation email never arrives | RabbitMQ or MailHog not running | `docker compose up -d rabbitmq mailhog`; check :15672 for queue activity |

---

*Next: [Development](development.md) for day-to-day workflow, or back to the [index](../INDEX.md).*
