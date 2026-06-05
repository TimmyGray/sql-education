/**
 * @sql-edu/contracts — shared Zod schemas + inferred TypeScript types.
 *
 * This is THE API contract. Consumed by both apps/api (Nest.js) and apps/web
 * (Next.js) via the workspace dependency "@sql-edu/contracts": "workspace:*".
 *
 * Domain enums here (Level, TaskStatus, BlockStatus, UserStatus, ComparisonMode)
 * are the single source of truth shared with Prisma — keep them in sync with
 * apps/api/prisma/schema.prisma.
 */

export * from "./common";
export * from "./auth";
export * from "./study";
export * from "./ai";
