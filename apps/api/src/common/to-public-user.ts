import type { User as PrismaUser } from "@prisma/client";
import type { User } from "@sql-edu/contracts";

/** Map a Prisma `User` row to the public {@link User} contract shape. */
export function toPublicUser(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    isTestAccount: user.isTestAccount,
    testAccountExpiresAt: user.testAccountExpiresAt?.toISOString() ?? null,
  };
}
