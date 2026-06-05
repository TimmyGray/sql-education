import { checkForbiddenStatement } from "./forbidden-statement.guard";

describe("checkForbiddenStatement", () => {
  describe("allows read-only queries", () => {
    it.each([
      "SELECT 1",
      "select * from users",
      "  SELECT id FROM t  ",
      "SELECT 1;", // trailing semicolon only
      "SELECT 1 ;   ", // trailing semicolon + whitespace
      "WITH cte AS (SELECT 1) SELECT * FROM cte",
      "with x as (select 1) select * from x",
      "-- a comment\nSELECT 1",
      "/* block */ SELECT 1",
      "/* multi\nline */\n-- then line\nSELECT 1",
      "\n\t SELECT 1",
      "SELECT 1; -- trailing comment after semicolon",
    ])("ok: %s", (sql) => {
      expect(checkForbiddenStatement(sql).ok).toBe(true);
    });
  });

  describe("rejects non-SELECT/WITH leading statements", () => {
    it.each([
      "INSERT INTO t VALUES (1)",
      "insert into t values (1)",
      "UPDATE t SET x = 1",
      "DELETE FROM t",
      "DROP TABLE t",
      "drop schema grade_run",
      "TRUNCATE t",
      "ALTER TABLE t ADD COLUMN x int",
      "CREATE TABLE t (id int)",
      "GRANT ALL ON t TO public",
      "COPY t FROM '/etc/passwd'",
      "BEGIN",
      "SET search_path TO public",
      "-- sneaky\nDROP TABLE t",
      "/* c */ DELETE FROM t",
    ])("rejected: %s", (sql) => {
      const res = checkForbiddenStatement(sql);
      expect(res.ok).toBe(false);
      expect(res.message).toBeTruthy();
    });
  });

  describe("rejects statement chaining (multiple statements)", () => {
    it.each([
      "SELECT 1; DROP TABLE users",
      "SELECT 1; SELECT 2",
      "select 1;delete from t",
      "SELECT 1;;", // second bare semicolon is still substantive
      "WITH x AS (SELECT 1) SELECT * FROM x; DROP TABLE x",
      "SELECT 1; -- comment\nDROP TABLE t",
    ])("rejected: %s", (sql) => {
      const res = checkForbiddenStatement(sql);
      expect(res.ok).toBe(false);
      expect(res.message).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("rejects empty string", () => {
      expect(checkForbiddenStatement("").ok).toBe(false);
    });

    it("rejects whitespace-only", () => {
      expect(checkForbiddenStatement("   \n\t ").ok).toBe(false);
    });

    it("rejects comment-only (no statement)", () => {
      expect(checkForbiddenStatement("-- just a comment").ok).toBe(false);
    });

    it("treats SELECT-prefixed identifiers as non-SELECT", () => {
      // "SELECTED" should NOT be treated as the SELECT keyword.
      expect(checkForbiddenStatement("SELECTED something").ok).toBe(false);
    });

    it("handles null/undefined input safely", () => {
      expect(
        checkForbiddenStatement(undefined as unknown as string).ok,
      ).toBe(false);
    });
  });
});
