import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { SubmitResult } from "@sql-edu/contracts";
import { StudyService } from "./study.service";
import { PrismaService } from "../prisma/prisma.service";
import { GradingService } from "../grading/grading.service";
import { ContentService } from "../content/content.service";

/**
 * StudyService tests — ALL I/O mocked (no PrismaService DB, no grading runner).
 * Focus: progress upsert + attempts++, task completion, block completion → XP
 * awarded ONCE (idempotent), reveal SKIPPED vs keeps COMPLETED, locked → 403.
 */

type AnyFn = jest.Mock;

interface MockPrisma {
  task: { findUnique: AnyFn; findMany: AnyFn };
  userTaskProgress: { findUnique: AnyFn; findMany: AnyFn; upsert: AnyFn };
  userBlockProgress: { findUnique: AnyFn; upsert: AnyFn };
  userLevelXp: { upsert: AnyFn };
  $transaction: AnyFn;
}

function makeMocks() {
  const prisma: MockPrisma = {
    task: { findUnique: jest.fn(), findMany: jest.fn() },
    userTaskProgress: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
    },
    userBlockProgress: {
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
    },
    userLevelXp: { upsert: jest.fn().mockResolvedValue({}) },
    // $transaction(cb) just runs cb with the same mock (tx === prisma).
    $transaction: jest.fn(async (cb: (tx: MockPrisma) => Promise<unknown>) =>
      cb(prisma),
    ),
  };

  const grading = {
    grade: jest.fn(),
  } as unknown as jest.Mocked<Pick<GradingService, "grade">>;

  const content = {
    resolveBlockStatus: jest.fn().mockResolvedValue("IN_PROGRESS"),
  } as unknown as jest.Mocked<Pick<ContentService, "resolveBlockStatus">>;

  const service = new StudyService(
    prisma as unknown as PrismaService,
    grading as unknown as GradingService,
    content as unknown as ContentService,
  );

  return { prisma, grading, content, service };
}

const TASK_ROW = {
  id: "task1",
  comparisonMode: "UNORDERED",
  expectedResultJson: { columns: ["id"], rows: [[1]] },
  referenceQuery: "SELECT id FROM t",
  dataset: { setupSql: "CREATE TABLE t(id int)" },
  block: { id: "blockA", level: "NOVICE" },
};

const CORRECT: SubmitResult = {
  correct: true,
  status: "COMPLETED",
  message: "Correct!",
  columns: ["id"],
  rows: [[1]],
};
const WRONG: SubmitResult = {
  correct: false,
  status: "NOT_STARTED",
  message: "nope",
  errorType: "WRONG_RESULT",
  columns: ["id"],
  rows: [[2]],
};

