import { TestAccountCleanupService } from "./test-account-cleanup.service";
import { PrismaService } from "../prisma/prisma.service";

describe("TestAccountCleanupService", () => {
  it("deletes test accounts whose testAccountExpiresAt has passed", async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = { user: { deleteMany } } as unknown as PrismaService;
    const service = new TestAccountCleanupService(prisma);

    await service.cleanupExpiredTestAccounts();

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        isTestAccount: true,
        testAccountExpiresAt: { lte: expect.any(Date) },
      },
    });
  });

  it("does nothing (no throw) when no accounts are expired", async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = { user: { deleteMany } } as unknown as PrismaService;
    const service = new TestAccountCleanupService(prisma);

    await expect(service.cleanupExpiredTestAccounts()).resolves.toBeUndefined();
  });
});
