import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { User as PrismaUser } from "@prisma/client";
import type { UpdateProfile, User } from "@sql-edu/contracts";
import { PrismaService } from "../prisma/prisma.service";

/**
 * User profile operations. Kept separate from AuthService so the `/users`
 * surface can grow (avatar, preferences, ...) without bloating auth.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update the authenticated user's profile and return the mapped public User.
   *
   * `displayName` is optional in the DTO; when omitted the update is a no-op on
   * that field (Prisma ignores `undefined`), so the call still returns the
   * current profile.
   */
  async updateProfile(userId: string, dto: UpdateProfile): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: dto.displayName },
    });
    this.logger.log(`Updated profile for user ${userId}`);
    return this.toPublicUser(user);
  }

  /** Fetch the public profile for a user id. */
  async getProfile(userId: string): Promise<User> {
    this.logger.debug(`getProfile: ${userId}`);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.toPublicUser(user);
  }

  /** Map a Prisma user to the public {@link User} contract shape. */
  private toPublicUser(user: PrismaUser): User {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
