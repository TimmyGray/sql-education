import { Injectable, Logger } from "@nestjs/common";
import * as path from "node:path";
import { Worker } from "node:worker_threads";
import {
  SandboxExecutionError,
  SandboxResult,
  SandboxRunner,
} from "./sandbox-runner";
import { safeMessageFor } from "./sqlite-executor";
import type {
  SandboxWorkerRequest,
  SandboxWorkerResponse,
} from "./sqlite-sandbox.worker";

/** Fallback when an unparseable timeout is passed in. */
const DEFAULT_TIMEOUT_MS = 2000;

/**
 * SQLite-backed {@link SandboxRunner}.
 *
 * Each grading run executes inside a short-lived worker thread hosting a fresh
 * in-memory database (see {@link executeInSqlite}). The worker provides two
 * things the in-process Postgres runner used to get from the server:
 *   - **Isolation:** the worker's DB holds only the task fixture, so untrusted
 *     SQL has nothing else to read or corrupt — no restricted role needed.
 *   - **Timeout:** better-sqlite3 is synchronous, so a runaway query would block
 *     its thread; we cap wall-clock time and `terminate()` the worker, turning a
 *     potential event-loop stall into a clean TIMEOUT error.
 *
 * One worker per request keeps the model simple and concurrency-safe; grading is
 * short and bursty so the spawn cost is acceptable. (A pooled worker is a
 * possible later optimization.)
 */
@Injectable()
export class SqliteSandboxRunner extends SandboxRunner {
  private readonly logger = new Logger(SqliteSandboxRunner.name);

  // The worker compiles next to this file, so at runtime it sits at
  // dist/sandbox/sqlite-sandbox.worker.js.
  private readonly workerPath = path.join(
    __dirname,
    "sqlite-sandbox.worker.js",
  );

  runGraded(
    setupSql: string,
    userSql: string,
    timeoutMs: number,
  ): Promise<SandboxResult> {
    const ms = Number.isFinite(timeoutMs)
      ? Math.max(1, Math.floor(timeoutMs))
      : DEFAULT_TIMEOUT_MS;

    const worker = new Worker(this.workerPath);

    return new Promise<SandboxResult>((resolve, reject) => {
      let settled = false;
      let timer: NodeJS.Timeout;

      // Single exit point: stop the timer, kill the worker, settle once.
      const finish = (settle: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        void worker.terminate();
        settle();
      };

      timer = setTimeout(() => {
        finish(() =>
          reject(
            new SandboxExecutionError("TIMEOUT", safeMessageFor("TIMEOUT")),
          ),
        );
      }, ms);

      worker.once("message", (res: SandboxWorkerResponse) => {
        finish(() =>
          res.ok
            ? resolve({ columns: res.columns, rows: res.rows })
            : reject(new SandboxExecutionError(res.errorType, res.message)),
        );
      });

      worker.once("error", (err) => {
        this.logger.error(`Sandbox worker error: ${err.message}`);
        finish(() =>
          reject(
            new SandboxExecutionError(
              "RUNTIME",
              "Your query could not be executed.",
            ),
          ),
        );
      });

      worker.postMessage({ setupSql, userSql } as SandboxWorkerRequest);
    });
  }
}
