# Testing

> **Summary:** How to write and run unit tests (Jest), end-to-end tests (Playwright), and the curriculum seed validator.
> **Read this when:** You're adding new code that needs tests, or running the test suite.
> **Audience:** both
> **Related:** [Development](development.md) · [Getting started](getting-started.md)

[← Back to docs index](../INDEX.md)

---

## Test layers

| Layer | Tool | Location | Runs against |
|-------|------|----------|-------------|
| Unit (API) | Jest + `@nestjs/testing` | `apps/api/src/**/*.spec.ts` | mocked dependencies (sandbox executor uses a real in-memory SQLite) |
| Unit (Web) | Jest + React Testing Library | `apps/web/src/**/*.spec.tsx` | jsdom |
| End-to-end | Playwright | `e2e/tests/` | full running stack |
| Seed validation | custom runner | `apps/api/prisma/seed/validate.ts` | in-memory SQLite |

## Running tests

```bash
# All unit tests (Turbo)
pnpm test

# API unit tests only
pnpm --filter api test

# Web unit tests only
pnpm --filter web test

# End-to-end (full stack must be running first)
pnpm e2e

# First-time Playwright browser install
pnpm --filter @sql-edu/e2e install:browsers

# Seed validation (validates reference queries bake correctly)
pnpm --filter api db:validate
```

## API unit tests

Each service has a `*.service.spec.ts` alongside it. NestJS services are tested in isolation by passing fakes to the constructor.

**Pattern:**

```typescript
// study.service.spec.ts
describe('StudyService', () => {
  let service: StudyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StudyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GradingService, useValue: mockGrading },
        // ...
      ],
    }).compile();

    service = module.get(StudyService);
  });

  it('returns FORBIDDEN for locked blocks', async () => {
    // ...
  });
});
```

**Rules:**
- Mock `PrismaService`, `RedisService`, and other infrastructure — keep tests fast and offline.
- Tests for guards can mock `req.user = { userId, email, status }` directly.
- Do **not** use `jest.mock()` for modules in `@sql-edu/contracts` — import the real schemas.
- Exception: the sandbox executor (`sqlite-executor.spec.ts`) runs against a **real in-memory SQLite** — it's fast, deterministic, and needs no external service, so don't mock it.

## Web unit tests

React components are tested with React Testing Library and `jsdom`.

```typescript
// TaskCard.spec.tsx
import { render, screen } from '@/test-utils';  // custom render with providers

it('shows hint when hint button is clicked', async () => {
  render(<TaskCard task={mockTask} />);
  await userEvent.click(screen.getByRole('button', { name: /hint/i }));
  expect(screen.getByText(mockTask.hint)).toBeInTheDocument();
});
```

Test utilities (providers, custom render) are in `apps/web/src/test-utils/`.

## End-to-end tests

Playwright tests run against the full running stack. They test complete user journeys.

**Main journey** (`e2e/tests/journey.spec.ts`):
1. Register new account
2. Retrieve activation code from MailHog
3. Activate account
4. Navigate to dashboard
5. Enter study page and submit SQL answers
6. Reveal a reference answer (skips task)
7. Ask the AI tutor a question
8. Update account display name
9. Logout

**Helpers:**
- `e2e/tests/helpers/flows.ts` — reusable user actions (register, login, type SQL, etc.)
- `e2e/tests/helpers/data.ts` — test constants, unique email generation
- `e2e/tests/helpers/mailhog.ts` — fetches activation codes from the MailHog API

**Mobile viewport** (`e2e/tests/mobile.spec.ts`) — repeats key flows at 390×844.

**Running e2e locally:**

```bash
# 1. Ensure full stack is running
docker compose up -d
pnpm dev   # in another terminal (or use Docker full stack)

# 2. Run tests
pnpm e2e

# 3. Open Playwright UI (interactive mode)
pnpm --filter @sql-edu/e2e test --ui
```

**Global setup** (`e2e/tests/global-setup.ts`) seeds a clean DB state before the suite runs. Don't add data that conflicts with this seed.

## Seed validation

Before running `pnpm db:seed`, the validator confirms every `referenceQuery` returns rows that match the expected schema. Run it when you change or add tasks:

```bash
pnpm --filter api db:validate
```

If a task fails validation, the error includes the task prompt and the SQL error. Fix the `referenceQuery` or `setupSql` in the relevant seed file, then re-run.

## Coverage

```bash
pnpm --filter api test -- --coverage
pnpm --filter web test -- --coverage
```

Coverage reports are written to `coverage/` in each app directory.

---

*Next: [Development](development.md) for workflow commands, or back to the [index](../INDEX.md).*
