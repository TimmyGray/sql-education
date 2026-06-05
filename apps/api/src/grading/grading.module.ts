import { Module } from "@nestjs/common";
import { SandboxModule } from "../sandbox/sandbox.module";
import { GradingService } from "./grading.service";

/**
 * GradingModule — exposes {@link GradingService}, the safe grading pipeline
 * (forbidden guard → sandbox execution → result comparison).
 *
 * Imports {@link SandboxModule} for the {@link SandboxRunner} abstraction and
 * exports GradingService so StudyModule can grade submissions.
 */
@Module({
  imports: [SandboxModule],
  providers: [GradingService],
  exports: [GradingService],
})
export class GradingModule {}
