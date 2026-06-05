/**
 * Block 1 — SELECT basics
 * Dataset: novice-b1-employees (employees + departments)
 */
import type { BlockDef } from "../types";

export const block1: BlockDef = {
  level: "NOVICE",
  order: 1,
  title: "SELECT Basics",
  theoryMarkdown: `# SELECT Basics

The \`SELECT\` statement is the foundation of SQL. It retrieves data from one or more tables.

## Selecting All Columns

Use \`SELECT *\` to return every column in a table:

\`\`\`sql
SELECT * FROM employees;
\`\`\`

This is convenient for exploration but avoid it in production queries — it returns more data than you may need and can break if the table schema changes.

## Selecting Specific Columns

List only the columns you care about, separated by commas:

\`\`\`sql
SELECT first_name, last_name, salary FROM employees;
\`\`\`

## Column Aliases

Use \`AS\` to rename a column in the result set. This is useful for clarity or to match an expected output format:

\`\`\`sql
SELECT first_name AS "First Name", salary AS annual_salary
FROM employees;
\`\`\`

Quotes are required when the alias contains spaces.

## Simple WHERE Equality

Add a \`WHERE\` clause to filter rows. The equality operator is \`=\`:

\`\`\`sql
SELECT first_name, last_name
FROM employees
WHERE department_id = 2;
\`\`\`

SQL is case-insensitive for keywords (\`SELECT\`, \`FROM\`, \`WHERE\`), but string values compared with \`=\` are case-sensitive by default in most databases.

## Key Points

- Every SELECT query needs at minimum: \`SELECT <columns> FROM <table>\`.
- \`WHERE\` filters which rows are returned; without it, all rows are returned.
- Aliases created with \`AS\` only exist in the result — the original column name in the table is unchanged.
`,
  theoryExamples: [
    {
      title: "Select all columns",
      sql: "SELECT * FROM employees;",
      explanation:
        "Returns every column and every row from the employees table. The asterisk (*) is a shorthand for 'all columns'.",
    },
    {
      title: "Select specific columns",
      sql: "SELECT first_name, last_name, salary FROM employees;",
      explanation:
        "Returns only the three named columns. Listing explicit columns is preferred in real applications.",
    },
    {
      title: "Column alias with AS",
      sql: "SELECT first_name AS name, salary AS annual_salary FROM employees;",
      explanation:
        "Renames columns in the output using AS. The table itself is not affected — only the result set label changes.",
    },
    {
      title: "Filter with WHERE equality",
      sql: "SELECT first_name, last_name FROM employees WHERE department_id = 1;",
      explanation:
        "The WHERE clause restricts results to only rows where department_id equals 1. All other rows are excluded.",
    },
  ],
  datasets: [
    {
      name: "novice-b1-employees",
      setupSql: `
CREATE TABLE departments (
  id   INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

CREATE TABLE employees (
  id            INT PRIMARY KEY,
  first_name    VARCHAR(50) NOT NULL,
  last_name     VARCHAR(50) NOT NULL,
  department_id INT REFERENCES departments(id),
  salary        NUMERIC(10,2) NOT NULL,
  hire_date     DATE NOT NULL
);

INSERT INTO departments (id, name) VALUES
  (1, 'Engineering'),
  (2, 'Marketing'),
  (3, 'HR');

INSERT INTO employees (id, first_name, last_name, department_id, salary, hire_date) VALUES
  (1, 'Alice',   'Smith',   1, 95000.00, '2020-03-15'),
  (2, 'Bob',     'Jones',   1, 85000.00, '2019-07-01'),
  (3, 'Carol',   'White',   2, 72000.00, '2021-01-10'),
  (4, 'David',   'Brown',   2, 68000.00, '2022-05-20'),
  (5, 'Eve',     'Davis',   3, 60000.00, '2018-11-30'),
  (6, 'Frank',   'Miller',  1, 92000.00, '2020-09-14'),
  (7, 'Grace',   'Wilson',  3, 58000.00, '2023-02-01'),
  (8, 'Hank',    'Moore',   2, 74000.00, '2017-06-22');
      `.trim(),
      schemaJson: [
        {
          tableName: "departments",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
          ],
        },
        {
          tableName: "employees",
          columns: [
            { name: "id", type: "INT" },
            { name: "first_name", type: "VARCHAR(50)" },
            { name: "last_name", type: "VARCHAR(50)" },
            { name: "department_id", type: "INT" },
            { name: "salary", type: "NUMERIC(10,2)" },
            { name: "hire_date", type: "DATE" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "novice-b1-employees",
      prompt:
        "Select all columns and all rows from the `employees` table.",
      hint: "Use SELECT * to retrieve every column without naming them individually.",
      referenceQuery: "SELECT * FROM employees;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] }, // filled by validate.ts
    },
    {
      order: 2,
      datasetName: "novice-b1-employees",
      prompt:
        "Select only the `first_name` and `last_name` columns from the `employees` table.",
      hint: "List the column names separated by a comma after SELECT.",
      referenceQuery: "SELECT first_name, last_name FROM employees;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "novice-b1-employees",
      prompt:
        "Select `first_name`, `last_name`, and `salary` from the `employees` table.",
      hint: "You can select multiple columns by listing them with commas.",
      referenceQuery: "SELECT first_name, last_name, salary FROM employees;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "novice-b1-employees",
      prompt:
        "Select all columns from the `departments` table.",
      hint: "Use SELECT * FROM the departments table.",
      referenceQuery: "SELECT * FROM departments;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "novice-b1-employees",
      prompt:
        "Select `first_name` aliased as `name` and `salary` aliased as `annual_salary` from `employees`.",
      hint: "Use the AS keyword after each column name to assign an alias.",
      referenceQuery:
        "SELECT first_name AS name, salary AS annual_salary FROM employees;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "novice-b1-employees",
      prompt:
        "Select `id` aliased as `employee_id` and `hire_date` aliased as `started_on` from the `employees` table.",
      hint: "Follow each column with AS and the alias name.",
      referenceQuery:
        "SELECT id AS employee_id, hire_date AS started_on FROM employees;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "novice-b1-employees",
      prompt:
        "Select `first_name` and `last_name` from `employees` where the `department_id` equals 1.",
      hint: "Add a WHERE clause: WHERE department_id = 1",
      referenceQuery:
        "SELECT first_name, last_name FROM employees WHERE department_id = 1;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "novice-b1-employees",
      prompt:
        "Select all columns from `employees` where `salary` equals 72000.00.",
      hint: "Use WHERE salary = 72000.00 — numeric literals don't need quotes.",
      referenceQuery:
        "SELECT * FROM employees WHERE salary = 72000.00;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "novice-b1-employees",
      prompt:
        "Select the `name` column from `departments` where the `id` equals 2.",
      hint: "Use WHERE id = 2 to match the row with id 2.",
      referenceQuery:
        "SELECT name FROM departments WHERE id = 2;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "novice-b1-employees",
      prompt:
        "Select `first_name`, `last_name`, and `department_id` from `employees` where the employee id equals 5.",
      hint: "Filter with WHERE id = 5.",
      referenceQuery:
        "SELECT first_name, last_name, department_id FROM employees WHERE id = 5;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
