import { z } from "zod";

/**
 * ---------------------------------------------------------------------------
 * Study contracts: levels, blocks, tasks, submissions, progress.
 *
 * The core domain enums live here (they are the single source of truth shared
 * with Prisma — keep in sync with apps/api/prisma/schema.prisma).
 * ---------------------------------------------------------------------------
 */

export const LevelSchema = z.enum(["NOVICE", "JUNIOR", "MIDDLE"]);
export type Level = z.infer<typeof LevelSchema>;

export const TaskStatusSchema = z.enum(["NOT_STARTED", "COMPLETED", "SKIPPED"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const BlockStatusSchema = z.enum(["LOCKED", "IN_PROGRESS", "COMPLETED"]);
export type BlockStatus = z.infer<typeof BlockStatusSchema>;

/**
 * One column of a dataset table, as exposed to the user so they know what they
 * can query.
 */
export const DatasetColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
});
export type DatasetColumn = z.infer<typeof DatasetColumnSchema>;

/** One table available to the user for a task. */
export const DatasetTableSchema = z.object({
  tableName: z.string(),
  columns: z.array(DatasetColumnSchema),
});
export type DatasetTable = z.infer<typeof DatasetTableSchema>;

/**
 * Public, USER-SAFE view of a task.
 *
 * SECURITY: this intentionally OMITS `referenceQuery` and `expectedResultJson`.
 * Never widen this schema to include them — the reference query is only
 * revealed via the dedicated reveal endpoint. `datasetSchema` describes the
 * tables the user can query.
 */
export const TaskPublicSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  prompt: z.string(),
  hint: z.string(),
  status: TaskStatusSchema,
  attempts: z.number().int(),
  datasetSchema: z.array(DatasetTableSchema),
});
export type TaskPublic = z.infer<typeof TaskPublicSchema>;

/**
 * Summary of a block as shown on the dashboard / level overview.
 */
export const BlockSummarySchema = z.object({
  id: z.string(),
  level: LevelSchema,
  order: z.number().int(),
  title: z.string(),
  status: BlockStatusSchema,
  totalTasks: z.number().int(),
  completedTasks: z.number().int(),
});
export type BlockSummary = z.infer<typeof BlockSummarySchema>;

/**
 * Full content payload for studying a single block: theory + the public tasks
 * + the user's remaining AI question quota for this block.
 */
export const BlockContentSchema = z.object({
  id: z.string(),
  level: LevelSchema,
  order: z.number().int(),
  title: z.string(),
  theoryMarkdown: z.string(),
  theoryExamples: z.array(z.any()).optional(),
  status: BlockStatusSchema,
  tasks: z.array(TaskPublicSchema),
  aiQuestionsRemaining: z.number().int(),
});
export type BlockContent = z.infer<typeof BlockContentSchema>;

/**
 * Submit an answer for grading. The task is identified by the route param; the
 * body carries only the SQL.
 */
export const SubmitAnswerSchema = z.object({
  sql: z.string().min(1).max(10000),
});
export type SubmitAnswer = z.infer<typeof SubmitAnswerSchema>;

/**
 * Result of grading a submitted answer.
 *
 * `columns`/`rows` reflect what the USER's query produced (for display only —
 * never the expected result). `errorType` is present when grading failed for a
 * specific reason.
 */
export const SubmitResultSchema = z.object({
  correct: z.boolean(),
  status: TaskStatusSchema,
  message: z.string(),
  columns: z.array(z.string()).optional(),
  rows: z.array(z.array(z.any())).optional(),
  errorType: z
    .enum(["SYNTAX", "TIMEOUT", "FORBIDDEN", "WRONG_RESULT", "RUNTIME"])
    .optional(),
});
export type SubmitResult = z.infer<typeof SubmitResultSchema>;

/**
 * Returned when a user reveals the reference answer (which also moves the task
 * to its resulting status).
 */
export const RevealResultSchema = z.object({
  referenceQuery: z.string(),
  status: TaskStatusSchema,
});
export type RevealResult = z.infer<typeof RevealResultSchema>;

/**
 * Per-level progress: XP plus the block summaries for that level.
 */
export const LevelProgressSchema = z.object({
  level: LevelSchema,
  xp: z.number().int(),
  blocks: z.array(BlockSummarySchema),
});
export type LevelProgress = z.infer<typeof LevelProgressSchema>;

/**
 * Dashboard payload: progress across every level.
 */
export const DashboardSchema = z.object({
  levels: z.array(LevelProgressSchema),
});
export type Dashboard = z.infer<typeof DashboardSchema>;
