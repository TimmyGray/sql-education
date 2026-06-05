import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

/**
 * Users module. PrismaService is global, and the auth guards come from the
 * global CommonModule, so no extra imports are needed.
 *
 * NOTE: not registered in app.module here — the orchestrator imports
 * `UsersModule` at the app seam.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
