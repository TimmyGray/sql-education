import type { BlockStatus, Level, TaskStatus } from "@sql-edu/contracts";

/**
 * Progression rules (PURE, fully unit-tested).
 *
 * These functions encode the block unlock / completion / XP rules with NO I/O
 * so they can be exhaustively tested and reused by both ContentService (reads)
 * and StudyService (writes).
 *
 * Unlock model (per level, blocks ordered 1..N):
 *   - Block order 1 is ALWAYS unlocked.
 *   - Block N>1 is unlocked iff block N-1 is COMPLETED for that user.
 * Per-user status (computed dynamically; LOCKED rows need NOT be pre-seeded):
 *   - COMPLETED if the user has a completed UserBlockProgress for it,
 *   - else IN_PROGRESS if unlocked,
 *   - else LOCKED.
 */

/** XP awarded the first time a block of a given level is completed. */
export const XP_PER_BLOCK: Record<Level, number> = {
  NOVICE: 100,
  JUNIOR: 150,
  MIDDLE: 200,
};

/** A block's identity needed for ordering within its level. */
export interface OrderedBlock {
  id: string;
  order: number;
}

/**
 * Given the ordered blocks of a single level and the set of block ids the user
 * has COMPLETED, return a map of blockId → BlockStatus.
 *
 * Walks blocks in `order`. A block is unlocked if it's first, or if the
 * immediately preceding block (by order) is completed.
 */
export function computeBlockStatuses(
  blocks: OrderedBlock[],
  completedBlockIds: ReadonlySet<string>,
): Map<string, BlockStatus> {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  const statuses = new Map<string, BlockStatus>();

  let prevCompleted = true; // the "block before the first" is treated as done
  for (const block of sorted) {
    const isCompleted = completedBlockIds.has(block.id);
    const unlocked = prevCompleted;

    let status: BlockStatus;
    if (isCompleted) {
      status = "COMPLETED";
    } else if (unlocked) {
      status = "IN_PROGRESS";
    } else {
      status = "LOCKED";
    }
    statuses.set(block.id, status);

    // The NEXT block unlocks only if THIS one is completed.
    prevCompleted = isCompleted;
  }

  return statuses;
}

/**
 * Resolve a single block's status without computing the whole level. Needs the
 * full ordered block list of the level (to find the predecessor) plus the
 * completed set.
 */
export function computeSingleBlockStatus(
  blockId: string,
  levelBlocks: OrderedBlock[],
  completedBlockIds: ReadonlySet<string>,
): BlockStatus {
  return computeBlockStatuses(levelBlocks, completedBlockIds).get(blockId) ?? "LOCKED";
}

/**
 * A block is COMPLETE when EVERY task in it is COMPLETED or SKIPPED.
 * An empty block (no tasks) is NOT considered complete (nothing to finish).
 */
export function isBlockComplete(taskStatuses: TaskStatus[]): boolean {
  if (taskStatuses.length === 0) {
    return false;
  }
  return taskStatuses.every((s) => s === "COMPLETED" || s === "SKIPPED");
}

/** Count of tasks in COMPLETED state (skipped does NOT count as completed). */
export function countCompletedTasks(taskStatuses: TaskStatus[]): number {
  return taskStatuses.filter((s) => s === "COMPLETED").length;
}
