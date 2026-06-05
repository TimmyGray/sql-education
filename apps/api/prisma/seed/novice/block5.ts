/**
 * Block 5 — Subqueries & Sets
 * Dataset: novice-b5-library (books + authors + loans)
 */
import type { BlockDef } from "../types";

export const block5: BlockDef = {
  level: "NOVICE",
  order: 5,
  title: "Subqueries & Sets",
  theoryMarkdown: `# Subqueries & Sets

Subqueries (also called inner queries or nested queries) let you use the result of one SELECT inside another.

## IN with a Subquery

Instead of hard-coding values in an \`IN\` list, you can supply them from a subquery:

\`\`\`sql
SELECT name FROM books
WHERE author_id IN (
  SELECT id FROM authors WHERE country = 'USA'
);
\`\`\`

The inner query runs first and produces a list of IDs; the outer query then filters by that list.

## Scalar Subquery

A scalar subquery returns exactly **one row and one column**. You can use it anywhere a single value is expected:

\`\`\`sql
SELECT name, pages,
       (SELECT AVG(pages) FROM books) AS avg_pages
FROM books;
\`\`\`

## DISTINCT

\`DISTINCT\` removes duplicate rows from the result:

\`\`\`sql
SELECT DISTINCT country FROM authors;
\`\`\`

Without \`DISTINCT\`, if ten authors share the same country, you get ten rows.

## Common Table Expressions (WITH)

A CTE (Common Table Expression) names a temporary result set that you can reference in the main query. It improves readability and avoids repeating subqueries:

\`\`\`sql
WITH high_pages AS (
  SELECT id, name, pages
  FROM books
  WHERE pages > 400
)
SELECT name, pages FROM high_pages ORDER BY pages DESC;
\`\`\`

The part after \`WITH name AS (...)\` is the CTE definition; the query after it uses \`high_pages\` like a table.

## When to Use Each

| Technique | Best for |
|-----------|----------|
| IN (subquery) | Filtering by a dynamic set of values |
| Scalar subquery | Including a single aggregate value alongside each row |
| DISTINCT | Eliminating duplicate rows in the output |
| CTE | Breaking a complex query into readable named steps |
`,
  theoryExamples: [
    {
      title: "IN with subquery",
      sql: `SELECT name FROM books
WHERE author_id IN (
  SELECT id FROM authors WHERE country = 'USA'
);`,
      explanation:
        "The subquery returns the IDs of all USA authors. The outer query then selects books whose author_id appears in that list.",
    },
    {
      title: "Scalar subquery in SELECT",
      sql: `SELECT name, pages,
       (SELECT AVG(pages) FROM books) AS avg_pages
FROM books;`,
      explanation:
        "The scalar subquery runs once and returns the overall average pages. It is placed in the SELECT list so each row includes that global value alongside the book's own data.",
    },
    {
      title: "DISTINCT to remove duplicates",
      sql: "SELECT DISTINCT country FROM authors ORDER BY country;",
      explanation:
        "Without DISTINCT, you would get one row per author, with many repeated country values. DISTINCT collapses duplicates so each country appears once.",
    },
    {
      title: "Simple CTE",
      sql: `WITH recent_loans AS (
  SELECT book_id, borrower
  FROM loans
  WHERE return_date IS NULL
)
SELECT b.name, rl.borrower
FROM books AS b
INNER JOIN recent_loans AS rl ON b.id = rl.book_id;`,
      explanation:
        "The CTE 'recent_loans' is defined first and selects only unreturned loans. The main query joins it to books, treating the CTE like a normal table.",
    },
  ],
  datasets: [
    {
      name: "novice-b5-library",
      setupSql: `
CREATE TABLE authors (
  id      INT PRIMARY KEY,
  name    VARCHAR(80) NOT NULL,
  country VARCHAR(50) NOT NULL
);

CREATE TABLE books (
  id        INT PRIMARY KEY,
  title     VARCHAR(120) NOT NULL,
  author_id INT REFERENCES authors(id),
  genre     VARCHAR(50),
  pages     INT NOT NULL
);

CREATE TABLE loans (
  id          INT PRIMARY KEY,
  book_id     INT REFERENCES books(id),
  borrower    VARCHAR(80) NOT NULL,
  loan_date   DATE NOT NULL,
  return_date DATE
);

INSERT INTO authors (id, name, country) VALUES
  (1, 'George Orwell',      'UK'),
  (2, 'Mark Twain',         'USA'),
  (3, 'Haruki Murakami',    'Japan'),
  (4, 'Toni Morrison',      'USA'),
  (5, 'Gabriel García Márquez', 'Colombia');

INSERT INTO books (id, title, author_id, genre, pages) VALUES
  (1, '1984',                              1, 'Dystopia',   328),
  (2, 'Animal Farm',                       1, 'Satire',     112),
  (3, 'Adventures of Huckleberry Finn',    2, 'Adventure',  366),
  (4, 'The Adventures of Tom Sawyer',      2, 'Adventure',  274),
  (5, 'Norwegian Wood',                    3, 'Literary',   296),
  (6, 'Kafka on the Shore',                3, 'Magical Realism', 505),
  (7, 'Beloved',                           4, 'Literary',   321),
  (8, 'Song of Solomon',                   4, 'Literary',   337),
  (9, 'One Hundred Years of Solitude',     5, 'Magical Realism', 417),
  (10,'Love in the Time of Cholera',       5, 'Literary',   348);

INSERT INTO loans (id, book_id, borrower, loan_date, return_date) VALUES
  (1, 1, 'James Watson',  '2024-01-10', '2024-01-25'),
  (2, 3, 'Sara Connor',   '2024-01-15', '2024-02-05'),
  (3, 5, 'Mike Zhao',     '2024-02-01', NULL),
  (4, 7, 'Anna Bell',     '2024-02-10', '2024-02-28'),
  (5, 2, 'James Watson',  '2024-03-01', NULL),
  (6, 9, 'Sara Connor',   '2024-03-05', NULL),
  (7, 4, 'Lee Park',      '2024-03-10', '2024-03-20'),
  (8, 6, 'Anna Bell',     '2024-03-15', NULL),
  (9, 8, 'Mike Zhao',     '2024-04-01', '2024-04-15'),
  (10,10,'James Watson',  '2024-04-05', NULL);
      `.trim(),
      schemaJson: [
        {
          tableName: "authors",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(80)" },
            { name: "country", type: "VARCHAR(50)" },
          ],
        },
        {
          tableName: "books",
          columns: [
            { name: "id", type: "INT" },
            { name: "title", type: "VARCHAR(120)" },
            { name: "author_id", type: "INT" },
            { name: "genre", type: "VARCHAR(50)" },
            { name: "pages", type: "INT" },
          ],
        },
        {
          tableName: "loans",
          columns: [
            { name: "id", type: "INT" },
            { name: "book_id", type: "INT" },
            { name: "borrower", type: "VARCHAR(80)" },
            { name: "loan_date", type: "DATE" },
            { name: "return_date", type: "DATE" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "novice-b5-library",
      prompt:
        "Using a subquery, select `title` from `books` where the `author_id` is IN the set of IDs from `authors` whose `country` is 'USA'.",
      hint: "The subquery is: SELECT id FROM authors WHERE country = 'USA'. Use that inside IN (...).",
      referenceQuery: `SELECT title FROM books
WHERE author_id IN (
  SELECT id FROM authors WHERE country = 'USA'
);`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "novice-b5-library",
      prompt:
        "Using a subquery with IN, select `title` from `books` where the book has ever been loaned (i.e., its `id` appears in the `loans` table's `book_id` column).",
      hint: "Subquery: SELECT book_id FROM loans.",
      referenceQuery: `SELECT title FROM books
WHERE id IN (
  SELECT book_id FROM loans
);`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "novice-b5-library",
      prompt:
        "Select `title` from `books` where the book has NOT been returned yet (i.e., its `id` is IN the `book_id` values from `loans` where `return_date` IS NULL).",
      hint: "Subquery: SELECT book_id FROM loans WHERE return_date IS NULL.",
      referenceQuery: `SELECT title FROM books
WHERE id IN (
  SELECT book_id FROM loans WHERE return_date IS NULL
);`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "novice-b5-library",
      prompt:
        "For each book, select `title`, `pages`, and a scalar subquery that returns the average `pages` across all books (aliased as `avg_pages`).",
      hint: "Place (SELECT AVG(pages) FROM books) in your SELECT list.",
      referenceQuery: `SELECT title, pages,
       (SELECT AVG(pages) FROM books) AS avg_pages
FROM books;`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "novice-b5-library",
      prompt:
        "Select the DISTINCT `country` values from the `authors` table.",
      hint: "Use SELECT DISTINCT country FROM authors.",
      referenceQuery: "SELECT DISTINCT country FROM authors;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "novice-b5-library",
      prompt:
        "Select DISTINCT `genre` values from the `books` table, ordered alphabetically.",
      hint: "SELECT DISTINCT genre FROM books ORDER BY genre.",
      referenceQuery:
        "SELECT DISTINCT genre FROM books ORDER BY genre;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "novice-b5-library",
      prompt:
        "Using a CTE named `usa_authors`, select the `id` and `name` of authors from the USA. Then in the main query, select the `title` of books whose `author_id` is in that CTE.",
      hint: "WITH usa_authors AS (SELECT id, name FROM authors WHERE country = 'USA') SELECT title FROM books WHERE author_id IN (SELECT id FROM usa_authors);",
      referenceQuery: `WITH usa_authors AS (
  SELECT id FROM authors WHERE country = 'USA'
)
SELECT title FROM books
WHERE author_id IN (SELECT id FROM usa_authors);`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "novice-b5-library",
      prompt:
        "Using a CTE named `long_books` that selects books with more than 300 pages, return the `title` and `pages` from that CTE ordered by `pages` descending.",
      hint: "Define the CTE with WHERE pages > 300, then SELECT from it with ORDER BY pages DESC.",
      referenceQuery: `WITH long_books AS (
  SELECT title, pages FROM books WHERE pages > 300
)
SELECT title, pages FROM long_books ORDER BY pages DESC;`,
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "novice-b5-library",
      prompt:
        "Using a scalar subquery, select `title` and `pages` from `books` where `pages` is greater than the average number of pages across all books.",
      hint: "WHERE pages > (SELECT AVG(pages) FROM books).",
      referenceQuery: `SELECT title, pages FROM books
WHERE pages > (SELECT AVG(pages) FROM books);`,
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "novice-b5-library",
      prompt:
        "Using a CTE named `active_loans` (loans where `return_date` IS NULL), join it to `books` to get the `title` and `borrower` for all currently unreturned books. Order by `borrower` ascending.",
      hint: "CTE selects book_id and borrower from loans WHERE return_date IS NULL. Main query JOINs books to that CTE.",
      referenceQuery: `WITH active_loans AS (
  SELECT book_id, borrower FROM loans WHERE return_date IS NULL
)
SELECT b.title, al.borrower
FROM active_loans AS al
INNER JOIN books AS b ON al.book_id = b.id
ORDER BY al.borrower ASC;`,
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
