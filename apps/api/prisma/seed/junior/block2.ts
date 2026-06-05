/**
 * Block 2 — Aggregation & GROUP BY
 * Dataset: junior-b2-orders (orders for an online store)
 */
import type { BlockDef } from "../types";

export const block2: BlockDef = {
  level: "JUNIOR",
  order: 2,
  title: "Aggregation & GROUP BY",
  theoryMarkdown: `# Aggregation & GROUP BY

Aggregate functions collapse many rows into a single summary value. Combined with \`GROUP BY\`, they summarise data per group.

## Aggregate Functions

| Function | Returns |
|----------|---------|
| \`COUNT(*)\` | number of rows |
| \`COUNT(col)\` | number of non-NULL values |
| \`SUM(col)\` | total of a numeric column |
| \`AVG(col)\` | average of a numeric column |
| \`MIN(col)\` / \`MAX(col)\` | smallest / largest value |

\`\`\`sql
SELECT COUNT(*) AS order_count, SUM(amount) AS total
FROM orders;
\`\`\`

Without \`GROUP BY\`, an aggregate function reduces the whole table to one row.

## GROUP BY

\`GROUP BY\` splits rows into groups that share a value, then applies the aggregate to each group:

\`\`\`sql
SELECT category, COUNT(*) AS items
FROM orders
GROUP BY category;
\`\`\`

You get one output row per distinct \`category\`. **Rule:** every column in the \`SELECT\` list must either be inside an aggregate function or appear in the \`GROUP BY\` clause.

## Grouping by Multiple Columns

\`\`\`sql
SELECT category, status, COUNT(*) AS n
FROM orders
GROUP BY category, status;
\`\`\`

This makes one group per unique combination of \`category\` and \`status\`.

## HAVING

\`WHERE\` filters individual rows **before** grouping. To filter on an aggregate value, use \`HAVING\`, which runs **after** grouping:

\`\`\`sql
SELECT category, SUM(amount) AS total
FROM orders
GROUP BY category
HAVING SUM(amount) > 1000;
\`\`\`

You can use both: \`WHERE\` to pre-filter rows, then \`HAVING\` to filter groups.

\`\`\`sql
SELECT category, COUNT(*) AS n
FROM orders
WHERE status = 'shipped'
GROUP BY category
HAVING COUNT(*) >= 2;
\`\`\`

## Key Points

- Aggregates reduce many rows to one value per group (or one value overall).
- Every non-aggregated SELECT column must be in the \`GROUP BY\`.
- \`WHERE\` filters rows before grouping; \`HAVING\` filters groups after.
- \`COUNT(*)\` counts rows; \`COUNT(col)\` ignores NULLs.
`,
  theoryExamples: [
    {
      title: "Whole-table aggregate",
      sql: "SELECT COUNT(*) AS order_count, SUM(amount) AS total FROM orders;",
      explanation:
        "With no GROUP BY, the aggregates summarise every row at once, producing a single result row.",
    },
    {
      title: "Count per group",
      sql: "SELECT category, COUNT(*) AS items FROM orders GROUP BY category;",
      explanation:
        "Returns one row per category with the number of orders in that category. category is allowed in SELECT because it is in GROUP BY.",
    },
    {
      title: "Average per group",
      sql: "SELECT category, AVG(amount) AS avg_amount FROM orders GROUP BY category;",
      explanation:
        "AVG computes the mean amount within each category group.",
    },
    {
      title: "Filter groups with HAVING",
      sql: "SELECT category, SUM(amount) AS total FROM orders GROUP BY category HAVING SUM(amount) > 1000;",
      explanation:
        "HAVING removes whole groups whose summed amount is 1000 or less — something WHERE cannot do because the sum is only known after grouping.",
    },
  ],
  datasets: [
    {
      name: "junior-b2-orders",
      setupSql: `
CREATE TABLE orders (
  id        INT PRIMARY KEY,
  category  VARCHAR(30) NOT NULL,
  status    VARCHAR(20) NOT NULL,
  amount    NUMERIC(10,2) NOT NULL,
  quantity  INT NOT NULL
);

INSERT INTO orders (id, category, status, amount, quantity) VALUES
  (1,  'Electronics', 'shipped',   500.00, 2),
  (2,  'Electronics', 'pending',   300.00, 1),
  (3,  'Electronics', 'shipped',   800.00, 4),
  (4,  'Books',       'shipped',    40.00, 5),
  (5,  'Books',       'shipped',    25.00, 3),
  (6,  'Books',       'pending',    60.00, 6),
  (7,  'Clothing',    'shipped',   120.00, 2),
  (8,  'Clothing',    'cancelled', 200.00, 1),
  (9,  'Clothing',    'shipped',    90.00, 3),
  (10, 'Toys',        'pending',    45.00, 4);
      `.trim(),
      schemaJson: [
        {
          tableName: "orders",
          columns: [
            { name: "id", type: "INT" },
            { name: "category", type: "VARCHAR(30)" },
            { name: "status", type: "VARCHAR(20)" },
            { name: "amount", type: "NUMERIC(10,2)" },
            { name: "quantity", type: "INT" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "junior-b2-orders",
      prompt:
        "Count the total number of rows in the `orders` table. Alias the result `order_count`.",
      hint: "Use COUNT(*) with an alias.",
      referenceQuery: "SELECT COUNT(*) AS order_count FROM orders;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "junior-b2-orders",
      prompt:
        "Compute the total `amount` across all orders (alias `total`) and the average `amount` (alias `avg_amount`).",
      hint: "Combine SUM(amount) and AVG(amount) in one SELECT.",
      referenceQuery:
        "SELECT SUM(amount) AS total, AVG(amount) AS avg_amount FROM orders;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "junior-b2-orders",
      prompt:
        "Find the minimum and maximum `amount` in the `orders` table, aliased `min_amount` and `max_amount`.",
      hint: "Use MIN(amount) and MAX(amount).",
      referenceQuery:
        "SELECT MIN(amount) AS min_amount, MAX(amount) AS max_amount FROM orders;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "junior-b2-orders",
      prompt:
        "For each `category`, count how many orders it has. Select `category` and the count aliased as `order_count`.",
      hint: "GROUP BY category and use COUNT(*).",
      referenceQuery:
        "SELECT category, COUNT(*) AS order_count FROM orders GROUP BY category;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "junior-b2-orders",
      prompt:
        "For each `category`, compute the total `amount` (alias `total`). Select `category` and `total`.",
      hint: "Use SUM(amount) with GROUP BY category.",
      referenceQuery:
        "SELECT category, SUM(amount) AS total FROM orders GROUP BY category;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "junior-b2-orders",
      prompt:
        "For each `category`, compute the average `amount` aliased `avg_amount` and the total `quantity` aliased `total_qty`. Select `category`, `avg_amount`, and `total_qty`.",
      hint: "You can place several aggregates in the same grouped SELECT.",
      referenceQuery:
        "SELECT category, AVG(amount) AS avg_amount, SUM(quantity) AS total_qty FROM orders GROUP BY category;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "junior-b2-orders",
      prompt:
        "For each combination of `category` and `status`, count the orders. Select `category`, `status`, and the count aliased `n`.",
      hint: "List both columns in GROUP BY: GROUP BY category, status.",
      referenceQuery:
        "SELECT category, status, COUNT(*) AS n FROM orders GROUP BY category, status;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "junior-b2-orders",
      prompt:
        "For each `category`, compute the total `amount` (alias `total`), but only keep categories whose total is greater than 200. Select `category` and `total`.",
      hint: "Use HAVING SUM(amount) > 200 after the GROUP BY.",
      referenceQuery:
        "SELECT category, SUM(amount) AS total FROM orders GROUP BY category HAVING SUM(amount) > 200;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "junior-b2-orders",
      prompt:
        "Considering only orders with `status` equal to `'shipped'`, count the orders per `category`. Select `category` and the count aliased `shipped_count`, keeping only categories with at least 2 shipped orders.",
      hint: "Filter rows with WHERE status = 'shipped' before GROUP BY, then use HAVING COUNT(*) >= 2.",
      referenceQuery:
        "SELECT category, COUNT(*) AS shipped_count FROM orders WHERE status = 'shipped' GROUP BY category HAVING COUNT(*) >= 2;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "junior-b2-orders",
      prompt:
        "For each `category`, compute the total `amount` (alias `total`). Order the result by `total` descending. Select `category` and `total`.",
      hint: "Add ORDER BY total DESC (or ORDER BY SUM(amount) DESC) after grouping.",
      referenceQuery:
        "SELECT category, SUM(amount) AS total FROM orders GROUP BY category ORDER BY total DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