describe("StudyService.submit", () => {
  it("404s when the task does not exist", async () => {
    const { service, prisma } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(null);
    await expect(service.submit("u1", "missing", "SELECT 1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("403s when the block is locked", async () => {
    const { service, prisma, content } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    content.resolveBlockStatus.mockResolvedValue("LOCKED");
    await expect(service.submit("u1", "task1", "SELECT 1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // Must reject BEFORE grading.
  });

  it("upserts progress, increments attempts, stores SQL (wrong answer, first attempt)", async () => {
    const { service, prisma, grading } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    grading.grade.mockResolvedValue(WRONG);
    prisma.userTaskProgress.findUnique.mockResolvedValue(null); // no prior progress

    const res = await service.submit("u1", "task1", "SELECT bad");

    expect(res).toEqual(WRONG);
    const upsertArg = prisma.userTaskProgress.upsert.mock.calls[0][0];
    expect(upsertArg.where).toEqual({
      userId_taskId: { userId: "u1", taskId: "task1" },
    });
    expect(upsertArg.create).toMatchObject({
      userId: "u1",
      taskId: "task1",
      status: "NOT_STARTED",
      attempts: 1,
      lastSubmittedSql: "SELECT bad",
    });
    expect(upsertArg.update).toMatchObject({
      status: "NOT_STARTED",
      attempts: { increment: 1 },
      lastSubmittedSql: "SELECT bad",
    });
    // Wrong answer → no block completion path.
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it("does NOT downgrade an already-COMPLETED task on a later wrong submit", async () => {
    const { service, prisma, grading } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    grading.grade.mockResolvedValue(WRONG);
    prisma.userTaskProgress.findUnique.mockResolvedValue({ status: "COMPLETED" });

    await service.submit("u1", "task1", "SELECT bad");

    const upsertArg = prisma.userTaskProgress.upsert.mock.calls[0][0];
    expect(upsertArg.update.status).toBe("COMPLETED"); // preserved
    expect(upsertArg.update.attempts).toEqual({ increment: 1 });
  });

  it("marks the task COMPLETED on a correct submit", async () => {
    const { service, prisma, grading } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    grading.grade.mockResolvedValue(CORRECT);
    prisma.userTaskProgress.findUnique.mockResolvedValue(null);
    // Block completion check: one task, now completed.
    prisma.task.findMany.mockResolvedValue([{ id: "task1" }]);
    prisma.userTaskProgress.findMany.mockResolvedValue([
      { taskId: "task1", status: "COMPLETED" },
    ]);
    prisma.userBlockProgress.findUnique.mockResolvedValue(null);

    const res = await service.submit("u1", "task1", "SELECT id FROM t");

    expect(res.correct).toBe(true);
    const upsertArg = prisma.userTaskProgress.upsert.mock.calls[0][0];
    expect(upsertArg.create.status).toBe("COMPLETED");
    expect(upsertArg.update.status).toBe("COMPLETED");
  });

  it("completes the block and awards XP ONCE when the final task is solved", async () => {
    const { service, prisma, grading } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    grading.grade.mockResolvedValue(CORRECT);
    prisma.userTaskProgress.findUnique.mockResolvedValue(null);
    // Two tasks; task2 already SKIPPED, task1 now COMPLETED → block complete.
    prisma.task.findMany.mockResolvedValue([{ id: "task1" }, { id: "task2" }]);
    prisma.userTaskProgress.findMany.mockResolvedValue([
      { taskId: "task1", status: "COMPLETED" },
      { taskId: "task2", status: "SKIPPED" },
    ]);
    prisma.userBlockProgress.findUnique.mockResolvedValue(null); // not yet credited

    await service.submit("u1", "task1", "SELECT id FROM t");

    // Block progress recorded COMPLETED.
    const blockUpsert = prisma.userBlockProgress.upsert.mock.calls[0][0];
    expect(blockUpsert.where).toEqual({
      userId_blockId: { userId: "u1", blockId: "blockA" },
    });
    expect(blockUpsert.create.status).toBe("COMPLETED");
    expect(blockUpsert.create.completedAt).toBeInstanceOf(Date);

    // XP awarded for NOVICE = 100, via increment.
    const xpUpsert = prisma.userLevelXp.upsert.mock.calls[0][0];
    expect(xpUpsert.where).toEqual({
      userId_level: { userId: "u1", level: "NOVICE" },
    });
    expect(xpUpsert.create).toEqual({ userId: "u1", level: "NOVICE", xp: 100 });
    expect(xpUpsert.update).toEqual({ xp: { increment: 100 } });
  });

  it("is IDEMPOTENT — does NOT re-award XP if the block is already COMPLETED", async () => {
    const { service, prisma, grading } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    grading.grade.mockResolvedValue(CORRECT);
    prisma.userTaskProgress.findUnique.mockResolvedValue({ status: "COMPLETED" });
    prisma.task.findMany.mockResolvedValue([{ id: "task1" }]);
    prisma.userTaskProgress.findMany.mockResolvedValue([
      { taskId: "task1", status: "COMPLETED" },
    ]);
    // Block already credited.
    prisma.userBlockProgress.findUnique.mockResolvedValue({ status: "COMPLETED" });

    await service.submit("u1", "task1", "SELECT id FROM t");

    expect(prisma.userBlockProgress.upsert).not.toHaveBeenCalled();
    expect(prisma.userLevelXp.upsert).not.toHaveBeenCalled();
  });

  it("does NOT complete the block while a task is still NOT_STARTED", async () => {
    const { service, prisma, grading } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    grading.grade.mockResolvedValue(CORRECT);
    prisma.userTaskProgress.findUnique.mockResolvedValue(null);
    prisma.task.findMany.mockResolvedValue([{ id: "task1" }, { id: "task2" }]);
    prisma.userTaskProgress.findMany.mockResolvedValue([
      { taskId: "task1", status: "COMPLETED" },
      // task2 has no progress row → NOT_STARTED
    ]);

    await service.submit("u1", "task1", "SELECT id FROM t");

    expect(prisma.userBlockProgress.upsert).not.toHaveBeenCalled();
    expect(prisma.userLevelXp.upsert).not.toHaveBeenCalled();
  });
});

describe("StudyService.reveal", () => {
  it("404s when the task does not exist", async () => {
    const { service, prisma } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(null);
    await expect(service.reveal("u1", "missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("403s when the block is locked", async () => {
    const { service, prisma, content } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    content.resolveBlockStatus.mockResolvedValue("LOCKED");
    await expect(service.reveal("u1", "task1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("sets SKIPPED and returns the referenceQuery for a not-started task", async () => {
    const { service, prisma } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    prisma.userTaskProgress.findUnique.mockResolvedValue(null);
    prisma.task.findMany.mockResolvedValue([{ id: "task1" }]);
    prisma.userTaskProgress.findMany.mockResolvedValue([
      { taskId: "task1", status: "SKIPPED" },
    ]);
    prisma.userBlockProgress.findUnique.mockResolvedValue(null);

    const res = await service.reveal("u1", "task1");

    expect(res.referenceQuery).toBe("SELECT id FROM t");
    expect(res.status).toBe("SKIPPED");
    const upsertArg = prisma.userTaskProgress.upsert.mock.calls[0][0];
    expect(upsertArg.update.status).toBe("SKIPPED");
    expect(upsertArg.create.status).toBe("SKIPPED");
  });

  it("KEEPS COMPLETED (does not downgrade to SKIPPED) but still returns referenceQuery", async () => {
    const { service, prisma } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    prisma.userTaskProgress.findUnique.mockResolvedValue({ status: "COMPLETED" });
    prisma.task.findMany.mockResolvedValue([{ id: "task1" }]);
    prisma.userTaskProgress.findMany.mockResolvedValue([
      { taskId: "task1", status: "COMPLETED" },
    ]);
    prisma.userBlockProgress.findUnique.mockResolvedValue({ status: "COMPLETED" });

    const res = await service.reveal("u1", "task1");

    expect(res.status).toBe("COMPLETED");
    expect(res.referenceQuery).toBe("SELECT id FROM t");
    const upsertArg = prisma.userTaskProgress.upsert.mock.calls[0][0];
    expect(upsertArg.update.status).toBe("COMPLETED");
  });

  it("completing the block via reveal (all skipped) awards XP once", async () => {
    const { service, prisma } = makeMocks();
    prisma.task.findUnique.mockResolvedValue(TASK_ROW);
    prisma.userTaskProgress.findUnique.mockResolvedValue(null);
    prisma.task.findMany.mockResolvedValue([{ id: "task1" }]);
    prisma.userTaskProgress.findMany.mockResolvedValue([
      { taskId: "task1", status: "SKIPPED" },
    ]);
    prisma.userBlockProgress.findUnique.mockResolvedValue(null);

    await service.reveal("u1", "task1");

    expect(prisma.userBlockProgress.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.userLevelXp.upsert).toHaveBeenCalledTimes(1);
  });
});
