import {
  containsTaskQuery,
  REDACTED_REPLY,
  sanitizeReply,
} from "./sanitize";
import {
  buildUserPrompt,
  collectTaskTableNames,
  STREAMING_SYSTEM_PROMPT,
  type SafeBlock,
} from "./prompt";

/**
 * Guardrail unit tests (pure, no I/O):
 *  - sanitizeReply / containsTaskQuery redact answer-shaped queries against the
 *    task's REAL tables but leave conceptual guidance and generic toy-table
 *    examples untouched.
 *  - buildUserPrompt never embeds a reference answer (it can't — SafeBlock has
 *    no such field) and collectTaskTableNames pulls the right names.
 */

describe("sanitizeReply / containsTaskQuery", () => {
  const tables = ["orders", "customers"];

  it("REDACTS a SELECT against a real task table and sets refused=true", () => {
    const leak = "Here you go: SELECT id, total FROM orders WHERE total > 100;";
    expect(containsTaskQuery(leak, tables)).toBe(true);

    const out = sanitizeReply(leak, tables, false);
    expect(out.refused).toBe(true);
    expect(out.reply).toBe(REDACTED_REPLY);
    // The leaked query content is gone (the redaction replaces it wholesale).
    expect(out.reply).not.toContain("FROM orders");
    expect(out.reply).not.toContain("total > 100");
  });

  it("REDACTS a WITH (CTE) query against a real task table", () => {
    const leak =
      "WITH t AS (SELECT * FROM customers) SELECT * FROM t;";
    expect(containsTaskQuery(leak, tables)).toBe(true);
    expect(sanitizeReply(leak, tables).refused).toBe(true);
  });

  it("REDACTS even when the table name is schema-qualified or quoted", () => {
    const leak = 'SELECT * FROM public."Orders" o';
    // taskTableNames may themselves arrive quoted/qualified.
    expect(containsTaskQuery(leak, ['public."orders"'])).toBe(true);
  });

  it("leaves a conceptual reply (no query) untouched and preserves refused", () => {
    const reply =
      "Think about which table holds order rows, then filter with a WHERE " +
      "clause on the total column and sort the result.";
    expect(containsTaskQuery(reply, tables)).toBe(false);

    const passed = sanitizeReply(reply, tables, false);
    expect(passed.reply).toBe(reply);
    expect(passed.refused).toBe(false);

    const refusedPassThrough = sanitizeReply(reply, tables, true);
    expect(refusedPassThrough.refused).toBe(true); // model refusal preserved
    expect(refusedPassThrough.reply).toBe(reply);
  });

  it("leaves a GENERIC toy-table example untouched (not a real task table)", () => {
    const teaching =
      "For example, on a made-up table: SELECT name FROM foo WHERE id = 1; " +
      "apply the same idea to your task.";
    expect(containsTaskQuery(teaching, tables)).toBe(false);
    expect(sanitizeReply(teaching, tables, false).reply).toBe(teaching);
  });

  it("does not redact when a table name appears WITHOUT a query keyword", () => {
    const reply = "The orders table stores one row per purchase.";
    expect(containsTaskQuery(reply, tables)).toBe(false);
  });

  it("does not match a table name embedded in a larger word", () => {
    // 'orders' should not match inside 'reorders'/'orders_archive_2024'... but
    // 'orders_archive' is a different identifier; ensure partial words don't trip.
    const reply = "SELECT * FROM reordersummary;";
    expect(containsTaskQuery(reply, ["orders"])).toBe(false);
  });

  it("is a no-op when there are no task table names", () => {
    const leak = "SELECT * FROM orders;";
    expect(containsTaskQuery(leak, [])).toBe(false);
    expect(sanitizeReply(leak, [], false).reply).toBe(leak);
  });
});

describe("prompt building (leakage-safe by construction)", () => {
  const block: SafeBlock = {
    title: "Filtering rows",
    theoryMarkdown: "# WHERE\nUse WHERE to filter.",
    tasks: [
      {
        order: 1,
        prompt: "List expensive orders",
        hint: "filter on total",
        dataset: {
          schemaJson: [
            {
              tableName: "orders",
              columns: [
                { name: "id", type: "int" },
                { name: "total", type: "numeric" },
              ],
            },
          ],
        },
      },
      {
        order: 2,
        prompt: "Count customers",
        hint: null,
        dataset: {
          schemaJson: [
            { tableName: "customers", columns: [{ name: "id", type: "int" }] },
          ],
        },
      },
    ],
  };

  it("collectTaskTableNames returns the distinct real table names", () => {
    expect(collectTaskTableNames(block).sort()).toEqual([
      "customers",
      "orders",
    ]);
  });

  it("buildUserPrompt includes title, theory, prompts, hints, tables + question", () => {
    const prompt = buildUserPrompt(block, "How do I filter rows?");
    expect(prompt).toContain("Filtering rows");
    expect(prompt).toContain("Use WHERE to filter.");
    expect(prompt).toContain("List expensive orders");
    expect(prompt).toContain("filter on total");
    expect(prompt).toContain("orders: id (int), total (numeric)");
    expect(prompt).toContain("How do I filter rows?");
  });

  it("the SafeBlock type carries NO reference answer, so prompts can't leak it", () => {
    // Compile-time guarantee + runtime sanity: a would-be reference answer is
    // simply not a property we read. Even if upstream data had it, SafeBlock
    // doesn't surface it.
    const sneaky = {
      ...block,
      tasks: [
        {
          ...block.tasks[0],
          // @ts-expect-error referenceQuery is NOT part of SafeTask.
          referenceQuery: "SELECT id, total FROM orders WHERE total > 100",
        },
      ],
    } as SafeBlock;
    const prompt = buildUserPrompt(sneaky, "help");
    expect(prompt).not.toContain("total > 100");
    expect(prompt).not.toContain("referenceQuery");
  });

  it("system prompt forbids handing over solutions and scopes to SQL", () => {
    expect(STREAMING_SYSTEM_PROMPT.toLowerCase()).toContain("never");
    expect(STREAMING_SYSTEM_PROMPT.toLowerCase()).toContain("sql tutor");
    expect(STREAMING_SYSTEM_PROMPT).toContain("REFUSED: ");
  });
});
