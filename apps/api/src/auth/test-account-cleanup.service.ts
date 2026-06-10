import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Periodically deletes test accounts (`User.isTestAccount`) once their
 * `testAccountExpiresAt` has passed. `onDelete: Cascade` on the user's
 * relations (progress, XP, AI usage) means a single delete is enough.
 */
@Injectable()
export class TestAccountCleanupService {
  private readonly logger = new Logger(TestAccountCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredTestAccounts(): Promise<void> {
    const { count } = await this.prisma.user.deleteMany({
      where: {
        isTestAccount: true,
        testAccountExpiresAt: { lte: new Date() },
      },
    });
    if (count > 0) {
      this.logger.log(`Deleted ${count} expired test account(s)`);
    }
  }
}
