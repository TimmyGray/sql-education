import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { LlmService } from "./llm.service";

/**
 * AiModule — the SQL tutor endpoint (`POST /ai/blocks/:blockId/ask`).
 *
 * Wiring notes for the orchestrator (register once in AppModule.imports):
 *  - PrismaService is available globally (PrismaModule is @Global).
 *  - The auth guards (JwtAuthGuard/ActiveUserGuard) come from the global
 *    CommonModule.
 *  - ConfigService is available globally (ConfigModule isGlobal) and is what
 *    LlmService reads provider keys / model from.
 *
 * LlmService is the only network boundary and is the sole thing unit tests
 * mock; AiService orchestrates quota + guardrails around it.
 */
@Module({
  controllers: [AiController],
  providers: [AiService, LlmService],
  exports: [AiService],
})
export class AiModule {}
