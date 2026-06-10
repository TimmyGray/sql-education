import { Injectable, Logger } from "@nestjs/common";
import type { ComparisonMode, SubmitResult } from "@sql-edu/contracts";
import {
  SandboxExecutionError,
  SandboxRunner,
} from "../sandbox/sandbox-runner";
import { checkForbiddenStatement } from "./forbidden-statement.guard";
import { compareResults, type TabularResult } from "./result-comparison";

/**
 * The dataset bootstrap a task needs to be graded against.
 */
export interface GradingDataset {
  setupSql: string;
}

/**
 * Minimal, structural view of a Task required for grading. Kept as an interface
 * (not the Prisma type) so callers can pass any object with these fields and the
 * service stays decoupled from the ORM payload generics.
 *
 * `expectedResultJson` MUST be the pinned `{ columns, rows }` shape written by
 * the content seed.
 */
export interface GradableTask {
  comparisonMode: ComparisonMode;
  expectedResultJson: TabularResult;
  dataset: GradingDataset;
}

export interface GradeArgs {
  task: GradableTask;
  userSql: string;
}

/** Default per-statement timeout for a grading run. */
const DEFAULT_TIMEOUT_MS = 2000;

/**
 * GradingService — orchestrates the safe grading pipeline:
 *
 *   1. Forbidden-statement guard (pure)            → FORBIDDEN
 *   2. Execute in the isolated sandbox runner       → TIMEOUT/SYNTAX/RUNTIME
 *   3. Compare to expected under comparisonMode      → WRONG_RESULT / correct
 *
 * Returns the contract {@link SubmitResult}. On success/failure it includes the
 * USER's columns/rows for display (never the expected result). Persistence and
 * progress updates are the caller's (StudyService) responsibility — this service
 * is side-effect free apart from invoking the runner.
 */
@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(private readonly runner: SandboxRunner) {}

  async grade({ task, userSql }: GradeArgs): Promise<SubmitResult> {
    // --- 1. Forbidden-statement guard (short-circuits before the runner). ---
    const guard = checkForbiddenStatement(userSql);
    if (!guard.ok) {
      this.logger.debug(`grade: forbidden statement rejected — ${guard.message}`);
      return {
        correct: false,
        status: "NOT_STARTED",
        message: guard.message ?? "This kind of statement is not allowed.",
        errorType: "FORBIDDEN",
      };
    }

    // --- 2. Execute the user's query in the isolated sandbox. ---
    let result: TabularResult;
    try {
      result = await this.runner.runGraded(
        task.dataset.setupSql,
        userSql,
        DEFAULT_TIMEOUT_MS,
      );
    } catch (err) {
      if (err instanceof SandboxExecutionError) {
        this.logger.debug(
          `grade: sandbox error ${err.errorType} — ${err.message}`,
        );
        return {
          correct: false,
          status: "NOT_STARTED",
          message: err.message,
          errorType: err.errorType,
        };
      }
      // Unknown failure — surface a safe, generic runtime error.
      this.logger.error(
        `grade: unexpected sandbox failure — ${(err as Error).message}`,
      );
      return {
        correct: false,
        status: "NOT_STARTED",
        message: "Your query could not be executed.",
        errorType: "RUNTIME",
      };
    }

    // --- 3. Compare to expected under the task's comparison mode. ---
    const isCorrect = compareResults(
      result,
      task.expectedResultJson,
      task.comparisonMode,
    );

    if (isCorrect) {
      this.logger.debug("grade: result matches expected output");
      return {
        correct: true,
        status: "COMPLETED",
        message: "Correct!",
        columns: result.columns,
        rows: result.rows,
      };
    }

    this.logger.debug("grade: result does not match expected output");
    return {
      correct: false,
      status: "NOT_STARTED",
      message:
        "Your query ran, but the result does not match the expected output.",
      errorType: "WRONG_RESULT",
      columns: result.columns,
      rows: result.rows,
    };
  }
}
