import { Global, Module } from "@nestjs/common";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { ActiveUserGuard } from "./auth/active-user.guard";

/**
 * Global module exposing the shared auth guards so any feature module can apply
 * them with `@UseGuards(JwtAuthGuard, ActiveUserGuard)` without re-providing.
 * Registered once in `AppModule` by the orchestrator.
 */
@Global()
@Module({
  providers: [JwtAuthGuard, ActiveUserGuard],
  exports: [JwtAuthGuard, ActiveUserGuard],
})
export class CommonModule {}
