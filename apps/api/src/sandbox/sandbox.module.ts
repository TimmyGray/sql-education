import { Module } from "@nestjs/common";
import { SandboxRunner } from "./sandbox-runner";
import { SqliteSandboxRunner } from "./sqlite-sandbox-runner";

/**
 * SandboxModule — provides the {@link SandboxRunner} abstraction bound to the
 * SQLite-backed {@link SqliteSandboxRunner}. Exported so GradingModule can inject
 * the abstract token without knowing the concrete implementation.
 */
@Module({
  providers: [
    {
      provide: SandboxRunner,
      useClass: SqliteSandboxRunner,
    },
  ],
  exports: [SandboxRunner],
})
export class SandboxModule {}
