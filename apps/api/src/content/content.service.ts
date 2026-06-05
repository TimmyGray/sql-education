import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  BlockContent,
  BlockStatus,
  Dashboard,
  DatasetTable,
  Level,
  LevelProgress,
  TaskPublic,
  TaskStatus,
} from "@sql-edu/contracts";
import { PrismaService } from "../prisma/prisma.service";
import {
  computeBlockStatuses,
  countCompletedTasks,
  type OrderedBlock,
} from "../study/progression";

/** The three levels, in display order. */
const LEVELS: Level[] = ["NOVICE", "JUNIOR", "MIDDLE"];

/** Per-block AI question allowance. */
const AI_QUESTIONS_PER_BLOCK = 10;

/**
 * ContentService — read side of the study domain. Serves the per-user dashboard
 * and full block content. All block statuses are computed dynamically from the
 * user's completed-block set (see progression helpers); LOCKED rows are never
 * required to be pre-seeded.
 *
 * SECURITY: only ever serves the USER-SAFE projection of tasks — it never reads
 * `referenceQuery` / `expectedResultJson` into a response. `datasetSchema` comes
 * verbatim from `SandboxDataset.schemaJson` (pinned `DatasetTable[]` shape).
 */
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the dashboard: for every level, the user's XP plus an ordered
   * BlockSummary[] with per-user status and completed/total task counts.
   */
  async getDashboard(userId: string): Promise<Dashboard> {
    // All blocks with their tasks (id+order only) ordered by level then order.
    const blocks = await this.prisma.block.findMany({
      orderBy: [{ level: "asc" }, { order: "asc" }],
      select: {
        id: true,
        level: true,
        order: true,
        title: true,
        tasks: { select: { id: true } },
      },
    });

    const [xpRows, completedBlockIds, taskStatusByTaskId] = await Promise.all([
      this.prisma.userLevelXp.findMany({ where: { userId } }),
      this.getCompletedBlockIds(userId),
      this.getTaskStatusMap(userId),
    ]);

    const xpByLevel = new Map<Level, number>();
    for (const row of xpRows) {
      xpByLevel.set(row.level as Level, row.xp);
    }

    const levels: LevelProgress[] = LEVELS.map((level) => {
      const levelBlocks = blocks.filter((b) => b.level === level);
      const statusMap = computeBlockStatuses(
        levelBlocks as OrderedBlock[],
        completedBlockIds,
      );

      const summaries = levelBlocks.map((block) => {
        const taskStatuses: TaskStatus[] = block.tasks.map(
          (t) => taskStatusByTaskId.get(t.id) ?? "NOT_STARTED",
        );
        return {
          id: block.id,
          level,
          order: block.order,
          title: block.title,
          status: statusMap.get(block.id) ?? ("LOCKED" as BlockStatus),
          totalTasks: block.tasks.length,
          completedTasks: countCompletedTasks(taskStatuses),
        };
      });

      return {
        level,
        xp: xpByLevel.get(level) ?? 0,
        blocks: summaries,
      };
    });

    return { levels };
  }

  /**
   * Full content for a single block. Throws 404 if the block does not exist and
   * 403 if it is LOCKED for this user.
   */
  async getBlockContent(
    userId: string,
    blockId: string,
  ): Promise<BlockContent> {
    const block = await this.prisma.block.findUnique({
      where: { id: blockId },
      include: {
        tasks: {
          orderBy: { order: "asc" },
          include: {
            dataset: { select: { schemaJson: true } },
          },
        },
      },
    });

    if (!block) {
      throw new NotFoundException("Block not found");
    }

    // Determine this block's status against its level's ordered block list.
    const status = await this.resolveBlockStatus(
      userId,
      block.level as Level,
      blockId,
    );
    if (status === "LOCKED") {
      throw new ForbiddenException("This block is locked");
    }

    const [taskStatusByTaskId, attemptsByTaskId, aiUsed] = await Promise.all([
      this.getTaskStatusMap(userId),
      this.getTaskAttemptsMap(userId),
      this.getAiQuestionsUsed(userId, blockId),
    ]);

    const tasks: TaskPublic[] = block.tasks.map((task) => ({
      id: task.id,
      order: task.order,
      prompt: task.prompt,
      hint: task.hint ?? "",
      status: taskStatusByTaskId.get(task.id) ?? "NOT_STARTED",
      attempts: attemptsByTaskId.get(task.id) ?? 0,
      datasetSchema: this.toDatasetSchema(task.dataset?.schemaJson),
    }));

    return {
      id: block.id,
      level: block.level as Level,
      order: block.order,
      title: block.title,
      theoryMarkdown: block.theoryMarkdown,
      theoryExamples: this.toTheoryExamples(block.theoryExamples),
      status,
      tasks,
      aiQuestionsRemaining: Math.max(0, AI_QUESTIONS_PER_BLOCK - aiUsed),
    };
  }

  // -------------------------------------------------------------------------
  // Shared per-user lookups (also consumed by StudyService via this service).
  // -------------------------------------------------------------------------

  /** Set of block ids the user has COMPLETED (from UserBlockProgress). */
  async getCompletedBlockIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.userBlockProgress.findMany({
      where: { userId, status: "COMPLETED" },
      select: { blockId: true },
    });
    return new Set(rows.map((r) => r.blockId));
  }

  /** Resolve a single block's status for the user within its level. */
  async resolveBlockStatus(
    userId: string,
    level: Level,
    blockId: string,
  ): Promise<BlockStatus> {
    const [levelBlocks, completed] = await Promise.all([
      this.prisma.block.findMany({
        where: { level },
        orderBy: { order: "asc" },
        select: { id: true, order: true },
      }),
      this.getCompletedBlockIds(userId),
    ]);
    return (
      computeBlockStatuses(levelBlocks as OrderedBlock[], completed).get(
        blockId,
      ) ?? "LOCKED"
    );
  }

  /** Map of taskId → TaskStatus from the user's UserTaskProgress rows. */
  private async getTaskStatusMap(
    userId: string,
  ): Promise<Map<string, TaskStatus>> {
    const rows = await this.prisma.userTaskProgress.findMany({
      where: { userId },
      select: { taskId: true, status: true },
    });
    return new Map(rows.map((r) => [r.taskId, r.status as TaskStatus]));
  }

  /** Map of taskId → attempts from the user's UserTaskProgress rows. */
  private async getTaskAttemptsMap(
    userId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.userTaskProgress.findMany({
      where: { userId },
      select: { taskId: true, attempts: true },
    });
    return new Map(rows.map((r) => [r.taskId, r.attempts]));
  }

  /** Number of AI questions the user has used in this block (0 if none). */
  private async getAiQuestionsUsed(
    userId: string,
    blockId: string,
  ): Promise<number> {
    const usage = await this.prisma.userBlockAiUsage.findUnique({
      where: { userId_blockId: { userId, blockId } },
      select: { questionsUsed: true },
    });
    return usage?.questionsUsed ?? 0;
  }

  // -------------------------------------------------------------------------
  // JSON coercion helpers for the pinned content-seed shapes.
  // -------------------------------------------------------------------------

  /**
   * Map `SandboxDataset.schemaJson` (pinned `DatasetTable[]`) into the public
   * `datasetSchema`. Defensive: returns [] for null/non-array data.
   */
  private toDatasetSchema(schemaJson: unknown): DatasetTable[] {
    if (!Array.isArray(schemaJson)) {
      return [];
    }
    return schemaJson as DatasetTable[];
  }

  /** Block.theoryExamples is free-form JSON; pass an array through, else undefined. */
  private toTheoryExamples(examples: unknown): unknown[] | undefined {
    return Array.isArray(examples) ? (examples as unknown[]) : undefined;
  }
}
