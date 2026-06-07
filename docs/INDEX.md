# Documentation Index

> **Summary:** Catalog of all project documentation with a one-line summary and a "read when" cue for each entry.

For task-based routing, see the **[Context Map in AGENTS.md](../AGENTS.md#context-map--what-to-read-for-the-task-at-hand)**.

---

## Start here

| Doc | Summary | Read when |
|-----|---------|-----------|
| [README](../README.md) | Project overview, quick start, commands | You're new to the project |
| [AGENTS](../AGENTS.md) | Conventions, guardrails, and context map | Before any code change — especially as an AI agent |

## Web frontend

| Doc | Summary | Read when |
|-----|---------|-----------|
| [Web AGENTS](../apps/web/AGENTS.md) | Conventions, guardrails, and context map for `apps/web` | Before any frontend change |
| [Web docs index](../apps/web/docs/INDEX.md) | Full web documentation index | Navigating web-specific docs |

## Architecture

| Doc | Summary | Read when |
|-----|---------|-----------|
| [Overview](architecture/overview.md) | System structure, components, data flow, security model | You need the big picture before changing anything non-trivial |
| [Modules](architecture/modules.md) | Every NestJS module + frontend section: responsibilities, key files, rules | You're changing a specific domain area |
| [Data model](architecture/data-model.md) | All Prisma entities, relationships, enums, and progression rules | You're touching the database schema or progression logic |
| [ADR-0001: Monorepo + contracts](architecture/decisions/0001-monorepo-shared-contracts.md) | Why a pnpm monorepo with shared Zod contracts | You want to understand why this architecture was chosen |
| [ADR-0002: Isolated sandbox](architecture/decisions/0002-isolated-sql-sandbox.md) | Why student SQL ran on a separate Postgres instance (**superseded by ADR-0003**) | You want the history of the sandbox design |
| [ADR-0003: In-process SQLite sandbox](architecture/decisions/0003-sqlite-in-process-sandbox.md) | Why student SQL now runs in embedded SQLite (worker thread) instead of a second Postgres | You're working on the grading or sandbox layer |

## Guides

| Doc | Summary | Read when |
|-----|---------|-----------|
| [Getting started](guides/getting-started.md) | Complete first-time local setup: Docker, migrations, seed, verify | Setting up the project for the first time |
| [Development](guides/development.md) | Day-to-day commands, adding curriculum content, workflow | Active development |
| [Testing](guides/testing.md) | Unit tests (Jest), e2e tests (Playwright), seed validation | Writing or running tests |

## Reference

| Doc | Summary | Read when |
|-----|---------|-----------|
| [Configuration](reference/configuration.md) | All environment variables, their defaults and purpose | Configuring the app or debugging missing env vars |
| [API](reference/api.md) | All REST endpoints, auth requirements, request/response shapes | Calling or extending the API |
| [Glossary](reference/glossary.md) | Domain terms (Level, Block, Task, XP, sandbox, grading pipeline) | A domain term is unclear |

---

*Each doc above starts with a header block (summary · read-when · related links) and links back here.*
