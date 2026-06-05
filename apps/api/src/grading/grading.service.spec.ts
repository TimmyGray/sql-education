import { GradingService, type GradableTask } from "./grading.service";
import {
  SandboxExecutionError,
  SandboxRunner,
  type SandboxResult,
} from "../sandbox/sandbox-runner";

/** A controllable fake runner so no real pg is involved. */
class FakeRunner extends SandboxRunner {
  public calls: Array<{ setupSql: string; userSql: string; timeoutMs: number }> =
    [];
  constructor(
    private readonly behavior:
      | { kind: "result"; result: SandboxResult }
      | { kind: "throw"; error: unknown },
  ) {
    super();
  }
  async runGraded(
    setupSql: string,
    userSql: string,
    timeoutMs: number,
  ): Promise<SandboxResult> {
    this.calls.push({ setupSql, userSql, timeoutMs });
    if (this.behavior.kind === "throw") {
      throw this.behavior.error;
    }
    return this.behavior.result;
  }
}

const task = (overrides: Partial<GradableTask> = {}): GradableTask => ({
  comparisonMode: "UNORDERED",
  expectedResultJson: { columns: ["id"], rows: [[1], [2]] },
  dataset: { setupSql: "CREATE TABLE t(id int); INSERT INTO t VALUES (1),(2);" },
  ...overrides,
});

describe("GradingService", () => {
  it("returns correct=true with user columns/rows when result matches", async () => {
    const runner = new FakeRunner({
      kind: "result",
      result: { columns: ["id"], rows: [[2], [1]] }, // unordered match
    });
    const svc = new GradingService(runner);

    const res = await svc.grade({ task: task(), userSql: "SELECT id FROM t" });

    expect(res.correct).toBe(true);
    expect(res.status).toBe("COMPLETED");
    expect(res.message).toBe("Correct!");
    expect(res.columns).toEqual(["id"]);
    expect(res.rows).toEqual([[2], [1]]);
    expect(res.errorType).toBeUndefined();
  });

  it("returns WRONG_RESULT with user data when result mismatches", async () => {
    const runner = new FakeRunner({
      kind: "result",
      result: { columns: ["id"], rows: [[1]] },
    });
    const svc = new GradingService(runner);

    const res = await svc.grade({ task: task(), userSql: "SELECT id FROM t" });

    expect(res.correct).toBe(false);
    expect(res.status).toBe("NOT_STARTED");
    expect(res.errorType).toBe("WRONG_RESULT");
    expect(res.columns).toEqual(["id"]);
    expect(res.rows).toEqual([[1]]);
  });

  it("maps a runner TIMEOUT error (code 57014) to errorType TIMEOUT", async () => {
    const runner = new FakeRunner({
      kind: "throw",
      error: new SandboxExecutionError("TIMEOUT", "took too long"),
    });
    const svc = new GradingService(runner);

    const res = await svc.grade({ task: task(), userSql: "SELECT pg_sleep(10)" });

    expect(res.correct).toBe(false);
    expect(res.status).toBe("NOT_STARTED");
    expect(res.errorType).toBe("TIMEOUT");
    expect(res.message).toBe("took too long");
  });

  it("maps SYNTAX and RUNTIME sandbox errors through", async () => {
    for (const t of ["SYNTAX", "RUNTIME"] as const) {
      const runner = new FakeRunner({
        kind: "throw",
        error: new SandboxExecutionError(t, `${t} message`),
      });
      const svc = new GradingService(runner);
      const res = await svc.grade({ task: task(), userSql: "SELECT 1" });
      expect(res.errorType).toBe(t);
      expect(res.correct).toBe(false);
    }
  });

  it("treats an unknown thrown error as RUNTIME with a safe message", async () => {
    const runner = new FakeRunner({
      kind: "throw",
      error: new Error("raw internal detail"),
    });
    const svc = new GradingService(runner);

    const res = await svc.grade({ task: task(), userSql: "SELECT 1" });

    expect(res.errorType).toBe("RUNTIME");
    expect(res.message).not.toContain("raw internal detail");
  });

  it("FORBIDDEN short-circuits BEFORE the runner is called", async () => {
    const runner = new FakeRunner({
      kind: "result",
      result: { columns: [], rows: [] },
    });
    const svc = new GradingService(runner);

    const res = await svc.grade({
      task: task(),
      userSql: "DROP TABLE t",
    });

    expect(res.correct).toBe(false);
    expect(res.errorType).toBe("FORBIDDEN");
    expect(runner.calls).toHaveLength(0); // runner never invoked
  });

  it("FORBIDDEN also blocks multi-statement submissions before the runner", async () => {
    const runner = new FakeRunner({
      kind: "result",
      result: { columns: [], rows: [] },
    });
    const svc = new GradingService(runner);

    const res = await svc.grade({
      task: task(),
      userSql: "SELECT 1; DROP TABLE t",
    });

    expect(res.errorType).toBe("FORBIDDEN");
    expect(runner.calls).toHaveLength(0);
  });

  it("passes the dataset setupSql and default 2000ms timeout to the runner", async () => {
    const runner = new FakeRunner({
      kind: "result",
      result: { columns: ["id"], rows: [[1], [2]] },
    });
    const svc = new GradingService(runner);

    await svc.grade({ task: task(), userSql: "SELECT id FROM t" });

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0].setupSql).toContain("CREATE TABLE t");
    expect(runner.calls[0].userSql).toBe("SELECT id FROM t");
    expect(runner.calls[0].timeoutMs).toBe(2000);
  });

  it("honours ORDERED comparison mode", async () => {
    const runner = new FakeRunner({
      kind: "result",
      result: { columns: ["id"], rows: [[2], [1]] }, // wrong order
    });
    const svc = new GradingService(runner);

    const res = await svc.grade({
      task: task({
        comparisonMode: "ORDERED",
        expectedResultJson: { columns: ["id"], rows: [[1], [2]] },
      }),
      userSql: "SELECT id FROM t",
    });

    expect(res.correct).toBe(false);
    expect(res.errorType).toBe("WRONG_RESULT");
  });
});
