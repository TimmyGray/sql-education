/**
 * SandboxRunner tests. The `pg` module is fully mocked — NO real database.
 * We assert the exact statement sequence (BEGIN / SET LOCAL / CREATE SCHEMA /
 * search_path / setup / user / ROLLBACK), result mapping, and that ROLLBACK is
 * always issued (even when the user query throws).
 */

// ---- pg mock plumbing -----------------------------------------------------
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};
const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  on: jest.fn(),
  end: jest.fn().mockResolvedValue(undefined),
};
const PoolCtor = jest.fn().mockImplementation(() => mockPool);

jest.mock("pg", () => ({
  Pool: PoolCtor,
}));

import { ConfigService } from "@nestjs/config";
import { PgSandboxRunner, mapPgErrorType } from "./pg-sandbox-runner";
import { SandboxExecutionError } from "./sandbox-runner";

function makeRunner(url = "postgres://sandbox_runner:pw@localhost:5433/sandbox") {
  const config = {
    get: jest.fn().mockReturnValue(url),
  } as unknown as ConfigService;
  return new PgSandboxRunner(config);
}

/** Build a pg-like QueryResult. */
function queryResult(fields: string[], rows: Record<string, unknown>[]) {
  return {
    fields: fields.map((name) => ({ name })),
    rows,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: every control statement resolves with an empty result.
  mockClient.query.mockResolvedValue({ fields: [], rows: [] });
});

describe("PgSandboxRunner.runGraded — happy path", () => {
  it("issues the isolation statement sequence in order and maps the result", async () => {
    // Sequence: BEGIN, SET LOCAL timeout, CREATE SCHEMA, SET LOCAL search_path,
    // setupSql, userSql (→ result), ROLLBACK.
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // SET LOCAL statement_timeout
      .mockResolvedValueOnce({}) // CREATE SCHEMA grade_run
      .mockResolvedValueOnce({}) // SET LOCAL search_path
      .mockResolvedValueOnce({}) // setupSql
      .mockResolvedValueOnce(
        queryResult(["id", "name"], [
          { id: 1, name: "a" },
          { id: 2, name: "b" },
        ]),
      ) // userSql
      .mockResolvedValueOnce({}); // ROLLBACK

    const runner = makeRunner();
    const res = await runner.runGraded(
      "CREATE TABLE t(id int)",
      "SELECT id, name FROM t",
      1500,
    );

    const sql = mockClient.query.mock.calls.map((c) => String(c[0]));
    expect(sql[0]).toBe("BEGIN");
    expect(sql[1]).toBe("SET LOCAL statement_timeout = '1500ms'");
    expect(sql[2]).toBe("CREATE SCHEMA grade_run");
    expect(sql[3]).toBe("SET LOCAL search_path TO grade_run");
    expect(sql[4]).toBe("CREATE TABLE t(id int)");
    expect(sql[5]).toBe("SELECT id, name FROM t");
    expect(sql[6]).toBe("ROLLBACK");

    // Result mapped to columns + ordered row tuples.
    expect(res.columns).toEqual(["id", "name"]);
    expect(res.rows).toEqual([
      [1, "a"],
      [2, "b"],
    ]);

    // Client always released.
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("maps rows into field order even if row object key order differs", async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // timeout
      .mockResolvedValueOnce({}) // schema
      .mockResolvedValueOnce({}) // search_path
      .mockResolvedValueOnce({}) // setup
      .mockResolvedValueOnce(
        queryResult(["a", "b"], [{ b: 2, a: 1 }]),
      ) // userSql with reversed key order
      .mockResolvedValueOnce({}); // ROLLBACK

    const runner = makeRunner();
    const res = await runner.runGraded("setup", "SELECT a, b", 2000);
    expect(res.rows).toEqual([[1, 2]]);
  });

  it("clamps a non-finite timeout to a safe default", async () => {
    const runner = makeRunner();
    await runner.runGraded("setup", "SELECT 1", Number.NaN);
    const sql = mockClient.query.mock.calls.map((c) => String(c[0]));
    expect(sql[1]).toBe("SET LOCAL statement_timeout = '2000ms'");
  });
});

describe("PgSandboxRunner.runGraded — error handling", () => {
  it("ALWAYS issues ROLLBACK and releases when the user query throws", async () => {
    const pgErr = Object.assign(new Error("syntax error at or near"), {
      code: "42601",
    });
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // timeout
      .mockResolvedValueOnce({}) // schema
      .mockResolvedValueOnce({}) // search_path
      .mockResolvedValueOnce({}) // setup
      .mockRejectedValueOnce(pgErr) // userSql throws
      .mockResolvedValueOnce({}); // ROLLBACK

    const runner = makeRunner();
    await expect(
      runner.runGraded("setup", "SELCT 1", 2000),
    ).rejects.toBeInstanceOf(SandboxExecutionError);

    const sql = mockClient.query.mock.calls.map((c) => String(c[0]));
    expect(sql).toContain("ROLLBACK");
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("classifies code 57014 as TIMEOUT with a safe message", async () => {
    const pgErr = Object.assign(new Error("canceling statement"), {
      code: "57014",
    });
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(pgErr)
      .mockResolvedValueOnce({});

    const runner = makeRunner();
    await expect(runner.runGraded("s", "SELECT pg_sleep(99)", 100)).rejects.toMatchObject(
      { errorType: "TIMEOUT" },
    );
  });

  it("classifies undefined table/column (42P01/42703) as RUNTIME", async () => {
    for (const code of ["42P01", "42703"]) {
      jest.clearAllMocks();
      mockClient.query.mockResolvedValue({ fields: [], rows: [] });
      const pgErr = Object.assign(new Error("does not exist"), { code });
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(pgErr)
        .mockResolvedValueOnce({});
      const runner = makeRunner();
      await expect(
        runner.runGraded("s", "SELECT * FROM nope", 2000),
      ).rejects.toMatchObject({ errorType: "RUNTIME" });
    }
  });

  it("does not let a ROLLBACK failure mask the original error", async () => {
    const pgErr = Object.assign(new Error("boom"), { code: "42601" });
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // timeout
      .mockResolvedValueOnce({}) // schema
      .mockResolvedValueOnce({}) // search_path
      .mockResolvedValueOnce({}) // setup
      .mockRejectedValueOnce(pgErr) // userSql throws
      .mockRejectedValueOnce(new Error("rollback failed")); // ROLLBACK also throws

    const runner = makeRunner();
    await expect(runner.runGraded("s", "bad", 2000)).rejects.toMatchObject({
      errorType: "SYNTAX",
    });
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("throws a safe RUNTIME error when the sandbox is not configured", async () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const runner = new PgSandboxRunner(config);
    await expect(runner.runGraded("s", "SELECT 1", 2000)).rejects.toBeInstanceOf(
      SandboxExecutionError,
    );
  });
});

describe("mapPgErrorType (pure)", () => {
  it.each([
    ["57014", "TIMEOUT"],
    ["42601", "SYNTAX"],
    ["42P01", "RUNTIME"],
    ["42703", "RUNTIME"],
    ["08006", "RUNTIME"],
    [undefined, "RUNTIME"],
  ])("%s → %s", (code, expected) => {
    expect(mapPgErrorType(code as string | undefined)).toBe(expected);
  });
});
