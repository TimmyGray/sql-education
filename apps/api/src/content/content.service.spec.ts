import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ContentService } from "./content.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * ContentService tests — ALL Prisma I/O mocked. Covers dashboard composition
 * (XP, per-user block status, completed/total task counts) and block content
 * (404/403, datasetSchema from schemaJson, aiQuestionsRemaining clamp, USER-SAFE
 * task projection).
 */

type AnyFn = jest.Mock;
interface MockPrisma {
  block: { findMany: AnyFn; findUnique: AnyFn };
  userLevelXp: { findMany: AnyFn };
  userBlockProgress: { findMany: AnyFn };
  userTaskProgress: { findMany: AnyFn };
  userBlockAiUsage: { findUnique: AnyFn };
}

function makeService() {
  const prisma: MockPrisma = {
    block: { findMany: jest.fn(), findUnique: jest.fn() },
    userLevelXp: { findMany: jest.fn().mockResolvedValue([]) },
    userBlockProgress: { findMany: jest.fn().mockResolvedValue([]) },
    userTaskProgress: { findMany: jest.fn().mockResolvedValue([]) },
    userBlockAiUsage: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const service = new ContentService(prisma as unknown as PrismaService);
  return { prisma, service };
}

describe("ContentService.getDashboard", () => {
  it("returns all three levels with XP and ordered block summaries", async () => {
    const { prisma, service } = makeService();
    prisma.block.findMany.mockResolvedValue([
      { id: "n1", level: "NOVICE", order: 1, title: "N1", tasks: [{ id: "t1" }, { id: "t2" }] },
      { id: "n2", level: "NOVICE", order: 2, title: "N2", tasks: [{ id: "t3" }] },
      { id: "j1", level: "JUNIOR", order: 1, title: "J1", tasks: [{ id: "t4" }] },
    ]);
    prisma.userLevelXp.findMany.mockResolvedValue([
      { level: "NOVICE", xp: 100 },
    ]);
    // n1 completed → unlocks n2; t1 completed, t2 skipped.
    prisma.userBlockProgress.findMany.mockResolvedValue([{ blockId: "n1" }]);
    prisma.userTaskProgress.findMany.mockResolvedValue([
      { taskId: "t1", status: "COMPLETED", attempts: 3 },
      { taskId: "t2", status: "SKIPPED", attempts: 1 },
    ]);

    const dash = await service.getDashboard("u1");

    expect(dash.levels.map((l) => l.level)).toEqual([
      "NOVICE",
      "JUNIOR",
      "MIDDLE",
    ]);

    const novice = dash.levels.find((l) => l.level === "NOVICE")!;
    expect(novice.xp).toBe(100);
    expect(novice.blocks).toHaveLength(2);

    const n1 = novice.blocks.find((b) => b.id === "n1")!;
    expect(n1.status).toBe("COMPLETED");
    expect(n1.totalTasks).toBe(2);
    expect(n1.completedTasks).toBe(1); // only COMPLETED counts, not SKIPPED

    const n2 = novice.blocks.find((b) => b.id === "n2")!;
    expect(n2.status).toBe("IN_PROGRESS"); // unlocked because n1 completed

    const junior = dash.levels.find((l) => l.level === "JUNIOR")!;
    expect(junior.xp).toBe(0); // no row → 0
    expect(junior.blocks[0].status).toBe("IN_PROGRESS"); // first block always unlocked

    const middle = dash.levels.find((l) => l.level === "MIDDLE")!;
    expect(middle.blocks).toEqual([]); // no blocks seeded
  });

  it("locks the second block when the first is not completed", async () => {
    const { prisma, service } = makeService();
    prisma.block.findMany.mockResolvedValue([
      { id: "n1", level: "NOVICE", order: 1, title: "N1", tasks: [{ id: "t1" }] },
      { id: "n2", level: "NOVICE", order: 2, title: "N2", tasks: [{ id: "t2" }] },
    ]);

    const dash = await service.getDashboard("u1");
    const novice = dash.levels.find((l) => l.level === "NOVICE")!;
    expect(novice.blocks.find((b) => b.id === "n1")!.status).toBe("IN_PROGRESS");
    expect(novice.blocks.find((b) => b.id === "n2")!.status).toBe("LOCKED");
  });
});

describe("ContentService.getBlockContent", () => {
  const BLOCK = {
    id: "n1",
    level: "NOVICE",
    order: 1,
    title: "Basics",
    theoryMarkdown: "# Theory",
    theoryExamples: [{ sql: "SELECT 1" }],
    tasks: [
      {
        id: "t1",
        order: 1,
        prompt: "Get all",
        hint: "use SELECT",
        // SECURITY-sensitive fields must NOT appear in output:
        referenceQuery: "SELECT * FROM users",
        expectedResultJson: { columns: ["id"], rows: [[1]] },
        dataset: {
          schemaJson: [
            {
              tableName: "users",
              columns: [
                { name: "id", type: "int" },
                { name: "email", type: "text" },
              ],
            },
          ],
        },
      },
    ],
  };

  it("404s when the block does not exist", async () => {
    const { prisma, service } = makeService();
    prisma.block.findUnique.mockResolvedValue(null);
    await expect(service.getBlockContent("u1", "ghost")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("403s when the block is LOCKED for the user", async () => {
    const { prisma, service } = makeService();
    prisma.block.findUnique.mockResolvedValue({ ...BLOCK, order: 2 });
    // Level has block order 1 (not completed) before this order-2 block → LOCKED.
    prisma.block.findMany.mockResolvedValue([
      { id: "n0", order: 1 },
      { id: "n1", order: 2 },
    ]);
    // resolveBlockStatus uses block.findMany + userBlockProgress.findMany([]).
    await expect(service.getBlockContent("u1", "n1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("serves block content with datasetSchema from schemaJson and clamps AI quota", async () => {
    const { prisma, service } = makeService();
    prisma.block.findUnique.mockResolvedValue(BLOCK);
    // First block in the level → unlocked.
    prisma.block.findMany.mockResolvedValue([{ id: "n1", order: 1 }]);
    prisma.userTaskProgress.findMany.mockResolvedValue([
      { taskId: "t1", status: "COMPLETED", attempts: 2 },
    ]);
    prisma.userBlockAiUsage.findUnique.mockResolvedValue({ questionsUsed: 4 });

    const content = await service.getBlockContent("u1", "n1");

    expect(content.id).toBe("n1");
    expect(content.status).toBe("IN_PROGRESS");
    expect(content.theoryMarkdown).toBe("# Theory");
    expect(content.theoryExamples).toEqual([{ sql: "SELECT 1" }]);
    expect(content.aiQuestionsRemaining).toBe(6); // 10 - 4

    expect(content.tasks).toHaveLength(1);
    const task = content.tasks[0];
    expect(task).toEqual({
      id: "t1",
      order: 1,
      prompt: "Get all",
      hint: "use SELECT",
      status: "COMPLETED",
      attempts: 2,
      datasetSchema: [
        {
          tableName: "users",
          columns: [
            { name: "id", type: "int" },
            { name: "email", type: "text" },
          ],
        },
      ],
    });
    // SECURITY: reference query / expected result never leak into the payload.
    expect(JSON.stringify(content)).not.toContain("SELECT * FROM users");
    expect(JSON.stringify(content)).not.toContain("expectedResultJson");
  });

  it("defaults task status/attempts and AI quota when no rows exist", async () => {
    const { prisma, service } = makeService();
    prisma.block.findUnique.mockResolvedValue(BLOCK);
    prisma.block.findMany.mockResolvedValue([{ id: "n1", order: 1 }]);
    // No task progress, no AI usage.
    const content = await service.getBlockContent("u1", "n1");
    expect(content.tasks[0].status).toBe("NOT_STARTED");
    expect(content.tasks[0].attempts).toBe(0);
    expect(content.aiQuestionsRemaining).toBe(10);
  });

  it("never returns negative AI quota even if usage exceeds the cap", async () => {
    const { prisma, service } = makeService();
    prisma.block.findUnique.mockResolvedValue(BLOCK);
    prisma.block.findMany.mockResolvedValue([{ id: "n1", order: 1 }]);
    prisma.userBlockAiUsage.findUnique.mockResolvedValue({ questionsUsed: 99 });
    const content = await service.getBlockContent("u1", "n1");
    expect(content.aiQuestionsRemaining).toBe(0);
  });

  it("returns [] datasetSchema when schemaJson is missing/non-array", async () => {
    const { prisma, service } = makeService();
    prisma.block.findUnique.mockResolvedValue({
      ...BLOCK,
      tasks: [{ ...BLOCK.tasks[0], dataset: { schemaJson: null } }],
    });
    prisma.block.findMany.mockResolvedValue([{ id: "n1", order: 1 }]);
    const content = await service.getBlockContent("u1", "n1");
    expect(content.tasks[0].datasetSchema).toEqual([]);
  });
});
