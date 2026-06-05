/**
 * Block 2 — Common Table Expressions (CTEs)
 * Dataset: middle-b2-employees (employees self-referencing hierarchy)
 */
import type { BlockDef } from "../types";

export const block2: BlockDef = {
  level: "MIDDLE",
  order: 2,
  title: "Common Table Expressions",
  theoryMarkdown: `# Common Table Expressions (CTEs)

A Common Table Expression is a named temporary result set defined with the \`WITH\` keyword that exists only for the duration of a single query. CTEs make complex queries readable by breaking them into named, logical steps.

## Basic CTE

\`\`\`sql
WITH high_earners AS (
  SELECT id, name, salary
  FROM employees
  WHERE salary > 80000
)
SELECT name, salary
FROM high_earners
ORDER BY salary DESC;
\`\`\`

The CTE \`high_earners\` is defined first, then queried like a table in the main \`SELECT\`.

## Multiple CTEs

Separate multiple CTEs with commas. Later CTEs can reference earlier ones:

\`\`\`sql
WITH dept_avg AS (
  SELECT department_id, AVG(salary) AS avg_salary
  FROM employees
  GROUP BY department_id
),
above_avg AS (
  SELECT e.name, e.salary, d.avg_salary
  FROM employees e
  JOIN dept_avg d ON e.department_id = d.department_id
  WHERE e.salary > d.avg_salary
)
SELECT * FROM above_avg;
\`\`\`

## Recursive CTEs

A recursive CTE references itself. It has an *anchor* member, then \`UNION ALL\`, then a *recursive* member that builds on the previous result. Use \`WITH RECURSIVE\`:

\`\`\`sql
WITH RECURSIVE numbers AS (
  SELECT 1 AS n            -- anchor
  UNION ALL
  SELECT n + 1            -- recursive step
  FROM numbers
  WHERE n < 5
)
SELECT n FROM numbers;
\`\`\`

This generates the series 1..5. Recursive CTEs also walk hierarchies (employee → manager → manager's manager).

\`\`\`sql
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 1 AS depth
  FROM employees
  WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.depth + 1
  FROM employees e
  JOIN chain c ON e.manager_id = c.id
)
SELECT * FROM chain;
\`\`\`

## Key Points

- A CTE is defined with \`WITH name AS (...)\` and used like a table in the query that follows.
- Multiple CTEs are comma-separated; later ones can build on earlier ones.
- CTEs only exist for that one statement — they are not stored.
- Recursive CTEs use \`WITH RECURSIVE\`: an anchor query, \`UNION ALL\`, and a self-referencing recursive query with a stopping condition.
`,
  theoryExamples: [
    {
      title: "Simple CTE",
      sql: "WITH high_earners AS (SELECT id, name, salary FROM employees WHERE salary > 80000) SELECT name, salary FROM high_earners ORDER BY salary DESC;",
      explanation:
        "Defines a named subset of employees, then selects from it. The CTE makes the intent (high earners) explicit and reusable in the main query.",
    },
    {
      title: "Multiple chained CTEs",
      sql: "WITH dept_avg AS (SELECT department_id, AVG(salary) AS avg_salary FROM employees GROUP BY department_id) SELECT e.name FROM employees e JOIN dept_avg d ON e.department_id = d.department_id WHERE e.salary > d.avg_salary;",
      explanation:
        "Computes each department's average salary in a CTE, then joins it back to find employees paid above their department average.",
    },
    {
      title: "Recursive number series",
      sql: "WITH RECURSIVE numbers AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM numbers WHERE n < 5) SELECT n FROM numbers;",
      explanation:
        "The anchor seeds n = 1; the recursive member adds 1 each step until n reaches 5, generating the series 1 through 5.",
    },
    {
      title: "Recursive hierarchy walk",
      sql: "WITH RECURSIVE chain AS (SELECT id, name, manager_id, 1 AS depth FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.id, e.name, e.manager_id, c.depth + 1 FROM employees e JOIN chain c ON e.manager_id = c.id) SELECT name, depth FROM chain;",
      explanation:
        "Starts at the top manager (no manager_id) and walks down the org chart, tracking each employee's depth in the hierarchy.",
    },
  ],
  datasets: [
    {
      name: "middle-b2-employees",
      setupSql: `
CREATE TABLE departments (
  id   INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL
);

CREATE TABLE employees (
  id            INT PRIMARY KEY,
  name          VARCHAR(50) NOT NULL,
  department_id INT REFERENCES departments(id),
  manager_id    INT REFERENCES employees(id),
  salary        NUMERIC(10,2) NOT NULL
);

INSERT INTO departments (id, name) VALUES
  (1, 'Engineering'),
  (2, 'Sales'),
  (3, 'Support');

INSERT INTO employees (id, name, department_id, manager_id, salary) VALUES
  (1, 'Alice',   1, NULL, 150000.00),
  (2, 'Bob',     1, 1,    110000.00),
  (3, 'Carol',   1, 2,    90000.00),
  (4, 'David',   1, 2,    85000.00),
  (5, 'Eve',     2, 1,    120000.00),
  (6, 'Frank',   2, 5,    75000.00),
  (7, 'Grace',   2, 5,    78000.00),
  (8, 'Heidi',   3, 1,    95000.00),
  (9, 'Ivan',    3, 8,    62000.00),
  (10,'Judy',    3, 8,    64000.00);
      `.trim(),
      schemaJson: [
        {
          tableName: "departments",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(40)" },
          ],
        },
        {
          tableName: "employees",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
            { name: "department_id", type: "INT" },
            { name: "manager_id", type: "INT" },
            { name: "salary", type: "NUMERIC(10,2)" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "middle-b2-employees",
      prompt:
        "Using a CTE named `high_earners` that selects employees with `salary` greater than 90000, return their `name` and `salary`. Order by `salary` descending.",
      hint: "Define WITH high_earners AS (...), then SELECT from it and ORDER BY salary DESC.",
      referenceQuery:
        "WITH high_earners AS (SELECT id, name, salary FROM employees WHERE salary > 90000) SELECT name, salary FROM high_earners ORDER BY salary DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "middle-b2-employees",
      prompt:
        "Using a CTE that computes each department's average salary, return `department_id` and `avg_salary` for departments whose average `salary` exceeds 90000. Order by `avg_salary` descending.",
      hint: "Build a CTE with GROUP BY department_id, then filter on the CTE's avg_salary.",
      referenceQuery:
        "WITH dept_avg AS (SELECT department_id, AVG(salary) AS avg_salary FROM employees GROUP BY department_id) SELECT department_id, avg_salary FROM dept_avg WHERE avg_salary > 90000 ORDER BY avg_salary DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "middle-b2-employees",
      prompt:
        "Using a CTE of each department's average salary, return the `name` and `salary` of every employee paid strictly more than their own department's average. Order by `salary` descending.",
      hint: "Join the employees table back to a dept_avg CTE on department_id and filter salary > avg_salary.",
      referenceQuery:
        "WITH dept_avg AS (SELECT department_id, AVG(salary) AS avg_salary FROM employees GROUP BY department_id) SELECT e.name, e.salary FROM employees e JOIN dept_avg d ON e.department_id = d.department_id WHERE e.salary > d.avg_salary ORDER BY e.salary DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "middle-b2-employees",
      prompt:
        "Use two CTEs: one for the company-wide average salary, and one selecting employees above it. Return `name` and `salary` ordered by `salary` descending.",
      hint: "First CTE computes AVG(salary) as one row; cross join or compare against it in the second CTE.",
      referenceQuery:
        "WITH company_avg AS (SELECT AVG(salary) AS avg_salary FROM employees), above AS (SELECT e.name, e.salary FROM employees e, company_avg c WHERE e.salary > c.avg_salary) SELECT name, salary FROM above ORDER BY salary DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "middle-b2-employees",
      prompt:
        "Using a recursive CTE, generate the integer series 1 through 8 in a single column named `n`. Order by `n` ascending.",
      hint: "Anchor: SELECT 1 AS n. Recursive: SELECT n + 1 FROM the CTE WHERE n < 8.",
      referenceQuery:
        "WITH RECURSIVE numbers AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM numbers WHERE n < 8) SELECT n FROM numbers ORDER BY n;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "middle-b2-employees",
      prompt:
        "Using a recursive CTE, walk the employee hierarchy from the top manager (the one with no `manager_id`) downward. Return each employee's `name` and a `depth` column (top = 1). Order by `depth`, then `name`.",
      hint: "Anchor selects WHERE manager_id IS NULL with depth 1; the recursive member joins employees to the CTE on e.manager_id = c.id and adds 1 to depth.",
      referenceQuery:
        "WITH RECURSIVE chain AS (SELECT id, name, manager_id, 1 AS depth FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.id, e.name, e.manager_id, c.depth + 1 FROM employees e JOIN chain c ON e.manager_id = c.id) SELECT name, depth FROM chain ORDER BY depth, name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "middle-b2-employees",
      prompt:
        "Using a recursive CTE, return all employees who report (directly or indirectly) to the employee named `Alice`, including Alice herself. Return `name` and `depth` (Alice = 1). Order by `depth`, then `name`.",
      hint: "Anchor selects the row WHERE name = 'Alice'; recurse down via e.manager_id = c.id.",
      referenceQuery:
        "WITH RECURSIVE subtree AS (SELECT id, name, 1 AS depth FROM employees WHERE name = 'Alice' UNION ALL SELECT e.id, e.name, s.depth + 1 FROM employees e JOIN subtree s ON e.manager_id = s.id) SELECT name, depth FROM subtree ORDER BY depth, name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "middle-b2-employees",
      prompt:
        "Using a CTE that counts direct reports per manager, return the manager's `name` and a `report_count` column for managers who have at least 2 direct reports. Order by `report_count` descending, then `name` ascending.",
      hint: "Group employees by manager_id to count reports in a CTE, then join back to employees to get the manager's name.",
      referenceQuery:
        "WITH counts AS (SELECT manager_id, COUNT(*) AS report_count FROM employees WHERE manager_id IS NOT NULL GROUP BY manager_id) SELECT m.name, c.report_count FROM counts c JOIN employees m ON m.id = c.manager_id WHERE c.report_count >= 2 ORDER BY c.report_count DESC, m.name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "middle-b2-employees",
      prompt:
        "Using a CTE, rank employees by `salary` within each `department_id` (highest = 1) and return `department_id`, `name`, `salary`, and the rank as `dept_rank`. Order by `department_id`, then `dept_rank`.",
      hint: "Compute RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) inside a CTE, then select from it.",
      referenceQuery:
        "WITH ranked AS (SELECT department_id, name, salary, RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS dept_rank FROM employees) SELECT department_id, name, salary, dept_rank FROM ranked ORDER BY department_id, dept_rank;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "middle-b2-employees",
      prompt:
        "Using two CTEs, join each department's headcount and total payroll, and return the department `name`, `headcount`, and `total_payroll`. Order by `total_payroll` descending.",
      hint: "One CTE aggregates COUNT(*) and SUM(salary) per department_id; join it to the departments table by id.",
      referenceQuery:
        "WITH agg AS (SELECT department_id, COUNT(*) AS headcount, SUM(salary) AS total_payroll FROM employees GROUP BY department_id) SELECT d.name, a.headcount, a.total_payroll FROM agg a JOIN departments d ON d.id = a.department_id ORDER BY a.total_payroll DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
