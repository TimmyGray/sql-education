/**
 * Block 5 — Sorting, LIMIT, DISTINCT & Combining Concepts
 * Dataset: junior-b5-tracks (artists + tracks for a music catalogue)
 */
import type { BlockDef } from "../types";

export const block5: BlockDef = {
  level: "JUNIOR",
  order: 5,
  title: "Sorting, LIMIT, DISTINCT & Combining Concepts",
  theoryMarkdown: `# Sorting, LIMIT, DISTINCT & Combining Concepts

This block ties together result shaping — ordering, paging, de-duplicating — and mixes in the JOIN and GROUP BY skills from earlier blocks.

## ORDER BY Multiple Keys

List several sort keys; ties on the first are broken by the next:

\`\`\`sql
SELECT title, plays, duration
FROM tracks
ORDER BY plays DESC, title ASC;
\`\`\`

Each key can independently be \`ASC\` (default) or \`DESC\`.

## LIMIT and OFFSET

\`LIMIT\` caps the number of rows; \`OFFSET\` skips rows first. Together they implement paging:

\`\`\`sql
SELECT title FROM tracks ORDER BY plays DESC LIMIT 3;          -- top 3
SELECT title FROM tracks ORDER BY plays DESC LIMIT 3 OFFSET 3; -- next 3
\`\`\`

Always pair \`LIMIT\`/\`OFFSET\` with \`ORDER BY\` so the selected rows are deterministic.

## DISTINCT

\`DISTINCT\` removes duplicate rows from the result:

\`\`\`sql
SELECT DISTINCT genre FROM tracks;
\`\`\`

\`DISTINCT\` applies to the whole row, so \`SELECT DISTINCT genre, artist_id\` de-duplicates on the **combination** of both columns.

## Combining Everything

You can join, group, filter groups, and sort in one query. The clauses always run in this logical order: \`FROM\`/\`JOIN\` → \`WHERE\` → \`GROUP BY\` → \`HAVING\` → \`SELECT\` → \`ORDER BY\` → \`LIMIT\`.

\`\`\`sql
SELECT a.name, COUNT(*) AS track_count
FROM tracks AS t
JOIN artists AS a ON t.artist_id = a.id
GROUP BY a.name
HAVING COUNT(*) >= 2
ORDER BY track_count DESC;
\`\`\`

## Key Points

- \`ORDER BY\` accepts multiple keys, each with its own \`ASC\`/\`DESC\`.
- \`LIMIT\` caps rows; \`OFFSET\` skips them — always with \`ORDER BY\` for determinism.
- \`DISTINCT\` de-duplicates across all selected columns together.
- A single query can combine JOIN, GROUP BY, HAVING, and ORDER BY.
`,
  theoryExamples: [
    {
      title: "Sort by two keys",
      sql: "SELECT title, plays FROM tracks ORDER BY plays DESC, title ASC;",
      explanation:
        "Tracks are ordered by plays descending; tracks with equal plays are then ordered by title alphabetically.",
    },
    {
      title: "Paging with LIMIT and OFFSET",
      sql: "SELECT title FROM tracks ORDER BY plays DESC LIMIT 3 OFFSET 3;",
      explanation:
        "Skips the top 3 most-played tracks and returns the next 3 — the second 'page' of results.",
    },
    {
      title: "Distinct values",
      sql: "SELECT DISTINCT genre FROM tracks;",
      explanation:
        "Returns each genre once, removing duplicate rows that share the same genre.",
    },
    {
      title: "Join + group + sort",
      sql: "SELECT a.name, COUNT(*) AS track_count FROM tracks AS t JOIN artists AS a ON t.artist_id = a.id GROUP BY a.name ORDER BY track_count DESC;",
      explanation:
        "Joins tracks to artists, counts tracks per artist, and orders artists from most to fewest tracks.",
    },
  ],
  datasets: [
    {
      name: "junior-b5-tracks",
      setupSql: `
CREATE TABLE artists (
  id      INT PRIMARY KEY,
  name    VARCHAR(50) NOT NULL,
  country VARCHAR(40) NOT NULL
);

CREATE TABLE tracks (
  id        INT PRIMARY KEY,
  title     VARCHAR(80) NOT NULL,
  artist_id INT REFERENCES artists(id),
  genre     VARCHAR(30) NOT NULL,
  plays     INT NOT NULL,
  duration  INT NOT NULL
);

INSERT INTO artists (id, name, country) VALUES
  (1, 'The Echoes',   'USA'),
  (2, 'Nova Sound',   'UK'),
  (3, 'Marisol',      'Spain'),
  (4, 'Kestrel',      'UK');

INSERT INTO tracks (id, title, artist_id, genre, plays, duration) VALUES
  (1,  'Skyline',      1, 'Rock',  1200, 210),
  (2,  'Undertow',     1, 'Rock',   800, 195),
  (3,  'Glass Walls',  2, 'Pop',   1500, 180),
  (4,  'Neon',         2, 'Pop',    950, 200),
  (5,  'Cielo',        3, 'Latin',  600, 230),
  (6,  'Aurora',       3, 'Latin',  600, 215),
  (7,  'Drift',        4, 'Pop',   1100, 205),
  (8,  'Hollow',       4, 'Rock',   400, 190),
  (9,  'Embers',       1, 'Rock',   950, 220),
  (10, 'Tides',        2, 'Pop',    300, 175);
      `.trim(),
      schemaJson: [
        {
          tableName: "artists",
          columns: [
            { name: "id", type: "INT" },
            { name: "name", type: "VARCHAR(50)" },
            { name: "country", type: "VARCHAR(40)" },
          ],
        },
        {
          tableName: "tracks",
          columns: [
            { name: "id", type: "INT" },
            { name: "title", type: "VARCHAR(80)" },
            { name: "artist_id", type: "INT" },
            { name: "genre", type: "VARCHAR(30)" },
            { name: "plays", type: "INT" },
            { name: "duration", type: "INT" },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      order: 1,
      datasetName: "junior-b5-tracks",
      prompt:
        "Select `title` and `plays` from `tracks`, ordered by `plays` descending.",
      hint: "Use ORDER BY plays DESC.",
      referenceQuery:
        "SELECT title, plays FROM tracks ORDER BY plays DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 2,
      datasetName: "junior-b5-tracks",
      prompt:
        "Select `title`, `genre`, and `plays` from `tracks`, ordered by `genre` ascending and then `plays` descending within each genre.",
      hint: "Two sort keys: ORDER BY genre ASC, plays DESC.",
      referenceQuery:
        "SELECT title, genre, plays FROM tracks ORDER BY genre ASC, plays DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 3,
      datasetName: "junior-b5-tracks",
      prompt:
        "Select the `title` and `plays` of the 3 most-played tracks. Order by `plays` descending and limit to 3 rows.",
      hint: "Combine ORDER BY plays DESC with LIMIT 3.",
      referenceQuery:
        "SELECT title, plays FROM tracks ORDER BY plays DESC LIMIT 3;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 4,
      datasetName: "junior-b5-tracks",
      prompt:
        "Return the 4th through 6th most-played tracks: select `title` and `plays`, ordered by `plays` descending, skipping the first 3 rows and returning the next 3.",
      hint: "Use LIMIT 3 OFFSET 3 after ORDER BY plays DESC.",
      referenceQuery:
        "SELECT title, plays FROM tracks ORDER BY plays DESC LIMIT 3 OFFSET 3;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 5,
      datasetName: "junior-b5-tracks",
      prompt:
        "Select the distinct list of `genre` values present in `tracks`.",
      hint: "Use SELECT DISTINCT genre.",
      referenceQuery:
        "SELECT DISTINCT genre FROM tracks;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 6,
      datasetName: "junior-b5-tracks",
      prompt:
        "Select the distinct combinations of `genre` and `artist_id` from `tracks`.",
      hint: "SELECT DISTINCT genre, artist_id — DISTINCT applies to the whole row.",
      referenceQuery:
        "SELECT DISTINCT genre, artist_id FROM tracks;",
      comparisonMode: "UNORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 7,
      datasetName: "junior-b5-tracks",
      prompt:
        "Join `tracks` to `artists` and select the track `title` and the artist `name` (alias `artist`). Order by track `title` ascending.",
      hint: "JOIN on t.artist_id = a.id, then ORDER BY t.title ASC.",
      referenceQuery:
        "SELECT t.title, a.name AS artist FROM tracks AS t JOIN artists AS a ON t.artist_id = a.id ORDER BY t.title ASC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 8,
      datasetName: "junior-b5-tracks",
      prompt:
        "For each artist, count their tracks. Join `tracks` to `artists`, group by the artist `name`, and select `name` with the count aliased `track_count`. Order by `track_count` descending, then `name` ascending.",
      hint: "GROUP BY a.name with COUNT(*), then ORDER BY track_count DESC, name ASC.",
      referenceQuery:
        "SELECT a.name, COUNT(*) AS track_count FROM tracks AS t JOIN artists AS a ON t.artist_id = a.id GROUP BY a.name ORDER BY track_count DESC, a.name ASC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 9,
      datasetName: "junior-b5-tracks",
      prompt:
        "For each artist, compute the total `plays` across their tracks. Join `tracks` to `artists`, group by artist `name`, and keep only artists whose total plays exceed 1500. Select `name` and the total aliased `total_plays`, ordered by `total_plays` descending.",
      hint: "Use SUM(t.plays), HAVING SUM(t.plays) > 1500, and ORDER BY total_plays DESC.",
      referenceQuery:
        "SELECT a.name, SUM(t.plays) AS total_plays FROM tracks AS t JOIN artists AS a ON t.artist_id = a.id GROUP BY a.name HAVING SUM(t.plays) > 1500 ORDER BY total_plays DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
    {
      order: 10,
      datasetName: "junior-b5-tracks",
      prompt:
        "For each `genre`, compute the average `plays` (alias `avg_plays`) and the number of tracks (alias `n`). Select `genre`, `avg_plays`, and `n`, ordered by `avg_plays` descending.",
      hint: "GROUP BY genre with AVG(plays) and COUNT(*), then ORDER BY avg_plays DESC.",
      referenceQuery:
        "SELECT genre, AVG(plays) AS avg_plays, COUNT(*) AS n FROM tracks GROUP BY genre ORDER BY avg_plays DESC;",
      comparisonMode: "ORDERED",
      expectedResultJson: { columns: [], rows: [] },
    },
  ],
};
