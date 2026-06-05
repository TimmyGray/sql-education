import { Module } from "@nestjs/common";
import { ContentModule } from "../content/content.module";
import { GradingModule } from "../grading/grading.module";
import { StudyController } from "./study.controller";
import { StudyService } from "./study.service";

/**
 * StudyModule — submit/reveal endpoints and progression bookkeeping.
 *
 * Imports {@link GradingModule} (to grade submissions) and {@link ContentModule}
 * (to reuse per-user block-status resolution for lock enforcement). Prisma and
 * the auth guards come from their global modules.
 */
@Module({
  imports: [GradingModule, ContentModule],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
