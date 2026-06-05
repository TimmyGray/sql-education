import { Body, Controller, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { User } from "@sql-edu/contracts";
import { ActiveUserGuard, CurrentUser, JwtAuthGuard } from "../common";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto";

/**
 * User profile endpoints. All routes require an authenticated, ACTIVE account
 * (`JwtAuthGuard` then `ActiveUserGuard`).
 */
@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Update the current user's profile (displayName). */
  @Patch("me")
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  updateMe(
    @CurrentUser("userId") userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<User> {
    return this.users.updateProfile(userId, dto);
  }
}
