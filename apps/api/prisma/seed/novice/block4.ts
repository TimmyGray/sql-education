/**
 * Block 4 — Joins
 * Dataset: novice-b4-store (customers + orders + products + order_items)
 */
import type { BlockDef } from "../types";

export const block4: BlockDef = {
  level: "NOVICE",
  order: 4,
  title: "Joins",
  theoryMarkdown: `# Joins

A JOIN combines rows from two or more tables based on a related column.

## INNER JOIN

Returns only rows that have a match in **both** tables:

\`\`\`sql
SELECT customers.name, orders.amount
FROM orders
INNER JOIN customers ON orders.customer_id = customers.id;
\`\`\`

If an order has no matching customer (or vice versa), that row is excluded.

## LEFT JOIN (LEFT OUTER JOIN)

Returns **all rows from the left table**, plus matched rows from the right table. If there is no match, right-table columns are NULL:

\`\`\`sql
SELECT customers.name, orders.amount
FROM customers
LEFT JOIN orders ON customers.id = orders.customer_id;
\`\`\`

Use a LEFT JOIN when you want to keep every row from the "main" (left) table even if it has no related row.

## Table Aliases

Use short aliases to avoid repeating long table names:

\`\`\`sql
SELECT c.name, o.amount
FROM customers AS c
INNER JOIN orders AS o ON c.id = o.customer_id;
\`\`\`

## Joining Three Tables

Chain additional JOINs to combine three (or more) tables:

\`\`\`sql
SELECT c.name, p.name AS product, oi.quantity
FROM customers AS c
INNER JOIN orders AS o ON c.id = o.customer_id
INNER JOIN order_items AS oi ON o.id = oi.order_id
INNER JOIN products AS p ON oi.product_id = p.id;
\`\`\`

## Which JOIN to Use?

- Use **INNER JOIN** when you only want rows that have a match on both sides.
- Use **LEFT JOIN** when you want all rows from one table, even if the other has no match.
- The most common need is INNER JOIN (matching data) and LEFT JOIN (optional relationship).
`,
  theoryExamples: [
    {
      title: "INNER JOIN two tables",
      sql: `SELECT c.name AS customer, o.amount
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.id;`,
      explanation:
        "INNER JOIN returns one row for each order that has a matching customer. Orders without a customer (or customers without orders) are excluded.",
    },
    {
      title: "LEFT JOIN to include all left rows",
      sql: `SELECT c.name, o.amount
FROM customers AS c
LEFT JOIN orders AS o ON c.id = o.customer_id;`,
      explanation:
        "Every customer appears at least once. If a customer has no orders, the amount column is NULL. With INNER JOIN, that customer would be absent entirely.",
    },
    {
      title: "Three-table join",
      sql: `SELECT c.name, p.name AS product, oi.quantity
FROM customers AS c
INNER JOIN orders AS o ON c.id = o.customer_id
INNER JOIN order_items AS oi ON o.id = oi.order_id
INNER JOIN products AS p ON oi.product_id = p.id;`,
      explanation:
        "Chains three INNER JOINs to travel from customers → orders → order_items → products. Each JOIN adds a new table using a foreign-key relationship.",
    },
  ],
  datasets: [
    {
      name: "novice-b4-store",
      setupSql: `
CREATE TABLE customers (
  id   INT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  city VARCHAR(50)
);

CREATE TABLE products (
  id    INT PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  price NUMERIC(8,2) NOT NULL
);

CREATE TABLE orders (
  id          INT PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  order_date  DATE NOT NULL
);

CREATE TABLE order_items (
  id         INT PRIMARY KEY,
  order_id   INT REFERENCES orders(id),
  product_id INT REFERENCES products(id),
  quantity   INT NOT NULL,
  unit_price NUMERIC(8,2) NOT NULL
);

INSERT INTO customers (id, name, city) VALUES
  (1, 'Alice Green',  'Boston'),
  (2, 'Bob Hill',     'Austin'),
  (3, 'Carol King',   'Boston'),
  (4, 'Dan Lee',      'Chicago');

INSERT INTO products (id, name, price) VALUES
  (1, 'Widget A',  9.99),
  (2, 'Widget B', 14.99),
  (3, 'Gadget X', 49.99),
  (4, 'Gadget Y', 79.99);

INSERT INTO orders (id, customer_id, order_date) VALUES
  (1, 1, '2024-01-15'),
  (2, 1, '2024-02-20'),
  (3, 2, '2024-01-28'),
  (4, 3, '2024-03-10');
  -- Dan Lee (id=4) has no orders intentionally

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES
  (1, 1, 1, 2,  9.99),
  (2, 1, 3, 1, 49.99),
  (3, 2, 2, 3, 14.99),
  (4, 3, 4, 1, 79.99),
  (5, 3, 1, 5,  9.99),
  (6, 4, 2, 2, 14.99),
  (7, 4, 3, 1, 49.99);
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
          tableName: "products",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(100)" },
            { name: "price", type: "NUMERIC(8,2)" },
          ],
        },
        {
          tableName: "orders",
          columns: [
            { name: "id", type: "INT" },
            { name: "customer_id", type: "INT" },
            { name: "order_date", type: "DATE" },
          ],
        },
        {
          tableName: "order_items",
          columns: [
            { name: "id", type: "INT" },
            { name: "order_id", type: "INT" },
            { name: "product_id", type: "INT" },
            { name: "quantity", type: "INT" },
            { name: "unit_price", type: "NUMERIC(8,2)" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "novice-b4-store",
      prompt:
        "Using an INNER JOIN, select the customer `name` (from `customers`) and `order_date` (from `orders`) for all orders.",
      hint: "Join orders to customers on orders.customer_id = customers.id.",
      referenceQuery: `SELECT c.name, o.order_date
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.id;`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "novice-b4-store",
      prompt:
        "Using a LEFT JOIN, select every customer's `name` and their `order_date`. Include customers who have no orders (they should appear with a NULL order_date).",
      hint: "LEFT JOIN keeps all rows from the left table (customers). Unmatched rows get NULL on the right side.",
      referenceQuery: `SELECT c.name, o.order_date
FROM customers AS c
LEFT JOIN orders AS o ON c.id = o.customer_id;`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "novice-b4-store",
      prompt:
        "Select the `name` from `products` and `unit_price` from `order_items` for every order item, using an INNER JOIN.",
      hint: "Join order_items to products on order_items.product_id = products.id.",
      referenceQuery: `SELECT p.name, oi.unit_price
FROM order_items AS oi
INNER JOIN products AS p ON oi.product_id = p.id;`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "novice-b4-store",
      prompt:
        "Select customer `name` (from `customers`) and `order_date` from `orders`, filtering only customers from 'Boston'.",
      hint: "INNER JOIN orders to customers, then add WHERE c.city = 'Boston'.",
      referenceQuery: `SELECT c.name, o.order_date
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.id
WHERE c.city = 'Boston';`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "novice-b4-store",
      prompt:
        "For each order item, select the `order_id`, product `name` (from `products`), and `quantity`. Use an INNER JOIN.",
      hint: "Join order_items to products using the product_id foreign key.",
      referenceQuery: `SELECT oi.order_id, p.name, oi.quantity
FROM order_items AS oi
INNER JOIN products AS p ON oi.product_id = p.id;`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "novice-b4-store",
      prompt:
        "Join `customers`, `orders`, and `order_items` to get the customer `name`, `order_date`, and `quantity` for every order item.",
      hint: "Chain two INNER JOINs: customers → orders → order_items.",
      referenceQuery: `SELECT c.name, o.order_date, oi.quantity
FROM customers AS c
INNER JOIN orders AS o ON c.id = o.customer_id
INNER JOIN order_items AS oi ON o.id = oi.order_id;`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "novice-b4-store",
      prompt:
        "Join all four tables (`customers`, `orders`, `order_items`, `products`) to get customer `name`, product `name` (aliased as `product`), and `quantity`.",
      hint: "Chain three INNER JOINs: customers → orders → order_items → products.",
      referenceQuery: `SELECT c.name, p.name AS product, oi.quantity
FROM customers AS c
INNER JOIN orders AS o ON c.id = o.customer_id
INNER JOIN order_items AS oi ON o.id = oi.order_id
INNER JOIN products AS p ON oi.product_id = p.id;`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "novice-b4-store",
      prompt:
        "Using a LEFT JOIN between `customers` and `orders`, count how many orders each customer has. Return `name` and `order_count`. Include customers with zero orders.",
      hint: "LEFT JOIN then COUNT(o.id) — counting a column (not *) returns 0 when all values are NULL.",
      referenceQuery: `SELECT c.name, COUNT(o.id) AS order_count
FROM customers AS c
LEFT JOIN orders AS o ON c.id = o.customer_id
GROUP BY c.id, c.name;`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "novice-b4-store",
      prompt:
        "Join `orders` and `order_items` to find the total `quantity` ordered per `order_id`. Return `order_id` and `total_qty`.",
      hint: "INNER JOIN order_items to orders on order_id, then SUM(quantity) grouped by order_id.",
      referenceQuery: `SELECT o.id AS order_id, SUM(oi.quantity) AS total_qty
FROM orders AS o
INNER JOIN order_items AS oi ON o.id = oi.order_id
GROUP BY o.id;`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "novice-b4-store",
      prompt:
        "Join `customers`, `orders`, and `order_items` to find each customer's total spend (`quantity * unit_price` summed). Return customer `name` and `total_spend`, ordered by `total_spend` descending.",
      hint: "SUM(oi.quantity * oi.unit_price) after joining all three tables, GROUP BY customer, ORDER BY descending.",
      referenceQuery: `SELECT c.name, SUM(oi.quantity * oi.unit_price) AS total_spend
FROM customers AS c
INNER JOIN orders AS o ON c.id = o.customer_id
INNER JOIN order_items AS oi ON o.id = oi.order_id
GROUP BY c.id, c.name
ORDER BY total_spend DESC;`,
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
