import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { AiStreamEvent } from "@sql-edu/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { LlmService } from "./llm.service";
import {
  buildUserPrompt,
  collectTaskTableNames,
  STREAMING_SYSTEM_PROMPT,
  type SafeBlock,
} from "./prompt";
import { sanitizeReply } from "./sanitize";
import {
  AI_QUESTIONS_PER_BLOCK,
  NOT_CONFIGURED_REPLY,
  QUOTA_EXCEEDED_REPLY,
} from "./refusals";

/**
 * SECURITY-CRITICAL Prisma selection for building the model context.
 * Explicitly omits Task.referenceQuery and Task.expectedResultJson so the
 * reference answer is structurally absent from everything sent to the LLM.
 * Exported so tests can assert the exact shape passed to Prisma.
 */
export const SAFE_BLOCK_SELECT = {
  title: true,
  theoryMarkdown: true,
  tasks: {
    orderBy: { order: "asc" as const },
    select: {
      order: true,
      prompt: true,
      hint: true,
      dataset: { select: { schemaJson: true } },
    },
  },
} as const;

const REFUSED_PREFIX = "REFUSED: ";

/**
 * Orchestrates a streaming tutoring turn:
 *   1. Not configured → done event with graceful refusal.
 *   2. Quota exhausted → done event with quota-exceeded message.
 *   3. Block not found → throws NotFoundException (controller handles 404).
 *   4. Streams tokens via LlmService.completeStream.
 *   5. LLM error → error event (no empty bubble).
 *   6. Strips REFUSED: prefix; runs sanitiser.
 *   7. Increments quota only when at least one token was received.
 *   8. Emits done event with final sanitised reply and questionsRemaining.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async *askStream(
    userId: string,
    blockId: string,
    message: string,
  ): AsyncGenerator<AiStreamEvent> {
    if (!this.llm.isConfigured()) {
      const used = await this.readQuestionsUsed(userId, blockId);
      yield {
        type: "done",
        refused: true,
        questionsRemaining: this.remaining(used),
        reply: NOT_CONFIGURED_REPLY,
      };
      return;
    }

    const used = await this.readQuestionsUsed(userId, blockId);
    if (used >= AI_QUESTIONS_PER_BLOCK) {
      yield {
        type: "done",
        refused: true,
        questionsRemaining: 0,
        reply: QUOTA_EXCEEDED_REPLY,
      };
      return;
    }

    const block = (await this.prisma.block.findUnique({
      where: { id: blockId },
      select: SAFE_BLOCK_SELECT,
    })) as SafeBlock | null;

    if (!block) {
      throw new NotFoundException("Block not found");
    }

    const system = STREAMING_SYSTEM_PROMPT;
    const userPrompt = buildUserPrompt(block, message);

    let accumulated = "";
    let tokenCount = 0;

    try {
      for await (const chunk of this.llm.completeStream(system, userPrompt)) {
        accumulated += chunk;
        tokenCount++;
        yield { type: "token", text: chunk };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "LLM unavailable";
      this.logger.error(`askStream: stream failed — ${msg}`);
      yield {
        type: "error",
        message: "The AI tutor is temporarily unavailable. Please try again.",
      };
      return;
    }

    const tableNames = collectTaskTableNames(block);

    let refused = false;
    let replyText = accumulated;
    if (accumulated.startsWith(REFUSED_PREFIX)) {
      refused = true;
      replyText = accumulated.slice(REFUSED_PREFIX.length);
    }

    const safe = sanitizeReply(replyText, tableNames, refused);

    let newUsed = used;
    if (tokenCount > 0) {
      newUsed = await this.incrementUsage(userId, blockId, used);
    }

    yield {
      type: "done",
      refused: safe.refused,
      questionsRemaining: this.remaining(newUsed),
      reply: safe.reply,
    };
  }

  private async readQuestionsUsed(userId: string, blockId: string): Promise<number> {
    const row = await this.prisma.userBlockAiUsage.findUnique({
      where: { userId_blockId: { userId, blockId } },
      select: { questionsUsed: true },
    });
    return row?.questionsUsed ?? 0;
  }

  private async incrementUsage(
    userId: string,
    blockId: string,
    currentUsed: number,
  ): Promise<number> {
    const row = await this.prisma.userBlockAiUsage.upsert({
      where: { userId_blockId: { userId, blockId } },
      create: { userId, blockId, questionsUsed: 1 },
      update: { questionsUsed: { increment: 1 } },
      select: { questionsUsed: true },
    });
    const persisted = row?.questionsUsed ?? currentUsed + 1;
    return Math.min(persisted, AI_QUESTIONS_PER_BLOCK);
  }

  private remaining(used: number): number {
    return Math.max(0, AI_QUESTIONS_PER_BLOCK - used);
  }
}
