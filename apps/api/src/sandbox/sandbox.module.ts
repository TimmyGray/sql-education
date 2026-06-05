import { Module } from "@nestjs/common";
import { PgSandboxRunner } from "./pg-sandbox-runner";
import { SandboxRunner } from "./sandbox-runner";

/**
 * SandboxModule — provides the {@link SandboxRunner} abstraction bound to the
 * `pg`-backed {@link PgSandboxRunner}. Exported so GradingModule can inject the
 * abstract token without knowing the concrete implementation.
 *
 * (ConfigService is available globally via the root ConfigModule.)
 */
@Module({
  providers: [
    {
      provide: SandboxRunner,
      useClass: PgSandboxRunner,
    },
  ],
  exports: [SandboxRunner],
})
export class SandboxModule {}
