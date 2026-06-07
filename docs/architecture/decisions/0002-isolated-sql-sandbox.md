# ADR-0002: Isolated PostgreSQL instance for untrusted SQL execution

> **Summary:** Student SQL queries run on a separate PostgreSQL instance with a restricted database role, not on the main application database.
> **Status:** Superseded by [ADR-0003](0003-sqlite-in-process-sandbox.md)
> **Date:** 2026-06-06

[← Back to docs index](../../INDEX.md) · [Architecture overview](../overview.md)

---

> **Superseded (2026-06-07):** The sandbox no longer uses a separate PostgreSQL
> instance. Untrusted SQL now runs in an embedded in-process SQLite database — see
> [ADR-0003](0003-sqlite-in-process-sandbox.md). This record is kept for history;
> the decision and consequences below describe the *previous* design.

## Context

The core feature of the platform is executing arbitrary SQL written by students. Running that SQL on the main database (which contains user accounts, progress, and curriculum data) is an unacceptable security risk: a student could read other users' passwords, delete their own progress records, or drop tables.

Even read-only access to the main DB would leak data (emails, password hashes, reference queries the student shouldn't see).

## Decision

We will run a **second PostgreSQL instance** (`sandbox-postgres`, port 5433) whose sole purpose is evaluating student queries. A restricted role (`sandbox_runner`) has no privileges on application tables. Each grading request:

1. Connects to the sandbox DB as `sandbox_admin`
2. Executes the task's `setupSql` (creates ephemeral tables, inserts fixture data)
3. Switches to `sandbox_runner` and executes the student's query
4. Returns the rows
5. Tears down the ephemeral tables

A 2-second query timeout is enforced at the Postgres `statement_timeout` level, not just the application level.

## Consequences

**Positive**
- Main DB is completely isolated from student SQL — no risk of data leakage or corruption.
- The `sandbox_runner` role cannot read application tables even via `UNION` injection.
- Timeout kills runaway queries (infinite loops, expensive full scans on large data).
- The sandbox can be reset to a clean state independently of the main DB.

**Negative / trade-offs**
- Two Postgres instances to provision and maintain (Docker mitigates local dev cost).
- Each grading request opens a new connection to sandbox-postgres (connection pool may be needed at scale).
- `setupSql` runs on every submission — for large datasets this adds latency. Mitigation: datasets are small by design.

**Follow-ups**
- Add connection pooling (PgBouncer) if throughput becomes a bottleneck.
- Consider snapshotting dataset state between requests instead of re-running `setupSql`.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| Same DB with row-level security | Complex to configure correctly; still risks leaking schema names and table structure |
| In-process SQLite (sql.js) | No real PostgreSQL dialect; students learn non-transferable syntax |
| Docker-per-submission | Too slow; overkill for the educational use case |

---

*[Architecture overview](../overview.md) · [Sandbox module](../modules.md#sandbox) · [Back to index](../../INDEX.md)*
