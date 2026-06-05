/**
 * Block 4 — Set Operations & Advanced Joins
 * Dataset: middle-b4-staff (current_staff, former_staff, projects, assignments)
 */
import type { BlockDef } from "../types";

export const block4: BlockDef = {
  level: "MIDDLE",
  order: 4,
  title: "Set Operations & Advanced Joins",
  theoryMarkdown: `# Set Operations & Advanced Joins

This block combines query results vertically with set operations and explores join patterns beyond the simple inner join.

## UNION and UNION ALL

\`UNION\` stacks the rows of two queries that have the same column count and compatible types. \`UNION\` removes duplicates; \`UNION ALL\` keeps them (and is faster):

\`\`\`sql
SELECT name FROM current_staff
UNION
SELECT name FROM former_staff;
\`\`\`

## INTERSECT and EXCEPT

- \`INTERSECT\` returns rows present in *both* queries.
- \`EXCEPT\` returns rows in the first query that are *not* in the second.

\`\`\`sql
SELECT name FROM current_staff
INTERSECT
SELECT name FROM former_staff;

SELECT name FROM current_staff
EXCEPT
SELECT name FROM former_staff;
\`\`\`

## SELF JOIN

A self join joins a table to itself using two aliases — useful for hierarchies or comparing rows in the same table:

\`\`\`sql
SELECT e.name AS employee, m.name AS manager
FROM current_staff e
JOIN current_staff m ON e.manager_id = m.id;
\`\`\`

## FULL OUTER JOIN

A \`FULL OUTER JOIN\` keeps unmatched rows from *both* sides, filling missing columns with \`NULL\`:

\`\`\`sql
SELECT s.name, a.project_id
FROM current_staff s
FULL OUTER JOIN assignments a ON s.id = a.staff_id;
\`\`\`

## Anti-Joins

An *anti-join* finds rows in one table with no match in another. Express it with \`LEFT JOIN ... WHERE right.key IS NULL\` or \`NOT EXISTS\`:

\`\`\`sql
SELECT s.name
FROM current_staff s
LEFT JOIN assignments a ON s.id = a.staff_id
WHERE a.staff_id IS NULL;
\`\`\`

## Key Points

- Set operations require matching column counts and compatible types.
- \`UNION\` dedupes, \`UNION ALL\` keeps duplicates; \`INTERSECT\` = in both, \`EXCEPT\` = in first only.
- A self join uses two aliases of the same table.
- \`FULL OUTER JOIN\` preserves unmatched rows from both tables.
- Anti-joins (\`LEFT JOIN ... IS NULL\` or \`NOT EXISTS\`) find rows with no counterpart.
`,
  theoryExamples: [
    {
      title: "UNION of two tables",
      sql: "SELECT name FROM current_staff UNION SELECT name FROM former_staff;",
      explanation:
        "Combines names from both tables into one distinct list; UNION removes any duplicate names that appear in both.",
    },
    {
      title: "INTERSECT (in both)",
      sql: "SELECT name FROM current_staff INTERSECT SELECT name FROM former_staff;",
      explanation:
        "Returns only names that appear in both the current and former staff lists — people who left and were rehired, for example.",
    },
    {
      title: "Self join for manager names",
      sql: "SELECT e.name AS employee, m.name AS manager FROM current_staff e JOIN current_staff m ON e.manager_id = m.id;",
      explanation:
        "Joins the staff table to itself: alias e is the employee, alias m is their manager, matched on manager_id.",
    },
    {
      title: "Anti-join for unassigned staff",
      sql: "SELECT s.name FROM current_staff s LEFT JOIN assignments a ON s.id = a.staff_id WHERE a.staff_id IS NULL;",
      explanation:
        "A LEFT JOIN keeps all staff; filtering where the assignment side is NULL leaves only staff with no project assignment.",
    },
  ],
  datasets: [
    {
      name: "middle-b4-staff",
      setupSql: `
CREATE TABLE current_staff (
  id         INT PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  manager_id INT REFERENCES current_staff(id)
);

CREATE TABLE former_staff (
  id   INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

CREATE TABLE projects (
  id   INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

CREATE TABLE assignments (
  staff_id   INT,
  project_id INT REFERENCES projects(id),
  PRIMARY KEY (staff_id, project_id)
);

INSERT INTO current_staff (id, name, manager_id) VALUES
  (1, 'Alice',  NULL),
  (2, 'Bob',    1),
  (3, 'Carol',  1),
  (4, 'David',  2),
  (5, 'Eve',    2);

INSERT INTO former_staff (id, name) VALUES
  (101, 'Carol'),
  (102, 'Frank'),
  (103, 'Grace'),
  (104, 'Bob');

INSERT INTO projects (id, name) VALUES
  (1, 'Apollo'),
  (2, 'Borealis'),
  (3, 'Cosmos'),
  (4, 'Dragonfly');

INSERT INTO assignments (staff_id, project_id) VALUES
  (1, 1),
  (2, 1),
  (2, 2),
  (3, 2),
  (4, 3);
      `.trim(),
      schemaJson: [
        {
          tableName: "current_staff",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
            { name: "manager_id", type: "INT" },
          ],
        },
        {
          tableName: "former_staff",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
          ],
        },
        {
          tableName: "projects",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
          ],
        },
        {
          tableName: "assignments",
          columns: [
            { name: "staff_id", type: "INT" },
            { name: "project_id", type: "INT" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "middle-b4-staff",
      prompt:
        "Return a single column `name` containing the distinct set of all names that appear in either `current_staff` or `former_staff`. Order by `name` ascending.",
      hint: "Combine the two name lists with UNION (which removes duplicates), then ORDER BY name.",
      referenceQuery:
        "SELECT name FROM current_staff UNION SELECT name FROM former_staff ORDER BY name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "middle-b4-staff",
      prompt:
        "Return a single column `name` containing the names from both `current_staff` and `former_staff` WITHOUT removing duplicates. Order by `name` ascending.",
      hint: "Use UNION ALL to keep duplicates, then ORDER BY name.",
      referenceQuery:
        "SELECT name FROM current_staff UNION ALL SELECT name FROM former_staff ORDER BY name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "middle-b4-staff",
      prompt:
        "Return the `name` values that appear in BOTH `current_staff` and `former_staff`. Order by `name` ascending.",
      hint: "Use INTERSECT between the two name queries.",
      referenceQuery:
        "SELECT name FROM current_staff INTERSECT SELECT name FROM former_staff ORDER BY name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "middle-b4-staff",
      prompt:
        "Return the `name` values that are in `current_staff` but NOT in `former_staff`. Order by `name` ascending.",
      hint: "Use EXCEPT: current names minus former names.",
      referenceQuery:
        "SELECT name FROM current_staff EXCEPT SELECT name FROM former_staff ORDER BY name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "middle-b4-staff",
      prompt:
        "Using a self join on `current_staff`, return each employee's `name` as `employee` alongside their manager's `name` as `manager`. Exclude staff who have no manager. Order by `employee` ascending.",
      hint: "Join current_staff e to current_staff m on e.manager_id = m.id.",
      referenceQuery:
        "SELECT e.name AS employee, m.name AS manager FROM current_staff e JOIN current_staff m ON e.manager_id = m.id ORDER BY e.name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "middle-b4-staff",
      prompt:
        "Using a LEFT self join, return every employee's `name` as `employee` and their manager's `name` as `manager`, showing NULL for staff with no manager. Order by `employee` ascending.",
      hint: "LEFT JOIN current_staff m ON e.manager_id = m.id so unmatched rows keep NULL for manager.",
      referenceQuery:
        "SELECT e.name AS employee, m.name AS manager FROM current_staff e LEFT JOIN current_staff m ON e.manager_id = m.id ORDER BY e.name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "middle-b4-staff",
      prompt:
        "Return the `name` of every current staff member who is NOT assigned to any project, using an anti-join. Order by `name` ascending.",
      hint: "LEFT JOIN current_staff to assignments on staff_id and keep rows WHERE assignments.staff_id IS NULL.",
      referenceQuery:
        "SELECT s.name FROM current_staff s LEFT JOIN assignments a ON s.id = a.staff_id WHERE a.staff_id IS NULL ORDER BY s.name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "middle-b4-staff",
      prompt:
        "Return the project `name` of every project that has NO staff assigned, using a `NOT EXISTS` anti-join. Order by `name` ascending.",
      hint: "WHERE NOT EXISTS (SELECT 1 FROM assignments a WHERE a.project_id = p.id).",
      referenceQuery:
        "SELECT p.name FROM projects p WHERE NOT EXISTS (SELECT 1 FROM assignments a WHERE a.project_id = p.id) ORDER BY p.name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "middle-b4-staff",
      prompt:
        "Join `current_staff` to `assignments` and `projects` to return each staff member's `name` as `staff` and the project `name` as `project` for every assignment. Order by `staff`, then `project`.",
      hint: "INNER JOIN current_staff to assignments on staff_id, then to projects on project_id.",
      referenceQuery:
        "SELECT s.name AS staff, p.name AS project FROM current_staff s JOIN assignments a ON a.staff_id = s.id JOIN projects p ON p.id = a.project_id ORDER BY s.name, p.name;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "middle-b4-staff",
      prompt:
        "Using a FULL OUTER JOIN between `current_staff` and `assignments`, return each staff member's `name` and the `project_id` they are assigned to, including staff with no assignment (project_id NULL). Order by `name` ascending, then `project_id` ascending (NULLs last).",
      hint: "FULL OUTER JOIN current_staff to assignments on id = staff_id; use ORDER BY name, project_id NULLS LAST.",
      referenceQuery:
        "SELECT s.name, a.project_id FROM current_staff s FULL OUTER JOIN assignments a ON s.id = a.staff_id ORDER BY s.name, a.project_id NULLS LAST;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
