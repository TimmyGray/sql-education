import { Module } from "@nestjs/common";
import { ContentController } from "./content.controller";
import { ContentService } from "./content.service";

/**
 * ContentModule — serves the per-user dashboard and block content.
 *
 * PrismaService is available globally (PrismaModule is @Global). The auth guards
 * come from the global CommonModule. ContentService is exported so StudyModule
 * can reuse its per-user lookups (completed blocks, block status).
 */
@Module({
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
