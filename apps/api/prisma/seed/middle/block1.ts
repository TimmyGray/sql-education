/**
 * Block 1 — Window Functions
 * Dataset: middle-b1-sales (sales)
 */
import type { BlockDef } from "../types";

export const block1: BlockDef = {
  level: "MIDDLE",
  order: 1,
  title: "Window Functions",
  theoryMarkdown: `# Window Functions

Window functions perform a calculation across a set of rows that are related to the current row — without collapsing them into a single output row the way \`GROUP BY\` does. Every input row stays in the result, and a new computed column is added.

## The OVER Clause

A window function is any function followed by an \`OVER (...)\` clause. The \`OVER\` clause defines the "window" of rows the function sees:

\`\`\`sql
SELECT region, amount,
       SUM(amount) OVER () AS grand_total
FROM sales;
\`\`\`

With an empty \`OVER ()\` the window is the entire result set, so \`grand_total\` is the same on every row.

## PARTITION BY

\`PARTITION BY\` splits the rows into groups; the function restarts for each group, much like \`GROUP BY\` but keeping every row:

\`\`\`sql
SELECT region, amount,
       SUM(amount) OVER (PARTITION BY region) AS region_total
FROM sales;
\`\`\`

## Ranking Functions

Ranking functions need an \`ORDER BY\` inside \`OVER\`:

\`\`\`sql
SELECT region, amount,
       ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC) AS rn,
       RANK()       OVER (PARTITION BY region ORDER BY amount DESC) AS rnk,
       DENSE_RANK() OVER (PARTITION BY region ORDER BY amount DESC) AS dense_rnk
FROM sales;
\`\`\`

- \`ROW_NUMBER()\` — a unique sequential number, no ties.
- \`RANK()\` — ties share a rank, then the next rank skips (1, 1, 3).
- \`DENSE_RANK()\` — ties share a rank, no gaps (1, 1, 2).

## Running Totals

Adding \`ORDER BY\` to an aggregate window turns it into a running (cumulative) calculation:

\`\`\`sql
SELECT sale_date, amount,
       SUM(amount) OVER (ORDER BY sale_date) AS running_total
FROM sales;
\`\`\`

## Key Points

- A window function keeps all rows; \`GROUP BY\` collapses them.
- \`PARTITION BY\` defines groups; \`ORDER BY\` (inside \`OVER\`) defines order within each group.
- \`ROW_NUMBER\`, \`RANK\`, and \`DENSE_RANK\` differ only in how they handle ties.
- An aggregate like \`SUM(...) OVER (ORDER BY ...)\` becomes a running total.
`,
  theoryExamples: [
    {
      title: "Aggregate over the whole result",
      sql: "SELECT region, amount, SUM(amount) OVER () AS grand_total FROM sales;",
      explanation:
        "An empty OVER () treats every row as one window, so grand_total repeats the overall sum on each row while keeping all rows.",
    },
    {
      title: "Partitioned total",
      sql: "SELECT region, amount, SUM(amount) OVER (PARTITION BY region) AS region_total FROM sales;",
      explanation:
        "PARTITION BY region restarts the sum for each region, giving each row its region's total without grouping the rows away.",
    },
    {
      title: "Ranking within partitions",
      sql: "SELECT region, amount, RANK() OVER (PARTITION BY region ORDER BY amount DESC) AS rnk FROM sales;",
      explanation:
        "RANK numbers rows from highest to lowest amount inside each region; tied amounts share a rank and the next rank skips a number.",
    },
    {
      title: "Running total by date",
      sql: "SELECT sale_date, amount, SUM(amount) OVER (ORDER BY sale_date) AS running_total FROM sales;",
      explanation:
        "Adding ORDER BY to the windowed SUM accumulates the amount in date order, producing a cumulative running total.",
    },
  ],
  datasets: [
    {
      name: "middle-b1-sales",
      setupSql: `
CREATE TABLE sales (
  id        INT PRIMARY KEY,
  region    VARCHAR(20) NOT NULL,
  product   VARCHAR(30) NOT NULL,
  sale_date DATE NOT NULL,
  amount    NUMERIC(10,2) NOT NULL
);

INSERT INTO sales (id, region, product, sale_date, amount) VALUES
  (1,  'North', 'Widget',  '2022-01-05', 100.00),
  (2,  'North', 'Gadget',  '2022-01-12', 250.00),
  (3,  'North', 'Widget',  '2022-02-03', 250.00),
  (4,  'North', 'Gizmo',   '2022-02-20', 175.00),
  (5,  'South', 'Widget',  '2022-01-08', 300.00),
  (6,  'South', 'Gadget',  '2022-01-25', 120.00),
  (7,  'South', 'Gizmo',   '2022-02-14', 300.00),
  (8,  'East',  'Widget',  '2022-01-19', 90.00),
  (9,  'East',  'Gadget',  '2022-02-01', 410.00),
  (10, 'East',  'Gizmo',   '2022-02-28', 60.00),
  (11, 'West',  'Widget',  '2022-01-30', 220.00),
  (12, 'West',  'Gadget',  '2022-02-10', 220.00);
      `.trim(),
      schemaJson: [
        {
          tableName: "sales",
          columns: [
            { name: "id", type: "INT" },
            { name: "region", type: "VARCHAR(20)" },
            { name: "product", type: "VARCHAR(30)" },
            { name: "sale_date", type: "DATE" },
            { name: "amount", type: "NUMERIC(10,2)" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "middle-b1-sales",
      prompt:
        "Return `region`, `amount`, and a column `grand_total` containing the sum of all `amount` values across the whole `sales` table, repeated on every row. Do not collapse the rows.",
      hint: "Use SUM(amount) with an empty OVER () window.",
      referenceQuery:
        "SELECT region, amount, SUM(amount) OVER () AS grand_total FROM sales;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "middle-b1-sales",
      prompt:
        "Return `region`, `amount`, and a column `region_total` with the total `amount` for that row's `region`, keeping every row.",
      hint: "Use SUM(amount) OVER (PARTITION BY region).",
      referenceQuery:
        "SELECT region, amount, SUM(amount) OVER (PARTITION BY region) AS region_total FROM sales;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "middle-b1-sales",
      prompt:
        "Return `region`, `product`, `amount`, and a column `rn` numbering rows within each `region` ordered by `amount` descending. Order the final output by `region` ascending, then `rn` ascending.",
      hint: "Use ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC), then ORDER BY region, rn.",
      referenceQuery:
        "SELECT region, product, amount, ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC) AS rn FROM sales ORDER BY region, rn;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "middle-b1-sales",
      prompt:
        "Return `region`, `amount`, and a column `rnk` giving the RANK of each row within its `region` by `amount` descending. Order the output by `region` ascending, then `rnk` ascending.",
      hint: "Use RANK() OVER (PARTITION BY region ORDER BY amount DESC).",
      referenceQuery:
        "SELECT region, amount, RANK() OVER (PARTITION BY region ORDER BY amount DESC) AS rnk FROM sales ORDER BY region, rnk;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "middle-b1-sales",
      prompt:
        "Return `region`, `amount`, and a column `dense_rnk` giving the DENSE_RANK of each row within its `region` by `amount` descending. Order the output by `region` ascending, then `dense_rnk` ascending.",
      hint: "DENSE_RANK() leaves no gaps after ties; partition by region and order by amount DESC.",
      referenceQuery:
        "SELECT region, amount, DENSE_RANK() OVER (PARTITION BY region ORDER BY amount DESC) AS dense_rnk FROM sales ORDER BY region, dense_rnk;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "middle-b1-sales",
      prompt:
        "Return `sale_date`, `amount`, and a column `running_total` that accumulates `amount` ordered by `sale_date`. Order the output by `sale_date` ascending.",
      hint: "Use SUM(amount) OVER (ORDER BY sale_date) and add a matching ORDER BY.",
      referenceQuery:
        "SELECT sale_date, amount, SUM(amount) OVER (ORDER BY sale_date) AS running_total FROM sales ORDER BY sale_date;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "middle-b1-sales",
      prompt:
        "Return `region`, `sale_date`, `amount`, and a column `region_running` that accumulates `amount` within each `region` ordered by `sale_date`. Order the output by `region` ascending, then `sale_date` ascending.",
      hint: "Combine PARTITION BY region with ORDER BY sale_date inside the SUM() OVER window.",
      referenceQuery:
        "SELECT region, sale_date, amount, SUM(amount) OVER (PARTITION BY region ORDER BY sale_date) AS region_running FROM sales ORDER BY region, sale_date;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "middle-b1-sales",
      prompt:
        "Return `region`, `amount`, and a column `avg_region_amount` with the average `amount` for that row's `region`. Round the average to 2 decimals.",
      hint: "Use ROUND(AVG(amount) OVER (PARTITION BY region), 2).",
      referenceQuery:
        "SELECT region, amount, ROUND(AVG(amount) OVER (PARTITION BY region), 2) AS avg_region_amount FROM sales;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "middle-b1-sales",
      prompt:
        "For each `region`, return only the single highest-`amount` sale: columns `region`, `product`, `amount`. If there are ties, ROW_NUMBER will keep one row per region. Order the output by `region` ascending.",
      hint: "Wrap a ROW_NUMBER() query in a CTE or subquery and keep rows where the number equals 1.",
      referenceQuery:
        "SELECT region, product, amount FROM (SELECT region, product, amount, ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC, id) AS rn FROM sales) ranked WHERE rn = 1 ORDER BY region;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "middle-b1-sales",
      prompt:
        "Return `region`, `amount`, and a column `pct_of_region` showing each row's `amount` as a percentage of its `region` total, rounded to 2 decimals. Order the output by `region` ascending, then `amount` descending.",
      hint: "Divide amount by SUM(amount) OVER (PARTITION BY region); multiply by 100 and ROUND. Cast to numeric to avoid integer division.",
      referenceQuery:
        "SELECT region, amount, ROUND(amount * 100.0 / SUM(amount) OVER (PARTITION BY region), 2) AS pct_of_region FROM sales ORDER BY region, amount DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
