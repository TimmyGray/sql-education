/**
 * Integration tests for SqliteSandboxRunner's orchestration layer:
 * worker spawning, result forwarding, timeout enforcement, and error propagation.
 *
 * Worker threads run in a separate Node process so ts-jest cannot transform
 * them; we mock `worker_threads` here and test only what the runner is
 * responsible for. The executor's SQLite execution is covered by
 * sqlite-executor.spec.ts.
 */

// Capture event handlers so individual tests can trigger them.
let onMessage: (msg: unknown) => void = () => {};
let onError: (err: Error) => void = () => {};

const mockWorker = {
  once: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (event === "message") onMessage = handler as (msg: unknown) => void;
    if (event === "error") onError = handler as (err: Error) => void;
  }),
  postMessage: jest.fn(),
  terminate: jest.fn().mockResolvedValue(0),
};

jest.mock("node:worker_threads", () => ({
  Worker: jest.fn().mockImplementation(() => {
    onMessage = () => {};
    onError = () => {};
    return mockWorker;
  }),
}));

import { SandboxExecutionError } from "./sandbox-runner";
import { SqliteSandboxRunner } from "./sqlite-sandbox-runner";

describe("SqliteSandboxRunner — orchestration", () => {
  let runner: SqliteSandboxRunner;

  beforeEach(() => {
    jest.clearAllMocks();
    runner = new SqliteSandboxRunner();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves with the worker result and terminates the worker", async () => {
    const promise = runner.runGraded("CREATE TABLE t(id INT)", "SELECT id FROM t", 2000);
    onMessage({ ok: true, columns: ["id"], rows: [[1], [2]] });

    const result = await promise;

    expect(result).toEqual({ columns: ["id"], rows: [[1], [2]] });
    expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects with TIMEOUT and terminates the worker when the deadline elapses", async () => {
    jest.useFakeTimers();

    const promise = runner.runGraded("", "SELECT 1", 100);
    jest.advanceTimersByTime(101);

    await expect(promise).rejects.toMatchObject({
      errorType: "TIMEOUT",
    });
    expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects with RUNTIME when the worker thread emits an error event", async () => {
    const promise = runner.runGraded("", "SELECT 1", 2000);
    onError(new Error("Worker crashed unexpectedly"));

    await expect(promise).rejects.toMatchObject({
      errorType: "RUNTIME",
    });
    expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
  });

  it("propagates SYNTAX error from a worker error-response message", async () => {
    const promise = runner.runGraded("", "SELCT 1", 2000);
    onMessage({ ok: false, errorType: "SYNTAX", message: "SQL syntax error: near SELCT" });

    await expect(promise).rejects.toMatchObject({
      errorType: "SYNTAX",
      message: expect.stringContaining("SELCT"),
    });
  });

  it("propagates RUNTIME error from a worker error-response message", async () => {
    const promise = runner.runGraded("", "SELECT * FROM nope", 2000);
    onMessage({ ok: false, errorType: "RUNTIME", message: "Your query could not be executed: no such table: nope" });

    await expect(promise).rejects.toBeInstanceOf(SandboxExecutionError);
  });

  it("does not settle twice when timeout fires just before the message arrives", async () => {
    jest.useFakeTimers();

    const promise = runner.runGraded("", "SELECT 1", 100);
    jest.advanceTimersByTime(101);

    await expect(promise).rejects.toMatchObject({ errorType: "TIMEOUT" });

    // Late message must be silently ignored — no throw, no second settle.
    expect(() => onMessage({ ok: true, columns: [], rows: [] })).not.toThrow();
    // terminate still called only once (from the timeout path)
    expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
  });

  it("clamps a non-finite timeout to a safe default and still resolves", async () => {
    const promise = runner.runGraded("", "SELECT 1", Number.NaN);
    onMessage({ ok: true, columns: [], rows: [] });
    await expect(promise).resolves.toEqual({ columns: [], rows: [] });
  });
});
