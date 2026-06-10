import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";
import { TestAccountCleanupService } from "./test-account-cleanup.service";

/**
 * Authentication module.
 *
 * `JwtModule` is registered WITHOUT a global secret on purpose: access and
 * refresh tokens are signed with different secrets, so {@link TokenService}
 * passes the secret per `sign`/`verify` call.
 *
 * `RedisService` (RedisModule) and `MailService` (MailModule) are global, so
 * they're injectable here without importing those modules. PrismaService is
 * likewise global.
 *
 * NOTE: not registered in app.module here — the orchestrator imports
 * `AuthModule` at the app seam.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, TestAccountCleanupService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
