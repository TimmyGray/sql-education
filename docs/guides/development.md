# Development

> **Summary:** Day-to-day development workflow: common commands, adding new curriculum content, database changes, and project conventions.
> **Read this when:** You're actively developing a feature or fixing a bug.
> **Audience:** both
> **Related:** [Getting started](getting-started.md) · [Testing](testing.md) · [Configuration](../reference/configuration.md)

[← Back to docs index](../INDEX.md)

---

## Daily workflow

```bash
# Start infrastructure (if not running)
docker compose up -d postgres redis rabbitmq mailhog

# Start dev servers (Turbo watches all packages)
pnpm dev
```

> The SQL sandbox is embedded SQLite (in-process) — there is no sandbox database to start.

After making changes to `packages/contracts/`, the contracts package rebuilds automatically via Turbo's watch pipeline. If you see stale type errors, run:

```bash
pnpm --filter @sql-edu/contracts build
```

## Key commands

| Command | Does |
|---------|------|
| `pnpm dev` | Start all apps in watch mode (Turbo) |
| `pnpm build` | Build all packages (contracts → api + web) |
| `pnpm lint` | ESLint + Prettier check across all packages |
| `pnpm typecheck` | TypeScript strict check (no emit) |
| `pnpm test` | Run all Jest unit tests |
| `pnpm e2e` | Run Playwright e2e tests (needs full running stack) |
| `pnpm prisma:generate` | Regenerate Prisma client (run after schema changes) |
| `pnpm db:migrate` | Apply committed migrations (`prisma migrate deploy`) |
| `pnpm --filter api db:migrate:dev` | Create + apply a new local migration during dev |
| `pnpm db:seed` | Seed curriculum content (idempotent) |
| `pnpm --filter api db:validate` | Validate all reference queries against their datasets |

## Adding a new API module

1. Create the directory: `apps/api/src/<feature>/`
2. Create `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.service.spec.ts`
3. Add any new request/response types to `packages/contracts/src/` as Zod schemas
4. Rebuild contracts: `pnpm --filter @sql-edu/contracts build`
5. Import the new module in `apps/api/src/app.module.ts` at the `=== FEATURE MODULES ===` seam
6. Add the new endpoint(s) to [docs/reference/api.md](../reference/api.md)

## Changing the database schema

1. Edit `apps/api/prisma/schema.prisma`
2. If adding/changing enums, mirror the change in `packages/contracts/src/` (the relevant `*.ts` file)
3. Create a migration:
   ```bash
   pnpm --filter api db:migrate:dev
   ```
   Prisma will prompt for a migration name (use kebab-case, e.g. `add-user-streak`)
4. Regenerate the client:
   ```bash
   pnpm prisma:generate
   ```
5. Update [docs/architecture/data-model.md](../architecture/data-model.md) if the entity structure changes

## Adding content {#adding-content}

Content (blocks, tasks, datasets) lives in `apps/api/prisma/seed/`. The workflow:

### 1. Define the content

Create or edit a block file, e.g. `apps/api/prisma/seed/novice/block6.ts`:

```typescript
import type { BlockSeed } from '../types';

export const block6: BlockSeed = {
  order: 6,
  title: 'Window Functions',
  theoryMarkdown: `...`,
  theoryExamples: [{ sql: 'SELECT ...', description: '...' }],
  tasks: [
    {
      order: 1,
      prompt: 'Rank employees by salary within each department.',
      hint: 'Use RANK() OVER (PARTITION BY ...)',
      datasetName: 'employees_v1',   // must match a SandboxDataset name
      referenceQuery: `SELECT ..., RANK() OVER (...) FROM ...`,
      comparisonMode: 'ORDERED',
    },
    // ...
  ],
};
```

Register it in `apps/api/prisma/seed/registry.ts` under the appropriate level array.

### 2. Validate

```bash
pnpm --filter api db:validate
```

This runs every `referenceQuery` against its dataset **in SQLite** (the same engine the grader uses), checks the result, and bakes it into `{level}/baked.json`. Always re-run it after changing any `setupSql` or reference query. Fix any errors before proceeding.

### 3. Seed

```bash
pnpm db:seed
```

Upserts the new records into the main database. Run `docker compose up -d postgres` if the DB isn't running.

### 4. Smoke test

Open http://localhost:3000, navigate to the level, and confirm the new block appears and its tasks are gradable.

## Working with the contracts package

All shared API types live in `packages/contracts/src/`. The package is built to `dist/` and imported as `@sql-edu/contracts`.

```typescript
// Adding a new schema
// packages/contracts/src/study.ts
export const NewFeatureSchema = z.object({ ... });
export type NewFeature = z.infer<typeof NewFeatureSchema>;

// Re-export from packages/contracts/src/index.ts
export { NewFeatureSchema } from './study';
```

After any change: `pnpm --filter @sql-edu/contracts build`

## Import rules

- Import shared types: `import { LoginSchema } from '@sql-edu/contracts'`
- Never use relative paths across package boundaries (`../../packages/contracts/...`)
- Frontend never imports from `apps/api/src/` directly

## Running a single app

```bash
pnpm --filter api dev      # API only (http://localhost:3001)
pnpm --filter web dev      # Web only (http://localhost:3000)
pnpm --filter api test     # API unit tests only
pnpm --filter web test     # Web unit tests only
```

## Docker full stack

```bash
docker compose up -d --build   # builds + starts api and web in containers
docker compose logs -f api     # stream API logs
docker compose down            # stop all services
```

---

*Next: [Testing](testing.md) for unit and e2e test details, or back to the [index](../INDEX.md).*
