# ADR-0001: Turborepo monorepo with shared `@sql-edu/contracts` package

> **Summary:** We use a pnpm + Turborepo monorepo with a dedicated contracts package as the single source of truth for API types.
> **Status:** Accepted
> **Date:** 2026-06-06

[← Back to docs index](../../INDEX.md) · [Architecture overview](../overview.md)

---

## Context

The project has two separate applications (NestJS API and Next.js web) that must agree on the shape of every request and response. Without a shared source of truth, the frontend and backend drift apart: the frontend calls an endpoint with a field the backend has renamed, or the backend adds a required field the frontend doesn't know about. This is especially painful when TypeScript types on each side diverge silently.

We also need a build system that understands the dependency order: contracts must be compiled before the apps that import them.

## Decision

We will maintain the project as a **pnpm workspace monorepo orchestrated by Turborepo**, with three top-level packages:

- `apps/api` — NestJS backend
- `apps/web` — Next.js frontend
- `packages/contracts` — shared Zod schemas + inferred TypeScript types

All API request/response types are defined **once** in `packages/contracts/src/` as Zod schemas and exported as TypeScript types. Both `apps/api` and `apps/web` consume them via the workspace alias `@sql-edu/contracts`. The Turbo pipeline declares `^build` so contracts always build before their consumers.

## Consequences

**Positive**
- Single source of truth: a schema change in contracts produces TypeScript errors in both the API and the web simultaneously.
- Runtime validation on both sides from the same Zod schema (API via `nestjs-zod`, web via direct `schema.parse()`).
- Build order is guaranteed by Turbo — no manual steps needed.
- `pnpm --filter` lets developers work on a single app without rebuilding the others.

**Negative / trade-offs**
- Adding a new endpoint requires touching three files: the contracts schema, the API handler, and the web client call.
- Contracts package must be rebuilt whenever its types change (Turbo handles this in CI; local dev requires `pnpm --filter @sql-edu/contracts build` on first run).
- Enums must be kept in sync between `packages/contracts/src/` and `apps/api/prisma/schema.prisma` — there is no automated check enforcing this.

**Follow-ups**
- Consider a lint rule or CI check to verify enum parity between contracts and schema.prisma.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| Separate repos with OpenAPI code-gen | More infra, slower iteration, generated types are often imprecise |
| Copy-paste types in each app | Silent drift — defeats the purpose |
| Single Next.js app with API routes | Couples frontend and backend lifecycles; prevents independent deployment |

---

*[Architecture overview](../overview.md) · [Back to index](../../INDEX.md)*
