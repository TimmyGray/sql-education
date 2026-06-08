import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AiStreamEvent } from "@sql-edu/contracts";
import { ActiveUserGuard, CurrentUser, JwtAuthGuard } from "../common";
import { AiService } from "./ai.service";
import { AskDto } from "./dto/ask.dto";

interface HttpResponse {
  status(code: number): this;
  json(body: unknown): this;
  setHeader(name: string, value: string): this;
  write(chunk: string): boolean;
  end(): void;
}

/**
 * AI tutor controller — streams tokens via SSE.
 *
 * SSE events:
 *   { type: "token",  text }              — one or more per response
 *   { type: "done",   refused, questionsRemaining, reply }  — always last
 *   { type: "error",  message }           — on unrecoverable LLM failure
 *
 * HTTP 404 is returned as JSON when the block doesn't exist (before SSE
 * headers are sent). All other errors produce an "error" SSE event.
 */
@ApiTags("ai")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard)
@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("blocks/:blockId/ask/stream")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: "SSE stream of tutor tokens." })
  async streamAsk(
    @CurrentUser("userId") userId: string,
    @Param("blockId") blockId: string,
    @Body() body: AskDto,
    @Res() res: HttpResponse,
  ): Promise<void> {
    const gen = this.ai.askStream(userId, blockId, body.message);

    // Advance once before sending headers — lets NotFoundException produce a
    // proper 404 JSON response instead of an SSE error event.
    let first: IteratorResult<AiStreamEvent>;
    try {
      first = await gen.next();
    } catch (err) {
      if (err instanceof HttpException) {
        res.status(err.getStatus()).json(err.getResponse());
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const write = (event: AiStreamEvent) =>
      res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      if (!first.done) write(first.value);
      for await (const event of gen) write(event);
    } catch (err) {
      write({ type: "error", message: err instanceof Error ? err.message : "Stream error" });
    } finally {
      res.end();
    }
  }
}
