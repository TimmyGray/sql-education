/**
 * Block 2 — Filtering & Sorting
 * Dataset: novice-b2-products (products + categories)
 */
import type { BlockDef } from "../types";

export const block2: BlockDef = {
  level: "NOVICE",
  order: 2,
  title: "Filtering & Sorting",
  theoryMarkdown: `# Filtering & Sorting

Once you can retrieve data, the next skill is narrowing and ordering results.

## Comparison Operators

Beyond \`=\`, SQL supports the standard comparison operators:

| Operator | Meaning |
|----------|---------|
| \`=\`  | equals |
| \`<>\` or \`!=\` | not equals |
| \`<\` | less than |
| \`>\` | greater than |
| \`<=\` | less than or equal |
| \`>=\` | greater than or equal |

\`\`\`sql
SELECT name, price FROM products WHERE price > 50;
\`\`\`

## IN and BETWEEN

\`IN\` matches any value in a list:

\`\`\`sql
SELECT name FROM products WHERE category_id IN (1, 3);
\`\`\`

\`BETWEEN\` checks for an inclusive range:

\`\`\`sql
SELECT name, price FROM products WHERE price BETWEEN 20 AND 80;
\`\`\`

## LIKE (Pattern Matching)

\`LIKE\` matches string patterns using wildcards:
- \`%\` matches zero or more characters.
- \`_\` matches exactly one character.

\`\`\`sql
SELECT name FROM products WHERE name LIKE 'S%';   -- starts with S
SELECT name FROM products WHERE name LIKE '%kit';  -- ends with kit
\`\`\`

## AND / OR / NOT

Combine conditions with logical operators:

\`\`\`sql
SELECT name, price FROM products
WHERE price > 30 AND category_id = 2;

SELECT name FROM products
WHERE category_id = 1 OR category_id = 3;

SELECT name FROM products
WHERE NOT category_id = 2;
\`\`\`

Use parentheses to control precedence: \`AND\` binds more tightly than \`OR\`.

## ORDER BY

Sort results with \`ORDER BY\`. Default is ascending (\`ASC\`); use \`DESC\` for descending:

\`\`\`sql
SELECT name, price FROM products ORDER BY price DESC;
SELECT name, price FROM products ORDER BY price ASC, name ASC;
\`\`\`

## LIMIT

Return only the first N rows:

\`\`\`sql
SELECT name, price FROM products ORDER BY price DESC LIMIT 3;
\`\`\`

\`LIMIT\` is most useful combined with \`ORDER BY\` so the "top N" is deterministic.
`,
  theoryExamples: [
    {
      title: "Comparison filter",
      sql: "SELECT name, price FROM products WHERE price > 50;",
      explanation:
        "Returns only products with a price strictly greater than 50. The > operator works on numeric, date, and string columns.",
    },
    {
      title: "IN list filter",
      sql: "SELECT name, category_id FROM products WHERE category_id IN (1, 2);",
      explanation:
        "IN (1, 2) is shorthand for category_id = 1 OR category_id = 2. It keeps the WHERE clause concise when checking multiple values.",
    },
    {
      title: "LIKE pattern",
      sql: "SELECT name FROM products WHERE name LIKE 'W%';",
      explanation:
        "LIKE 'W%' matches any name that starts with the letter W. The % wildcard represents any sequence of characters.",
    },
    {
      title: "ORDER BY with LIMIT",
      sql: "SELECT name, price FROM products ORDER BY price DESC LIMIT 3;",
      explanation:
        "Sorts all products by price descending, then returns only the top 3. Without ORDER BY, LIMIT picks rows arbitrarily.",
    },
  ],
  datasets: [
    {
      name: "novice-b2-products",
      setupSql: `
CREATE TABLE categories (
  id   INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

CREATE TABLE products (
  id          INT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  category_id INT REFERENCES categories(id),
  price       NUMERIC(8,2) NOT NULL,
  stock       INT NOT NULL DEFAULT 0
);

INSERT INTO categories (id, name) VALUES
  (1, 'Electronics'),
  (2, 'Clothing'),
  (3, 'Books'),
  (4, 'Sports');

INSERT INTO products (id, name, category_id, price, stock) VALUES
  (1,  'Laptop',          1,  999.99, 15),
  (2,  'T-Shirt',         2,   19.99, 80),
  (3,  'SQL Handbook',    3,   39.99, 50),
  (4,  'Running Shoes',   4,   89.99, 30),
  (5,  'Headphones',      1,  149.99, 20),
  (6,  'Winter Jacket',   2,  129.99, 10),
  (7,  'Python Primer',   3,   29.99, 45),
  (8,  'Yoga Mat',        4,   24.99, 60),
  (9,  'Wireless Mouse',  1,   34.99, 55),
  (10, 'Dress Shirt',     2,   49.99, 35);
      `.trim(),
      schemaJson: [
        {
          tableName: "categories",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
          ],
        },
        {
          tableName: "products",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(100)" },
            { name: "category_id", type: "INT" },
            { name: "price", type: "NUMERIC(8,2)" },
            { name: "stock", type: "INT" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "novice-b2-products",
      prompt:
        "Select `name` and `price` from `products` where `price` is greater than 50.",
      hint: "Use the > operator in your WHERE clause.",
      referenceQuery:
        "SELECT name, price FROM products WHERE price > 50;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "novice-b2-products",
      prompt:
        "Select `name` and `price` from `products` where `price` is less than or equal to 40.",
      hint: "Use the <= operator.",
      referenceQuery:
        "SELECT name, price FROM products WHERE price <= 40;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "novice-b2-products",
      prompt:
        "Select `name` and `category_id` from `products` where `category_id` is IN (1, 3).",
      hint: "Use WHERE category_id IN (1, 3) to match rows in either category.",
      referenceQuery:
        "SELECT name, category_id FROM products WHERE category_id IN (1, 3);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "novice-b2-products",
      prompt:
        "Select `name` and `price` from `products` where `price` is BETWEEN 25 and 100 (inclusive).",
      hint: "BETWEEN is inclusive on both ends: BETWEEN 25 AND 100.",
      referenceQuery:
        "SELECT name, price FROM products WHERE price BETWEEN 25 AND 100;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "novice-b2-products",
      prompt:
        "Select `name` from `products` where the name starts with the letter 'W'.",
      hint: "Use LIKE 'W%' — the % matches any sequence of characters.",
      referenceQuery:
        "SELECT name FROM products WHERE name LIKE 'W%';",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "novice-b2-products",
      prompt:
        "Select `name` and `price` from `products` where `price` is greater than 30 AND `category_id` equals 2.",
      hint: "Combine two conditions with AND.",
      referenceQuery:
        "SELECT name, price FROM products WHERE price > 30 AND category_id = 2;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "novice-b2-products",
      prompt:
        "Select `name` and `category_id` from `products` where `category_id` equals 3 OR `category_id` equals 4.",
      hint: "Use OR to combine two conditions that each match a different value.",
      referenceQuery:
        "SELECT name, category_id FROM products WHERE category_id = 3 OR category_id = 4;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "novice-b2-products",
      prompt:
        "Select `name` and `price` from `products`, ordered by `price` ascending.",
      hint: "Use ORDER BY price ASC (ASC is the default, but being explicit is fine).",
      referenceQuery:
        "SELECT name, price FROM products ORDER BY price ASC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "novice-b2-products",
      prompt:
        "Select `name` and `price` from `products`, ordered by `price` descending, and return only the top 3 rows.",
      hint: "Combine ORDER BY price DESC with LIMIT 3.",
      referenceQuery:
        "SELECT name, price FROM products ORDER BY price DESC LIMIT 3;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "novice-b2-products",
      prompt:
        "Select `name` and `stock` from `products` where `stock` is NOT less than 50, ordered by `stock` descending.",
      hint: "NOT (stock < 50) is the same as stock >= 50. Then add ORDER BY stock DESC.",
      referenceQuery:
        "SELECT name, stock FROM products WHERE NOT stock < 50 ORDER BY stock DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
