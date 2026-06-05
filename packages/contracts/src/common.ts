import { z } from "zod";

/**
 * Shared primitives that are not specific to auth/study/ai.
 *
 * The core domain enums (Level, TaskStatus, BlockStatus) live in `study.ts`
 * because that is where the foundation contract groups them. `UserStatus`
 * lives in `auth.ts`. These MUST stay in sync with the Prisma schema
 * (apps/api/prisma/schema.prisma).
 */

/** Comparison mode used by the grader (mirrors Prisma `ComparisonMode`). */
export const ComparisonModeSchema = z.enum(["ORDERED", "UNORDERED"]);
export type ComparisonMode = z.infer<typeof ComparisonModeSchema>;

/**
 * Generic API error payload shape (what the Nest exception filter returns on
 * failures). Available for clients that want to narrow error bodies.
 */
export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
