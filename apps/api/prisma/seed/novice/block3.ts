/**
 * Block 3 — Aggregation
 * Dataset: novice-b3-orders (customers + orders)
 */
import type { BlockDef } from "../types";

export const block3: BlockDef = {
  level: "NOVICE",
  order: 3,
  title: "Aggregation",
  theoryMarkdown: `# Aggregation

Aggregate functions collapse many rows into a single summary value.

## Core Aggregate Functions

| Function | Returns |
|----------|---------|
| \`COUNT(*)\` | Number of rows |
| \`COUNT(col)\` | Number of non-NULL values in col |
| \`SUM(col)\` | Total of all values |
| \`AVG(col)\` | Mean (average) of all values |
| \`MIN(col)\` | Smallest value |
| \`MAX(col)\` | Largest value |

\`\`\`sql
SELECT COUNT(*) FROM orders;
SELECT SUM(amount) FROM orders;
SELECT AVG(amount) FROM orders;
SELECT MIN(amount), MAX(amount) FROM orders;
\`\`\`

## GROUP BY

\`GROUP BY\` splits rows into groups by one or more columns, then applies the aggregate to each group independently:

\`\`\`sql
SELECT customer_id, COUNT(*) AS order_count
FROM orders
GROUP BY customer_id;
\`\`\`

**Rule**: every column in SELECT that is not an aggregate function **must** appear in GROUP BY.

## HAVING

\`HAVING\` filters groups (like \`WHERE\` filters rows). It runs **after** aggregation:

\`\`\`sql
SELECT customer_id, COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 2;
\`\`\`

Use \`WHERE\` to filter individual rows **before** grouping, and \`HAVING\` to filter groups **after** grouping.

## Execution Order

The logical order of a query is:
1. FROM / JOIN
2. WHERE
3. GROUP BY
4. HAVING
5. SELECT
6. ORDER BY
7. LIMIT

This means aliases defined in SELECT are not available in WHERE or HAVING in standard SQL.
`,
  theoryExamples: [
    {
      title: "COUNT all rows",
      sql: "SELECT COUNT(*) AS total_orders FROM orders;",
      explanation:
        "COUNT(*) counts every row regardless of NULL values, giving the total number of orders.",
    },
    {
      title: "SUM and AVG",
      sql: "SELECT SUM(amount) AS total_revenue, AVG(amount) AS avg_order FROM orders;",
      explanation:
        "SUM adds all amount values together; AVG divides the sum by the count. Both ignore NULL values.",
    },
    {
      title: "GROUP BY with COUNT",
      sql: "SELECT customer_id, COUNT(*) AS order_count FROM orders GROUP BY customer_id;",
      explanation:
        "Groups rows by customer_id, then counts rows in each group. The result has one row per unique customer_id.",
    },
    {
      title: "HAVING to filter groups",
      sql: "SELECT customer_id, SUM(amount) AS total FROM orders GROUP BY customer_id HAVING SUM(amount) > 200;",
      explanation:
        "HAVING filters the grouped results. Only customers whose total order amount exceeds 200 appear in the output.",
    },
  ],
  datasets: [
    {
      name: "novice-b3-orders",
      setupSql: `
CREATE TABLE customers (
  id   INT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  city VARCHAR(50)
);

CREATE TABLE orders (
  id          INT PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  amount      NUMERIC(10,2) NOT NULL,
  status      VARCHAR(20) NOT NULL,
  order_date  DATE NOT NULL
);

INSERT INTO customers (id, name, city) VALUES
  (1, 'Acme Corp',      'New York'),
  (2, 'Globex Ltd',     'Chicago'),
  (3, 'Initech',        'Dallas'),
  (4, 'Umbrella Inc',   'New York'),
  (5, 'Stark Industries','San Francisco');

INSERT INTO orders (id, customer_id, amount, status, order_date) VALUES
  (1,  1, 250.00, 'completed', '2024-01-10'),
  (2,  1, 180.50, 'completed', '2024-02-14'),
  (3,  2, 320.75, 'completed', '2024-01-22'),
  (4,  2,  95.00, 'cancelled', '2024-03-05'),
  (5,  3, 415.00, 'completed', '2024-02-01'),
  (6,  3, 210.00, 'completed', '2024-03-18'),
  (7,  4,  75.50, 'completed', '2024-01-30'),
  (8,  4, 530.00, 'completed', '2024-02-28'),
  (9,  5, 120.00, 'pending',   '2024-03-20'),
  (10, 5, 890.00, 'completed', '2024-01-05'),
  (11, 1, 300.00, 'pending',   '2024-04-01'),
  (12, 3,  60.00, 'cancelled', '2024-04-10');
      `.trim(),
      schemaJson: [
        {
          tableName: "customers",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(80)" },
            { name: "city", type: "VARCHAR(50)" },
          ],
        },
        {
          tableName: "orders",
          columns: [
            { name: "id", type: "INT" },
            { name: "customer_id", type: "INT" },
            { name: "amount", type: "NUMERIC(10,2)" },
            { name: "status", type: "VARCHAR(20)" },
            { name: "order_date", type: "DATE" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "novice-b3-orders",
      prompt: "Count the total number of rows in the `orders` table.",
      hint: "Use COUNT(*) to count every row.",
      referenceQuery: "SELECT COUNT(*) AS total FROM orders;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "novice-b3-orders",
      prompt:
        "Find the total (`SUM`) of the `amount` column across all orders.",
      hint: "Use SUM(amount) in your SELECT.",
      referenceQuery: "SELECT SUM(amount) AS total_amount FROM orders;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "novice-b3-orders",
      prompt:
        "Find the average (`AVG`) order `amount`, the minimum (`MIN`), and the maximum (`MAX`) in a single query.",
      hint: "Include AVG(amount), MIN(amount), and MAX(amount) in your SELECT.",
      referenceQuery:
        "SELECT AVG(amount) AS avg_amount, MIN(amount) AS min_amount, MAX(amount) AS max_amount FROM orders;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "novice-b3-orders",
      prompt:
        "Count the number of orders for each `customer_id`. Return `customer_id` and the count aliased as `order_count`.",
      hint: "Use GROUP BY customer_id and COUNT(*).",
      referenceQuery:
        "SELECT customer_id, COUNT(*) AS order_count FROM orders GROUP BY customer_id;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "novice-b3-orders",
      prompt:
        "Find the total `amount` per `customer_id`. Return `customer_id` and `total_amount`.",
      hint: "Use SUM(amount) and GROUP BY customer_id.",
      referenceQuery:
        "SELECT customer_id, SUM(amount) AS total_amount FROM orders GROUP BY customer_id;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "novice-b3-orders",
      prompt:
        "Count the number of orders for each `status`. Return `status` and the count aliased as `count`.",
      hint: "GROUP BY status and use COUNT(*).",
      referenceQuery:
        "SELECT status, COUNT(*) AS count FROM orders GROUP BY status;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "novice-b3-orders",
      prompt:
        "Find the total `amount` for 'completed' orders only.",
      hint: "Use WHERE status = 'completed' before aggregating.",
      referenceQuery:
        "SELECT SUM(amount) AS total_completed FROM orders WHERE status = 'completed';",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "novice-b3-orders",
      prompt:
        "Find each `customer_id` and their total `amount`, but only include customers whose total amount exceeds 400. Return `customer_id` and `total_amount`.",
      hint: "Use HAVING SUM(amount) > 400 after GROUP BY.",
      referenceQuery:
        "SELECT customer_id, SUM(amount) AS total_amount FROM orders GROUP BY customer_id HAVING SUM(amount) > 400;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "novice-b3-orders",
      prompt:
        "For each `customer_id`, count only 'completed' orders. Return `customer_id` and `completed_count`. Show only customers who have at least 2 completed orders.",
      hint: "Filter with WHERE status = 'completed' first, then GROUP BY, then HAVING COUNT(*) >= 2.",
      referenceQuery:
        "SELECT customer_id, COUNT(*) AS completed_count FROM orders WHERE status = 'completed' GROUP BY customer_id HAVING COUNT(*) >= 2;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "novice-b3-orders",
      prompt:
        "Find the maximum (`MAX`) order `amount` per `customer_id`, and order the results by that maximum amount descending. Return `customer_id` and `max_amount`.",
      hint: "Use MAX(amount), GROUP BY customer_id, then ORDER BY max_amount DESC.",
      referenceQuery:
        "SELECT customer_id, MAX(amount) AS max_amount FROM orders GROUP BY customer_id ORDER BY max_amount DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
