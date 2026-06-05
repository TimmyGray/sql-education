import {
  cellsEqual,
  compareResults,
  type TabularResult,
} from "./result-comparison";

const cols = (...c: string[]) => c;

describe("cellsEqual", () => {
  it("treats null and undefined as equal empties", () => {
    expect(cellsEqual(null, undefined)).toBe(true);
    expect(cellsEqual(null, null)).toBe(true);
    expect(cellsEqual(undefined, undefined)).toBe(true);
  });

  it("treats null vs a value as unequal", () => {
    expect(cellsEqual(null, 0)).toBe(false);
    expect(cellsEqual(0, null)).toBe(false);
    expect(cellsEqual(null, "")).toBe(false);
  });

  it("normalizes numeric vs string", () => {
    expect(cellsEqual(123, "123")).toBe(true);
    expect(cellsEqual("45.0", 45.0)).toBe(false); // String(45.0) === "45"
    expect(cellsEqual(45, "45")).toBe(true);
  });

  it("compares plain values by string form", () => {
    expect(cellsEqual("abc", "abc")).toBe(true);
    expect(cellsEqual("abc", "abd")).toBe(false);
    expect(cellsEqual(true, "true")).toBe(true);
  });
});

describe("compareResults — column matching", () => {
  const base: TabularResult = { columns: cols("a", "b"), rows: [[1, 2]] };

  it("fails when column count differs", () => {
    const actual: TabularResult = { columns: cols("a"), rows: [[1]] };
    expect(compareResults(actual, base, "UNORDERED")).toBe(false);
  });

  it("fails when column names differ", () => {
    const actual: TabularResult = { columns: cols("a", "c"), rows: [[1, 2]] };
    expect(compareResults(actual, base, "UNORDERED")).toBe(false);
  });

  it("fails when column ORDER differs", () => {
    const actual: TabularResult = { columns: cols("b", "a"), rows: [[2, 1]] };
    expect(compareResults(actual, base, "UNORDERED")).toBe(false);
  });

  it("passes when columns match exactly", () => {
    const actual: TabularResult = { columns: cols("a", "b"), rows: [[1, 2]] };
    expect(compareResults(actual, base, "UNORDERED")).toBe(true);
  });
});

describe("compareResults — ORDERED", () => {
  const expected: TabularResult = {
    columns: cols("id", "name"),
    rows: [
      [1, "alice"],
      [2, "bob"],
    ],
  };

  it("passes when rows match in order (with numeric/string normalization)", () => {
    const actual: TabularResult = {
      columns: cols("id", "name"),
      rows: [
        ["1", "alice"],
        ["2", "bob"],
      ],
    };
    expect(compareResults(actual, expected, "ORDERED")).toBe(true);
  });

  it("fails when row order differs", () => {
    const actual: TabularResult = {
      columns: cols("id", "name"),
      rows: [
        [2, "bob"],
        [1, "alice"],
      ],
    };
    expect(compareResults(actual, expected, "ORDERED")).toBe(false);
  });

  it("fails when row count differs", () => {
    const actual: TabularResult = {
      columns: cols("id", "name"),
      rows: [[1, "alice"]],
    };
    expect(compareResults(actual, expected, "ORDERED")).toBe(false);
  });

  it("handles null cells", () => {
    const exp: TabularResult = { columns: cols("x"), rows: [[null]] };
    const act: TabularResult = { columns: cols("x"), rows: [[null]] };
    expect(compareResults(act, exp, "ORDERED")).toBe(true);
  });
});

describe("compareResults — UNORDERED (multiset)", () => {
  const expected: TabularResult = {
    columns: cols("id"),
    rows: [[1], [2], [3]],
  };

  it("passes regardless of row order", () => {
    const actual: TabularResult = { columns: cols("id"), rows: [[3], [1], [2]] };
    expect(compareResults(actual, expected, "UNORDERED")).toBe(true);
  });

  it("respects duplicate multiplicity", () => {
    const exp: TabularResult = { columns: cols("id"), rows: [[1], [1], [2]] };
    const sameMultiset: TabularResult = {
      columns: cols("id"),
      rows: [[1], [2], [1]],
    };
    const wrongMultiset: TabularResult = {
      columns: cols("id"),
      rows: [[1], [2], [2]],
    };
    expect(compareResults(sameMultiset, exp, "UNORDERED")).toBe(true);
    expect(compareResults(wrongMultiset, exp, "UNORDERED")).toBe(false);
  });

  it("fails when a row is missing", () => {
    const actual: TabularResult = { columns: cols("id"), rows: [[1], [2]] };
    expect(compareResults(actual, expected, "UNORDERED")).toBe(false);
  });

  it("normalizes cell types across the multiset", () => {
    const actual: TabularResult = {
      columns: cols("id"),
      rows: [["2"], ["3"], ["1"]],
    };
    expect(compareResults(actual, expected, "UNORDERED")).toBe(true);
  });
});
