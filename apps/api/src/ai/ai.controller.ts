import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AiReply } from "@sql-edu/contracts";
import { ActiveUserGuard, CurrentUser, JwtAuthGuard } from "../common";
import { AiService } from "./ai.service";
import { AskDto } from "./dto/ask.dto";

/**
 * AI tutor controller — write action for the authenticated, ACTIVE user.
 * Asks a scoped question about a block; the service enforces the per-block
 * question quota and the answer-leakage guardrails.
 */
@ApiTags("ai")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard)
@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  /**
   * Ask the SQL tutor a question scoped to this block. Always returns HTTP 200
   * with `{ reply, refused, questionsRemaining }` — refusals (off-topic,
   * solution requests, quota exhausted, AI unconfigured) are conveyed via
   * `refused`, not error status codes. 404 only if the block doesn't exist.
   */
  @Post("blocks/:blockId/ask")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: "The tutor's reply plus remaining quota." })
  ask(
    @CurrentUser("userId") userId: string,
    @Param("blockId") blockId: string,
    @Body() body: AskDto,
  ): Promise<AiReply> {
    return this.ai.ask(userId, blockId, body.message);
  }
}
