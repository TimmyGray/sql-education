import type { ComparisonMode } from "@sql-edu/contracts";

/**
 * Result comparison (PURE, fully unit-tested).
 *
 * Compares the user's query result against the task's `expectedResultJson`
 * (`{ columns, rows }`) under the task's {@link ComparisonMode}:
 *   - ORDERED   → row sequences must be equal position-by-position.
 *   - UNORDERED → rows must be equal as multisets (bag equality).
 *
 * Cells are compared with string normalization so a Postgres numeric coming
 * back as `123` vs an expected `"123"` does not false-negative. The column SET
 * AND ORDER must match `expected.columns` exactly.
 */

export interface TabularResult {
  columns: string[];
  rows: unknown[][];
}

/**
 * Null-safe, type-tolerant cell equality. `null`/`undefined` are treated as the
 * same "empty" value; everything else compares by `String(value)` so
 * numeric-vs-string differences from the driver don't matter.
 */
export function cellsEqual(a: unknown, b: unknown): boolean {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull || bNull) {
    return aNull && bNull;
  }
  return String(a) === String(b);
}

/** Stable key for a row used in multiset comparison and column checks. */
function rowKey(row: unknown[]): string {
  // Normalize null/undefined to a sentinel so they hash consistently, and wrap
  // each cell as a string so 1 and "1" collide intentionally.
  return JSON.stringify(
    row.map((c) => (c === null || c === undefined ? null : String(c))),
  );
}

function columnsMatch(actual: string[], expected: string[]): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      return false;
    }
  }
  return true;
}

function rowsEqualOrdered(actual: unknown[][], expected: unknown[][]): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];
    if (a.length !== e.length) {
      return false;
    }
    for (let j = 0; j < e.length; j++) {
      if (!cellsEqual(a[j], e[j])) {
        return false;
      }
    }
  }
  return true;
}

function rowsEqualUnordered(
  actual: unknown[][],
  expected: unknown[][],
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  // Multiset equality via sorted normalized keys (handles duplicate rows).
  const a = actual.map(rowKey).sort();
  const e = expected.map(rowKey).sort();
  for (let i = 0; i < e.length; i++) {
    if (a[i] !== e[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Compare a user result against the expected result under `mode`.
 * Column order/set is always enforced; row order only for ORDERED.
 */
export function compareResults(
  actual: TabularResult,
  expected: TabularResult,
  mode: ComparisonMode,
): boolean {
  if (!columnsMatch(actual.columns, expected.columns)) {
    return false;
  }
  return mode === "ORDERED"
    ? rowsEqualOrdered(actual.rows, expected.rows)
    : rowsEqualUnordered(actual.rows, expected.rows);
}
