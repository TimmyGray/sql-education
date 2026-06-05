/**
 * SandboxRunner abstraction — the seam through which the grader executes
 * UNTRUSTED user SQL against an isolated, throwaway schema.
 *
 * GradingService depends ONLY on this abstract token, never on the concrete
 * `pg`-backed implementation. That keeps the isolation core swappable and lets
 * unit tests inject a fake runner (NO real database in unit tests).
 */

/** Tabular result of running a query: column names + row tuples in field order. */
export interface SandboxResult {
  columns: string[];
  rows: unknown[][];
}

/**
 * The specific failure categories the runner can surface. These map 1:1 to the
 * `errorType` values in the SubmitResult contract (minus FORBIDDEN/WRONG_RESULT,
 * which are decided by the grader, not the runner).
 */
export type SandboxErrorType = "TIMEOUT" | "SYNTAX" | "RUNTIME";

/**
 * Error thrown by a SandboxRunner when the user's SQL fails to execute.
 *
 * SECURITY: `message` must be SAFE to show the user — it must never leak the
 * expected result, the reference query, or internal infrastructure detail.
 */
export class SandboxExecutionError extends Error {
  constructor(
    public readonly errorType: SandboxErrorType,
    message: string,
  ) {
    super(message);
    this.name = "SandboxExecutionError";
  }
}

/**
 * Abstract runner. Implementations execute `setupSql` then `userSql` inside a
 * disposable, rolled-back transaction and return the user query's tabular
 * result. They MUST never mutate persistent data.
 */
export abstract class SandboxRunner {
  /**
   * Run the dataset setup followed by the user's query in an isolated schema.
   *
   * @param setupSql  Dataset bootstrap (may contain multiple statements).
   * @param userSql   The user's (already forbidden-guarded) SELECT/WITH query.
   * @param timeoutMs Per-statement timeout enforced via `statement_timeout`.
   * @throws SandboxExecutionError on timeout / syntax / runtime failure.
   */
  abstract runGraded(
    setupSql: string,
    userSql: string,
    timeoutMs: number,
  ): Promise<SandboxResult>;
}

/** DI token for {@link SandboxRunner}. */
export const SANDBOX_RUNNER = SandboxRunner;
