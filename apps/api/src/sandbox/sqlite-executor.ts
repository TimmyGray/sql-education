import Database from "better-sqlite3";
import {
  SandboxExecutionError,
  type SandboxErrorType,
  type SandboxResult,
} from "./sandbox-runner";

/**
 * Core SQLite execution — PURE and SYNCHRONOUS, directly unit-testable.
 *
 * This runs the dataset `setupSql` followed by the user's `userSql` inside a
 * brand-new in-memory database. Because each call gets its own throwaway
 * `:memory:` DB that contains ONLY the task fixture, isolation is total: there
 * is no other data to leak, no shared state between users, and nothing to tear
 * down (the database is discarded when this function returns).
 *
 * The synchronous, blocking nature of better-sqlite3 means a pathological query
 * could hang the calling thread — so the timeout/DoS guarantee is provided by
 * the WORKER that hosts this function (see {@link SqliteSandboxRunner}), not
 * here. This module never deals with timeouts.
 */

/** Hard cap on returned rows — bounds memory before the host timeout can fire. */
export const MAX_RESULT_ROWS = 10_000;

/**
 * Classify a better-sqlite3 error into one of our user-facing categories.
 * SQLite reports both true syntax errors and "no such table/column" under the
 * generic `SQLITE_ERROR` code, so we disambiguate on the message text. TIMEOUT
 * is never produced here — it is enforced by the worker host.
 */
export function mapSqliteErrorType(err: unknown): SandboxErrorType {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  if (message.includes("syntax error")) {
    return "SYNTAX";
  }
  return "RUNTIME";
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
 * Run `setupSql` then `userSql` in a disposable in-memory SQLite database and
 * return the user query's tabular result.
 *
 * @throws SandboxExecutionError on syntax / runtime failure (mapped + safe).
 */
export function executeInSqlite(
  setupSql: string,
  userSql: string,
): SandboxResult {
  const db = new Database(":memory:");
  try {
    // Dataset bootstrap — may contain multiple statements.
    db.exec(setupSql);

    // The user's query. Positional-array rows match SandboxResult.rows; columns
    // come from the statement metadata so unaliased expressions keep SQLite's
    // own naming (which the baked expectedResultJson was generated against).
    const stmt = db.prepare(userSql);
    stmt.raw(true);
    const columns = stmt.columns().map((c) => c.name);

    const rows: unknown[][] = [];
    for (const row of stmt.iterate()) {
      rows.push(row as unknown[]);
      if (rows.length > MAX_RESULT_ROWS) {
        throw new SandboxExecutionError(
          "RUNTIME",
          "Your query returned too many rows. Add a filter or LIMIT.",
        );
      }
    }
    return { columns, rows };
  } catch (err) {
    if (err instanceof SandboxExecutionError) {
      throw err;
    }
    const errorType = mapSqliteErrorType(err);
    const raw = err instanceof Error ? err.message : undefined;
    throw new SandboxExecutionError(errorType, safeMessageFor(errorType, raw));
  } finally {
    db.close();
  }
}
