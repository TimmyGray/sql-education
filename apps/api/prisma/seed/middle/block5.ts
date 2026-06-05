/**
 * Block 5 — Analytics Combo (LAG/LEAD, NTILE, FILTER, ROLLUP, pivoting)
 * Dataset: middle-b5-revenue (monthly revenue by product line)
 */
import type { BlockDef } from "../types";

export const block5: BlockDef = {
  level: "MIDDLE",
  order: 5,
  title: "Analytics Combo",
  theoryMarkdown: `# Analytics Combo

This block combines the most useful analytical tools: offset window functions, bucketing, conditional aggregation, and grand totals.

## LAG and LEAD

\`LAG\` looks at a previous row; \`LEAD\` looks at a following row — relative to the current row's window order:

\`\`\`sql
SELECT month, revenue,
       LAG(revenue)  OVER (ORDER BY month) AS prev_revenue,
       LEAD(revenue) OVER (ORDER BY month) AS next_revenue
FROM monthly;
\`\`\`

This is ideal for month-over-month change: \`revenue - LAG(revenue) OVER (ORDER BY month)\`.

## NTILE

\`NTILE(n)\` splits ordered rows into \`n\` roughly equal buckets — useful for quartiles/quartile scoring:

\`\`\`sql
SELECT product, revenue,
       NTILE(4) OVER (ORDER BY revenue DESC) AS quartile
FROM monthly;
\`\`\`

## FILTER on Aggregates

The \`FILTER (WHERE ...)\` clause restricts which rows an individual aggregate sees — cleaner than \`CASE\` inside the aggregate:

\`\`\`sql
SELECT
  SUM(revenue) FILTER (WHERE region = 'East') AS east_total,
  SUM(revenue) FILTER (WHERE region = 'West') AS west_total
FROM monthly;
\`\`\`

## CASE-Based Pivoting

To turn rows into columns, aggregate a \`CASE\` (or \`FILTER\`) per target column:

\`\`\`sql
SELECT month,
       SUM(CASE WHEN region = 'East' THEN revenue ELSE 0 END) AS east,
       SUM(CASE WHEN region = 'West' THEN revenue ELSE 0 END) AS west
FROM monthly
GROUP BY month;
\`\`\`

## ROLLUP

\`GROUP BY ROLLUP(...)\` adds subtotal and grand-total rows (the rolled-up columns are \`NULL\`):

\`\`\`sql
SELECT region, SUM(revenue) AS total
FROM monthly
GROUP BY ROLLUP(region);
\`\`\`

## Key Points

- \`LAG\`/\`LEAD\` access prior/next rows for period-over-period comparisons.
- \`NTILE(n)\` divides ordered rows into n buckets.
- \`FILTER (WHERE ...)\` scopes a single aggregate without affecting the others.
- Pivot rows into columns with conditional \`SUM(CASE ...)\` or \`SUM(...) FILTER\`.
- \`ROLLUP\` produces subtotal/grand-total rows where grouped columns become \`NULL\`.
`,
  theoryExamples: [
    {
      title: "Previous-row comparison with LAG",
      sql: "SELECT month, revenue, LAG(revenue) OVER (ORDER BY month) AS prev_revenue FROM monthly;",
      explanation:
        "LAG returns the revenue of the previous month in month order; the first row has NULL because there is no prior row.",
    },
    {
      title: "Quartiles with NTILE",
      sql: "SELECT product, revenue, NTILE(4) OVER (ORDER BY revenue DESC) AS quartile FROM monthly;",
      explanation:
        "NTILE(4) distributes the ordered rows into four roughly equal buckets, labeling the highest-revenue rows as quartile 1.",
    },
    {
      title: "Conditional totals with FILTER",
      sql: "SELECT SUM(revenue) FILTER (WHERE region = 'East') AS east_total, SUM(revenue) FILTER (WHERE region = 'West') AS west_total FROM monthly;",
      explanation:
        "Each SUM only adds rows matching its FILTER condition, producing per-region totals side by side in a single result row.",
    },
    {
      title: "Subtotals with ROLLUP",
      sql: "SELECT region, SUM(revenue) AS total FROM monthly GROUP BY ROLLUP(region);",
      explanation:
        "ROLLUP adds an extra grand-total row where region is NULL, on top of the per-region totals.",
    },
  ],
  datasets: [
    {
      name: "middle-b5-revenue",
      setupSql: `
CREATE TABLE monthly (
  id      INT PRIMARY KEY,
  region  VARCHAR(10) NOT NULL,
  product VARCHAR(20) NOT NULL,
  month   INT NOT NULL,
  revenue NUMERIC(10,2) NOT NULL
);

INSERT INTO monthly (id, region, product, month, revenue) VALUES
  (1,  'East', 'Alpha', 1, 1000.00),
  (2,  'East', 'Alpha', 2, 1200.00),
  (3,  'East', 'Alpha', 3, 1100.00),
  (4,  'East', 'Beta',  1, 800.00),
  (5,  'East', 'Beta',  2, 900.00),
  (6,  'East', 'Beta',  3, 1300.00),
  (7,  'West', 'Alpha', 1, 700.00),
  (8,  'West', 'Alpha', 2, 1500.00),
  (9,  'West', 'Alpha', 3, 1400.00),
  (10, 'West', 'Beta',  1, 600.00),
  (11, 'West', 'Beta',  2, 650.00),
  (12, 'West', 'Beta',  3, 950.00);
      `.trim(),
      schemaJson: [
        {
          tableName: "monthly",
          columns: [
            { name: "id", type: "INT" },
            { name: "region", type: "VARCHAR(10)" },
            { name: "product", type: "VARCHAR(20)" },
            { name: "month", type: "INT" },
            { name: "revenue", type: "NUMERIC(10,2)" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "middle-b5-revenue",
      prompt:
        "For the `East` region's `Alpha` product, return `month`, `revenue`, and a column `prev_revenue` containing the previous month's `revenue` using `LAG`. Order by `month` ascending.",
      hint: "Filter to region 'East' and product 'Alpha', then use LAG(revenue) OVER (ORDER BY month).",
      referenceQuery:
        "SELECT month, revenue, LAG(revenue) OVER (ORDER BY month) AS prev_revenue FROM monthly WHERE region = 'East' AND product = 'Alpha' ORDER BY month;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "middle-b5-revenue",
      prompt:
        "For the `East` region's `Alpha` product, return `month`, `revenue`, and a column `next_revenue` containing the following month's `revenue` using `LEAD`. Order by `month` ascending.",
      hint: "Use LEAD(revenue) OVER (ORDER BY month) on the filtered rows.",
      referenceQuery:
        "SELECT month, revenue, LEAD(revenue) OVER (ORDER BY month) AS next_revenue FROM monthly WHERE region = 'East' AND product = 'Alpha' ORDER BY month;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "middle-b5-revenue",
      prompt:
        "For the `West` region's `Alpha` product, return `month`, `revenue`, and a column `mom_change` equal to `revenue` minus the previous month's `revenue`. Order by `month` ascending.",
      hint: "Subtract LAG(revenue) OVER (ORDER BY month) from revenue.",
      referenceQuery:
        "SELECT month, revenue, revenue - LAG(revenue) OVER (ORDER BY month) AS mom_change FROM monthly WHERE region = 'West' AND product = 'Alpha' ORDER BY month;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "middle-b5-revenue",
      prompt:
        "Return `region`, `product`, `month`, `revenue`, and a column `quartile` assigning each row to one of 4 buckets by `revenue` descending using `NTILE`. Order by `quartile` ascending, then `revenue` descending.",
      hint: "Use NTILE(4) OVER (ORDER BY revenue DESC).",
      referenceQuery:
        "SELECT region, product, month, revenue, NTILE(4) OVER (ORDER BY revenue DESC) AS quartile FROM monthly ORDER BY quartile, revenue DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "middle-b5-revenue",
      prompt:
        "Return one row with two columns: `east_total` (sum of `revenue` where `region` is `East`) and `west_total` (sum where `region` is `West`), using the `FILTER` clause.",
      hint: "SUM(revenue) FILTER (WHERE region = 'East') AS east_total, and similarly for West.",
      referenceQuery:
        "SELECT SUM(revenue) FILTER (WHERE region = 'East') AS east_total, SUM(revenue) FILTER (WHERE region = 'West') AS west_total FROM monthly;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "middle-b5-revenue",
      prompt:
        "Pivot revenue by region: return `month`, a column `east` (total `revenue` for `East` that month) and a column `west` (total for `West`), using conditional `SUM(CASE ...)`. Group by `month` and order by `month` ascending.",
      hint: "SUM(CASE WHEN region = 'East' THEN revenue ELSE 0 END) AS east, similarly for west; GROUP BY month.",
      referenceQuery:
        "SELECT month, SUM(CASE WHEN region = 'East' THEN revenue ELSE 0 END) AS east, SUM(CASE WHEN region = 'West' THEN revenue ELSE 0 END) AS west FROM monthly GROUP BY month ORDER BY month;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "middle-b5-revenue",
      prompt:
        "Using `GROUP BY ROLLUP`, return `region` and the total `revenue` per region plus a grand-total row (where `region` is NULL). Order by `region` ascending with the NULL grand total last.",
      hint: "GROUP BY ROLLUP(region); use ORDER BY region NULLS LAST.",
      referenceQuery:
        "SELECT region, SUM(revenue) AS total FROM monthly GROUP BY ROLLUP(region) ORDER BY region NULLS LAST;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "middle-b5-revenue",
      prompt:
        "Return `region`, `product`, and total `revenue` for each region/product, plus subtotal and grand-total rows using `ROLLUP(region, product)`. Order by `region` and `product`, both with NULLs last.",
      hint: "GROUP BY ROLLUP(region, product); ORDER BY region NULLS LAST, product NULLS LAST.",
      referenceQuery:
        "SELECT region, product, SUM(revenue) AS total FROM monthly GROUP BY ROLLUP(region, product) ORDER BY region NULLS LAST, product NULLS LAST;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "middle-b5-revenue",
      prompt:
        "Return `region`, `product`, total `revenue` as `prod_total`, and a column `pct_of_region` showing that product's share of its region's total revenue (rounded to 2 decimals). Group by `region`, `product`. Order by `region` ascending, then `pct_of_region` descending.",
      hint: "After GROUP BY region, product, divide SUM(revenue) by SUM(SUM(revenue)) OVER (PARTITION BY region) and multiply by 100.",
      referenceQuery:
        "SELECT region, product, SUM(revenue) AS prod_total, ROUND(SUM(revenue) * 100.0 / SUM(SUM(revenue)) OVER (PARTITION BY region), 2) AS pct_of_region FROM monthly GROUP BY region, product ORDER BY region, pct_of_region DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "middle-b5-revenue",
      prompt:
        "For each `region`/`product`, return `region`, `product`, `month`, `revenue`, and a column `running_total` accumulating `revenue` over `month` within that region/product. Order by `region`, `product`, `month`.",
      hint: "Use SUM(revenue) OVER (PARTITION BY region, product ORDER BY month).",
      referenceQuery:
        "SELECT region, product, month, revenue, SUM(revenue) OVER (PARTITION BY region, product ORDER BY month) AS running_total FROM monthly ORDER BY region, product, month;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
