/**
 * Block 3 — Subqueries
 * Dataset: junior-b3-library (books + members + loans)
 */
import type { BlockDef } from "../types";

export const block3: BlockDef = {
  level: "JUNIOR",
  order: 3,
  title: "Subqueries",
  theoryMarkdown: `# Subqueries

A subquery is a \`SELECT\` nested inside another query. It lets you compute a value, a list, or a derived table to use in the outer query.

## Scalar Subqueries

A scalar subquery returns a single value (one row, one column). You can use it anywhere a value is expected — often in \`WHERE\`:

\`\`\`sql
SELECT title
FROM books
WHERE price > (SELECT AVG(price) FROM books);
\`\`\`

The inner query computes the average price once; the outer query compares each book against it.

## IN and NOT IN

A subquery that returns a column of values can drive an \`IN\` (or \`NOT IN\`) filter:

\`\`\`sql
SELECT title
FROM books
WHERE id IN (SELECT book_id FROM loans);
\`\`\`

This finds books that have at least one loan. \`NOT IN\` returns books that have never been loaned. Be careful: if the subquery can produce \`NULL\`, \`NOT IN\` may behave unexpectedly — prefer \`NOT EXISTS\` in that case.

## EXISTS

\`EXISTS\` tests whether a **correlated** subquery returns any row. The subquery references a column from the outer query:

\`\`\`sql
SELECT m.name
FROM members AS m
WHERE EXISTS (
  SELECT 1 FROM loans AS l WHERE l.member_id = m.id
);
\`\`\`

\`EXISTS\` stops as soon as one matching row is found, so it is efficient. Use \`NOT EXISTS\` to find members with no loans.

## Subquery in FROM (Derived Table)

A subquery in the \`FROM\` clause acts as a temporary table. It must be given an alias:

\`\`\`sql
SELECT category, total
FROM (
  SELECT category, SUM(price) AS total
  FROM books
  GROUP BY category
) AS sums
WHERE total > 50;
\`\`\`

## Key Points

- Scalar subqueries return exactly one value and slot in where a value is expected.
- \`IN (subquery)\` filters against a list of values the subquery returns.
- \`EXISTS\` checks for the existence of matching rows and is usually correlated.
- A subquery in \`FROM\` is a derived table and **must** have an alias.
`,
  theoryExamples: [
    {
      title: "Scalar subquery in WHERE",
      sql: "SELECT title FROM books WHERE price > (SELECT AVG(price) FROM books);",
      explanation:
        "The subquery returns the single average price; each book is compared against it, returning only above-average books.",
    },
    {
      title: "IN with a subquery",
      sql: "SELECT title FROM books WHERE id IN (SELECT book_id FROM loans);",
      explanation:
        "The subquery produces the list of book ids that appear in loans; the outer query keeps books whose id is in that list.",
    },
    {
      title: "Correlated EXISTS",
      sql: "SELECT m.name FROM members AS m WHERE EXISTS (SELECT 1 FROM loans AS l WHERE l.member_id = m.id);",
      explanation:
        "For each member, EXISTS checks whether any loan references that member. Members with no loans are excluded.",
    },
    {
      title: "Derived table in FROM",
      sql: "SELECT category, total FROM (SELECT category, SUM(price) AS total FROM books GROUP BY category) AS sums WHERE total > 50;",
      explanation:
        "The inner query summarises prices per category; the outer query treats that result as a table and filters it. The alias 'sums' is required.",
    },
  ],
  datasets: [
    {
      name: "junior-b3-library",
      setupSql: `
CREATE TABLE members (
  id    INT PRIMARY KEY,
  name  VARCHAR(50) NOT NULL
);

CREATE TABLE books (
  id        INT PRIMARY KEY,
  title     VARCHAR(80) NOT NULL,
  category  VARCHAR(30) NOT NULL,
  price     NUMERIC(8,2) NOT NULL
);

CREATE TABLE loans (
  id         INT PRIMARY KEY,
  book_id    INT REFERENCES books(id),
  member_id  INT REFERENCES members(id),
  loan_date  DATE NOT NULL
);

INSERT INTO members (id, name) VALUES
  (1, 'Anna'),
  (2, 'Ben'),
  (3, 'Cara'),
  (4, 'Dan');

INSERT INTO books (id, title, category, price) VALUES
  (1, 'SQL Deep Dive',     'Tech',    45.00),
  (2, 'Cloud Basics',      'Tech',    30.00),
  (3, 'The Long Road',     'Fiction', 18.00),
  (4, 'Quiet Waters',      'Fiction', 22.00),
  (5, 'History of Maps',   'History', 55.00),
  (6, 'Ancient Empires',   'History', 60.00);

INSERT INTO loans (id, book_id, member_id, loan_date) VALUES
  (1, 1, 1, '2022-03-01'),
  (2, 3, 1, '2022-03-05'),
  (3, 1, 2, '2022-03-10'),
  (4, 5, 3, '2022-03-12'),
  (5, 2, 2, '2022-03-20');
      `.trim(),
      schemaJson: [
        {
          tableName: "members",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
          ],
        },
        {
          tableName: "books",
          columns: [
            { name: "id", type: "INT" },
            { name: "title", type: "VARCHAR(80)" },
            { name: "category", type: "VARCHAR(30)" },
            { name: "price", type: "NUMERIC(8,2)" },
          ],
        },
        {
          tableName: "loans",
          columns: [
            { name: "id", type: "INT" },
            { name: "book_id", type: "INT" },
            { name: "member_id", type: "INT" },
            { name: "loan_date", type: "DATE" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "junior-b3-library",
      prompt:
        "Select the `title` of all books whose `price` is greater than the average price of all books. Use a scalar subquery.",
      hint: "Compare price against (SELECT AVG(price) FROM books).",
      referenceQuery:
        "SELECT title FROM books WHERE price > (SELECT AVG(price) FROM books);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "junior-b3-library",
      prompt:
        "Select the `title` of the book(s) whose `price` equals the maximum price in the `books` table. Use a scalar subquery for the maximum.",
      hint: "Use WHERE price = (SELECT MAX(price) FROM books).",
      referenceQuery:
        "SELECT title FROM books WHERE price = (SELECT MAX(price) FROM books);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "junior-b3-library",
      prompt:
        "Select the `title` of every book that has been loaned at least once. Use `IN` with a subquery over the `loans` table.",
      hint: "WHERE id IN (SELECT book_id FROM loans).",
      referenceQuery:
        "SELECT title FROM books WHERE id IN (SELECT book_id FROM loans);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "junior-b3-library",
      prompt:
        "Select the `title` of every book that has NEVER been loaned. Use `NOT IN` with a subquery over `loans`.",
      hint: "WHERE id NOT IN (SELECT book_id FROM loans).",
      referenceQuery:
        "SELECT title FROM books WHERE id NOT IN (SELECT book_id FROM loans);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "junior-b3-library",
      prompt:
        "Select the `name` of every member who has at least one loan. Use a correlated `EXISTS` subquery against `loans`.",
      hint: "WHERE EXISTS (SELECT 1 FROM loans l WHERE l.member_id = m.id).",
      referenceQuery:
        "SELECT m.name FROM members AS m WHERE EXISTS (SELECT 1 FROM loans AS l WHERE l.member_id = m.id);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "junior-b3-library",
      prompt:
        "Select the `name` of every member who has NO loans. Use a correlated `NOT EXISTS` subquery against `loans`.",
      hint: "WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.member_id = m.id).",
      referenceQuery:
        "SELECT m.name FROM members AS m WHERE NOT EXISTS (SELECT 1 FROM loans AS l WHERE l.member_id = m.id);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "junior-b3-library",
      prompt:
        "Select the `title` of books in the `'Tech'` category whose `price` is below the overall average price of all books. Combine a normal filter with a scalar subquery.",
      hint: "WHERE category = 'Tech' AND price < (SELECT AVG(price) FROM books).",
      referenceQuery:
        "SELECT title FROM books WHERE category = 'Tech' AND price < (SELECT AVG(price) FROM books);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "junior-b3-library",
      prompt:
        "Select the `name` of members whose `id` appears among the member ids that have loans of the book with `id` 1. Use `IN` with a subquery filtered on `book_id = 1`.",
      hint: "WHERE id IN (SELECT member_id FROM loans WHERE book_id = 1).",
      referenceQuery:
        "SELECT name FROM members WHERE id IN (SELECT member_id FROM loans WHERE book_id = 1);",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "junior-b3-library",
      prompt:
        "Using a derived table (subquery in `FROM`), compute the total `price` per `category` (alias `total`), then select only `category` and `total` for categories whose total exceeds 50. Alias the derived table `sums`.",
      hint: "FROM (SELECT category, SUM(price) AS total FROM books GROUP BY category) AS sums WHERE total > 50.",
      referenceQuery:
        "SELECT category, total FROM (SELECT category, SUM(price) AS total FROM books GROUP BY category) AS sums WHERE total > 50;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "junior-b3-library",
      prompt:
        "Select the `title` and `price` of all books that have been loaned at least once (use `IN` with a subquery), ordered by `price` descending.",
      hint: "Combine WHERE id IN (SELECT book_id FROM loans) with ORDER BY price DESC.",
      referenceQuery:
        "SELECT title, price FROM books WHERE id IN (SELECT book_id FROM loans) ORDER BY price DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
