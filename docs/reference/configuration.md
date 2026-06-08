# Configuration

> **Summary:** All environment variables, their purpose, defaults, and which service requires them.
> **Read this when:** You're configuring a new environment, debugging a startup failure, or adding a new env var.
> **Audience:** both
> **Related:** [Getting started](../guides/getting-started.md) · [Architecture overview](../architecture/overview.md)

[← Back to docs index](../INDEX.md)

---

Source of truth: `.env.example` in the repo root. The API validates all variables at startup via Zod in `apps/api/src/config/env.validation.ts` — missing required variables cause an immediate startup error with a clear message.

## Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string for the main DB (used by Prisma at runtime) |
| `DIRECT_URL` | no | = `DATABASE_URL` | Non-pooled connection used by Prisma Migrate. Equal to `DATABASE_URL` for local Postgres. Set separately when using a pooled provider (e.g. Supabase pgBouncer): `DATABASE_URL` → pooler on port 6543 with `?pgbouncer=true`, `DIRECT_URL` → direct connection on port 5432. |

> **The SQL sandbox needs no configuration.** Untrusted student SQL runs in an embedded in-process SQLite database (a fresh in-memory DB per request) — there is no sandbox server, connection string, or role to set. See [ADR-0003](../architecture/decisions/0003-sqlite-in-process-sandbox.md).

> **Single source of truth:** the repo-root `.env` is used by everything. The API reads it via `ConfigModule.forRoot({ envFilePath: '../../.env' })`; Prisma CLI scripts are prefixed with `dotenv -e ../../.env --`. There is no `apps/api/.env`.

## Redis

The `RedisModule` auto-selects between a local ioredis client and the Upstash HTTP client based on which variables are present.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | local only | `redis://localhost:6379` | ioredis connection string — used when cloud vars are absent |
| `REDIS_CLOUD_URL` | cloud only | — | Upstash REST endpoint (`https://<name>.upstash.io`) |
| `REDIS_CLOUD_TOKEN` | cloud only | — | Upstash REST token |

**Selection logic:** if both `REDIS_CLOUD_URL` and `REDIS_CLOUD_TOKEN` are set, the Upstash HTTP client is used and `REDIS_URL` is ignored. Otherwise ioredis connects to `REDIS_URL` (defaults to `redis://localhost:6379`). Leave the cloud vars empty for local development.

Redis stores: JWT refresh token allowlist, email activation codes (15-min TTL), AI quota counters.

## RabbitMQ

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RABBITMQ_URL` | ✅ | — | AMQP URL (`amqp://user:pass@host:5672`) |

Used by the mail module — producer publishes to a queue, consumer dequeues and sends via SMTP.

## JWT

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_ACCESS_SECRET` | ✅ | — | Signing secret for access tokens |
| `JWT_REFRESH_SECRET` | ✅ | — | Signing secret for refresh tokens (must differ from access secret) |
| `JWT_ACCESS_TTL` | no | `900` | Access token TTL in seconds (default: 15 min) |
| `JWT_REFRESH_TTL` | no | `604800` | Refresh token TTL in seconds (default: 7 days) |

## Email (SMTP)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | ✅ | — | SMTP server hostname (`mailhog` in Docker, real host in prod) |
| `SMTP_PORT` | no | `1025` | SMTP port |
| `SMTP_USER` | no | — | SMTP username (not needed for MailHog) |
| `SMTP_PASS` | no | — | SMTP password |
| `MAIL_FROM` | no | `noreply@sql-edu.local` | Sender address in outgoing emails |

## AI tutor

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | no* | — | OpenRouter API key for LLM completions |
| `OPENAI_API_KEY` | no* | — | OpenAI API key (used if OpenRouter is not configured) |
| `AI_MODEL` | no | `openai/gpt-4o-mini` | Model identifier passed to the LLM provider |

*At least one AI key is required for the AI tutor feature to function. The API starts without them (env validation is intentionally permissive for optional integrations), but `POST /ai/ask` will fail at runtime.

## App

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_PORT` | no | `3001` | Port the NestJS API listens on |
| `WEB_ORIGIN` | ✅ | — | Web app origin for CORS (`http://localhost:3000` locally) |
| `NEXT_PUBLIC_API_URL` | ✅ | — | API base URL used by the Next.js app to make requests |
| `NODE_ENV` | no | `development` | `development` / `production` / `test` |

## Docker overrides

Inside `docker-compose.yml`, service hostnames replace `localhost`:

| Variable | Local value | Docker value |
|----------|-------------|-------------|
| `DATABASE_URL` | `...@localhost:5432/sql_edu` | `...@postgres:5432/sql_edu` |
| `DIRECT_URL` | `...@localhost:5432/sql_edu` | `...@postgres:5432/sql_edu` |
| `REDIS_URL` | `redis://localhost:6379` | `redis://redis:6379` |
| `RABBITMQ_URL` | `amqp://...@localhost:5672` | `amqp://...@rabbitmq:5672` |
| `SMTP_HOST` | `localhost` | `mailhog` |

> `REDIS_CLOUD_URL` / `REDIS_CLOUD_TOKEN` are cloud-deployment vars; they are not container-hostname-dependent and stay the same in any environment.

---

*Back to the [index](../INDEX.md).*
