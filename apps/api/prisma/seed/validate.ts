/**
 * Validation harness for ALL curriculum levels (NOVICE, JUNIOR, MIDDLE).
 *
 * For every task across every level:
 *   1. Opens a transaction on the sandbox DB (localhost:5433)
 *   2. Creates a temp schema, runs the dataset setupSql + referenceQuery
 *   3. Captures columns + rows → bakes expectedResultJson
 *   4. Rolls back (no permanent state left on sandbox)
 *
 * Run:
 *   cd apps/api
 *   npx ts-node prisma/seed/validate.ts
 *
 * On success, writes one `<dir>/baked.json` per level (e.g. novice/baked.json,
 * junior/baked.json, middle/baked.json), each an array of
 * { blockOrder, taskOrder, expectedResultJson }.
 */

import { Client, types as pgTypes } from "pg";
import * as fs from "fs";
import * as path from "path";

// Parse DATE/TIME/TIMESTAMP(TZ) as RAW STRINGS (timezone-independent) so the
// baked expectedResultJson matches what the grading sandbox runner produces on
// any machine/timezone. MUST stay in sync with the runner's parser config.
const identity = (v: string): string => v;
for (const oid of [1082, 1083, 1114, 1184]) {
  pgTypes.setTypeParser(oid, identity);
}

import { LEVELS } from "./registry";
import type { ExpectedResult } from "./types";

const SANDBOX_URL =
  "postgresql://sandbox_admin:sandbox_admin_pw@localhost:5433/sandbox";

interface ValidationResult {
  level: string;
  block: number;
  task: number;
  status: "ok" | "error" | "empty";
  rowCount: number;
  error?: string;
}

async function runInTransaction(
  client: Client,
  setupSql: string,
  referenceQuery: string
): Promise<{ fields: string[]; rows: unknown[][] }> {
  await client.query("BEGIN");
  try {
    const schemaName = `tmp_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    await client.query(`CREATE SCHEMA ${schemaName}`);
    await client.query(`SET search_path TO ${schemaName}`);
    await client.query(setupSql);
    const result = await client.query(referenceQuery);
    const fields = result.fields.map((f) => f.name);
    const rows = result.rows.map((row) => fields.map((f) => row[f]));
    await client.query("ROLLBACK");
    return { fields, rows };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

interface BakedTask {
  blockOrder: number;
  taskOrder: number;
  expectedResultJson: ExpectedResult;
}

async function main() {
  const client = new Client({ connectionString: SANDBOX_URL });
  await client.connect();

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
          const { fields, rows } = await runInTransaction(
            client,
            setupSql,
            task.referenceQuery
          );
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

  await client.end();

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

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
