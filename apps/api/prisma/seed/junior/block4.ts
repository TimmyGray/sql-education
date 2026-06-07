/**
 * Block 4 — String & Date Functions + CASE
 * Dataset: junior-b4-users (users with names and signup dates)
 */
import type { BlockDef } from "../types";

export const block4: BlockDef = {
  level: "JUNIOR",
  order: 4,
  title: "String & Date Functions + CASE",
  theoryMarkdown: `# String & Date Functions + CASE

SQL can transform values, not just filter them. This block covers common string functions, date handling, and conditional logic with \`CASE\`.

## String Functions

| Function | Result |
|----------|--------|
| \`LOWER(s)\` / \`UPPER(s)\` | change letter case |
| \`LENGTH(s)\` | number of characters |
| \`s1 || s2\` | join strings |
| \`SUBSTR(s, a, b)\` | b characters starting at position a |

\`\`\`sql
SELECT UPPER(first_name) AS shout,
       LENGTH(last_name) AS len,
       first_name || ' ' || last_name AS full_name
FROM users;
\`\`\`

\`||\` is the concatenation operator. String positions are **1-based**.

## Date Functions

Dates are stored as text in \`YYYY-MM-DD\` form. \`strftime\` formats a date; pass a
format code to pull out a field. Use \`%Y\` for the year, \`%m\` for the month, and
\`%d\` for the day. Wrap it in \`CAST(... AS INTEGER)\` when you want a number:

\`\`\`sql
SELECT CAST(strftime('%Y', signup_date) AS INTEGER) AS signup_year FROM users;
\`\`\`

You can shift a date with \`date()\`, and measure the gap between two dates with
\`julianday()\` (the number of days, which you can cast to an integer):

\`\`\`sql
SELECT date(signup_date, '+30 days') AS trial_end FROM users;
SELECT CAST(julianday('2022-12-31') - julianday(signup_date) AS INTEGER) AS days_since FROM users;
\`\`\`

Always compare against fixed date literals like \`'2022-06-01'\` so results are reproducible.

## CASE Expressions

\`CASE\` is SQL's if/else. It returns a value based on conditions:

\`\`\`sql
SELECT first_name,
       CASE
         WHEN age >= 18 THEN 'adult'
         ELSE 'minor'
       END AS age_group
FROM users;
\`\`\`

Each \`WHEN\` is tested in order; the first match wins. \`ELSE\` is optional (without it, unmatched rows get \`NULL\`).

## Key Points

- String positions are 1-based; \`||\` concatenates and \`SUBSTR(s, a, b)\` slices.
- \`strftime('%Y', date)\` reads part of a date; \`julianday()\` differences give days.
- Use fixed date literals (\`'2022-06-01'\`) for deterministic results.
- \`CASE WHEN ... THEN ... ELSE ... END\` evaluates conditions top to bottom.
`,
  theoryExamples: [
    {
      title: "Uppercase and length",
      sql: "SELECT UPPER(first_name) AS shout, LENGTH(first_name) AS len FROM users;",
      explanation:
        "UPPER converts the name to capitals; LENGTH returns how many characters it has.",
    },
    {
      title: "Concatenate a full name",
      sql: "SELECT first_name || ' ' || last_name AS full_name FROM users;",
      explanation:
        "The || operator glues strings together. A literal space ' ' separates the two name parts.",
    },
    {
      title: "Extract the signup year",
      sql: "SELECT first_name, CAST(strftime('%Y', signup_date) AS INTEGER) AS yr FROM users;",
      explanation:
        "strftime('%Y', ...) returns the year as text; CAST turns it into a number.",
    },
    {
      title: "CASE bucketing",
      sql: "SELECT first_name, CASE WHEN age >= 30 THEN 'senior' ELSE 'junior' END AS tier FROM users;",
      explanation:
        "Returns 'senior' for users aged 30 or more, otherwise 'junior'. The first matching WHEN determines the value.",
    },
  ],
  datasets: [
    {
      name: "junior-b4-users",
      setupSql: `
CREATE TABLE users (
  id          INT PRIMARY KEY,
  first_name  VARCHAR(40) NOT NULL,
  last_name   VARCHAR(40) NOT NULL,
  age         INT NOT NULL,
  signup_date DATE NOT NULL
);

INSERT INTO users (id, first_name, last_name, age, signup_date) VALUES
  (1, 'Alice',   'Morgan',  34, '2021-03-15'),
  (2, 'Bob',     'Nguyen',  17, '2022-07-01'),
  (3, 'Carlos',  'Reyes',   29, '2020-11-20'),
  (4, 'Dina',    'Olsen',   42, '2022-01-05'),
  (5, 'Ethan',   'Park',    23, '2021-09-30'),
  (6, 'Fiona',   'Quinn',   16, '2022-05-12'),
  (7, 'George',  'Russo',   55, '2019-12-25');
      `.trim(),
      schemaJson: [
        {
          tableName: "users",
          columns: [
            { name: "id", type: "INT" },
            { name: "first_name", type: "VARCHAR(40)" },
            { name: "last_name", type: "VARCHAR(40)" },
            { name: "age", type: "INT" },
            { name: "signup_date", type: "DATE" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "junior-b4-users",
      prompt:
        "Select each user's `first_name` in uppercase (alias `shout`) and lowercase (alias `whisper`).",
      hint: "Use UPPER(first_name) and LOWER(first_name).",
      referenceQuery:
        "SELECT UPPER(first_name) AS shout, LOWER(first_name) AS whisper FROM users;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "junior-b4-users",
      prompt:
        "Select each user's `first_name` and the number of characters in their `last_name` (alias `name_len`).",
      hint: "Use LENGTH(last_name).",
      referenceQuery:
        "SELECT first_name, LENGTH(last_name) AS name_len FROM users;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "junior-b4-users",
      prompt:
        "Build each user's full name as `first_name`, a space, then `last_name`, aliased `full_name`.",
      hint: "Concatenate with || and a ' ' literal in the middle.",
      referenceQuery:
        "SELECT first_name || ' ' || last_name AS full_name FROM users;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "junior-b4-users",
      prompt:
        "Select each user's `first_name` and the first 3 characters of their `last_name` (alias `prefix`). Use SUBSTR starting at position 1 for 3 characters.",
      hint: "SUBSTR(last_name, 1, 3) returns the first three characters.",
      referenceQuery:
        "SELECT first_name, SUBSTR(last_name, 1, 3) AS prefix FROM users;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "junior-b4-users",
      prompt:
        "Select each user's `first_name` and the year they signed up (alias `signup_year`), taken from `signup_date` as an integer.",
      hint: "Use CAST(strftime('%Y', signup_date) AS INTEGER).",
      referenceQuery:
        "SELECT first_name, CAST(strftime('%Y', signup_date) AS INTEGER) AS signup_year FROM users;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "junior-b4-users",
      prompt:
        "Select each user's `first_name` and the whole number of days between their `signup_date` and the fixed date `'2022-12-31'` (alias `days_since`).",
      hint: "Use CAST(julianday('2022-12-31') - julianday(signup_date) AS INTEGER).",
      referenceQuery:
        "SELECT first_name, CAST(julianday('2022-12-31') - julianday(signup_date) AS INTEGER) AS days_since FROM users;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "junior-b4-users",
      prompt:
        "Select each user's `first_name` and a label `tier` that is `'adult'` when `age` is 18 or more, otherwise `'minor'`. Use a CASE expression.",
      hint: "CASE WHEN age >= 18 THEN 'adult' ELSE 'minor' END.",
      referenceQuery:
        "SELECT first_name, CASE WHEN age >= 18 THEN 'adult' ELSE 'minor' END AS tier FROM users;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "junior-b4-users",
      prompt:
        "Select each user's `first_name` and an `age_band` using CASE: `'teen'` when `age` is below 20, `'twenties'` when `age` is below 30, otherwise `'30plus'`.",
      hint: "List the WHEN branches from most specific to least: < 20, then < 30, then ELSE.",
      referenceQuery:
        "SELECT first_name, CASE WHEN age < 20 THEN 'teen' WHEN age < 30 THEN 'twenties' ELSE '30plus' END AS age_band FROM users;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "junior-b4-users",
      prompt:
        "Select the `first_name` and `signup_date` of users who signed up in the year 2022. Filter on the year taken from `signup_date`.",
      hint: "WHERE CAST(strftime('%Y', signup_date) AS INTEGER) = 2022.",
      referenceQuery:
        "SELECT first_name, signup_date FROM users WHERE CAST(strftime('%Y', signup_date) AS INTEGER) = 2022;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "junior-b4-users",
      prompt:
        "Select each user's full name (`first_name` || ' ' || `last_name`, alias `full_name`) and their `age`, ordered by `age` descending.",
      hint: "Concatenate the name with ||, then ORDER BY age DESC.",
      referenceQuery:
        "SELECT first_name || ' ' || last_name AS full_name, age FROM users ORDER BY age DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
