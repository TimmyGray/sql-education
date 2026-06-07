/**
 * Tests for the pure SQLite execution core. These use a REAL in-memory
 * better-sqlite3 database (fast, deterministic, no external service) to assert
 * result shape, isolation, the row cap, and error classification.
 */
import {
  MAX_RESULT_ROWS,
  executeInSqlite,
  mapSqliteErrorType,
  safeMessageFor,
} from "./sqlite-executor";
import { SandboxExecutionError } from "./sandbox-runner";

const SETUP = `
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  salary NUMERIC(10,2) NOT NULL,
  hire_date DATE NOT NULL
);
INSERT INTO employees (id, name, salary, hire_date) VALUES
  (1, 'Alice', 95000.00, '2020-03-15'),
  (2, 'Bob',   85000.00, '2019-07-01'),
  (3, 'Carol', 72000.00, '2021-01-10');
`;

describe("executeInSqlite — happy path", () => {
  it("returns columns in select order and rows as positional tuples", () => {
    const res = executeInSqlite(SETUP, "SELECT id, name FROM employees ORDER BY id");
    expect(res.columns).toEqual(["id", "name"]);
    expect(res.rows).toEqual([
      [1, "Alice"],
      [2, "Bob"],
      [3, "Carol"],
    ]);
  });

  it("returns DATE values as raw strings (stable for comparison)", () => {
    const res = executeInSqlite(
      SETUP,
      "SELECT hire_date FROM employees WHERE id = 1",
    );
    expect(res.rows).toEqual([["2020-03-15"]]);
  });

  it("preserves aliased and unaliased expression column names", () => {
    const res = executeInSqlite(
      SETUP,
      "SELECT COUNT(*) AS n, MAX(salary) FROM employees",
    );
    expect(res.columns).toEqual(["n", "MAX(salary)"]);
    expect(res.rows).toEqual([[3, 95000]]);
  });

  it("supports window functions (curriculum needs RANK/ROW_NUMBER)", () => {
    const res = executeInSqlite(
      SETUP,
      "SELECT name, RANK() OVER (ORDER BY salary DESC) AS rnk FROM employees",
    );
    expect(res.rows).toEqual([
      ["Alice", 1],
      ["Bob", 2],
      ["Carol", 3],
    ]);
  });

  it("isolates state between calls (each run is a fresh database)", () => {
    executeInSqlite(SETUP, "SELECT 1");
    // A second call with no setup must NOT see the previous run's table.
    expect(() => executeInSqlite("", "SELECT * FROM employees")).toThrow(
      SandboxExecutionError,
    );
  });
});

describe("executeInSqlite — error handling", () => {
  it("classifies a syntax error as SYNTAX", () => {
    expect.assertions(2);
    try {
      executeInSqlite(SETUP, "SELCT * FROM employees");
    } catch (err) {
      expect(err).toBeInstanceOf(SandboxExecutionError);
      expect((err as SandboxExecutionError).errorType).toBe("SYNTAX");
    }
  });

  it("classifies an unknown table as RUNTIME", () => {
    expect.assertions(1);
    try {
      executeInSqlite(SETUP, "SELECT * FROM nope");
    } catch (err) {
      expect((err as SandboxExecutionError).errorType).toBe("RUNTIME");
    }
  });

  it("caps runaway result sets at MAX_RESULT_ROWS", () => {
    const recursive = `
      WITH RECURSIVE seq(n) AS (
        SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ${MAX_RESULT_ROWS + 50}
      )
      SELECT n FROM seq
    `;
    expect.assertions(2);
    try {
      executeInSqlite("", recursive);
    } catch (err) {
      expect((err as SandboxExecutionError).errorType).toBe("RUNTIME");
      expect((err as SandboxExecutionError).message).toMatch(/too many rows/i);
    }
  });
});

describe("mapSqliteErrorType (pure)", () => {
  it("maps syntax-error messages to SYNTAX, everything else to RUNTIME", () => {
    expect(mapSqliteErrorType(new Error('near "SELCT": syntax error'))).toBe(
      "SYNTAX",
    );
    expect(mapSqliteErrorType(new Error("no such table: nope"))).toBe("RUNTIME");
    expect(mapSqliteErrorType("not an error")).toBe("RUNTIME");
  });
});

describe("safeMessageFor (pure)", () => {
  it("never leaks internals and includes the raw message where useful", () => {
    expect(safeMessageFor("TIMEOUT")).toMatch(/too long/i);
    expect(safeMessageFor("SYNTAX", "near x")).toContain("near x");
    expect(safeMessageFor("RUNTIME")).toMatch(/could not be executed/i);
  });
});
