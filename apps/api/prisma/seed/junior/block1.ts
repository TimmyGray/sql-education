/**
 * Block 1 — Multi-table JOINs
 * Dataset: junior-b1-sales (customers + orders + employees)
 */
import type { BlockDef } from "../types";

export const block1: BlockDef = {
  level: "JUNIOR",
  order: 1,
  title: "Multi-table JOINs",
  theoryMarkdown: `# Multi-table JOINs

Real databases spread related data across many tables. \`JOIN\` lets you recombine that data in a single query by matching rows on a shared key.

## INNER JOIN

An \`INNER JOIN\` returns only rows that have a match in **both** tables. It is the most common join.

\`\`\`sql
SELECT orders.id, customers.name
FROM orders
INNER JOIN customers ON orders.customer_id = customers.id;
\`\`\`

The \`ON\` clause states how the two tables relate — here, the order's \`customer_id\` must equal a customer's \`id\`. Orders with no matching customer (and customers with no orders) are excluded.

## Table Aliases

Typing full table names repeatedly is tedious. Give each table a short alias and use it as a prefix:

\`\`\`sql
SELECT o.id, c.name
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.id;
\`\`\`

The \`AS\` keyword is optional for table aliases (\`orders o\` works too), but being explicit aids readability.

## LEFT JOIN

A \`LEFT JOIN\` (also \`LEFT OUTER JOIN\`) returns **all** rows from the left table, plus matching rows from the right table. Where there is no match, the right table's columns are \`NULL\`.

\`\`\`sql
SELECT c.name, o.id AS order_id
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id;
\`\`\`

This is the standard way to find "all customers, including those without orders". To keep only the unmatched rows, filter with \`WHERE o.id IS NULL\`.

## Joining Three Tables

Chain joins to combine three or more tables. Each \`JOIN\` adds one table and one \`ON\` condition:

\`\`\`sql
SELECT o.id, c.name AS customer, e.name AS rep
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.id
INNER JOIN employees AS e ON o.employee_id = e.id;
\`\`\`

## Qualifying Columns

When two tables share a column name (such as \`id\` or \`name\`), you must qualify it with the table or alias (\`c.name\`) to avoid an "ambiguous column" error.

## Key Points

- \`INNER JOIN\` keeps only matched rows; \`LEFT JOIN\` keeps every left-table row.
- The \`ON\` clause defines the matching condition, usually \`foreign_key = primary_key\`.
- Aliases shorten queries and are required when a table is joined to itself.
- Always qualify columns that exist in more than one joined table.
`,
  theoryExamples: [
    {
      title: "INNER JOIN two tables",
      sql: "SELECT o.id, c.name FROM orders AS o INNER JOIN customers AS c ON o.customer_id = c.id;",
      explanation:
        "Returns one row per order that has a matching customer, pairing each order id with its customer's name. Orders without a customer are dropped.",
    },
    {
      title: "LEFT JOIN keeps all left rows",
      sql: "SELECT c.name, o.id FROM customers AS c LEFT JOIN orders AS o ON o.customer_id = c.id;",
      explanation:
        "Every customer appears at least once. Customers with no orders still show, with NULL in the order id column.",
    },
    {
      title: "Join three tables",
      sql: "SELECT o.id, c.name, e.name FROM orders AS o INNER JOIN customers AS c ON o.customer_id = c.id INNER JOIN employees AS e ON o.employee_id = e.id;",
      explanation:
        "Chains two INNER JOINs so each order is shown with both its customer and the employee who handled it.",
    },
    {
      title: "Filter after joining",
      sql: "SELECT o.id, c.name FROM orders AS o INNER JOIN customers AS c ON o.customer_id = c.id WHERE c.city = 'Boston';",
      explanation:
        "A WHERE clause applies after the join, so you can filter on columns from either table — here, only orders from Boston customers.",
    },
  ],
  datasets: [
    {
      name: "junior-b1-sales",
      setupSql: `
CREATE TABLE customers (
  id     INT PRIMARY KEY,
  name   VARCHAR(50) NOT NULL,
  city   VARCHAR(50) NOT NULL
);

CREATE TABLE employees (
  id     INT PRIMARY KEY,
  name   VARCHAR(50) NOT NULL,
  region VARCHAR(50) NOT NULL
);

CREATE TABLE orders (
  id          INT PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  employee_id INT REFERENCES employees(id),
  amount      NUMERIC(10,2) NOT NULL,
  order_date  DATE NOT NULL
);

INSERT INTO customers (id, name, city) VALUES
  (1, 'Acme Corp',     'Boston'),
  (2, 'Globex',        'Chicago'),
  (3, 'Initech',       'Boston'),
  (4, 'Umbrella',      'Denver'),
  (5, 'Stark Inc',     'Chicago');

INSERT INTO employees (id, name, region) VALUES
  (1, 'Nora Reed',   'East'),
  (2, 'Liam Cole',   'West'),
  (3, 'Priya Shah',  'East');

INSERT INTO orders (id, customer_id, employee_id, amount, order_date) VALUES
  (1, 1, 1,  500.00, '2022-01-15'),
  (2, 1, 2,  250.00, '2022-02-10'),
  (3, 2, 1, 1200.00, '2022-02-20'),
  (4, 3, 3,  300.00, '2022-03-05'),
  (5, 2, 2,  750.00, '2022-03-18'),
  (6, 5, 1,  900.00, '2022-04-01'),
  (7, 1, 3,  150.00, '2022-04-22');
      `.trim(),
      schemaJson: [
        {
          tableName: "customers",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
            { name: "city", type: "VARCHAR(50)" },
          ],
        },
        {
          tableName: "employees",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
            { name: "region", type: "VARCHAR(50)" },
          ],
        },
        {
          tableName: "orders",
          columns: [
            { name: "id", type: "INT" },
            { name: "customer_id", type: "INT" },
            { name: "employee_id", type: "INT" },
            { name: "amount", type: "NUMERIC(10,2)" },
            { name: "order_date", type: "DATE" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "junior-b1-sales",
      prompt:
        "Using an INNER JOIN, select each order's `id` (from `orders`) and the customer's `name` (from `customers`). Match `orders.customer_id` to `customers.id`.",
      hint: "Join orders to customers with ON orders.customer_id = customers.id.",
      referenceQuery:
        "SELECT o.id, c.name FROM orders AS o INNER JOIN customers AS c ON o.customer_id = c.id;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "junior-b1-sales",
      prompt:
        "Select the order `id`, `amount`, and the customer's `city` for every order, joining `orders` to `customers`.",
      hint: "Qualify the city column from the customers table: c.city.",
      referenceQuery:
        "SELECT o.id, o.amount, c.city FROM orders AS o INNER JOIN customers AS c ON o.customer_id = c.id;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "junior-b1-sales",
      prompt:
        "Select the order `id` and customer `name` only for orders placed by customers in `'Boston'`. Join `orders` and `customers`, then filter on the city.",
      hint: "Add WHERE c.city = 'Boston' after the join.",
      referenceQuery:
        "SELECT o.id, c.name FROM orders AS o INNER JOIN customers AS c ON o.customer_id = c.id WHERE c.city = 'Boston';",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "junior-b1-sales",
      prompt:
        "Select the order `id` and the handling employee's `name`, joining `orders` to `employees` on `orders.employee_id = employees.id`.",
      hint: "This is the same pattern as joining to customers, but uses employee_id.",
      referenceQuery:
        "SELECT o.id, e.name FROM orders AS o INNER JOIN employees AS e ON o.employee_id = e.id;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "junior-b1-sales",
      prompt:
        "Select the order `id`, the customer's `name`, and the employee's `name`, joining all three tables: `orders`, `customers`, and `employees`. Alias the customer name as `customer` and the employee name as `rep`.",
      hint: "Chain two INNER JOINs and use AS to alias the two name columns.",
      referenceQuery:
        "SELECT o.id, c.name AS customer, e.name AS rep FROM orders AS o INNER JOIN customers AS c ON o.customer_id = c.id INNER JOIN employees AS e ON o.employee_id = e.id;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "junior-b1-sales",
      prompt:
        "Using a LEFT JOIN, select every customer's `name` and the `id` of their orders (alias it `order_id`). Customers with no orders should still appear (with NULL order_id). Join `customers` to `orders`.",
      hint: "Start FROM customers and LEFT JOIN orders ON o.customer_id = c.id.",
      referenceQuery:
        "SELECT c.name, o.id AS order_id FROM customers AS c LEFT JOIN orders AS o ON o.customer_id = c.id;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "junior-b1-sales",
      prompt:
        "Find customers who have NO orders. Select their `name`. Use a LEFT JOIN from `customers` to `orders` and keep only rows where the order side is NULL.",
      hint: "After the LEFT JOIN, filter with WHERE o.id IS NULL.",
      referenceQuery:
        "SELECT c.name FROM customers AS c LEFT JOIN orders AS o ON o.customer_id = c.id WHERE o.id IS NULL;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "junior-b1-sales",
      prompt:
        "Select the order `id`, customer `name`, and order `amount` for orders with an `amount` greater than 500, joining `orders` and `customers`.",
      hint: "Filter on the orders table's amount column after joining.",
      referenceQuery:
        "SELECT o.id, c.name, o.amount FROM orders AS o INNER JOIN customers AS c ON o.customer_id = c.id WHERE o.amount > 500;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "junior-b1-sales",
      prompt:
        "Select the customer `name`, employee `name` (aliased `rep`), and order `amount` for every order, joining all three tables. Order the result by `amount` descending.",
      hint: "Join the three tables, then add ORDER BY o.amount DESC.",
      referenceQuery:
        "SELECT c.name, e.name AS rep, o.amount FROM orders AS o INNER JOIN customers AS c ON o.customer_id = c.id INNER JOIN employees AS e ON o.employee_id = e.id ORDER BY o.amount DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "junior-b1-sales",
      prompt:
        "Select the order `id`, customer `name`, and customer `city`, joining `orders` and `customers`, only for customers in `'Boston'` or `'Chicago'`. Order the result by `city` ascending, then by order `id` ascending.",
      hint: "Use WHERE c.city IN ('Boston', 'Chicago') and ORDER BY c.city, o.id.",
      referenceQuery:
        "SELECT o.id, c.name, c.city FROM orders AS o INNER JOIN customers AS c ON o.customer_id = c.id WHERE c.city IN ('Boston', 'Chicago') ORDER BY c.city ASC, o.id ASC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
