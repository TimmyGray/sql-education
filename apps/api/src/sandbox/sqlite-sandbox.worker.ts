import { parentPort } from "node:worker_threads";
import { SandboxExecutionError, type SandboxErrorType } from "./sandbox-runner";
import { executeInSqlite } from "./sqlite-executor";

/**
 * Worker-thread host for {@link executeInSqlite}.
 *
 * Running the synchronous SQLite execution in a dedicated worker lets the parent
 * ({@link SqliteSandboxRunner}) enforce a hard wall-clock timeout by terminating
 * this thread — even when a pathological query (e.g. an unbounded
 * `WITH RECURSIVE`) blocks it completely. One job per spawned worker: the parent
 * terminates the worker once it has the response.
 */

export interface SandboxWorkerRequest {
  setupSql: string;
  userSql: string;
}

export type SandboxWorkerResponse =
  | { ok: true; columns: string[]; rows: unknown[][] }
  | { ok: false; errorType: SandboxErrorType; message: string };

if (parentPort) {
  parentPort.on("message", (req: SandboxWorkerRequest) => {
    let response: SandboxWorkerResponse;
    try {
      const { columns, rows } = executeInSqlite(req.setupSql, req.userSql);
      response = { ok: true, columns, rows };
    } catch (err) {
      if (err instanceof SandboxExecutionError) {
        response = { ok: false, errorType: err.errorType, message: err.message };
      } else {
        response = {
          ok: false,
          errorType: "RUNTIME",
          message: "Your query could not be executed.",
        };
      }
    }
    parentPort!.postMessage(response);
  });
}
