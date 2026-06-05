/**
 * Forbidden-statement guard (PURE, fully unit-tested).
 *
 * Defence-in-depth gate that runs BEFORE any SQL touches the sandbox. Even
 * though the sandbox executes in a least-privilege, always-rolled-back
 * transaction, we still reject anything that is not a single read-only query so
 * users get a clear error and we never rely solely on the DB for safety.
 *
 * Rules:
 *   1. Strip leading line (`-- ...`) and block (`/* ... *​/`) comments + whitespace.
 *   2. The FIRST SQL keyword must be `SELECT` or `WITH` (case-insensitive).
 *      Anything else (INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/…) is
 *      rejected.
 *   3. No statement chaining: a `;` followed by any non-whitespace (ignoring a
 *      trailing comment) is rejected — blocks "SELECT 1; DROP TABLE x" tricks.
 */

export interface ForbiddenCheckResult {
  /** True when the SQL is allowed to proceed to the sandbox. */
  ok: boolean;
  /** User-facing reason when `ok` is false. */
  message?: string;
}

const ALLOWED_LEADING_KEYWORDS = ["SELECT", "WITH"];

/**
 * Remove leading SQL comments and whitespace so we can inspect the first real
 * token. Handles repeated/interleaved line and block comments.
 */
function stripLeadingCommentsAndWhitespace(sql: string): string {
  let s = sql;
  // Loop because comments and whitespace can alternate at the start.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const before = s;
    s = s.replace(/^\s+/, "");
    // Line comment: -- ... up to (but not including) newline.
    if (s.startsWith("--")) {
      const nl = s.indexOf("\n");
      s = nl === -1 ? "" : s.slice(nl + 1);
    }
    // Block comment: /* ... */ (non-greedy, may span lines).
    else if (s.startsWith("/*")) {
      const end = s.indexOf("*/");
      s = end === -1 ? "" : s.slice(end + 2);
    }
    if (s === before) {
      break;
    }
  }
  return s;
}

/**
 * Detect statement chaining. A semicolon is allowed ONLY if everything after it
 * is whitespace and/or a trailing comment (i.e. it just terminates the single
 * statement). A `;` followed by further SQL is rejected.
 */
function hasMultipleStatements(sql: string): boolean {
  const semi = sql.indexOf(";");
  if (semi === -1) {
    return false;
  }
  // Examine the remainder after the first semicolon.
  let rest = sql.slice(semi + 1);
  // Strip whitespace + trailing comments; if anything substantive remains
  // (including another statement, even another bare `;`), it's multi-statement.
  rest = stripLeadingCommentsAndWhitespace(rest).trim();
  return rest.length > 0;
}

/**
 * Validate a user's SQL submission. Returns `{ ok: true }` when it is a single
 * SELECT/WITH query, else `{ ok: false, message }`.
 */
export function checkForbiddenStatement(rawSql: string): ForbiddenCheckResult {
  const trimmed = (rawSql ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Your query is empty." };
  }

  if (hasMultipleStatements(trimmed)) {
    return {
      ok: false,
      message:
        "Only a single SELECT query is allowed — multiple statements are not permitted.",
    };
  }

  const stripped = stripLeadingCommentsAndWhitespace(trimmed);
  // First word = leading run of letters (keywords are alphabetic).
  const match = /^([A-Za-z]+)/.exec(stripped);
  const firstKeyword = match ? match[1].toUpperCase() : "";

  if (!ALLOWED_LEADING_KEYWORDS.includes(firstKeyword)) {
    return {
      ok: false,
      message:
        "Only read-only SELECT queries are allowed. Statements like INSERT, UPDATE, DELETE, DROP, or CREATE are not permitted.",
    };
  }

  return { ok: true };
}
