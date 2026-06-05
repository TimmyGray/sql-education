import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, types as pgTypes, type PoolClient, type QueryResult } from "pg";
import {
  SandboxExecutionError,
  SandboxResult,
  SandboxRunner,
  type SandboxErrorType,
} from "./sandbox-runner";

/**
 * Parse Postgres DATE/TIME/TIMESTAMP(TZ) as RAW STRINGS instead of JS `Date`
 * objects. Two reasons:
 *  - The grader compares cells with `String(value)`; a `Date` object would
 *    stringify to a locale string and never match the baked ISO/string value.
 *  - Raw strings are TIMEZONE-INDEPENDENT ("2020-03-15"), so grading matches the
 *    statically-baked `expectedResultJson` regardless of the host/container TZ
 *    (e.g. host UTC-9 vs a UTC Docker container). The seed validator applies the
 *    SAME parsers so both sides agree.
 * Guarded so the unit tests (which mock `pg` without `types`) are unaffected.
 */
function configureSandboxDateParsers(): void {
  if (!pgTypes || typeof pgTypes.setTypeParser !== "function") {
    return;
  }
  const identity = (v: string): string => v;
  for (const oid of [1082, 1083, 1114, 1184]) {
    pgTypes.setTypeParser(oid, identity);
  }
}
configureSandboxDateParsers();

/**
 * Minimal shape of a Postgres error we care about (code-bearing). `pg` throws
 * plain Error objects decorated with a SQLSTATE `code`.
 */
interface PgError extends Error {
  code?: string;
}

function isPgError(err: unknown): err is PgError {
  return err instanceof Error && typeof (err as PgError).code === "string";
}

/**
 * Map a Postgres SQLSTATE to one of our user-facing error categories.
 *  - 57014 → statement timeout
 *  - 42601 → syntax error
 *  - 42P01 / 42703 → undefined table / column (treated as RUNTIME)
 *  - anything else → RUNTIME
 */
export function mapPgErrorType(code: string | undefined): SandboxErrorType {
  switch (code) {
    case "57014":
      return "TIMEOUT";
    case "42601":
      return "SYNTAX";
    case "42P01":
    case "42703":
      return "RUNTIME";
    default:
      return "RUNTIME";
  }
}

/** Safe, user-presentable message per error category (never leaks internals). */
export function safeMessageFor(
  errorType: SandboxErrorType,
  rawMessage?: string,
): string {
  switch (errorType) {
    case "TIMEOUT":
      return "Your query took too long to run and was cancelled. Try to make it more efficient.";
    case "SYNTAX":
      return rawMessage
        ? `SQL syntax error: ${rawMessage}`
        : "Your SQL has a syntax error.";
    case "RUNTIME":
      return rawMessage
        ? `Your query could not be executed: ${rawMessage}`
        : "Your query could not be executed.";
  }
}

/**
 * `pg.Pool`-backed {@link SandboxRunner}.
 *
 * Each grading run:
 *   1. checks out a client from a single shared pool;
 *   2. opens a transaction (`BEGIN`);
 *   3. clamps execution time (`SET LOCAL statement_timeout`);
 *   4. creates a throwaway `grade_run` schema and scopes `search_path` to it;
 *   5. runs the dataset `setupSql`, then the user's `userSql`;
 *   6. ALWAYS `ROLLBACK`s (even on error) so nothing persists, and releases the
 *      client back to the pool.
 *
 * The pool connects as the least-privilege `sandbox_runner` role against the
 * isolated sandbox database (SANDBOX_RUNNER_DATABASE_URL), so even a guard
 * bypass cannot touch application data.
 */
@Injectable()
export class PgSandboxRunner extends SandboxRunner implements OnModuleDestroy {
  private readonly logger = new Logger(PgSandboxRunner.name);
  private pool: Pool | null = null;

  constructor(private readonly config: ConfigService) {
    super();
  }

  /** Lazily build the pool so the app can boot even if the sandbox DB is down. */
  private getPool(): Pool {
    if (this.pool) {
      return this.pool;
    }
    const connectionString = this.config.get<string>(
      "SANDBOX_RUNNER_DATABASE_URL",
    );
    if (!connectionString) {
      throw new SandboxExecutionError(
        "RUNTIME",
        "Sandbox is not configured. Please try again later.",
      );
    }
    this.pool = new Pool({
      connectionString,
      // Keep the footprint small — grading is short-lived and bursty.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.pool.on("error", (err) => {
      // Never let a background idle-client error crash the process.
      this.logger.error(`Sandbox pool error: ${err.message}`);
    });
    return this.pool;
  }

  async runGraded(
    setupSql: string,
    userSql: string,
    timeoutMs: number,
  ): Promise<SandboxResult> {
    const pool = this.getPool();
    let client: PoolClient;
    try {
      client = await pool.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to acquire sandbox client: ${message}`);
      throw new SandboxExecutionError(
        "RUNTIME",
        "Could not reach the sandbox database. Please try again.",
      );
    }

    try {
      await client.query("BEGIN");
      // Clamp per-statement time. Integer ms — guard against junk input.
      const ms = Number.isFinite(timeoutMs) ? Math.max(1, Math.floor(timeoutMs)) : 2000;
      await client.query(`SET LOCAL statement_timeout = '${ms}ms'`);
      await client.query("CREATE SCHEMA grade_run");
      await client.query("SET LOCAL search_path TO grade_run");

      // Dataset bootstrap. Multi-statement string is fine over the simple
      // query protocol (no parameters here).
      await client.query(setupSql);

      // The user's query. This is the only result we surface.
      const result: QueryResult = await client.query(userSql);

      const columns = (result.fields ?? []).map((f) => f.name);
      const rows = (result.rows ?? []).map((row: Record<string, unknown>) =>
        columns.map((col) => row[col]),
      );
      return { columns, rows };
    } catch (err) {
      const code = isPgError(err) ? err.code : undefined;
      const errorType = mapPgErrorType(code);
      const raw = err instanceof Error ? err.message : undefined;
      throw new SandboxExecutionError(errorType, safeMessageFor(errorType, raw));
    } finally {
      // Disposable schema lives only inside this tx; rolling back removes it and
      // discards any setup side effects. Guard the rollback/release so a cleanup
      // failure never masks the original error.
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        const message =
          rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
        this.logger.warn(`Sandbox ROLLBACK failed: ${message}`);
      }
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
