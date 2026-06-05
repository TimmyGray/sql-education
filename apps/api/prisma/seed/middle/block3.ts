/**
 * Block 3 — Advanced & Correlated Subqueries
 * Dataset: middle-b3-orders (customers + orders)
 */
import type { BlockDef } from "../types";

export const block3: BlockDef = {
  level: "MIDDLE",
  order: 3,
  title: "Advanced Subqueries",
  theoryMarkdown: `# Advanced & Correlated Subqueries

A subquery is a query nested inside another query. Mastering subqueries lets you express comparisons and filters that a single flat query cannot.

## Scalar Subqueries

A scalar subquery returns exactly one value and can be used anywhere a value is expected:

\`\`\`sql
SELECT name, total
FROM orders
WHERE total > (SELECT AVG(total) FROM orders);
\`\`\`

## Subqueries Returning Sets (IN)

A subquery in an \`IN\` clause can return many values:

\`\`\`sql
SELECT name
FROM customers
WHERE id IN (SELECT customer_id FROM orders WHERE total > 500);
\`\`\`

## Correlated Subqueries

A *correlated* subquery references a column from the outer query, so it is re-evaluated for each outer row:

\`\`\`sql
SELECT c.name
FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders o
  WHERE o.customer_id = c.id AND o.total > 300
);
\`\`\`

Here \`c.id\` ties the inner query to the current outer row. \`EXISTS\` is true when the subquery returns at least one row.

## Derived Tables

A subquery in the \`FROM\` clause is a *derived table* — it must be aliased:

\`\`\`sql
SELECT region, max_total
FROM (
  SELECT region, MAX(total) AS max_total
  FROM orders
  GROUP BY region
) AS per_region
WHERE max_total > 400;
\`\`\`

## Comparing to Aggregate Subqueries

Correlated aggregate subqueries express "compared to its own group" logic:

\`\`\`sql
SELECT o.id, o.region, o.total
FROM orders o
WHERE o.total = (
  SELECT MAX(total) FROM orders o2 WHERE o2.region = o.region
);
\`\`\`

## Key Points

- A *scalar* subquery returns one value; a *set* subquery (used with \`IN\`/\`ANY\`/\`ALL\`) returns many.
- A *correlated* subquery references the outer query and runs once per outer row.
- \`EXISTS\` / \`NOT EXISTS\` test for the presence/absence of matching rows efficiently.
- A subquery in \`FROM\` is a derived table and must be given an alias.
`,
  theoryExamples: [
    {
      title: "Compare to an aggregate",
      sql: "SELECT id, total FROM orders WHERE total > (SELECT AVG(total) FROM orders);",
      explanation:
        "The scalar subquery computes the overall average total once; the outer query keeps only orders above that average.",
    },
    {
      title: "Set membership with IN",
      sql: "SELECT name FROM customers WHERE id IN (SELECT customer_id FROM orders WHERE total > 500);",
      explanation:
        "The subquery returns the ids of customers who placed a large order; the outer query returns those customers' names.",
    },
    {
      title: "Correlated EXISTS",
      sql: "SELECT c.name FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);",
      explanation:
        "For each customer, EXISTS checks whether at least one matching order exists. c.id correlates the inner query to the current customer.",
    },
    {
      title: "Derived table",
      sql: "SELECT region, max_total FROM (SELECT region, MAX(total) AS max_total FROM orders GROUP BY region) AS per_region WHERE max_total > 400;",
      explanation:
        "A grouped subquery is treated as a table (aliased per_region) that the outer query filters further.",
    },
  ],
  datasets: [
    {
      name: "middle-b3-orders",
      setupSql: `
CREATE TABLE customers (
  id     INT PRIMARY KEY,
  name   VARCHAR(50) NOT NULL,
  city   VARCHAR(40) NOT NULL
);

CREATE TABLE orders (
  id          INT PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  region      VARCHAR(20) NOT NULL,
  order_date  DATE NOT NULL,
  total       NUMERIC(10,2) NOT NULL
);

INSERT INTO customers (id, name, city) VALUES
  (1, 'Alice',   'Boston'),
  (2, 'Bob',     'Denver'),
  (3, 'Carol',   'Boston'),
  (4, 'David',   'Austin'),
  (5, 'Eve',     'Denver'),
  (6, 'Frank',   'Seattle');

INSERT INTO orders (id, customer_id, region, order_date, total) VALUES
  (1,  1, 'East',  '2022-01-10', 200.00),
  (2,  1, 'East',  '2022-02-15', 550.00),
  (3,  2, 'West',  '2022-01-20', 320.00),
  (4,  2, 'West',  '2022-03-05', 120.00),
  (5,  3, 'East',  '2022-02-01', 480.00),
  (6,  3, 'East',  '2022-03-22', 600.00),
  (7,  4, 'South', '2022-01-30', 90.00),
  (8,  5, 'West',  '2022-02-18', 410.00),
  (9,  5, 'West',  '2022-03-12', 410.00);
      `.trim(),
      schemaJson: [
        {
          tableName: "customers",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
            { name: "city", type: "VARCHAR(40)" },
          ],
        },
        {
          tableName: "orders",
          columns: [
            { name: "id", type: "INT" },
            { name: "customer_id", type: "INT" },
            { name: "region", type: "VARCHAR(20)" },
            { name: "order_date", type: "DATE" },
            { name: "total", type: "NUMERIC(10,2)" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "middle-b3-orders",
      prompt:
        "Return the `id` and `total` of every order whose `total` is greater than the average `total` across all orders.",
      hint: "Use a scalar subquery: WHERE total > (SELECT AVG(total) FROM orders).",
      referenceQuery:
        "SELECT id, total FROM orders WHERE total > (SELECT AVG(total) FROM orders);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "middle-b3-orders",
      prompt:
        "Return the `name` of every customer who has placed at least one order with `total` greater than 500, using a subquery with `IN`.",
      hint: "WHERE id IN (SELECT customer_id FROM orders WHERE total > 500).",
      referenceQuery:
        "SELECT name FROM customers WHERE id IN (SELECT customer_id FROM orders WHERE total > 500);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "middle-b3-orders",
      prompt:
        "Return the `name` of every customer who has placed at least one order, using a correlated `EXISTS` subquery.",
      hint: "WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id).",
      referenceQuery:
        "SELECT name FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "middle-b3-orders",
      prompt:
        "Return the `name` of every customer who has placed NO orders, using a correlated `NOT EXISTS` subquery.",
      hint: "WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id).",
      referenceQuery:
        "SELECT name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "middle-b3-orders",
      prompt:
        "Return each order's `id`, `region`, and `total` where the order's `total` equals the maximum `total` for its `region`, using a correlated subquery. Order by `region` ascending.",
      hint: "Compare o.total = (SELECT MAX(total) FROM orders o2 WHERE o2.region = o.region).",
      referenceQuery:
        "SELECT id, region, total FROM orders o WHERE total = (SELECT MAX(total) FROM orders o2 WHERE o2.region = o.region) ORDER BY region;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "middle-b3-orders",
      prompt:
        "Using a derived table that computes the maximum `total` per `region`, return `region` and `max_total` for regions whose maximum exceeds 400. Order by `max_total` descending.",
      hint: "Put a GROUP BY region subquery in FROM (aliased), then filter WHERE max_total > 400.",
      referenceQuery:
        "SELECT region, max_total FROM (SELECT region, MAX(total) AS max_total FROM orders GROUP BY region) AS per_region WHERE max_total > 400 ORDER BY max_total DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "middle-b3-orders",
      prompt:
        "For each customer, return their `name` and a column `order_count` containing the number of orders they placed, using a correlated scalar subquery in the SELECT list. Order by `order_count` descending, then `name` ascending.",
      hint: "SELECT name, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count FROM customers c.",
      referenceQuery:
        "SELECT name, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count FROM customers c ORDER BY order_count DESC, name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "middle-b3-orders",
      prompt:
        "Return the `name` and `total` of orders (joined to the customer) whose `total` is greater than every order placed in the `South` region, using a subquery with `ALL`. Order by `total` descending.",
      hint: "WHERE total > ALL (SELECT total FROM orders WHERE region = 'South'); join orders to customers for the name.",
      referenceQuery:
        "SELECT c.name, o.total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.total > ALL (SELECT total FROM orders WHERE region = 'South') ORDER BY o.total DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "middle-b3-orders",
      prompt:
        "Return the `name` and `city` of customers located in a `city` that has more than one customer, using a correlated subquery on `customers`. Order by `city`, then `name`.",
      hint: "WHERE (SELECT COUNT(*) FROM customers c2 WHERE c2.city = c.city) > 1.",
      referenceQuery:
        "SELECT name, city FROM customers c WHERE (SELECT COUNT(*) FROM customers c2 WHERE c2.city = c.city) > 1 ORDER BY city, name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "middle-b3-orders",
      prompt:
        "Return each customer's `name` and their `total_spent` (sum of order totals), but only customers whose total spend exceeds the average total spend across all customers who ordered. Order by `total_spent` descending.",
      hint: "Build a derived table of per-customer sums, then compare each to the average of those sums via a subquery.",
      referenceQuery:
        "SELECT name, total_spent FROM (SELECT c.name AS name, SUM(o.total) AS total_spent FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id, c.name) AS spend WHERE total_spent > (SELECT AVG(s) FROM (SELECT SUM(total) AS s FROM orders GROUP BY customer_id) AS per_cust) ORDER BY total_spent DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
