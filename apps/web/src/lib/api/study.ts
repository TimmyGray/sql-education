/**
 * Typed API wrappers for the study domain (dashboard, block content,
 * submissions, reveal).
 *
 * These are thin helpers over the foundation's `request<T>()` (from
 * "@/lib/api-client"), which already attaches the in-memory Bearer token and
 * (in the auth wave) handles 401 → refresh → retry. We pin each call to the
 * matching `@sql-edu/contracts` type and validate the response with the Zod
 * schema where practical so a malformed payload fails loudly at the boundary.
 */
import {
  DashboardSchema,
  BlockContentSchema,
  SubmitResultSchema,
  RevealResultSchema,
  type Dashboard,
  type BlockContent,
  type SubmitResult,
  type RevealResult,
} from "@sql-edu/contracts";
import { request } from "@/lib/api-client";

/** GET /content/dashboard → the per-user dashboard across all levels. */
export async function getDashboard(): Promise<Dashboard> {
  const data = await request<Dashboard>("/content/dashboard");
  return DashboardSchema.parse(data);
}

/** GET /content/blocks/:blockId → full block content (403 if LOCKED). */
export async function getBlock(blockId: string): Promise<BlockContent> {
  const data = await request<BlockContent>(
    `/content/blocks/${encodeURIComponent(blockId)}`,
  );
  return BlockContentSchema.parse(data);
}

/** POST /study/tasks/:taskId/submit → grade the submitted SQL. */
export async function submitAnswer(
  taskId: string,
  sql: string,
): Promise<SubmitResult> {
  const data = await request<SubmitResult>(
    `/study/tasks/${encodeURIComponent(taskId)}/submit`,
    { method: "POST", json: { sql } },
  );
  return SubmitResultSchema.parse(data);
}

/**
 * POST /study/tasks/:taskId/reveal → reveal the reference query (also marks the
 * task SKIPPED unless it was already COMPLETED).
 */
export async function reveal(taskId: string): Promise<RevealResult> {
  const data = await request<RevealResult>(
    `/study/tasks/${encodeURIComponent(taskId)}/reveal`,
    { method: "POST" },
  );
  return RevealResultSchema.parse(data);
}
