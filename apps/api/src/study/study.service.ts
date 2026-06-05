import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ComparisonMode,
  Level,
  RevealResult,
  SubmitResult,
  TaskStatus,
} from "@sql-edu/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { ContentService } from "../content/content.service";
import { GradingService } from "../grading/grading.service";
import type { TabularResult } from "../grading/result-comparison";
import { isBlockComplete, XP_PER_BLOCK } from "./progression";

/**
 * StudyService — write side of the study domain: submitting answers and
 * revealing reference answers, plus the resulting progression bookkeeping.
 *
 * Invariants enforced here:
 *   - Submissions/reveals against a LOCKED block are rejected (403).
 *   - Every submit upserts UserTaskProgress, increments `attempts`, and stores
 *     `lastSubmittedSql` (regardless of correctness).
 *   - A correct submit sets the task COMPLETED; a wrong/forbidden submit does
 *     NOT downgrade an already-COMPLETED task.
 *   - Reveal sets SKIPPED, unless the task is already COMPLETED (kept as-is).
 *   - After any status change, block completion is re-evaluated; on the
 *     transition to complete, XP is awarded to the block's level EXACTLY ONCE
 *     (idempotent — guarded by the UserBlockProgress status).
 */
@Injectable()
export class StudyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grading: GradingService,
    private readonly content: ContentService,
  ) {}

  /**
   * Grade and record a submission for a task.
   * @throws NotFoundException if the task doesn't exist.
   * @throws ForbiddenException if the task's block is LOCKED for the user.
   */
  async submit(
    userId: string,
    taskId: string,
    sql: string,
  ): Promise<SubmitResult> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        dataset: { select: { setupSql: true } },
        block: { select: { id: true, level: true } },
      },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    // Enforce the lock: cannot submit to a locked block.
    await this.assertBlockUnlocked(
      userId,
      task.block.level as Level,
      task.block.id,
    );

    // Grade BEFORE persisting status so we know the outcome.
    const result = await this.grading.grade({
      task: {
        comparisonMode: task.comparisonMode as ComparisonMode,
        expectedResultJson: task.expectedResultJson as unknown as TabularResult,
        dataset: { setupSql: task.dataset.setupSql },
      },
      userSql: sql,
    });

    // Persist progress: always attempts++ and store lastSubmittedSql.
    // Only promote to COMPLETED on a correct answer; never downgrade a task
    // that is already COMPLETED.
    const existing = await this.prisma.userTaskProgress.findUnique({
      where: { userId_taskId: { userId, taskId } },
      select: { status: true },
    });
    const alreadyCompleted = existing?.status === "COMPLETED";
    const nextStatus: TaskStatus = result.correct
      ? "COMPLETED"
      : alreadyCompleted
        ? "COMPLETED"
        : (existing?.status as TaskStatus) ?? "NOT_STARTED";

    await this.prisma.userTaskProgress.upsert({
      where: { userId_taskId: { userId, taskId } },
      create: {
        userId,
        taskId,
        status: result.correct ? "COMPLETED" : "NOT_STARTED",
        attempts: 1,
        lastSubmittedSql: sql,
      },
      update: {
        status: nextStatus,
        attempts: { increment: 1 },
        lastSubmittedSql: sql,
      },
    });

    // If this submission completed the task, the block may now be complete.
    if (result.correct) {
      await this.reevaluateBlockCompletion(
        userId,
        task.block.id,
        task.block.level as Level,
      );
    }

    return result;
  }

  /**
   * Reveal the reference answer for a task. Sets the task SKIPPED unless it is
   * already COMPLETED (in which case the status is preserved). Always returns
   * the reference query (the ONLY place it is exposed).
   * @throws NotFoundException if the task doesn't exist.
   * @throws ForbiddenException if the task's block is LOCKED for the user.
   */
  async reveal(userId: string, taskId: string): Promise<RevealResult> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        referenceQuery: true,
        block: { select: { id: true, level: true } },
      },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    await this.assertBlockUnlocked(
      userId,
      task.block.level as Level,
      task.block.id,
    );

    const existing = await this.prisma.userTaskProgress.findUnique({
      where: { userId_taskId: { userId, taskId } },
      select: { status: true },
    });
    const alreadyCompleted = existing?.status === "COMPLETED";
    // Completed tasks stay completed; everything else becomes SKIPPED.
    const nextStatus: TaskStatus = alreadyCompleted ? "COMPLETED" : "SKIPPED";

    await this.prisma.userTaskProgress.upsert({
      where: { userId_taskId: { userId, taskId } },
      create: {
        userId,
        taskId,
        status: nextStatus,
        attempts: 0,
      },
      update: {
        status: nextStatus,
      },
    });

    // Revealing (→ SKIPPED) can complete the block (all tasks done/skipped).
    await this.reevaluateBlockCompletion(
      userId,
      task.block.id,
      task.block.level as Level,
    );

    return { referenceQuery: task.referenceQuery, status: nextStatus };
  }

  // -------------------------------------------------------------------------
  // Internal helpers.
  // -------------------------------------------------------------------------

  /** Throw 403 if the given block is LOCKED for the user. */
  private async assertBlockUnlocked(
    userId: string,
    level: Level,
    blockId: string,
  ): Promise<void> {
    const status = await this.content.resolveBlockStatus(userId, level, blockId);
    if (status === "LOCKED") {
      throw new ForbiddenException("This block is locked");
    }
  }

  /**
   * Re-evaluate whether a block is now complete for the user and, on the
   * transition into completion, record it and award level XP exactly once.
   *
   * Idempotency: the whole check+award runs in a transaction and is gated on the
   * existing UserBlockProgress NOT already being COMPLETED, so XP is never
   * double-awarded even under repeated calls.
   */
  private async reevaluateBlockCompletion(
    userId: string,
    blockId: string,
    level: Level,
  ): Promise<void> {
    // Gather all task ids in the block and the user's status for each.
    const tasks = await this.prisma.task.findMany({
      where: { blockId },
      select: { id: true },
    });
    if (tasks.length === 0) {
      return;
    }

    const progress = await this.prisma.userTaskProgress.findMany({
      where: { userId, taskId: { in: tasks.map((t) => t.id) } },
      select: { taskId: true, status: true },
    });
    const statusByTask = new Map<string, TaskStatus>(
      progress.map((p) => [p.taskId, p.status as TaskStatus]),
    );
    const taskStatuses: TaskStatus[] = tasks.map(
      (t) => statusByTask.get(t.id) ?? "NOT_STARTED",
    );

    if (!isBlockComplete(taskStatuses)) {
      return;
    }

    // Block is complete. Record completion + award XP ONCE, atomically.
    await this.prisma.$transaction(async (tx) => {
      const blockProgress = await tx.userBlockProgress.findUnique({
        where: { userId_blockId: { userId, blockId } },
        select: { status: true },
      });

      // Already credited — do nothing (idempotent).
      if (blockProgress?.status === "COMPLETED") {
        return;
      }

      await tx.userBlockProgress.upsert({
        where: { userId_blockId: { userId, blockId } },
        create: {
          userId,
          blockId,
          status: "COMPLETED",
          completedAt: new Date(),
        },
        update: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      const xp = XP_PER_BLOCK[level];
      await tx.userLevelXp.upsert({
        where: { userId_level: { userId, level } },
        create: { userId, level, xp },
        update: { xp: { increment: xp } },
      });
    });
  }
}
