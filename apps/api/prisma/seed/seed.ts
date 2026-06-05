/**
 * Prisma database seed — full curriculum (NOVICE, JUNIOR, MIDDLE).
 *
 * Wired via package.json `prisma.seed` ("ts-node prisma/seed/seed.ts") and run
 * with `pnpm --filter api db:seed` (which calls `prisma db seed`).
 *
 * Idempotent: uses upserts keyed by unique constraints.
 * Does NOT require the sandbox DB — all expectedResultJson values are baked in
 * (per-level `<dir>/baked.json`, produced by validate.ts).
 *
 * Populates: SandboxDataset, Block, Task — for every level in the registry.
 */

import { PrismaClient, ComparisonMode, Level } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { LEVELS } from "./registry";
import type { ExpectedResult } from "./types";

interface BakedEntry {
  blockOrder: number;
  taskOrder: number;
  expectedResultJson: ExpectedResult;
}

/** Load a level's baked expected-results into a "blockOrder:taskOrder" map. */
function loadBaked(dir: string): Map<string, ExpectedResult> {
  const bakedPath = path.join(__dirname, dir, "baked.json");
  if (!fs.existsSync(bakedPath)) {
    throw new Error(
      `Missing ${dir}/baked.json. Run prisma/seed/validate.ts to generate it.`
    );
  }
  const raw = JSON.parse(fs.readFileSync(bakedPath, "utf8")) as BakedEntry[];
  return new Map(
    raw.map((b) => [`${b.blockOrder}:${b.taskOrder}`, b.expectedResultJson])
  );
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("[seed] Starting full curriculum seed…");

  let totalBlocks = 0;
  let totalTasks = 0;

  for (const { level, dir, blocks } of LEVELS) {
    const levelEnum = Level[level as keyof typeof Level];
    const bakedMap = loadBaked(dir);
    console.log(`\n[seed] === ${level} (${blocks.length} blocks) ===`);

    for (const blockDef of blocks) {
      // 1. Upsert all datasets used in this block.
      const datasetIdMap = new Map<string, string>(); // name → id
      for (const ds of blockDef.datasets) {
        const upserted = await prisma.sandboxDataset.upsert({
          where: { name: ds.name },
          create: {
            name: ds.name,
            setupSql: ds.setupSql,
            schemaJson: ds.schemaJson as Prisma.InputJsonValue,
          },
          update: {
            setupSql: ds.setupSql,
            schemaJson: ds.schemaJson as Prisma.InputJsonValue,
          },
          select: { id: true },
        });
        datasetIdMap.set(ds.name, upserted.id);
      }

      // 2. Upsert the Block.
      const block = await prisma.block.upsert({
        where: { level_order: { level: levelEnum, order: blockDef.order } },
        create: {
          level: levelEnum,
          order: blockDef.order,
          title: blockDef.title,
          theoryMarkdown: blockDef.theoryMarkdown,
          theoryExamples: blockDef.theoryExamples as Prisma.InputJsonValue,
        },
        update: {
          title: blockDef.title,
          theoryMarkdown: blockDef.theoryMarkdown,
          theoryExamples: blockDef.theoryExamples as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      // 3. Upsert all tasks.
      for (const taskDef of blockDef.tasks) {
        const bakedResult = bakedMap.get(
          `${blockDef.order}:${taskDef.order}`
        );
        if (!bakedResult) {
          throw new Error(
            `Missing baked result for ${level} block ${blockDef.order}, task ${taskDef.order}. ` +
              `Re-run prisma/seed/validate.ts to regenerate ${dir}/baked.json.`
          );
        }

        const datasetId = datasetIdMap.get(taskDef.datasetName);
        if (!datasetId) {
          throw new Error(
            `Dataset "${taskDef.datasetName}" not found for ${level} block ${blockDef.order}, task ${taskDef.order}`
          );
        }

        const comparisonMode: ComparisonMode =
          taskDef.comparisonMode === "ORDERED"
            ? ComparisonMode.ORDERED
            : ComparisonMode.UNORDERED;

        await prisma.task.upsert({
          where: { blockId_order: { blockId: block.id, order: taskDef.order } },
          create: {
            blockId: block.id,
            order: taskDef.order,
            prompt: taskDef.prompt,
            hint: taskDef.hint,
            referenceQuery: taskDef.referenceQuery,
            comparisonMode,
            expectedResultJson: bakedResult as Prisma.InputJsonValue,
            datasetId,
          },
          update: {
            prompt: taskDef.prompt,
            hint: taskDef.hint,
            referenceQuery: taskDef.referenceQuery,
            comparisonMode,
            expectedResultJson: bakedResult as Prisma.InputJsonValue,
            datasetId,
          },
        });
      }

      totalBlocks += 1;
      totalTasks += blockDef.tasks.length;
      console.log(
        `  [${level}/${blockDef.order}] "${blockDef.title}" — ${blockDef.tasks.length} tasks`
      );
    }
  }

  console.log(
    `\n[seed] Done. Seeded ${totalBlocks} blocks, ${totalTasks} tasks across ${LEVELS.length} levels.`
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
