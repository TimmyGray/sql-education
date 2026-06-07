/**
 * Validation harness for ALL curriculum levels (NOVICE, JUNIOR, MIDDLE).
 *
 * For every task across every level:
 *   1. Opens a fresh in-memory SQLite database
 *   2. Runs the dataset setupSql + referenceQuery
 *   3. Captures columns + rows → bakes expectedResultJson
 *   4. Discards the database (no state leaks between tasks)
 *
 * SQLite is the SAME engine the grading sandbox runner uses, so the baked
 * expectedResultJson matches exactly what a correct student query will produce
 * (numeric formatting, auto column names, date strings, etc.). No external
 * database service is required.
 *
 * Run:
 *   cd apps/api
 *   npx ts-node prisma/seed/validate.ts
 *
 * On success, writes one `<dir>/baked.json` per level (e.g. novice/baked.json,
 * junior/baked.json, middle/baked.json), each an array of
 * { blockOrder, taskOrder, expectedResultJson }.
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

import { LEVELS } from "./registry";
import type { ExpectedResult } from "./types";

interface ValidationResult {
  level: string;
  block: number;
  task: number;
  status: "ok" | "error" | "empty";
  rowCount: number;
  error?: string;
}

/**
 * Run the dataset setup then the reference query in a throwaway in-memory DB and
 * return the columns + positional rows. Raw better-sqlite3 errors propagate so
 * validation surfaces the real cause (the grading runner sanitizes them; here we
 * want the detail).
 */
function runOne(
  setupSql: string,
  referenceQuery: string
): { fields: string[]; rows: unknown[][] } {
  const db = new Database(":memory:");
  try {
    db.exec(setupSql);
    const stmt = db.prepare(referenceQuery);
    stmt.raw(true);
    const fields = stmt.columns().map((c) => c.name);
    const rows = stmt.all() as unknown[][];
    return { fields, rows };
  } finally {
    db.close();
  }
}

interface BakedTask {
  blockOrder: number;
  taskOrder: number;
  expectedResultJson: ExpectedResult;
}

function main(): void {
  const results: ValidationResult[] = [];
  // Baked results collected per level dir.
  const bakedByDir = new Map<string, BakedTask[]>();

  for (const { level, dir, blocks } of LEVELS) {
    const baked: BakedTask[] = [];
    bakedByDir.set(dir, baked);

    for (const block of blocks) {
      const datasetMap = new Map(
        block.datasets.map((d) => [d.name, d.setupSql])
      );

      for (const task of block.tasks) {
        const setupSql = datasetMap.get(task.datasetName);
        if (!setupSql) {
          results.push({
            level,
            block: block.order,
            task: task.order,
            status: "error",
            rowCount: 0,
            error: `Dataset '${task.datasetName}' not found in ${level} block ${block.order}`,
          });
          continue;
        }

        try {
          const { fields, rows } = runOne(setupSql, task.referenceQuery);
          const expectedResultJson: ExpectedResult = { columns: fields, rows };
          results.push({
            level,
            block: block.order,
            task: task.order,
            status: rows.length === 0 ? "empty" : "ok",
            rowCount: rows.length,
          });
          baked.push({
            blockOrder: block.order,
            taskOrder: task.order,
            expectedResultJson,
          });
        } catch (err) {
          results.push({
            level,
            block: block.order,
            task: task.order,
            status: "error",
            rowCount: 0,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  // Print summary
  const ok = results.filter((r) => r.status === "ok").length;
  const empty = results.filter((r) => r.status === "empty").length;
  const errors = results.filter((r) => r.status === "error");
  const orderedTasks = LEVELS.flatMap((l) => l.blocks).flatMap((b) =>
    b.tasks.filter((t) => t.comparisonMode === "ORDERED")
  ).length;

  console.log("\n=== SEED VALIDATION SUMMARY (all levels) ===");
  console.log(`Total tasks: ${results.length}`);
  console.log(`  OK (non-empty): ${ok}`);
  console.log(`  Empty result:   ${empty}`);
  console.log(`  Errors:         ${errors.length}`);
  console.log(`ORDERED tasks:    ${orderedTasks}`);

  for (const { level } of LEVELS) {
    const lvl = results.filter((r) => r.level === level);
    console.log(
      `  ${level}: ${lvl.length} tasks ` +
        `(${lvl.filter((r) => r.status === "error").length} errors, ` +
        `${lvl.filter((r) => r.status === "empty").length} empty)`
    );
  }

  if (empty > 0) {
    console.log("\n[WARN] Tasks with empty results:");
    results
      .filter((r) => r.status === "empty")
      .forEach((r) =>
        console.log(`  ${r.level} Block ${r.block}, Task ${r.task}: 0 rows`)
      );
  }

  if (errors.length > 0) {
    console.log("\n[ERROR] Failed tasks:");
    errors.forEach((r) =>
      console.log(
        `  ${r.level} Block ${r.block}, Task ${r.task}: ${r.error}`
      )
    );
    process.exitCode = 1;
    return;
  }

  // Write one baked.json per level dir.
  for (const { dir } of LEVELS) {
    const baked = bakedByDir.get(dir) ?? [];
    const bakedPath = path.join(__dirname, dir, "baked.json");
    fs.writeFileSync(bakedPath, JSON.stringify(baked, null, 2));
    console.log(`Baked ${baked.length} results → ${path.relative(__dirname, bakedPath)}`);
  }

  console.log("\nValidation PASSED. Run the seed next.");
}

main();
