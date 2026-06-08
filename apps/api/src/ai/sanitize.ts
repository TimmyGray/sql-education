interface SanitizeResult { reply: string; refused: boolean; }

/**
 * ---------------------------------------------------------------------------
 * Output post-filter (belt-and-suspenders guardrail).
 * ---------------------------------------------------------------------------
 *
 * Even with a hardened system prompt and a reference answer that is NEVER in
 * the model's context, we run one more PURE check on the model's reply before
 * returning it: if the reply contains an answer-shaped SQL statement (a
 * `SELECT`/`WITH` query) that targets one of THIS task's real table names, we
 * REDACT it and mark the response refused.
 *
 * This makes solution leakage structurally hard: a query against the task's
 * actual tables is exactly what we never want to hand over, regardless of how
 * the model was coaxed into producing it.
 *
 * Generic syntax examples on unrelated toy tables (e.g. `SELECT * FROM foo`)
 * are intentionally left untouched — those are legitimate teaching aids.
 */

/** Message shown when we redact an answer-shaped query from the reply. */
export const REDACTED_REPLY =
  "I can't give you the query that solves this task. " +
  "Instead, here's how to think about it: revisit the block's theory, " +
  "identify which tables and columns the task needs, and build the query " +
  "one clause at a time (choose your columns, the table to read from, then " +
  "add filters, grouping, or ordering as needed). Try writing it yourself " +
  "and submit it to check your result.";

/**
 * SQL keywords that introduce a table reference in a real query/statement.
 * A reply where a REAL task table name appears immediately after one of these
 * (modulo quoting / schema qualifier) is treated as a leaked solution. This is
 * the high-signal, low-false-positive shape — far safer than matching bare
 * English words like "with" or "select" that appear in normal prose.
 */
const TABLE_INTRO_KEYWORDS = ["from", "join", "into", "update", "table"];

/**
 * Normalize a table identifier for matching: strip schema qualifier, quoting,
 * and trailing punctuation, then lowercase. e.g. `public."Orders",` -> `orders`.
 */
function normalizeIdentifier(raw: string): string {
  let s = raw.trim().toLowerCase();
  // Drop a schema qualifier (keep the part after the last dot).
  const dot = s.lastIndexOf(".");
  if (dot !== -1) {
    s = s.slice(dot + 1);
  }
  // Strip wrapping quotes/backticks/brackets and surrounding punctuation.
  s = s.replace(/^[`"'\[]+/, "").replace(/[`"'\];,)]+$/, "");
  return s;
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a regex that matches one of the table-introducing keywords FOLLOWED by
 * the given (already-normalized) table name in clause position. Allows an
 * optional schema qualifier and optional opening quote/backtick/bracket before
 * the name, and requires a word boundary after it so `orders` does not match
 * inside `ordersummary`.
 *
 *   ... FROM orders ...           -> match
 *   ... JOIN public."orders" o    -> match
 *   ... the table with orders     -> NO match (no intro keyword before it)
 *   ... FROM reordersummary       -> NO match (word boundary)
 */
function tableInClausePosition(table: string): RegExp {
  const kw = TABLE_INTRO_KEYWORDS.join("|");
  const name = escapeRegExp(table);
  // keyword + ws + optional [schema.] + optional opening quote/bracket + name
  // + right boundary (non word char, closing quote/bracket, or end).
  return new RegExp(
    `(^|[^a-z0-9_])(${kw})\\s+([a-z0-9_]+\\.)?["\`\\[]?${name}([^a-z0-9_]|$)`,
    "i",
  );
}

/**
 * Does `reply` contain an answer-shaped query that targets at least one of the
 * task's real tables — i.e. a real table name sitting right after a SQL table
 * keyword (FROM/JOIN/INTO/UPDATE/TABLE)? Pure + side-effect free.
 */
export function containsTaskQuery(reply: string, taskTableNames: string[]): boolean {
  if (!reply) {
    return false;
  }
  const tables = taskTableNames
    .map(normalizeIdentifier)
    .filter((t) => t.length > 0);
  if (tables.length === 0) {
    return false;
  }

  return tables.some((table) => tableInClausePosition(table).test(reply));
}

/**
 * Pure post-filter. Given the model's `reply` and this task's real table names,
 * returns a safe `{ reply, refused }`:
 *  - If the reply contains an answer-shaped query against a real task table, it
 *    is replaced with {@link REDACTED_REPLY} and `refused` becomes `true`.
 *  - Otherwise the reply passes through unchanged and `refused` is preserved.
 *
 * `refused` from the model is OR-ed with our redaction decision: we never flip
 * a model refusal back to a non-refusal.
 */
export function sanitizeReply(
  reply: string,
  taskTableNames: string[],
  modelRefused = false,
): SanitizeResult {
  if (containsTaskQuery(reply, taskTableNames)) {
    return { reply: REDACTED_REPLY, refused: true };
  }
  return { reply, refused: modelRefused };
}
